const fs = require("fs");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const OpenAI = require("openai");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const app = express();
app.use(express.json({ limit: "64kb" }));

app.get("/", (req, res) => {
  res.sendFile(path.join(rootDir, "public", "index.html"));
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(rootDir, "public", "style.css"));
});

app.get("/main.js", (req, res) => {
  res.sendFile(path.join(rootDir, "public", "main.js"));
});

app.use(express.static(path.join(rootDir, "public")));
app.use(express.static(rootDir));

function parseCalculation(expression) {
  const sanitized = expression.replace(/\s+/g, "");
  const tokens = sanitized.match(/\d*\.?\d+|[()+\-*/%]/g);

  if (!tokens || tokens.join("") !== sanitized) {
    throw new Error("Invalid calculation");
  }

  let index = 0;

  function parseExpression() {
    let value = parseTerm();
    while (index < tokens.length && ["+", "-"].includes(tokens[index])) {
      const operator = tokens[index++];
      const next = parseTerm();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (index < tokens.length && ["*", "/", "%"].includes(tokens[index])) {
      const operator = tokens[index++];
      const next = parseFactor();
      if ((operator === "/" || operator === "%") && next === 0) {
        throw new Error("Cannot divide by zero");
      }
      value = operator === "*" ? value * next : operator === "/" ? value / next : value % next;
    }
    return value;
  }

  function parseFactor() {
    const token = tokens[index++];
    if (token === "(") {
      const value = parseExpression();
      if (tokens[index++] !== ")") {
        throw new Error("Unclosed parenthesis");
      }
      return value;
    }
    if (token === "+") return parseFactor();
    if (token === "-") return -parseFactor();

    const value = Number(token);
    if (!Number.isFinite(value)) {
      throw new Error("Expected a number");
    }
    return value;
  }

  const result = parseExpression();
  if (index !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Invalid calculation");
  }
  return Number(result.toPrecision(12));
}

function generateLocalReply(message) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return "I need a message to answer.";

  if (/\b(hello|hi|hey)\b/.test(normalized)) {
    return "Hello. All local systems are ready.";
  }

  if (/\b(time|clock)\b/.test(normalized)) {
    return `The local time is ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}.`;
  }

  if (/\b(date|day|today)\b/.test(normalized)) {
    return `Today is ${new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
  }

  if (/\b(joke|make me laugh)\b/.test(normalized)) {
    return "I told my computer I needed a break. It said: 'No problem, I'll go to sleep.'";
  }

  if (/\b(who are you|your name)\b/.test(normalized)) {
    return "I am JARVIS, your local assistant. I can handle a few useful commands without connecting to an AI service.";
  }

  if (/\b(help|commands|what can you do)\b/.test(normalized)) {
    return "Try: 'What time is it?', 'What is 24 * (3 + 2)?', 'Tell me a joke', 'Search for space news', or 'Open YouTube'.";
  }

  if (/\b(clear|clear chat|clear conversation)\b/.test(normalized)) {
    return "Conversation cleared.";
  }

  const calculation = normalized.match(/^(?:calculate|what is|compute)\s+(.+?)[?!.]*$/);
  if (calculation) {
    try {
      return `${calculation[1]} = ${parseCalculation(calculation[1])}`;
    } catch (error) {
      return `I could not calculate that: ${error.message}.`;
    }
  }

  const search = normalized.match(/^(?:search(?: the web)? for|look up)\s+(.+)$/);
  if (search) {
    return `Searching the web for “${search[1]}”.`;
  }

  const open = normalized.match(/^open\s+(google|youtube|wikipedia|maps)$/);
  if (open) {
    return `Opening ${open[1]}.`;
  }

  return "I am running without an AI service, so I cannot answer open-ended questions yet. I can tell the time or date, calculate expressions, tell a joke, and open or search the web. Say 'help' for examples.";
}

const systemPrompt = "You are JARVIS, a concise, capable personal assistant. Keep answers direct and helpful.";

function getConversationMessages(history, message) {
  const messages = Array.isArray(history)
    ? history
        .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
        .slice(-20)
        .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 2000) }))
        .filter((item) => item.content)
    : [];

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || last.content !== message) {
    messages.push({ role: "user", content: message });
  }

  return [{ role: "system", content: systemPrompt }, ...messages];
}

async function askOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai.");
  }

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages
  });

  return completion.choices?.[0]?.message?.content?.trim();
}

async function askOllama(messages) {
  const response = await fetch(process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "jarvis-tech/Jarvis_Distilled_v1:latest",
      messages,
      stream: false
    }),
    signal: AbortSignal.timeout(120_000)
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}. Check that Ollama is running and the model is installed.`);
  }

  const result = await response.json();
  const reply = result.message?.content?.trim();
  if (!reply) {
    throw new Error("Ollama returned an empty response.");
  }
  return reply;
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code) => {
      if (code[0] === "#") {
        const number = code[1].toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
        return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
          ? String.fromCodePoint(number)
          : entity;
      }

      return {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: "\"",
        apos: "'"
      }[code.toLowerCase()];
    })
    .trim();
}

function readFeedItems(xml, feedName) {
  return Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi))
    .map(([, item]) => {
      const title = item.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
      const link = item.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1];
      const publisher = item.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i)?.[1];
      const published = item.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1];
      if (!title || !link) return null;

      const url = decodeXml(link);
      if (!/^https:\/\//i.test(url)) return null;
      const date = published ? new Date(decodeXml(published)) : null;
      return {
        title: decodeXml(title),
        url,
        source: publisher ? decodeXml(publisher) : feedName,
        publishedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null
      };
    })
    .filter((item) => item && item.title);
}

app.get("/api/news", async (req, res) => {
  const feeds = [
    { name: "Google News · United States", region: "us", url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en" },
    { name: "NPR · Top Stories", region: "us", url: "https://feeds.npr.org/1001/rss.xml" },
    { name: "The Guardian · U.S.", region: "us", url: "https://www.theguardian.com/us-news/rss" },
    { name: "Google News · World", region: "world", url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en" },
    { name: "BBC News · World", region: "world", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { name: "The Guardian · World", region: "world", url: "https://www.theguardian.com/world/rss" }
  ];

  const results = await Promise.all(feeds.map(async (feed) => {
    try {
      const response = await fetch(feed.url, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}.`);
      const headlines = readFeedItems(await response.text(), feed.name)
        .map((headline) => ({ ...headline, region: feed.region }));
      return { name: feed.name, headlines };
    } catch (error) {
      console.error(`News feed error (${feed.name}):`, error.message);
      return { name: feed.name, headlines: [] };
    }
  }));

  const seen = new Set();
  const headlines = results
    .flatMap((result) => result.headlines)
    .filter((headline) => {
      const normalizedTitle = headline.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (seen.has(normalizedTitle)) return false;
      seen.add(normalizedTitle);
      return true;
    })
    .sort((left, right) =>
      (left.region === right.region ? 0 : left.region === "us" ? -1 : 1) ||
      new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0))
    .slice(0, 12);
  const availableSources = results.filter((result) => result.headlines.length > 0).map((result) => result.name);

  if (headlines.length === 0) {
    return res.status(502).json({ error: "News feeds are unavailable right now. Please try again shortly." });
  }

  res.set("Cache-Control", "public, max-age=300");
  res.json({ source: "U.S. and world news", sources: availableSources, headlines });
});

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const messages = getConversationMessages(req.body?.history, message);
  const provider = process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "local");

  try {
    let reply;
    if (provider === "ollama") {
      reply = await askOllama(messages);
    } else if (provider === "openai") {
      reply = await askOpenAI(messages);
    } else if (provider === "local") {
      reply = generateLocalReply(message);
    } else {
      throw new Error(`Unsupported AI_PROVIDER: ${provider}. Use ollama, openai, or local.`);
    }

    if (!reply) {
      throw new Error(`${provider} returned an empty response.`);
    }
    res.json({ reply, provider });
  } catch (error) {
    console.error(`${provider} error:`, error.message);
    res.json({
      reply: generateLocalReply(message),
      provider: "local",
      warning: `${provider} is unavailable; using local commands instead. ${error.message}`
    });
  }
});

function startServer(port, attempts = 0) {
  const server = app.listen(port, () => {
    console.log(`JARVIS running on port ${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      server.close(() => {
        if (attempts >= 20) {
          console.error(`Unable to find a free port after trying ${port}.`);
          process.exit(1);
        }

        const nextPort = port + 1;
        console.warn(`Port ${port} is busy; retrying on ${nextPort}`);
        startServer(nextPort, attempts + 1);
      });
      return;
    }

    console.error("Server failed to start:", error);
    process.exit(1);
  });
}

const preferredPort = Number(process.env.PORT) || 3100;
startServer(preferredPort);