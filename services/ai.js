import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function getAIResponse(messages) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini", // fast + capable
    messages,
    temperature: 0.4 // lower = more precise, higher = more creative
  });

  return response.choices[0].message.content;
}