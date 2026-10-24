
import os
from pathlib import Path

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

# Load the backend/.env file explicitly
load_dotenv(Path(__file__).with_name(".env"))

api_key = os.getenv("ELEVENLABS_API_KEY")

if not api_key:
    raise RuntimeError(
        "ELEVENLABS_API_KEY not found in backend/.env"
    )

client = ElevenLabs(api_key=api_key)

audio = client.text_to_speech.convert(
    text=(
        "Good evening.  Jaarvis systems are online. "
        "How may I assist you today?"
    ),
    voice_id="JBFqnCBsd6RMkjVDRZzb",
    model_id="eleven_multilingual_v2",
    output_format="mp3_44100_128",
)

output_path = Path(__file__).with_name("jarvis_voice_test.mp3")

with open(output_path, "wb") as file:
    for chunk in audio:
        file.write(chunk)

print(f"Success! Audio saved to: {output_path}")
