const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const { after, before, test } = require("node:test");

process.env.AI_PROVIDER = "local";
process.env.HOST = "127.0.0.1";

const { app, parseCalculation, readResponseTextLimited, resolveBuildFile } = require("../services/server");
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("local calculations handle precedence and reject unsafe boundaries", () => {
  assert.equal(parseCalculation("24 * (3 + 2)"), 120);
  assert.throws(() => parseCalculation("1 / 0"), /divide by zero/i);
  assert.throws(() => parseCalculation("1+".repeat(140)), /256 characters or fewer/i);
  assert.throws(() => parseCalculation("1+".repeat(70) + "1"), /Invalid calculation/i);
});

test("build workspace paths remain allowlisted and traversal-safe", () => {
  assert.equal(resolveBuildFile("package.json").relativePath, "package.json");
  assert.throws(() => resolveBuildFile("../package.json"), /not allowed/i);
  assert.throws(() => resolveBuildFile("public/../../.env"), /not allowed/i);
  assert.throws(() => resolveBuildFile(".env"), /not allowed/i);
});

test("upstream response reader enforces byte limits while streaming", async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("first"));
      controller.enqueue(new TextEncoder().encode("second"));
      controller.close();
    }
  }));
  await assert.rejects(readResponseTextLimited(response, 8), /size limit/i);
  assert.equal(await readResponseTextLimited(new Response("safe"), 10), "safe");
});

test("server applies browser hardening headers and serves only the app shell", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-powered-by"), null);

  const rootFile = await fetch(`${baseUrl}/package.json`);
  assert.equal(rootFile.status, 404);
});

test("local host validation rejects DNS-rebinding host headers", async () => {
  const { port } = server.address();
  const statusCode = await new Promise((resolve, reject) => {
    const request = http.get({
      hostname: "127.0.0.1",
      port,
      headers: { Host: "attacker.example" }
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
  });
  assert.equal(statusCode, 403);
});

test("local chat accepts bounded requests and rejects oversized messages", async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Calculate 2 + 2" })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, "2 + 2 = 4");

  const atLimit = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "x".repeat(8000) })
  });
  assert.equal(atLimit.status, 200);

  const oversized = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "x".repeat(8001) })
  });
  assert.equal(oversized.status, 413);
});
