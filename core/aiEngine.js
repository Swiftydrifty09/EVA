import { getChatCompletionStream } from "../services/openaiService.js";
import { getMemory, saveMemory } from "../services/memoryService.js";

export async function handleUserMessage(userId, message) {
  const memory = await getMemory(userId);

  const messages = [
    {
      role: "system",
      content: `
You are EVA (Enhanced Virtual Intelligence & Assistance).
Respond clearly, directly, and intelligently.
Always answer the user's question.
Never stall or say you are "learning".
      `.trim()
    },
    ...memory,
    { role: "user", content: message }
  ];

  const stream = await getChatCompletionStream(messages);

  // Wrap stream so we can capture response
  async function* streamWrapper() {
    let fullResponse = "";

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";

      if (text) {
        fullResponse += text;
        yield chunk;
      }
    }

    // Save BOTH sides
    await saveMemory(userId, { role: "user", content: message });
    await saveMemory(userId, { role: "assistant", content: fullResponse });
  }

  return streamWrapper();
}