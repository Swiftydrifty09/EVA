import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getAIResponse(messages) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const reply = response.choices[0].message.content;
    return reply;

  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
}