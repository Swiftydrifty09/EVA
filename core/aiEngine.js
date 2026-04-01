import { getChatCompletionStream } from "../services/openaiService.js";
import { getMemory, saveMemory } from "../services/memoryService.js";

export async function handleUserMessage(userId, message) {
  // 1. Load memory/context
  const memory = await getMemory(userId);

  // 2. Build context
  const messages = [
    { role: "system", content: "You are JARVIS, a highly intelligent AI assistant." },
    ...memory,
    { role: "user", content: message }
  ];

  // 3. Stream response
  const stream = await getChatCompletionStream(messages);

  // 4. Save interaction (async)
  saveMemory(userId, { role: "user", content: message });
  
  return stream;
}