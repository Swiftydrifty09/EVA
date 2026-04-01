const conversations = new Map();

export function getMemory(sessionId) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }
  return conversations.get(sessionId);
}

export function addToMemory(sessionId, role, content) {
  const memory = getMemory(sessionId);
  memory.push({ role, content });

  // Limit memory size (prevents overload)
  if (memory.length > 20) {
    memory.shift();
  }
}