import express from "express";
import cors from "cors";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.post("/api/chat", async (req, res) => {
  const { message, messages = [], provider = "auto", system = "" } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Enter a message." });
  }
  let history = Array.isArray(messages)
    ? messages.filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string").slice(-30)
    : [{ role: "user", content: message }];
  // Gemini conversation history must begin with a user message.
  while (history.length && history[0].role === "assistant") history.shift();
  if (!history.length) history = [{ role: "user", content: message }];
  const prompt = `${system}

Conversation history follows. Answer the latest user message. Do not claim to have performed actions you did not perform.`;

  async function useOllama() {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen3.5:4b",
        stream: false,
        messages: [{ role: "system", content: prompt }, ...history],
      }),
    });
    if (!response.ok) throw new Error("Ollama request failed. Make sure Ollama is running and qwen3.5:4b is installed.");
    const data = await response.json();
    return { reply: data.message?.content ?? "No response received from Ollama.", provider: "Ollama" };
  }

  async function useGemini() {
    if (!ai) throw new Error("Gemini API key is missing. Add GEMINI_API_KEY to your .env file and restart the backend.");
    const contents = history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    }));
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      contents,
      config: { systemInstruction: prompt },
    });
    return { reply: result.text || "No response received from Gemini.", provider: "Gemini" };
  }

  try {
    let result;
    if (provider === "ollama") {
      result = await useOllama();
    } else if (provider === "gemini") {
      result = await useGemini();
    } else {
      try { result = await useGemini(); }
      catch (cloudError) {
        console.warn("Gemini unavailable; trying local Ollama:", cloudError.message);
        result = await useOllama();
      }
    }
    res.json(result);
  } catch (error) {
    console.error("JARVIS API error:", error.message);
    res.status(502).json({ error: error.message || "AI request failed." });
  }
});

app.listen(3001, () => console.log("JARVIS backend running at http://localhost:3001"));
