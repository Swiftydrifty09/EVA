import { handleUserMessage } from "../core/aiEngine.js";

export async function chatHandler(req, res) {
  try {
    const { message, userId } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = await handleUserMessage(userId, message);

    let fullResponse = "";

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";

      if (text) {
        fullResponse += text;
        res.write(`data: ${text}\n\n`);
      }
    }

    // End signal (CRITICAL)
    res.write(`data: [DONE]\n\n`);
    res.end();

  } catch (err) {
    console.error(err);
    res.write(`data: ERROR\n\n`);
    res.end();
  }
}