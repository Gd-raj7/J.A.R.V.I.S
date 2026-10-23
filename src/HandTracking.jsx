
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

function Hologram({ gestureRef, pausedRef, zoomRef, sensitivityRef }) {
  const mountRef = useRef(null);
  const pointerRef = useRef({ down: false, x: 0, y: 0 });
  const dragDeltaRef = useRef({ x: 0, y: 0 });

  function handlePointerDown(event) {
    pointerRef.current = { down: true, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!pointerRef.current.down) return;
    const dx = event.clientX - pointerRef.current.x;
    const dy = event.clientY - pointerRef.current.y;
    dragDeltaRef.current.x += dx;
    dragDeltaRef.current.y += dy;
    pointerRef.current.x = event.clientX;
    pointerRef.current.y = event.clientY;
  }

  function handlePointerUp() {
    pointerRef.current.down = false;
  }

  function handleWheel(event) {
    event.preventDefault();
    zoomRef.current = THREE.MathUtils.clamp(
      zoomRef.current * (event.deltaY > 0 ? 0.92 : 1.08),
      0.65,
      2.2
    );
  }

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
      const paused = pausedRef.current;

      // Mouse/touch dragging works independently from camera hand tracking.
      const drag = dragDeltaRef.current;
      if (Math.abs(drag.x) > 0.01 || Math.abs(drag.y) > 0.01) {
        group.rotation.y += drag.x * 0.008;
        group.rotation.x += drag.y * 0.008;
        drag.x = 0;
        drag.y = 0;
      }

      if (!paused && !gesture?.standby && gesture?.pinching && gesture.index) {
        if (lastX !== null) {
          const dx = gesture.index.x - lastX;
          const dy = gesture.index.y - lastY;
          group.rotation.y += dx * sensitivityRef.current;
          group.rotation.x += dy * sensitivityRef.current;
        }
        lastX = gesture.index.x;
        lastY = gesture.index.y;
      } else {
        lastX = null;
        lastY = null;
        if (!paused && !gesture?.standby) group.rotation.y += 0.00035;
      }

      const handScale = gesture?.scale ?? 1;
      const targetScale = THREE.MathUtils.clamp(handScale * zoomRef.current, 0.65, 2.2);
      const smoothScale = THREE.MathUtils.damp(group.scale.x, targetScale, 5, 1 / 60);
      group.scale.setScalar(smoothScale);

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

  return (
    <div
      className="hologram-canvas touch-spatial-surface"
      ref={mountRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      title="Drag to rotate · Scroll or pinch to zoom"
    />
  );
}

export default function HandTracking() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const trackerRef = useRef(null);
  const streamRef = useRef(null);
  const gestureRef = useRef({ pinching: false, index: null, scale: 1 });
  const pausedRef = useRef(false);
  const zoomRef = useRef(1);
  const sensitivityRef = useRef(3.0);
  const calibrationRef = useRef({ pinch: true, scale: true, standby: true, pinchThreshold: 0.045, baseline: null });

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
  const [paused, setPaused] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [sensitivity, setSensitivity] = useState(3.0);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [pinchThreshold, setPinchThreshold] = useState(0.045);
  const [gestureEnabled, setGestureEnabled] = useState({ pinch: true, scale: true, standby: true });
  const [baselineReady, setBaselineReady] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState("Show your relaxed hand, then capture baseline.");

  function updateGestureEnabled(key, checked) {
    setGestureEnabled((current) => {
      const next = { ...current, [key]: checked };
      calibrationRef.current = { ...calibrationRef.current, ...next };
      return next;
    });
  }

  function captureNeutralBaseline() {
    const hand = gestureRef.current?.landmarks;
    if (!hand) {
      setCalibrationMessage("No hand detected yet. Place one hand in view and try again.");
      return;
    }
    const palmWidth = distance(hand[5], hand[17]);
    if (!Number.isFinite(palmWidth) || palmWidth < 0.01) {
      setCalibrationMessage("Keep your palm facing the camera and try again.");
      return;
    }
    calibrationRef.current.baseline = palmWidth;
    setBaselineReady(true);
    setCalibrationMessage("Neutral baseline captured. Keep a similar distance from the camera.");
  }

  function changeZoom(amount) {
    setZoom((current) => {
      const next = THREE.MathUtils.clamp(current + amount, 0.65, 2.2);
      zoomRef.current = next;
      return next;
    });
  }

  function togglePause() {
    setPaused((current) => {
      const next = !current;
      pausedRef.current = next;
      return next;
    });
  }

  function resetView() {
    zoomRef.current = 1;
    setZoom(1);
    pausedRef.current = false;
    setPaused(false);
  }

  useEffect(() => {
    let active = true;
    let animationId;
    let lastVideoTime = -1;
    let lastUiUpdate = 0;
    let frameCount = 0;
    let fpsStart = performance.now();
    let smoothedIndex = null;
    let pinchLatched = false;
    let standbyLatched = false;
    let smoothedSpan = null;
    const smoothing = 0.22;

    async function start() {
      let tracker;

      try {
        setStatus("REQUESTING CAMERA");

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
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
          let standby = false;
          let label = landmarks.length
            ? `${landmarks.length} HAND${landmarks.length > 1 ? "S" : ""} TRACKED`
            : "SHOW YOUR HANDS";

          if (first) {
            const calibration = calibrationRef.current;
            const palmWidth = Math.max(distance(first[5], first[17]), 0.001);
            const normalizedPinchDistance = distance(first[4], first[8]) / (calibration.baseline ?? palmWidth);
            const threshold = calibration.pinchThreshold;
            // Palm-open detection: four fingertips extended beyond their middle joints.
            const extended = [[8, 6], [12, 10], [16, 14], [20, 18]]
              .filter(([tip, joint]) => first[tip].y < first[joint].y).length;
            const palmOpen = extended >= 4 && normalizedPinchDistance > 0.32;
            if (calibration.standby && palmOpen) standbyLatched = true;
            // Close the palm or make a clear pinch to resume control.
            const fistClosed = extended <= 1;
            const clearPinch = normalizedPinchDistance < threshold * 0.8;
            if (fistClosed || clearPinch) standbyLatched = false;
            standby = calibration.standby && standbyLatched;

            // Hysteresis avoids flickering around the user-adjustable threshold.
            if (!pinchLatched && normalizedPinchDistance < threshold) pinchLatched = true;
            if (pinchLatched && normalizedPinchDistance > threshold * 1.35) pinchLatched = false;
            pinching = calibration.pinch && pinchLatched && !standby;

            const rawIndex = { x: 1 - first[8].x, y: first[8].y };
            if (!smoothedIndex) smoothedIndex = rawIndex;
            else {
              smoothedIndex.x += (rawIndex.x - smoothedIndex.x) * smoothing;
              smoothedIndex.y += (rawIndex.y - smoothedIndex.y) * smoothing;
            }
            index = { ...smoothedIndex };
            label = standby ? "OPEN PALM · STANDBY" : pinching ? "PINCH · ROTATE HOLOGRAM" : label;
          } else {
            smoothedIndex = null;
            pinchLatched = false;
            standbyLatched = false;
          }

          if (first && second && calibrationRef.current.scale) {
            const rawSpan = distance(first[8], second[8]);
            smoothedSpan = smoothedSpan == null
              ? rawSpan
              : smoothedSpan + (rawSpan - smoothedSpan) * 0.18;
            scale = THREE.MathUtils.clamp(0.7 + smoothedSpan * 2.8, 0.7, 1.8);
            label = standby ? "OPEN PALM · STANDBY" : "TWO HANDS · SCALE HOLOGRAM";
          } else {
            smoothedSpan = null;
          }

          gestureRef.current = { pinching, index, scale, standby, landmarks: first ?? null };

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
          <Hologram
            gestureRef={gestureRef}
            pausedRef={pausedRef}
            zoomRef={zoomRef}
            sensitivityRef={sensitivityRef}
          />
          <div className="spatial-controls">
            <button type="button" onClick={() => changeZoom(0.15)}>+ Zoom</button>
            <button type="button" onClick={() => changeZoom(-0.15)}>− Zoom</button>
            <button type="button" onClick={togglePause}>{paused ? "Resume" : "Pause"}</button>
            <button type="button" onClick={resetView}>Reset view</button>
            <button type="button" onClick={() => setDetailsOpen((value) => !value)}>
              {detailsOpen ? "Hide details" : "Details"}
            </button>
            <label className="sensitivity-control">
              Hand sensitivity
              <input
                type="range"
                min="1"
                max="6"
                step="0.5"
                value={sensitivity}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSensitivity(value);
                  sensitivityRef.current = value;
                }}
                aria-label="Hand rotation sensitivity"
              />
              <span>{sensitivity.toFixed(1)}×</span>
            </label>
          </div>
          <div className="calibration-heading">
            <button type="button" onClick={() => setCalibrationOpen((open) => !open)}>
              {calibrationOpen ? "Close calibration" : "⚙ Calibration mode"}
            </button>
            <span className={`calibration-status ${baselineReady ? "ready" : ""}`}>
              {baselineReady ? "BASELINE SET" : "BASELINE NOT SET"}
            </span>
          </div>
          {calibrationOpen && (
            <div className="calibration-panel">
              <div className="calibration-topline">
                <div>
                  <strong>Gesture calibration</strong>
                  <p className="hint">Capture your relaxed hand position, then tune each gesture.</p>
                </div>
                <button type="button" onClick={captureNeutralBaseline}>Capture neutral baseline</button>
              </div>
              <label className="calibration-range">
                Pinch threshold <strong>{pinchThreshold.toFixed(3)}</strong>
                <input type="range" min="0.025" max="0.09" step="0.005" value={pinchThreshold}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setPinchThreshold(value);
                    calibrationRef.current.pinchThreshold = value;
                  }} aria-label="Pinch detection threshold" />
                <small>Lower = tighter pinch required; higher = easier to trigger.</small>
              </label>
              <div className="gesture-toggles">
                <label><input type="checkbox" checked={gestureEnabled.pinch} onChange={(event) => updateGestureEnabled("pinch", event.target.checked)} /> Pinch to rotate</label>
                <label><input type="checkbox" checked={gestureEnabled.scale} onChange={(event) => updateGestureEnabled("scale", event.target.checked)} /> Two hands to scale</label>
                <label><input type="checkbox" checked={gestureEnabled.standby} onChange={(event) => updateGestureEnabled("standby", event.target.checked)} /> Open palm standby</label>
              </div>
              <p className="hint calibration-message">{calibrationMessage}</p>
            </div>
          )}
          {detailsOpen && (
            <p className="hint spatial-hint">
              Pinch and move to rotate. Spread both hands to scale. Drag the hologram with your mouse or finger; scroll to zoom. Show one open palm to enter standby, then close your hand or pinch to resume. Smoothing and pinch hysteresis reduce jitter.
            </p>
          )}
          <div className="holo-legend">
            <span><i /> ROTATE: PINCH / TOUCH-DRAG</span>
            <span><i /> SCALE: TWO HANDS / SCROLL</span>
            <span><i /> OPEN PALM: STANDBY</span>
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
