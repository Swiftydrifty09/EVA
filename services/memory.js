import fs from "fs";

const DB_FILE = "./memory.json";

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export async function getMemory(userId) {
  const db = loadDB();
  return db[userId] || [];
}

export async function saveMemory(userId, message) {
  const db = loadDB();

  if (!db[userId]) db[userId] = [];

  db[userId].push(message);

  // Optional: limit memory size
  db[userId] = db[userId].slice(-20);

  saveDB(db);
}