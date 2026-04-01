import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function getChatCompletionStream(messages) {
  const stream = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    stream: true
  });

  return stream;
}