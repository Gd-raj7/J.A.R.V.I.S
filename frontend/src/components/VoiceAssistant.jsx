
import { useEffect, useState, useRef } from "react";
import {
  sendChatMessage,
  speakWithElevenLabs,
} from "../services/api";

export default function VoiceAssistant() {
  const [mode, setMode] = useState("ollama");
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [language, setLanguage] = useState("en-IN");
  const [rate, setRate] = useState(0.9);
  const [pitch, setPitch] = useState(0.75);

  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState(
    "J.A.R.V.I.S. voice systems online."
  );
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const geminiSocketRef = useRef(null);
const micStreamRef = useRef(null);
const audioContextRef = useRef(null);
const processorRef = useRef(null);
const nextPlayTimeRef = useRef(0);
const geminiActiveRef = useRef(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setError("Speech output is not supported in this browser.");
      return;
    }

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(Array.isArray(available) ? available : []);

      setVoiceName((current) => {
        if (current && available.some((v) => v.name === current)) {
          return current;
        }
        return (
          available.find((v) => v.lang === "en-IN") ||
          available[0]
        )?.name || "";
      });
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        loadVoices
      );
      recognitionRef.current?.abort();
      audioRef.current?.pause();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  function stopAudio() {
  stopGeminiAgent();

  window.speechSynthesis?.cancel();

  audioRef.current?.pause();
  audioRef.current = null;

  if (audioUrlRef.current) {
    URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }
}

  function changeMode(nextMode) {
    if (nextMode === mode) return;

    recognitionRef.current?.abort();
    recognitionRef.current = null;
    stopAudio();

    setListening(false);
    setBusy(false);
    setError("");
    setMode(nextMode);

    setReply(
      nextMode === "ollama"
        ? "Local J.A.R.V.I.S. selected. Ollama + ElevenLabs."
        : "Gemini Voice Agent selected. Gemini connection is the next step."
    );
  }

  function changeStyle(nextStyle) {
    setStyle(nextStyle);

    if (nextStyle === "cinematic") {
      setRate(0.85);
      setPitch(0.65);
    } else if (nextStyle === "natural") {
      setRate(1);
      setPitch(1);
    } else {
      setRate(1.05);
      setPitch(1.15);
    }
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      setError("Speech synthesis is unavailable.");
      return;
    }

    stopAudio();

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = voices.find((v) => v.name === voiceName);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = language;
    }

    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;

    utterance.onerror = () =>
      setError("Could not play browser speech.");

    window.speechSynthesis.speak(utterance);
  }

  async function playElevenLabs(text) {
    const audioBlob = await speakWithElevenLabs(text);

    if (mode !== "ollama") return;

    stopAudio();

    const url = URL.createObjectURL(audioBlob);
    audioUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (audioUrlRef.current === url) {
        audioUrlRef.current = null;
        audioRef.current = null;
      }
    };

    await audio.play();
  }

  async function testElevenLabsVoice() {
    if (mode !== "ollama") {
      setError("ElevenLabs test is available in Local mode only.");
      return;
    }

    setError("");
    setBusy(true);

    try {
      const text =
        language === "ta-IN"
          ? "வணக்கம். நான் ஜார்விஸ். உங்களுக்கு எப்படி உதவ முடியும்?"
          : "Good evening. I am J.A.R.V.I.S. All systems are online.";

      await playElevenLabs(text);
    } catch (err) {
      setError(err.message || "ElevenLabs voice failed.");
    } finally {
      setBusy(false);
    }
  }

  function testVoice() {
    speak(
      language === "ta-IN"
        ? "வணக்கம். நான் ஜார்விஸ்."
        : "Hello. I am J.A.R.V.I.S. All systems are operational."
    );
  }
  
function floatTo16BitPCM(float32) {
  const pcm = new Int16Array(float32.length);

  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    pcm[i] = sample < 0
      ? sample * 32768
      : sample * 32767;
  }

  return pcm;
}

function downsampleTo16k(input, inputRate) {
  if (inputRate === 16000) {
    return input;
  }

  const ratio = inputRate / 16000;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(
      Math.floor((i + 1) * ratio),
      input.length
    );

    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
    }

    output[i] = sum / Math.max(1, end - start);
  }

  return output;
}

function playGeminiPCM(base64Audio, sampleRate = 24000) {
  const context = audioContextRef.current;
  if (!context) return;

  const binary = atob(base64Audio);
  const pcm = new Int16Array(binary.length / 2);

  for (let i = 0; i < pcm.length; i++) {
    pcm[i] =
      (binary.charCodeAt(i * 2) & 255) |
      (binary.charCodeAt(i * 2 + 1) << 8);

    if (pcm[i] >= 32768) {
      pcm[i] -= 65536;
    }
  }

  const buffer = context.createBuffer(
    1,
    pcm.length,
    sampleRate
  );

  const channel = buffer.getChannelData(0);

  for (let i = 0; i < pcm.length; i++) {
    channel[i] = pcm[i] / 32768;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);

  const startAt = Math.max(
    context.currentTime + 0.03,
    nextPlayTimeRef.current
  );

  source.start(startAt);
  nextPlayTimeRef.current = startAt + buffer.duration;
}

async function stopGeminiAgent() {
  geminiActiveRef.current = false;

  processorRef.current?.disconnect();
  processorRef.current = null;

  micStreamRef.current?.getTracks().forEach(
    (track) => track.stop()
  );
  micStreamRef.current = null;

  const socket = geminiSocketRef.current;
  geminiSocketRef.current = null;

  if (socket) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "end" }));
    }
    socket.close();
  }

  const context = audioContextRef.current;
  audioContextRef.current = null;

  if (context && context.state !== "closed") {
    await context.close();
  }

  setListening(false);
  setBusy(false);
}

async function startGeminiAgent() {
  setError("");
  setTranscript("");
  setReply("Connecting to Gemini Live...");
  setBusy(true);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    micStreamRef.current = stream;

    const context = new AudioContext();
    audioContextRef.current = context;
    await context.resume();

    const socket = new WebSocket(
      "ws://127.0.0.1:8000/gemini-live"
    );

    geminiSocketRef.current = socket;

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "ready") {
        setBusy(false);
        setListening(true);
        setReply("Gemini is ready. Speak naturally.");

        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(
          4096,
          1,
          1
        );

        processorRef.current = processor;

        processor.onaudioprocess = (audioEvent) => {
          if (
            !geminiActiveRef.current ||
            socket.readyState !== WebSocket.OPEN
          ) {
            return;
          }

          const input = audioEvent.inputBuffer
            .getChannelData(0);

          const downsampled = downsampleTo16k(
            input,
            context.sampleRate
          );

          const pcm = floatTo16BitPCM(downsampled);
          const bytes = new Uint8Array(pcm.buffer);

          let binary = "";
          const chunkSize = 8192;

          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(
              ...bytes.subarray(i, i + chunkSize)
            );
          }

          socket.send(JSON.stringify({
            type: "audio",
            data: btoa(binary),
          }));
        };

        source.connect(processor);

        // Keep the processor running without sending mic audio
        // directly to the speakers.
        const mute = context.createGain();
        mute.gain.value = 0;
        processor.connect(mute);
        mute.connect(context.destination);

        geminiActiveRef.current = true;
      }

      if (message.type === "audio") {
        const rateMatch = message.mime_type?.match(/rate=(\d+)/);
        const sampleRate = rateMatch
          ? Number(rateMatch[1])
          : 24000;

        playGeminiPCM(message.data, sampleRate);
        setReply("Gemini is speaking...");
      }

      if (message.type === "turn_complete") {
        setReply("Gemini is listening. Keep speaking.");
      }

      if (message.type === "error") {
        setError(message.message);
      }
    };

    socket.onerror = () => {
      setError("Gemini WebSocket connection failed.");
    };

    socket.onclose = () => {
      if (geminiSocketRef.current === socket) {
        geminiSocketRef.current = null;
        geminiActiveRef.current = false;
        setListening(false);
        setBusy(false);
      }
    };
  } catch (err) {
    await stopGeminiAgent();
    setError(
      err.message ||
      "Could not start Gemini. Check microphone permission and backend."
    );
  }
}


  function listen() {
  if (mode === "gemini") {
    startGeminiAgent();
    return;
  }

    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      setError("Speech recognition is unavailable. Try Chrome.");
      return;
    }

    setError("");

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);

    recognition.onend = () => {
      setListening(false);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setError(`Microphone error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      const selectedMode = mode;

      setTranscript(text);
      setBusy(true);
      setReply("Processing your command...");

      try {
        const answer = await sendChatMessage(text);

        if (selectedMode !== mode) return;

        setReply(answer);
        await playElevenLabs(answer);
      } catch (err) {
        setReply("I couldn't reach my AI system.");
        setError(
          err.message || "Check that Ollama and FastAPI are running."
        );
      } finally {
        setBusy(false);
      }
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Could not start the microphone. Please try again.");
    }
  }

  return (
    <section className="voice-panel">
      <h2>J.A.R.V.I.S. VOICE CONTROL</h2>

      <label>
        AI Mode
        <select
          value={mode}
          onChange={(event) => changeMode(event.target.value)}
          disabled={busy || listening}
        >
          <option value="ollama">Local — Ollama + ElevenLabs</option>
          <option value="gemini">Cloud — Gemini Voice Agent</option>
        </select>
      </label>

      <p className="voice-note">
        {mode === "ollama"
          ? "Local AI replies use Ollama. Speech uses ElevenLabs."
          : "Gemini mode selected. Native Gemini voice connection is the next step."}
      </p>

      {mode === "ollama" && (
        <>
          <label>
            Assistant voice
            <select
              value={voiceName}
              onChange={(event) => setVoiceName(event.target.value)}
            >
              {voices.length === 0 && (
                <option value="">No system voices found</option>
              )}
              {voices.map((voice) => (
                <option
                  key={`${voice.name}-${voice.lang}`}
                  value={voice.name}
                >
                  {voice.name} — {voice.lang}
                </option>
              ))}
            </select>
          </label>

          <label>
            Voice style
            <select
              value={style}
              onChange={(event) => changeStyle(event.target.value)}
            >
              <option value="cinematic">Cinematic / deep</option>
              <option value="natural">Natural</option>
              <option value="bright">Bright / energetic</option>
            </select>
          </label>

          <label>
            Speed: {rate.toFixed(2)}
            <input
              type="range"
              min="0.65"
              max="1.3"
              step="0.05"
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
            />
          </label>

          <label>
            Pitch: {pitch.toFixed(2)}
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={pitch}
              onChange={(event) => setPitch(Number(event.target.value))}
            />
          </label>
        </>
      )}

      <label>
        Speech language
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          <option value="en-IN">English (India)</option>
          <option value="en-US">English (US)</option>
          <option value="ta-IN">Tamil (India)</option>
        </select>
      </label>

      <div className="voice-actions">
        {mode === "ollama" && (
          <>
            <button className="voice-button" onClick={testVoice}>
              Test Browser Voice
            </button>

            <button
              className="voice-button"
              onClick={testElevenLabsVoice}
              disabled={busy}
            >
              {busy ? "Generating Voice..." : "✨ Test ElevenLabs Voice"}
            </button>
          </>
        )}

        <button
          className="voice-button"
          onClick={listen}
          disabled={listening || busy}
        >
          {listening
            ? "Listening..."
            : busy
              ? "Thinking..."
              : mode === "gemini"
                ? "🎙 Start Gemini Agent (next step)"
                : "🎙 Talk to J.A.R.V.I.S."}
        </button>

        <button
          className="voice-button"
          onClick={stopAudio}
        >
          Stop Audio
        </button>
      </div>

      <p>
        <strong>You:</strong>{" "}
        {transcript || "Waiting for your command..."}
      </p>

      <p>
        <strong>J.A.R.V.I.S.:</strong> {reply}
      </p>

      {error && <p className="voice-error">{error}</p>}
    </section>
  );
}
