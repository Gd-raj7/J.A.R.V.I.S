import { useEffect, useState } from "react";
import { checkJarvisHealth } from "./services/api";
import JarvisOrb from "./components/JarvisOrb";
import VoiceAssistant from "./components/VoiceAssistant";
import "./App.css";

export default function App() {
  const [status, setStatus] = useState("CONNECTING");

  useEffect(() => {
    checkJarvisHealth()
      .then(() => setStatus("ONLINE"))
      .catch(() => setStatus("OFFLINE"));
  }, []);

  return (
    <main className="jarvis">
      <div className="grid-bg" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">J</span>
          <div>
            <h1>J.A.R.V.I.S.</h1>
            <p>PERSONAL AI SYSTEM</p>
          </div>
        </div>

        <div className="system-status">
          <span className={`status-dot ${status.toLowerCase()}`} />
          SYSTEM {status}
        </div>
      </header>

      <section className="main-stage">
        <div className="orb">
  <JarvisOrb />
</div>
        <VoiceAssistant /> 

        <p className="system-label">ARTIFICIAL INTELLIGENCE CORE</p>
        <h2>At your service.</h2>
        <p className="subtitle">
          Awaiting your command, Sir.
        </p>

        <div className="command-status">
          <span className="pulse-dot" />
          {status === "ONLINE"
            ? "ALL SYSTEMS NOMINAL"
            : status === "OFFLINE"
              ? "BACKEND CONNECTION FAILED"
              : "ESTABLISHING CONNECTION"}
        </div>
      </section>

      <footer className="bottom-bar">
        <span>J.A.R.V.I.S. // LOCAL INSTANCE</span>
        <span>VOICE · SPATIAL UI · AI AGENTS</span>
      </footer>
    </main>
  );
}