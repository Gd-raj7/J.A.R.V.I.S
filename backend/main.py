
from datetime import datetime, timezone
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import HTTPException
from fastapi.responses import Response
from elevenlabs.client import ElevenLabs
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="J.A.R.V.I.S. API",
    description="Local AI assistant backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "name": "J.A.R.V.I.S.",
        "message": "Backend is running",
    }


@app.get("/health")
def health():
    return {
        "status": "online",
        "assistant": "J.A.R.V.I.S.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
import httpx
from pydantic import BaseModel
from fastapi import HTTPException

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "http://127.0.0.1:11434/api/chat",
                json={
                    "model": "llama3.2",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are J.A.R.V.I.S., a helpful "
                                "desktop AI assistant. Be clear, "
                                "concise, and friendly."
                            ),
                        },
                        {
                            "role": "user",
                            "content": request.message,
                        },
                    ],
                    "stream": False,
                },
            )

            response.raise_for_status()
            data = response.json()

        return {"reply": data["message"]["content"]}

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail="Cannot reach Ollama. Check that Ollama is running.",
        ) from exc

# Load backend secrets without changing the existing chat endpoint
load_dotenv(Path(__file__).with_name(".env"))

@app.post("/speak")
def speak_text(payload: dict):
    text = str(payload.get("text", "")).strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Text is required."
        )

    if len(text) > 2000:
        raise HTTPException(
            status_code=400,
            detail="Text must be 2000 characters or fewer."
        )

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs API key is not configured."
        )

    try:
        client = ElevenLabs(api_key=api_key)
        audio = client.text_to_speech.convert(
            text=text,
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )

        audio_bytes = b"".join(
            chunk for chunk in audio if isinstance(chunk, bytes)
        )

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )

    except Exception:
        raise HTTPException(
            status_code=502,
            detail="ElevenLabs speech generation failed. Check API access and credits."
        )
from fastapi import WebSocket
from backend.gemini_live import gemini_live_session

@app.websocket("/gemini-live")
async def gemini_live(websocket: WebSocket):
    await gemini_live_session(websocket)