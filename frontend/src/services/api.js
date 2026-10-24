const API_BASE_URL = "http://127.0.0.1:8000";

export async function checkJarvisHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error("J.A.R.V.I.S. backend is offline");
  }

  return response.json();
}
export async function sendChatMessage(message) {
  const response = await fetch("http://127.0.0.1:8000/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "AI request failed");
  }

  return data.reply;
}

export async function speakWithElevenLabs(text) {
  const response = await fetch("http://127.0.0.1:8000/speak", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Voice request failed (${response.status}): ${message}`);
  }

  return await response.blob();
}
