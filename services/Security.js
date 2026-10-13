"use strict";

/**
 * EVA security helpers. Built-in Node modules only, so there is nothing new to install.
 *
 *  - Access-token authentication (cookie for the browser UI, Bearer header for scripts)
 *  - Fixed-window, in-memory rate limiting
 *  - A protected-file list for the Build workspace
 *  - JSON error handling that never leaks stack traces
 *  - Provider error messages that never leak upstream details
 */

const crypto = require("node:crypto");

const COOKIE_NAME = "eva_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MIN_TOKEN_LENGTH = 24;

// Files the AI may read but not propose changes to. Lower-case, forward slashes.
const PROTECTED_BUILD_FILES = new Set([
  "package.json",
  "package-lock.json",
  "services/server.js",
  "services/security.js"
]);
const PROTECTED_BUILD_PREFIXES = ["services/tools"];

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

/** Constant-time comparison that is safe for inputs of different lengths. */
function safeEqual(left, right) {
  return crypto.timingSafeEqual(sha256(left), sha256(right));
}

function sessionValueFor(token) {
  return crypto.createHmac("sha256", token).update("eva-session-v1").digest("hex");
}

function parseCookies(header) {
  const cookies = Object.create(null);
  if (typeof header !== "string") return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (!(name in cookies)) cookies[name] = part.slice(index + 1).trim();
  }
  return cookies;
}

function extractBearer(req) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization || "");
  return match ? match[1].trim() : "";
}

function isSecureRequest(req) {
  const forwarded = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  return Boolean(req.secure) || forwarded === "https";
}

function buildCookie(value, { maxAge, secure }) {
  const parts = [`${COOKIE_NAME}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Reads the security settings from the environment and refuses unsafe combinations.
 * Throws at startup so a misconfiguration is caught immediately, not in production.
 */
function resolveSecurityConfig(env, { isLoopback }) {
  const token = String(env.EVA_ACCESS_TOKEN || "").trim();

  if (token && token.length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `EVA_ACCESS_TOKEN must be at least ${MIN_TOKEN_LENGTH} characters. Generate one with: ` +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  const allowUnauthenticated = env.EVA_ALLOW_UNAUTHENTICATED === "true";
  if (!isLoopback && !token && !allowUnauthenticated) {
    throw new Error(
      "HOST is not a loopback address, so EVA's APIs would be open to anyone who can reach the port. " +
        "Set EVA_ACCESS_TOKEN in .env, or set EVA_ALLOW_UNAUTHENTICATED=true to accept that risk."
    );
  }

  return { token, required: Boolean(token), allowUnauthenticated };
}

/** Fixed-window limiter keyed by client address. */
function createRateLimiter({ windowMs, max, message = "Too many requests. Please slow down.", now = Date.now }) {
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const current = now();

    if (buckets.size > 1000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= current) buckets.delete(bucketKey);
      }
    }

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - current) / 1000))));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

/** Throws if the Build workspace is not allowed to propose or apply changes to this file. */
function assertBuildWritable(relativePath, env = process.env) {
  if (env.EVA_BUILD_ALLOW_PROTECTED === "true") return;
  const normalized = String(relativePath).replace(/\\/g, "/").toLowerCase();
  const isProtected =
    PROTECTED_BUILD_FILES.has(normalized) ||
    PROTECTED_BUILD_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  if (isProtected) {
    throw new Error(
      `${relativePath} is protected and cannot be changed through Build. Edit it by hand, ` +
        "or set EVA_BUILD_ALLOW_PROTECTED=true if you accept that risk."
    );
  }
}

/**
 * Turns an error into text that is safe to show in the browser.
 * Errors that carry an HTTP status, a network code, or a cause come from a provider or the
 * network and may contain internal addresses or key hints, so they are replaced with a generic
 * message. EVA's own validation errors pass through unchanged.
 */
function publicErrorMessage(error) {
  if (!error) return "Unknown error.";
  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return "The AI provider timed out.";
  }
  const status = error.status || error.statusCode;
  if (status === 401 || status === 403) return "The AI provider rejected the request credentials.";
  if (status === 429) return "The AI provider rate limit was reached.";
  const looksUpstream =
    typeof status === "number" ||
    Boolean(error.cause) ||
    /^E[A-Z0-9_]+$/.test(String(error.code || "")) ||
    error.message === "fetch failed";
  if (looksUpstream) return "The AI provider could not be reached or returned an error.";
  return String(error.message || "Unknown error.").slice(0, 300);
}

/** Express error middleware (four arguments are required). */
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }

  console.error("Unhandled server error:", error?.message || error);
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  return res.status(status).json({
    error: status === 500 ? "Internal server error." : "The request could not be processed."
  });
}

function apiNotFound(req, res) {
  res.status(404).json({ error: "Not found." });
}

function createSecurity(config) {
  const { token, required } = config;
  const expectedSession = required ? sessionValueFor(token) : "";

  function isAuthenticated(req) {
    const bearer = extractBearer(req);
    if (bearer && safeEqual(bearer, token)) return true;
    const session = parseCookies(req.headers?.cookie)[COOKIE_NAME];
    return Boolean(session) && safeEqual(session, expectedSession);
  }

  function requireAuth(req, res, next) {
    if (!required || isAuthenticated(req)) return next();
    res.set("Cache-Control", "no-store");
    return res.status(401).json({ error: "Authentication required." });
  }

  /** Handles GET /eva-login?token=... and GET /eva-logout. */
  function authRoutes(req, res, next) {
    if (req.method !== "GET") return next();

    if (req.path === "/eva-login") {
      res.set("Cache-Control", "no-store");
      if (!required) return res.redirect(302, "/");
      const supplied = typeof req.query?.token === "string" ? req.query.token : "";
      if (!safeEqual(supplied, token)) {
        return res.status(401).set("Content-Type", "text/plain; charset=utf-8").send("Invalid access token.");
      }
      res.setHeader("Set-Cookie", buildCookie(expectedSession, { maxAge: COOKIE_MAX_AGE_SECONDS, secure: isSecureRequest(req) }));
      return res.redirect(302, "/");
    }

    if (req.path === "/eva-logout") {
      res.set("Cache-Control", "no-store");
      res.setHeader("Set-Cookie", buildCookie("", { maxAge: 0, secure: isSecureRequest(req) }));
      return res.redirect(302, "/");
    }

    return next();
  }

  return {
    requireAuth,
    authRoutes,
    apiNotFound,
    errorHandler,
    limits: {
      general: createRateLimiter({ windowMs: 60_000, max: 600 }),
      chat: createRateLimiter({ windowMs: 60_000, max: 30 }),
      suggest: createRateLimiter({ windowMs: 60_000, max: 10 }),
      apply: createRateLimiter({ windowMs: 60_000, max: 30 }),
      auth: createRateLimiter({ windowMs: 60_000, max: 10, message: "Too many login attempts. Try again shortly." })
    }
  };
}

module.exports = {
  COOKIE_NAME,
  apiNotFound,
  assertBuildWritable,
  createRateLimiter,
  createSecurity,
  errorHandler,
  parseCookies,
  publicErrorMessage,
  resolveSecurityConfig,
  safeEqual
};