const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(__dirname, "..", ".jarvis-memory.json");
const DEFAULT_SESSION = "default";

function ensureFile() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      fs.writeFileSync(MEMORY_FILE, JSON.stringify({}, null, 2));
    }
  } catch (error) {
    console.warn("Memory store unavailable:", error.message);
  }
}

function readStore() {
  ensureFile();
  try {
    const raw = fs.readFileSync(MEMORY_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Unable to read memory store:", error.message);
    return {};
  }
}

function writeStore(store) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.warn("Unable to write memory store:", error.message);
  }
}

function getMemory(sessionId = DEFAULT_SESSION) {
  const store = readStore();
  const items = Array.isArray(store[sessionId]) ? store[sessionId] : [];
  return items.slice(-20);
}

function addToMemory(sessionId = DEFAULT_SESSION, entry) {
  if (!entry || typeof entry !== "object") return [];

  const store = readStore();
  const existing = Array.isArray(store[sessionId]) ? store[sessionId] : [];
  const next = [...existing, { ...entry }].slice(-20);
  store[sessionId] = next;
  writeStore(store);
  return next;
}

function clearMemory(sessionId = DEFAULT_SESSION) {
  const store = readStore();
  delete store[sessionId];
  writeStore(store);
  return [];
}

module.exports = {
  getMemory,
  addToMemory,
  clearMemory
};