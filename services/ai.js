const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getAIResponse(messages, res) {
  try {
    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;

      if (content) {
        fullResponse += content;

        // CRITICAL: stream to client
        res.write(content);
      }
    }

    // finalize
    res.end();

    return fullResponse;

  } catch (err) {
    console.error("AI ERROR:", err);
    res.write("\n[AI ERROR]");
    res.end();
  }
}

module.exports = { getAIResponse };