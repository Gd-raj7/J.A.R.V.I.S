
import { useEffect, useState } from 'react'
import './App.css'

const stages = ['LISTENING', 'ANALYZING', 'GENERATING RESPONSE']

function App() {
  const [mode, setMode] = useState('READY')
  const [input, setInput] = useState('')
  const [voiceOn, setVoiceOn] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am your personal AI assistant. Ask me to explain a concept, help with code, or explore an idea.',
    },
  ])
  const [clock, setClock] = useState(new Date())
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (mode !== 'THINKING') return
    const timer = setInterval(() => {
      setStage((previous) => (previous + 1) % stages.length)
    }, 1200)
    return () => clearInterval(timer)
  }, [mode])

  function sendMessage(text = input) {
    const prompt = text.trim()
    if (!prompt || mode === 'THINKING') return

    setInput('')
    setMessages((old) => [...old, { role: 'user', text: prompt }])
    setMode('THINKING')
    setStage(0)

    // Temporary demo response. Ollama will replace this next.
    setTimeout(() => {
      setMessages((old) => [
        ...old,
        {
          role: 'assistant',
          text: `Let's explore "${prompt}" step by step. First, understand the basic idea. Next, identify its main parts and how they work together. Finally, connect the concept to a real-world example. I will connect this interface to your local Ollama model next.`,
        },
      ])
      setMode('READY')
    }, 1800)
  }

  function toggleVoice() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (voiceOn) {
      window.jarvisRecognition?.stop()
      setVoiceOn(false)
      return
    }

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Try a recent version of Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    window.jarvisRecognition = recognition
    recognition.lang = 'en-IN'
    recognition.interimResults = true

    recognition.onstart = () => setVoiceOn(true)
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('')
      setInput(transcript)

      const last = event.results[event.results.length - 1]
      if (last.isFinal) {
        setVoiceOn(false)
        sendMessage(transcript)
      }
    }
    recognition.onerror = () => setVoiceOn(false)
    recognition.onend = () => setVoiceOn(false)
    recognition.start()
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      alert('Speech output is not supported in this browser.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-IN'
    window.speechSynthesis.speak(utterance)
  }

  const lastAnswer = [...messages].reverse().find((m) => m.role === 'assistant')

  return (
    <main className="jarvis">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">J</div>
          <div>
            <h1>J.A.R.V.I.S.</h1>
            <p>PERSONAL INTELLIGENCE SYSTEM</p>
          </div>
        </div>
        <div className="top-right">
          <span className="online-dot" /> LOCAL INTERFACE
          <span>{clock.toLocaleTimeString('en-IN')}</span>
        </div>
      </header>

      <nav className="nav">
        <span className="nav-active">◈ COMMAND CENTER</span>
        <span>◉ VOICE</span>
        <span>⌘ CONCEPT LAB</span>
        <span>⬡ SYSTEM</span>
      </nav>

      <section className="heading">
        <div>
          <p className="eyebrow">STARK-INSPIRED PERSONAL AI</p>
          <h2>Your ideas. <span>My intelligence.</span></h2>
          <p className="muted">Ask questions, learn concepts, and build things.</p>
        </div>
        <span className="status-pill"><i /> {mode}</span>
      </section>

      <section className="workspace">
        <aside className="panel system-panel">
          <PanelTitle title="SYSTEM STATUS" number="01" />
          <Status label="Local AI model" value="Ollama" state="TO CONNECT" />
          <Status label="Voice input" value={voiceOn ? 'Listening' : 'Browser voice'} state={voiceOn ? 'ACTIVE' : 'READY'} />
          <Status label="Agent tools" value="FastAPI" state="PLANNED" />
          <div className="security">
            <span>⌑</span>
            <div>
              <b>APPROVAL PROTOCOL</b>
              <p>Important actions require your permission.</p>
            </div>
          </div>
        </aside>

        <section className="core-panel">
          <PanelTitle title="INTELLIGENCE CORE" number="02" />
          <div className={`reactor ${mode === 'THINKING' ? 'reactor-thinking' : ''} ${voiceOn ? 'reactor-listening' : ''}`}>
            <div className="ring ring-one" />
            <div className="ring ring-two" />
            <div className="ring ring-three" />
            <div className="ring ring-four" />
            <div className="core">
              <span>J</span>
              <small>{mode === 'THINKING' ? 'PROCESSING' : voiceOn ? 'LISTENING' : 'STANDBY'}</small>
            </div>
            <span className="orbit orbit-a">AI / 01</span>
            <span className="orbit orbit-b">ONLINE</span>
          </div>

          <div className="core-caption">
            <span className="online-dot" />
            {mode === 'THINKING'
              ? stages[stage]
              : voiceOn ? 'SPEAK NOW' : 'AWAITING YOUR COMMAND'}
          </div>

          <div className="voice-controls">
            <button className={voiceOn ? 'button-hot' : ''} onClick={toggleVoice}>
              {voiceOn ? '■ Stop listening' : '🎙 Talk to JARVIS'}
            </button>
            <button className="button-quiet" onClick={() => speak(lastAnswer?.text || '')}>
              🔊 Speak answer
            </button>
          </div>
          <p className="microcopy">Microphone permission may be required.</p>
        </section>

        <aside className="panel explain-panel">
          <PanelTitle title="CONCEPT LAB" number="03" />
          <p className="eyebrow">LEARN SOMETHING NEW</p>
          <h3>Understand it visually.</h3>
          <p className="muted">Explore a topic with simple explanations and a breakdown of its parts.</p>

          <div className="concept-list">
            <button onClick={() => sendMessage('Explain how an AI model works')}>
              <span className="concept-icon">✳</span>
              <span><b>Artificial Intelligence</b><small>Models, data, predictions</small></span>
              <span>↗</span>
            </button>
            <button onClick={() => sendMessage('Explain the anatomy of a robot')}>
              <span className="concept-icon">⬡</span>
              <span><b>Robot anatomy</b><small>Sensors, controller, motors</small></span>
              <span>↗</span>
            </button>
            <button onClick={() => sendMessage('Explain an electric circuit step by step')}>
              <span className="concept-icon">ϟ</span>
              <span><b>Electric circuits</b><small>Power, current, components</small></span>
              <span>↗</span>
            </button>
          </div>

          <div className="explain-note">
            <span>✦</span>
            <p><b>Learning mode</b><br />Simple idea → main parts → how it works → example.</p>
          </div>
        </aside>
      </section>

      <section className="bottom-grid">
        <section className="panel chat-panel">
          <PanelTitle title="CONVERSATION" number="04" />
          <div className="messages">
            {messages.map((item, index) => (
              <article className={`message ${item.role}`} key={index}>
                <div className="message-label">
                  {item.role === 'user' ? 'YOU' : 'JARVIS'}
                  {item.role === 'assistant' && (
                    <button onClick={() => speak(item.text)} title="Read aloud">🔊</button>
                  )}
                </div>
                <p>{item.text}</p>
              </article>
            ))}
            {mode === 'THINKING' && (
              <article className="message assistant">
                <div className="message-label">JARVIS · {stages[stage]}</div>
                <div className="thinking-dots"><i /><i /><i /></div>
              </article>
            )}
          </div>

          <form className="composer" onSubmit={(event) => {
            event.preventDefault()
            sendMessage()
          }}>
            <span>›</span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a question or explore a concept..."
              aria-label="Message JARVIS"
            />
            <button type="submit" disabled={mode === 'THINKING'}>SEND ↗</button>
          </form>
        </section>

        <section className="panel anatomy-panel">
          <PanelTitle title="ANATOMY VIEW" number="05" />
          <div className="anatomy-visual">
            <div className="anatomy-node node-top">INPUT</div>
            <div className="anatomy-line" />
            <div className="anatomy-node node-mid">PROCESS</div>
            <div className="anatomy-line" />
            <div className="anatomy-node node-bottom">OUTPUT</div>
          </div>
          <h3>Learn how parts connect</h3>
          <p className="muted">Choose a concept above to ask JARVIS for a step-by-step breakdown. Real diagrams can be added as we connect the AI.</p>
        </section>
      </section>

      <footer>
        <span>J.A.R.V.I.S. · PERSONAL AI</span>
        <span>LOCAL-FIRST · YOU STAY IN CONTROL</span>
      </footer>
    </main>
  )
}

function PanelTitle({ title, number }) {
  return (
    <div className="panel-title">
      <span>{number}</span><h3>{title}</h3><i />
    </div>
  )
}

function Status({ label, value, state }) {
  return (
    <div className="status-row">
      <div><b>{label}</b><small>{value}</small></div>
      <span>{state}</span>
    </div>
  )
}

export default App
