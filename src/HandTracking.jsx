
import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import * as THREE from "three";
import "./HandTracking.css";

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function Hologram({ gestureRef }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07111d");

    const camera = new THREE.PerspectiveCamera(
      42,
      host.clientWidth / host.clientHeight,
      0.1,
      100
    );
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 32, 24),
      new THREE.MeshBasicMaterial({
        color: "#3bdcff",
        wireframe: true,
        transparent: true,
        opacity: 0.8,
      })
    );
    group.add(globe);

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.94, 24, 18),
      new THREE.MeshBasicMaterial({
        color: "#1672a8",
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      })
    );
    group.add(inner);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#55e7ff",
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.012, 8, 120),
      ringMaterial
    );
    ring1.rotation.x = 1.05;
    group.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.85, 0.008, 8, 120),
      ringMaterial.clone()
    );
    ring2.rotation.y = 1.1;
    group.add(ring2);

    const starPositions = [];
    for (let i = 0; i < 500; i++) {
      starPositions.push(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 5
      );
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3)
    );
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: "#62b7d5",
        size: 0.018,
        transparent: true,
        opacity: 0.7,
      })
    );
    scene.add(stars);

    let frame;
    let lastX = null;
    let lastY = null;

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    function animate() {
      frame = requestAnimationFrame(animate);

      const gesture = gestureRef.current;

      if (gesture?.pinching && gesture.index) {
        if (lastX !== null) {
          group.rotation.y += (gesture.index.x - lastX) * 5;
          group.rotation.x += (gesture.index.y - lastY) * 5;
        }
        lastX = gesture.index.x;
        lastY = gesture.index.y;
      } else {
        lastX = null;
        lastY = null;
        group.rotation.y += 0.002;
        group.rotation.x += 0.0005;
      }

      const targetScale = gesture?.scale ?? 1;
      const smoothScale = THREE.MathUtils.clamp(targetScale, 0.65, 1.8);
      group.scale.lerp(
        new THREE.Vector3(smoothScale, smoothScale, smoothScale),
        0.12
      );

      stars.rotation.y += 0.00015;
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [gestureRef]);

  return <div className="hologram-canvas" ref={mountRef} />;
}

export default function HandTracking() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const trackerRef = useRef(null);
  const streamRef = useRef(null);
  const gestureRef = useRef({
    pinching: false,
    index: null,
    scale: 1,
  });

  const [status, setStatus] = useState("STARTING");
  const [hands, setHands] = useState(0);
  const [fps, setFps] = useState(0);
  const [gesture, setGesture] = useState("Show your hands");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Systems ready. I am listening when you are.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState("auto");

  useEffect(() => {
    let active = true;
    let animationId;
    let lastVideoTime = -1;
    let lastUiUpdate = 0;
    let frameCount = 0;
    let fpsStart = performance.now();

    async function start() {
      let tracker;

      try {
        setStatus("REQUESTING CAMERA");

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        setStatus("LOADING VISION MODEL");

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        tracker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });

        if (!active) {
          tracker.close();
          return;
        }

        trackerRef.current = tracker;
        setStatus("ONLINE");

        function draw() {
          if (!active) return;

          animationId = requestAnimationFrame(draw);

          const video = videoRef.current;
          const canvas = overlayRef.current;
          if (!video || !canvas || video.readyState < 2) return;
          if (video.currentTime === lastVideoTime) return;

          lastVideoTime = video.currentTime;

          if (
            canvas.width !== video.videoWidth ||
            canvas.height !== video.videoHeight
          ) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          const ctx = canvas.getContext("2d");
          const result = trackerRef.current.detectForVideo(
            video,
            performance.now()
          );
          const landmarks = result.landmarks ?? [];
          const now = performance.now();

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          landmarks.forEach((points, handIndex) => {
            const color = handIndex === 0 ? "#4deaff" : "#b6a2ff";

            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(2, canvas.width / 450);
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;

            CONNECTIONS.forEach(([a, b]) => {
              ctx.beginPath();
              ctx.moveTo(
                (1 - points[a].x) * canvas.width,
                points[a].y * canvas.height
              );
              ctx.lineTo(
                (1 - points[b].x) * canvas.width,
                points[b].y * canvas.height
              );
              ctx.stroke();
            });

            points.forEach((point, index) => {
              ctx.beginPath();
              ctx.arc(
                (1 - point.x) * canvas.width,
                point.y * canvas.height,
                index === 4 || index === 8 ? 6 : 3,
                0,
                Math.PI * 2
              );
              ctx.fillStyle = index === 8 ? "#ffffff" : color;
              ctx.fill();
            });
          });

          ctx.shadowBlur = 0;

          const first = landmarks[0];
          const second = landmarks[1];
          let pinching = false;
          let index = null;
          let scale = 1;
          let label = landmarks.length
            ? `${landmarks.length} HAND${landmarks.length > 1 ? "S" : ""} TRACKED`
            : "SHOW YOUR HANDS";

          if (first) {
            const pinchDistance = distance(first[4], first[8]);
            pinching = pinchDistance < 0.055;
            index = {
              x: 1 - first[8].x,
              y: first[8].y,
            };

            label = pinching ? "PINCH · ROTATE HOLOGRAM" : label;
          }

          if (first && second) {
            const span = distance(first[8], second[8]);
            scale = THREE.MathUtils.clamp(0.7 + span * 2.8, 0.7, 1.8);
            label = "TWO HANDS · SCALE HOLOGRAM";
          }

          gestureRef.current = { pinching, index, scale };

          if (now - lastUiUpdate > 100) {
            setHands(landmarks.length);
            setGesture(label);
            lastUiUpdate = now;
          }

          frameCount++;
          if (now - fpsStart >= 1000) {
            setFps(Math.round((frameCount * 1000) / (now - fpsStart)));
            frameCount = 0;
            fpsStart = now;
          }
        }

        draw();
      } catch (err) {
        console.error(err);
        if (active) {
          setStatus("OFFLINE");
          setError(
            err.name === "NotAllowedError"
              ? "Camera permission was denied. Allow camera access and reload."
              : err.message || "Could not initialize hand tracking."
          );
        }
      }
    }

    start();

    return () => {
      active = false;
      cancelAnimationFrame(animationId);
      trackerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      trackerRef.current = null;
      streamRef.current = null;
    };
  }, []);

  async function sendMessage(text = input) {
    const question = text.trim();
    if (!question || busy) return;

    const nextMessages = [
      ...messages,
      { role: "user", content: question },
    ];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          provider,
          system: "You are JARVIS, my personal AI assistant. Be helpful, accurate, concise, and friendly. Respond in the language the user uses.",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI request failed.");
      const answer = data.reply;

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: answer },
      ]);

      if (voiceOn && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(answer));
      }
    } catch (err) {
      setError(`${err.message} Check that server.mjs is running on port 3001 and Ollama/Gemini is available.`);
    } finally {
      setBusy(false);
    }
  }

  function toggleListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported by this browser. Try Chrome.");
      return;
    }

    if (listening) {
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      setListening(false);
      setError(`Voice input error: ${event.error}`);
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      void sendMessage(transcript);
    };

    recognition.start();
  }

  return (
    <main className="jarvis-app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">J</div>
          <div>
            <h1>JARVIS <span>INTERFACE</span></h1>
            <p>PERSONAL AI SYSTEM</p>
          </div>
        </div>
        <div className="system-state">
          <span className={`status-dot ${status === "ONLINE" ? "active" : ""}`} />
          {status}
        </div>
      </header>

      <section className="dashboard">
        <section className="panel vision-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">01 / COMPUTER VISION</span>
              <h2>Hand tracking</h2>
            </div>
            <span className="pill">{hands} DETECTED</span>
          </div>

          <div className="camera-frame">
            <video ref={videoRef} autoPlay muted playsInline />
            <canvas ref={overlayRef} />
            <div className="camera-corners" />
            <div className="camera-label">LIVE FEED · MIRRORED</div>
            <div className="camera-footer">
              <span>VISION ENGINE</span>
              <span>{fps} FPS</span>
            </div>
          </div>

          <div className="gesture-readout">
            <span className="readout-icon">⌁</span>
            <div>
              <small>GESTURE STATUS</small>
              <strong>{gesture}</strong>
            </div>
          </div>

          <p className="hint">
            Pinch thumb + index and move to rotate. Move both hands apart or
            together to scale the hologram.
          </p>
          {error && <p className="error-text">{error}</p>}
        </section>

        <section className="panel holo-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">02 / SPATIAL COMPUTING</span>
              <h2>Holographic core</h2>
            </div>
            <span className="pill">3D ACTIVE</span>
          </div>
          <Hologram gestureRef={gestureRef} />
          <div className="holo-legend">
            <span><i /> ROTATION: PINCH + MOVE</span>
            <span><i /> SCALE: TWO HANDS</span>
          </div>
        </section>

        <section className="panel assistant-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">03 / HYBRID INTELLIGENCE</span>
              <h2>Talk to JARVIS</h2>
            </div>
            <label className="pill" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              AI MODE
              <select value={provider} onChange={(event) => setProvider(event.target.value)} aria-label="AI provider" style={{ background: "transparent", color: "inherit", border: 0, font: "inherit", outline: "none" }}>
                <option value="auto" style={{ color: "#07111d" }}>AUTO</option>
                <option value="ollama" style={{ color: "#07111d" }}>LOCAL</option>
                <option value="gemini" style={{ color: "#07111d" }}>GEMINI CLOUD</option>
              </select>
            </label>
          </div>

          <div className="chat-log">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={index}>
                <small>{message.role === "user" ? "YOU" : "JARVIS"}</small>
                <p>{message.content}</p>
              </div>
            ))}
            {busy && <div className="thinking">JARVIS IS THINKING…</div>}
          </div>

          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask JARVIS anything..."
              aria-label="Message JARVIS"
            />
            <button type="submit" disabled={busy || !input.trim()}>
              SEND
            </button>
          </form>

          <div className="voice-controls">
            <button
              type="button"
              className={listening ? "selected" : ""}
              onClick={toggleListening}
            >
              {listening ? "■ STOP LISTENING" : "🎙 SPEAK"}
            </button>
            <button
              type="button"
              className={voiceOn ? "selected" : ""}
              onClick={() => {
                setVoiceOn((current) => !current);
                if (voiceOn) window.speechSynthesis?.cancel();
              }}
            >
              {voiceOn ? "🔊 VOICE ON" : "🔇 VOICE OFF"}
            </button>
          </div>
          <p className="hint">
            AUTO tries Gemini cloud first, then Ollama. LOCAL uses qwen3.5:4b. Voice support depends on your browser.
          </p>
        </section>
      </section>

      <footer className="app-footer">
        <span>JARVIS PERSONAL ASSISTANT</span>
        <span>VISION · SPATIAL UI · HYBRID AI</span>
      </footer>
    </main>
  );
}
