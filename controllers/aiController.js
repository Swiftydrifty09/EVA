import { handleUserMessage } from "../core/aiEngine.js";

export async function chatHandler(req, res) {
  const { message, userId } = req.body;

  const stream = await handleUserMessage(userId, message);

  res.setHeader("Content-Type", "text/event-stream");

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    res.write(`data: ${text}\n\n`);
  }

  res.end();
}