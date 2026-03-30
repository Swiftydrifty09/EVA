import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd())));

const PORT = process.env.PORT || 3000;

app.post("/api/chat", async (req, res) => {
    const userMessage = req.body.message;

    // If API key is placeholder, not set, or clearly invalid, use mock response
    const key = process.env.OPENAI_API_KEY || '';
    if (!key.startsWith('sk-')) {
        const mockReply = `I understand you're asking about "${userMessage}". As JARVIS, I'm here to assist you with any questions or tasks. Please set OPENAI_API_KEY=sk-... in .env to enable full AI capabilities. For now, I can handle basic built-in commands.`;
        return res.json({ reply: mockReply });
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are JARVIS, an advanced AI assistant.\n\nPERSONALITY:\nCalm, composed, highly intelligent. Professional tone with subtle dry wit. Polite and respectful, never overly casual or emotional.\n\nTHINKING:\nThink like a strategist and systems architect. Prioritize clarity, logic, and efficiency. Base all responses on sound reasoning. If uncertain, state it clearly rather than guessing.\n\nREASONING:\nEnsure every response follows a logical flow. Do not jump between ideas without connection. Build answers step-by-step when needed, and ensure conclusions follow clearly from the explanation.\n\nCOMMUNICATION:\nBe clear, direct, and concise. Avoid unnecessary words, repetition, or filler. Every sentence must add value. Use structure only when it improves understanding.\n\nBEHAVIOR:\nProvide recommendations, not just answers. Highlight risks, trade-offs, and alternatives when relevant. Avoid fabrication. Do not introduce irrelevant information.\n\nCOHERENCE:\nStay tightly focused on the user's question. Do not drift off-topic. Ensure responses are internally consistent and easy to follow.\n\nINTERACTION:\nAddress the user as 'sir' naturally. Maintain a helpful, advisor-like presence. Be proactive without being intrusive.\n\nGOAL:\nDeliver responses that are intelligent, logically sound, clear, and immediately useful." },
                    { role: "user", content: userMessage }
                ]
            })
        });

        const data = await response.json();
        const reply = data.choices[0].message.content;

        res.json({ reply });

    } catch (error) {
        res.status(500).json({ error: "AI request failed" });
    }
});

app.listen(PORT, () => {
    console.log(`JARVIS running on port ${PORT}`);
});