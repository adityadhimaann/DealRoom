# 🏛️ DealRoom: Autonomous Multi-Agent Voice Bargaining Arena
> **24-Hour AI Hackathon Brief · Deliverables #2 (2-Minute Pitch) & #3 (Architecture Diagram)**

---

### 🎙️ Deliverable #2: The 2-Minute Pitch (The 5 Mandatory Questions)

#### 01. What problem, and who exactly has it?
> *"Freelancers, agency founders, and enterprise procurement leads waste dozens of hours every week trapped in stressful, drawn-out price negotiations over text messages. DealRoom equips both parties with autonomous AI agents that verbally negotiate pricing, defend scope boundaries, and generate legally binding Statements of Work (SOWs) in under two minutes."*

#### 02. What is the non-obvious hard part?
> *"Conversational cadence, latency, and game-theoretic convergence. Getting two adversarial LLMs with opposing financial goals to negotiate out loud via synthesized speech—without interrupting each other, without stalling into deadlock, and while converging toward the true Pareto-optimal Nash Equilibrium in under 500 milliseconds per turn."*

#### 03. What did you build versus what did the API give you?
> *"The raw model APIs simply generate text. We engineered the entire decision and execution harness around them:
> 1. Real-time Nash Equilibrium Bargaining Radar with live telemetry.
> 2. Secret Whisper Human Supervisor Loop allowing real-time voice overrides.
> 3. LlamaIndex RAG Engine for sentence-chunked contract clause citations.
> 4. Asynchronous Neon PostgreSQL persistence queue with SHA-256 state hashing.
> 5. Dynamic Vocal Prosody engine modulating speech rates based on negotiation pressure."*

#### 04. Why does this break if you remove the AI?
> *"If you remove the AI, you cannot dynamically interpret unstandardized Upwork job postings, defend complex engineering trade-offs (e.g., trading weekly review cadence for lower rates), or evaluate commercial curveballs like unpaid trial demands."*

#### 05. What breaks at 10,000 users?
> *"Token concurrency rate limits and persistent WebSocket connection load. We solved this with sub-second circuit breakers, local sentence chunking via LlamaIndex, Edge TTS streaming, and daemon database worker queues."*

---

### 🗺️ Deliverable #3: Full-Stack Architecture Diagram

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                 CLIENT (REACT + VITE)                   │
                              │  • Translucent Liquid Glassmorphism UI (Black & White)   │
                              │  • Web Speech API Native In-Browser Microphone STT      │
                              │  • Audio Frequency Soundwave Spectrum Visualizer        │
                              │  • Live Pareto Frontier & Vocal Conviction Radar        │
                              └───────────┬─────────────────────────────────┬───────────┘
                                          │ HTTP (REST)                     │ WebSocket (Full Duplex)
                                          ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       FASTAPI BACKEND ORCHESTRATOR                                     │
│                                                                                                        │
│   ┌───────────────────────────┐   ┌───────────────────────────┐   ┌────────────────────────────────┐   │
│   │   Multimodal Vision RAG   │   │  Turn & Game Coordinator  │   │     Dynamic Vocal Prosody      │   │
│   │   • LlamaIndex Core       │   │  • Gemini 2.5 (Agent A)   │   │   • Edge Neural TTS Engine     │   │
│   │   • pypdf Stream Parser   │   │  • Groq Llama-3 (Agent B) │   │   • Cadence Rate Modulation    │   │
│   │   • Screenshot OCR Vision │   │  • Curveball Value Engine │   │   • 150ms Low-Latency Stream   │   │
│   └─────────────┬─────────────┘   └─────────────┬─────────────┘   └────────────────┬───────────────┘   │
│                 │                               │                                  │                   │
│                 ▼                               ▼                                  ▼                   │
│   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                        Zero-Latency Circuit Breakers & Fallback Router                         │   │
│   └─────────────────────────────────────────────┬──────────────────────────────────────────────────┘   │
│                                                 │                                                      │
│                                                 ▼                                                      │
│   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                    Asynchronous Non-Blocking Worker Thread Persistence Queue                   │   │
│   └─────────────────────────────────────────────┬──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┼──────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                        ┌───────────────────────────────────────────────────┐
                        │      NEON SERVERLESS POSTGRESQL (AWS us-east-2)   │
                        │  • Sessions Table (Metadata & Nash Scores)        │
                        │  • Turns Table (Transcript & Offer History)       │
                        │  • Contracts Table (Full SOW / MSA Markdown)      │
                        │  • Audit Logs Table (SHA-256 Tamper-Proof Trail)  │
                        └───────────────────────────────────────────────────┘
```
