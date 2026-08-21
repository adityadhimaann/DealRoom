# 🛠️ DealRoom Engineering Failure Log & Retrospective
> **24-Hour AI Hackathon · Compulsory Deliverable #4**  
> *"Engineering maturity is the tie-breaker: what we tried that failed, what our system still gets wrong, and what we would fix with another week."*

---

### 1. What We Tried That Failed (and How We Fixed It)

#### Failure 1: Synchronous PostgreSQL Cloud WAN Latency (400ms – 700ms Bottleneck)
- **What happened:** In our initial implementation, persisting each conversational turn, speech audio metadata, and cryptographic audit hash directly to remote **Neon Serverless PostgreSQL (AWS us-east-2)** via synchronous `psycopg2` calls introduced a 400ms–700ms round-trip network delay.
- **Why it failed:** This ruined the real-time verbal illusion of an adversarial phone conversation, causing perceptible conversational dead air.
- **The Fix:** We architected an asynchronous, in-memory non-blocking background queue (`db_service._worker_loop`) with daemon worker threads. The frontend WebSocket stream receives the counter-offer in **0ms**, while relational persistence and SHA-256 block creation execute in the background.

#### Failure 2: 429 Quota Rate Limits Triggering 48-Second SDK Retry Freezes
- **What happened:** During intense multi-turn bargaining simulations, rapid requests to Gemini and Groq occasionally breached free-tier tokens-per-minute (TPM) limits. The default SDK clients attempted exponential backoff retries with timeouts up to 48 seconds.
- **Why it failed:** A voice bargaining engine cannot wait 48 seconds for a spoken counter-offer.
- **The Fix:** We implemented a zero-latency circuit-breaker pattern (`self.gemini_cooldown_until` / `self.groq_cooldown_until`). When a 429 response is received, a 120-second cooldown is cached, and the agent immediately falls back to a deterministic Nash-anchored tactical rules engine in **0.05 seconds**.

#### Failure 3: Speech Recognition Dollar Sign Regex Parsing Collisions
- **What happened:** When humans used the live microphone to whisper instructions (*e.g., "Don't go above 14k" or "accept fifty dollars"*), native Web Speech API transcribed words phonetically without standardized currency symbols.
- **Why it failed:** Simple integer parsers failed to extract the numbers, leading to ignored supervisor whispers.
- **The Fix:** We built a multi-format phonetic number normalizer supporting `$14,000`, `14k`, `fifty dollars`, and Indian Rupee notation (`₹1,50,000`).

---

### 2. What the System Still Gets Wrong

1. **Extreme Edge Cases in Unstructured Scope Creep**:
   - If an uploaded RFP has contradictory milestone percentages (*e.g., 50% deposit + 60% completion = 110%*), the parser defaults to a 50/50 split rather than raising a semantic exception to the user.
2. **Audio Packet Streaming on Cellular Networks**:
   - When running on high-latency mobile networks, Edge-TTS audio playback can experience minor initial buffering (~200ms) compared to fiber connections.

---

### 3. What We Would Build With Another Week

1. **WebRTC Peer-to-Peer Interleaved Voice Streams**:
   - Direct UDP audio socket connections for sub-100ms human voice barge-in and conversational interruption.
2. **Multi-Party Procurement Roundtables**:
   - Expanding from 2 agents to 3+ agents (*e.g., Freelancer Architect vs Client Technical Lead vs Procurement Compliance Officer*).
3. **Automated Upwork / GitHub API Escrow Webhooks**:
   - Direct one-click export of the negotiated SOW to Upwork Contract creation or GitHub Milestone issue tracking.
