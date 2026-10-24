
const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL = "qwen3.5:4b";

export async function askOllama(messages) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are JARVIS, a helpful, concise AI assistant. " +
            "Respond clearly and naturally. You are running locally.",
        },
        ...messages,
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama returned ${response.status}. Check that Ollama is running.`
    );
  }

  const data = await response.json();

  if (!data.message?.content) {
    throw new Error("Ollama returned an empty response.");
  }

  return data.message.content;
}
