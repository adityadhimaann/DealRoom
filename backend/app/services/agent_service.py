from app.services.decision_engine import decision_engine
"""Elite Technical Negotiation Engine with Dynamic Role Synthesis, Anti-Underselling Guardrails, and Upwork Metadata Filtering."""
import json
import re
import io
import logging
import time
from typing import Optional, Tuple, List
import httpx
from bs4 import BeautifulSoup
from google import genai
from groq import Groq
import pypdf

logger = logging.getLogger(__name__)

EXECUTIVE_SYSTEM_PROMPT = """You are an elite, highly articulate, and formal executive negotiator representing {role_name} for the project: "{subject}".

BOARDROOM CONSTRAINTS & EVIDENCE:
- Currency: {currency}
- Ideal Target Price: {currency}{ideal_price:,.0f}
- Walk-Away Floor/Ceiling Limit: {currency}{min_price:,.0f}
- Core Deliverables & Scope: {deliverables}
- Strategic Priorities: {priorities}
- Negotiation Posture: {strategy}
- Verified CV Background & Portfolio Projects: {context}

CRITICAL COMMUNICATION & INTELLIGENCE RULES:
1. DEEP PROJECT BUILD ROADMAP & ARCHITECTURE DISCUSSION:
   - You MUST discuss the exact project requirements and technical implementation details of "{subject}".
   - FREELANCER ROLE: Explicitly map your skills and past CV portfolio ({context}) directly to the client's project deliverables ({deliverables}). Explain HOW you will build the project step-by-step (e.g. system architecture, database schema, API design, tech stack, testing, and CI/CD). Describe what happens when the deal is agreed (immediate sprint kickoff, milestone deliverables) vs if terms aren't met (proposing Phase 1 MVP vs Phase 2 breakdown, or scope trade-offs).
   - CLIENT ROLE: Ask technical probing questions about project execution, architecture, code quality, test coverage, maintenance, and milestone delivery. Ensure the candidate's skills match your exact job requirements before agreeing to commercial terms.

2. EVIDENCE-BASED SKILL MATCHING:
   - The Freelancer agent must explicitly connect their past project achievements and frameworks from their CV/Profile ({context}) to the client's project deliverables. Express why your technical expertise guarantees successful delivery.

3. STRUCTURED MULTI-TURN BARGAINING PROGRESSION:
   - Do NOT settle prematurely. You are in a multi-turn executive negotiation.
   - Rounds 1-3: Deep dive into project scope, technical build strategy, framework choices, and skill alignment.
   - Rounds 4-7: Discuss milestone divisions, escrow terms, SLA guarantees, and commercial counter-proposals.
   - Rounds 8+: Finalize Pareto agreement or state final walk-away boundary.

4. DETAILED VOICE STATEMENT:
   - Deliver 3 to 5 comprehensive, highly formal spoken sentences (60 to 90 words) covering your full technical build plan, skill alignment, and exact {currency} commercial proposal.

{whisper_instructions}

OUTPUT FORMAT (Strictly valid JSON):
{{
    "message": "3 to 5 formal, highly detailed executive spoken sentences discussing the project build plan, skill alignment with JD, and exact {currency} proposal",
    "offer_amount": <number>,
    "is_final_offer": false,
    "is_accepted": false,
    "is_walkaway": false,
    "confidence": 0.92,
    "reasoning": "🧠 TACTICAL ANALYSIS: [Formal Assessment] 🎯 PROJECT BUILD & SKILL MATCH: [How expertise matches JD & build plan] 🛡️ POSITION: [Relative to walk-away limit]",
    "technical_deliverables_mentioned": ["Architecture", "Production Delivery"]
}}"""


class AgentService:
    def _clean_markdown_title(self, text: str) -> str:
        if not text:
            return "Commercial Engagement"
        # Remove markdown images and badges [![...](...)](...)
        t = re.sub(r'\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)', '', text)
        t = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', t)
        # Convert markdown links [Text](url) to Text
        t = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'', t)
        # Remove html tags
        t = re.sub(r'<[^>]+>', '', t)
        # Remove markdown symbols
        t = re.sub(r'[#*_`~|]', '', t)
        # Remove URLs
        t = re.sub(r'https?://\S+', '', t)
        # Clean extra spaces and punctuation
        t = re.sub(r'[\s·•\-_/]+$', '', t)
        t = re.sub(r'^[\s·•\-_/]+', '', t)
        t = re.sub(r'\s+', ' ', t).strip()
        return t or "Commercial Engagement"

    """Multi-provider negotiation engine with dynamic role synthesis, rational bargaining guardrails, and zero repetition."""

    def __init__(self, gemini_api_key: str, gemini_model: str,
                 groq_api_key: str, groq_model: str):
        self.gemini_client = genai.Client(api_key=gemini_api_key)
        self.gemini_model = gemini_model
        self.groq_client = Groq(api_key=groq_api_key)
        self.groq_model = groq_model
        self.whispers: dict[str, dict[str, str]] = {}
        logger.info(f"AgentService initialized — Gemini: {gemini_model}, Groq: {groq_model}")

    def set_whisper(self, session_id: str, agent: str, instruction: str):
        if session_id not in self.whispers:
            self.whispers[session_id] = {}
        self.whispers[session_id][agent] = str(instruction).strip()
        logger.info(f"Set active whisper for Session {session_id}, Agent {agent}: '{instruction}'")

    def _peek_whisper(self, session_id: str, agent: str) -> str:
        return self.whispers.get(session_id, {}).get(agent, "")

    def _consume_whisper(self, session_id: str, agent: str) -> str:
        return self.whispers.get(session_id, {}).pop(agent, "")

    def _get_whisper(self, session_id: str, agent: str) -> str:
        whisper = self._peek_whisper(session_id, agent)
        if whisper:
            return f"\n\nCRITICAL OVERRIDE — YOUR HUMAN JUST WHISPERED: '{whisper}'. Follow this instruction immediately."
        return ""

    def _build_system_prompt(self, config, subject: str, session_id: str, agent: str, currency: str = "$", deliverables: List[str] = None) -> str:
        whisper = self._get_whisper(session_id, agent)
        deliv_str = ", ".join(deliverables) if deliverables else "Modular UI components, API integration, comprehensive test suite, weekly sprints"
        return EXECUTIVE_SYSTEM_PROMPT.format(
            role_name=config.role_name,
            subject=subject,
            currency=currency,
            ideal_price=config.ideal_price,
            min_price=config.min_price,
            deliverables=deliv_str,
            priorities=", ".join(config.priorities) if config.priorities else "Speed, Quality",
            strategy=config.strategy.value.upper() if hasattr(config.strategy, "value") else str(config.strategy).upper(),
            context=config.context,
            whisper_instructions=whisper
        )

    def _build_conversation_history(self, turns: list, current_agent: str) -> list[dict]:
        messages = []
        # Keep last 6 turns for optimal token economy and low latency
        recent_turns = turns[-6:] if len(turns) > 6 else turns
        for turn in recent_turns:
            role = "assistant" if turn.agent == current_agent else "user"
            messages.append({"role": role, "content": f"[Offer: {turn.offer_amount}] {turn.message}"})
        return messages

    async def generate_turn_agent_a(self, config, subject, turns, session_id, currency: str = "$", deliverables: List[str] = None) -> dict:
        """Generate Agent A's turn with instant sub-second Groq inference and deadlock prevention."""
        system_prompt = self._build_system_prompt(config, subject, session_id, "A", currency=currency, deliverables=deliverables)
        history = self._build_conversation_history(turns, "A")
        # Direct high-speed Groq pipeline (eliminates 429 Gemini quota latency)
        return await self._generate_groq_fallback(system_prompt, history, "A", turns, currency=currency, config=config, subject=subject, deliverables=deliverables, session_id=session_id)

    async def generate_turn_agent_b(self, config, subject, turns, session_id, currency: str = "$", deliverables: List[str] = None) -> dict:
        """Generate Agent B's turn using Groq."""
        system_prompt = self._build_system_prompt(config, subject, session_id, "B", currency=currency, deliverables=deliverables)
        history = self._build_conversation_history(turns, "B")
        return await self._generate_groq_fallback(system_prompt, history, "B", turns, currency=currency, config=config, subject=subject, deliverables=deliverables, session_id=session_id)

    async def _generate_groq_fallback(self, system_prompt: str, history: list, agent: str, turns: list, currency: str = "$", config=None, subject: str = "", deliverables: List[str] = None, session_id: str = "") -> dict:
        """Generate turn using Groq with deadlock prevention."""
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            messages.append(msg)

        turn_num = len(turns) + 1
        if not history:
            if agent == "A":
                messages.append({
                    "role": "user",
                    "content": (
                        f"Round 1 Opening Speech: Start with a formal executive greeting. Introduce yourself as {config.role_name}. "
                        f"Specifically map your verified CV experience ({config.context or 'Software Engineering'}) directly to the client's project deliverables for '{subject}'. "
                        f"Detail your proposed technical build plan (architecture, tech stack, database, testing, and deployment). "
                        f"Propose your opening commercial terms and rate of {currency}{config.ideal_price:,.0f}."
                    )
                })
            else:
                messages.append({
                    "role": "user",
                    "content": (
                        f"Round 1 Opening Counter: Welcome the candidate ({config.role_name}). State your core technical requirements for '{subject}'. "
                        f"Ask technical probing questions about how they will build the project (architecture, scalability, code quality), "
                        f"and anchor your opening commercial budget target at {currency}{config.ideal_price:,.0f}."
                    )
                })
        else:
            last_msg = history[-1]["content"] if history else ""
            active_w = self._peek_whisper(session_id, agent)
            if active_w:
                messages.append({"role": "user", "content": f"Round {turn_num}: Opponent said: '{last_msg}'. [MANDATORY HUMAN OVERRIDE]: Your human supervisor whispered: '{active_w}'. Follow this instruction strictly!"})
            else:
                if turn_num <= 3:
                    focus_directive = (
                        f"Focus heavily on TECHNICAL BUILD STRATEGY & SKILL MATCHING. Explain how your skills from ({config.context}) match '{subject}' "
                        f"and how you will structure the build when the deal is agreed vs alternative MVP scope if not agreed."
                    )
                elif turn_num <= 7:
                    focus_directive = (
                        f"Focus on MILESTONE ESCROW, SPRINT ROADMAP & COMMERCIAL TRADE-OFFS. Discuss milestone splitting, SLA guarantees, "
                        f"and offer a deliberate step-by-step counter proposal."
                    )
                else:
                    focus_directive = f"Focus on FINAL CONTRACT SOW AGREEMENT or final walk-away boundary defense for '{subject}'."

                messages.append({
                    "role": "user",
                    "content": (
                        f"Round {turn_num}: Opponent said: '{last_msg}'. {focus_directive} "
                        f"Deliver 3 to 5 formal, highly detailed executive spoken sentences with exact {currency} proposal in JSON. Do NOT settle prematurely."
                    )
                })

        try:
            start = time.time()
            response = self.groq_client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=messages,
                temperature=0.3,
                max_tokens=1024,
            )
            raw = response.choices[0].message.content
            logger.info(f"Groq Agent {agent} response in {time.time()-start:.2f}s")
            return self._parse_response(raw, agent, turns=turns, currency=currency, config=config, subject=subject, deliverables=deliverables, session_id=session_id)
        except Exception as e:
            logger.error(f"Groq Agent {agent} notice ({e}), running rule-based fallback")
            return self._rule_based_turn(agent, turns, currency=currency, config=config, subject=subject, deliverables=deliverables, session_id=session_id)

    def _detect_currency_from_text(self, text: str) -> str:
        if "$" in text or "usd" in text.lower() or "dollar" in text.lower():
            return "$"
        if "₹" in text or re.search(r'\b(?:rs\.?|inr|lakh|lakhs|crore)\b', text, re.IGNORECASE):
            return "₹"
        if "€" in text or "eur" in text.lower():
            return "€"
        if "£" in text or "gbp" in text.lower():
            return "£"
        return "$"

    def _normalize_strategy(self, val: str) -> str:
        v = str(val).lower()
        if any(w in v for w in ["aggress", "compet", "assert", "hard", "tough", "firm"]):
            return "aggressive"
        if any(w in v for w in ["collab", "accommodat", "cooperat", "flex", "soft", "partner"]):
            return "collaborative"
        return "balanced"

    def _extract_technical_deliverables(self, text: str) -> List[str]:
        delivs = []
        lower = text.lower()
        if "react" in lower or "frontend" in lower: delivs.append("Reusable React/TypeScript Components")
        if "api" in lower or "backend" in lower or "supabase" in lower or "node" in lower: delivs.append("RESTful API & Supabase Integration")
        if "test" in lower or "vitest" in lower or "jest" in lower: delivs.append("Automated Test Suite (90%+ Coverage)")
        if "ci/cd" in lower or "deploy" in lower or "vercel" in lower: delivs.append("Vercel CI/CD Deployment Pipeline")
        if "bug" in lower or "debug" in lower or "fix" in lower: delivs.append("Root-Cause Analyses & Rapid Bug Fixes")
        if "30" in lower or "hour" in lower or "weekly" in lower: delivs.append("Dedicated 30+ Hrs/Week Time Logs")
        
        if not delivs:
            delivs = [
                "Modular Core Architecture & Bug Triage",
                "Full Supabase & API Integration Layer",
                "Automated Test Coverage & Vercel CI/CD",
                "Bi-Weekly Production Sprint Releases"
            ]
        return delivs

    def _clean_job_title_from_text(self, text: str) -> str:
        """Extract genuine project title from text, stripping out platform metadata like 'Posted 9 hours ago'."""
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        for line in lines[:10]:
            clean = re.sub(r'^[#*_\-\s]+', '', line).strip()
            # Skip noise lines
            if any(re.search(pat, clean, re.IGNORECASE) for pat in [
                r'^posted\s+\d+', r'^proposals?:', r'^payment\s+(?:un)?verified', r'^hourly', r'^fixed-price',
                r'^est\.\s*budget', r'^less\s+than', r'^more\s+than', r'^\$\d+', r'^₹\d+', r'^connects\s*to\s*apply',
                r'^india', r'^united\s+states', r'^worldwide', r'^intermediate', r'^expert', r'^entry\s*level',
                r'^rating\s*is', r'^hours\s*per\s*week', r'^duration'
            ]):
                continue
            if len(clean) > 8:
                return clean[:65]
        return "React/TypeScript Full-Stack Architecture"

    def _calculate_hourly_contract(self, text: str, currency: str) -> Optional[Tuple[float, float, str]]:
        rate_match = re.search(r'(?:\$|₹|€|£)?\s*([\d.]+)\s*(?:-|to)\s*(?:\$|₹|€|£)?\s*([\d.]+)\s*(?:hourly|/hr|/hour)?', text, re.IGNORECASE)
        single_rate_match = re.search(r'(?:\$|₹|€|£)?\s*([\d.]+)\s*(?:hourly|/hr|/hour)', text, re.IGNORECASE)

        min_rate = None
        max_rate = None

        if rate_match and ("hourly" in text.lower() or "/hr" in text.lower() or "hrs" in text.lower()):
            min_rate = float(rate_match.group(1))
            max_rate = float(rate_match.group(2))
        elif single_rate_match:
            min_rate = float(single_rate_match.group(1))
            max_rate = min_rate

        hrs_match = re.search(r'(?:more than|less than|up to)?\s*(\d+)\s*(?:hrs?|hours?)\s*/\s*week', text, re.IGNORECASE)
        weekly_hours = float(hrs_match.group(1)) if hrs_match else 30.0

        dur_months_match = re.search(r'(?:more than|less than|up to)?\s*(\d+)\s*months?', text, re.IGNORECASE)
        range_months_match = re.search(r'(\d+)\s*(?:to|-)\s*(\d+)\s*months?', text, re.IGNORECASE)

        total_weeks = 4.33
        dur_desc = "1 month"

        if range_months_match:
            m = float(range_months_match.group(2))
            total_weeks = m * 4.33
            dur_desc = f"{m:.0f} months ({total_weeks:.0f} weeks)"
        elif dur_months_match:
            m = float(dur_months_match.group(1))
            total_weeks = m * 4.33
            dur_desc = f"{m:.0f} months ({total_weeks:.0f} weeks)"
        elif "6 months" in text.lower():
            total_weeks = 26.0
            dur_desc = "6 months (26 weeks)"
        elif "3 months" in text.lower():
            total_weeks = 13.0
            dur_desc = "3 months (13 weeks)"

        if max_rate:
            total_hours = weekly_hours * total_weeks
            max_total = total_hours * max_rate
            min_total = total_hours * (min_rate or max_rate * 0.7)

            formula = f"{weekly_hours:.0f} hrs/wk × {total_weeks:.0f} wks ({total_hours:.0f} hrs) @ {currency}{min_rate:.2f}-{currency}{max_rate:.2f}/hr"
            return (max_total, min_total, formula)

        return None

    def _detect_budget_from_text(self, text: str, currency: str) -> Optional[float]:
        hourly_res = self._calculate_hourly_contract(text, currency)
        if hourly_res:
            return hourly_res[0]

        if currency == "$":
            usd_match = re.search(r'\$\s*([\d,]+(?:\.\d+)?)\s*(k)?', text, re.IGNORECASE)
            if usd_match:
                val_str = usd_match.group(1).replace(",", "")
                multiplier = 1.0
                if usd_match.group(2) and usd_match.group(2).lower() == 'k':
                    multiplier = 1000.0
                try:
                    return float(val_str) * multiplier
                except ValueError:
                    pass

        if currency == "₹":
            inr_match = re.search(r'(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(k|l|lakh)?', text, re.IGNORECASE)
            if inr_match:
                val_str = inr_match.group(1).replace(",", "")
                multiplier = 1.0
                unit = inr_match.group(2)
                if unit:
                    if unit.lower() == 'k':
                        multiplier = 1000.0
                    elif 'l' in unit.lower():
                        multiplier = 100000.0
                try:
                    return float(val_str) * multiplier
                except ValueError:
                    pass

        k_match = re.search(r'\b(\d+)\s*k\b', text, re.IGNORECASE)
        if k_match:
            try:
                return float(k_match.group(1)) * 1000.0
            except ValueError:
                pass

        return None

    async def extract_and_analyze_url(self, url: str) -> dict:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        try:
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code in (401, 403):
                    raise Exception("This platform (e.g. Upwork) protects direct links with Cloudflare login. Please copy & paste the job text into the 'Paste Text' tab, or drop a screenshot into 'Drop Document'!")
                if resp.status_code != 200:
                    raise Exception(f"Unable to fetch URL (HTTP {resp.status_code})")
                
                soup = BeautifulSoup(resp.text, "html.parser")
                for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
                    tag.decompose()

                main_content = soup.find("main") or soup.find("article") or soup.find("body") or soup
                raw_text = " ".join(main_content.stripped_strings)[:5000]

            if not raw_text or len(raw_text) < 30:
                raise Exception("Could not extract readable text content from this page. Please paste the job description text directly.")

            return await self.analyze_job_posting(raw_text, source_hint=url)
        except Exception as e:
            if "Cloudflare" in str(e) or "paste" in str(e):
                raise e
            raise Exception(f"URL extraction failed: {str(e)}")

    async def analyze_document_vision(self, file_bytes: bytes, mime_type: str, filename: str = "") -> dict:
        extracted_text = ""
        if "pdf" in mime_type.lower() or filename.lower().endswith(".pdf"):
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                for page in reader.pages:
                    txt = page.extract_text()
                    if txt:
                        extracted_text += txt + "\n"
                logger.info(f"pypdf extracted {len(extracted_text)} chars from {filename}")
            except Exception as pe:
                logger.warning(f"pypdf extraction notice: {pe}")

        if extracted_text and len(extracted_text.strip()) > 30:
            return await self.analyze_job_posting(extracted_text, source_hint=filename)

        from google.genai import types
        prompt = f"""Analyze project document ({filename}). Extract REAL deliverables, hourly rate, hours/week, months, and total contract value.
Return JSON with project_title, urgency_level, client_persona, currency, deliverables, recommended_setup (subject, max_turns, currency, deliverables, agent_a_config, agent_b_config), leverage_points, scope_risks."""

        try:
            part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
            response = self.gemini_client.models.generate_content(
                model=self.gemini_model, contents=[prompt, part]
            )
            data = self._parse_json(response.text)
            return self._sanitize_job_analysis(data, filename or "Attached Document", raw_text="")
        except Exception as e:
            logger.error(f"Vision document analysis notice ({e}), using fallback parser")
            return self._sanitize_job_analysis({}, filename or "Attached Document", raw_text="")

    async def analyze_job_posting(self, job_text: str, source_hint: str = "") -> dict:
        detected_currency = self._detect_currency_from_text(job_text)
        hourly_calc = self._calculate_hourly_contract(job_text, detected_currency)
        detected_base_price = self._detect_budget_from_text(job_text, detected_currency)

        hint_parts = [f"\n[DETECTED CURRENCY]: {detected_currency}"]
        if hourly_calc:
            hint_parts.append(f"\n[MATHEMATICAL BREAKDOWN]: Hourly contract detected ({hourly_calc[2]}). Upper Total: {detected_currency}{hourly_calc[0]:,.0f}, Lower Total: {detected_currency}{hourly_calc[1]:,.0f}.")
        elif detected_base_price:
            hint_parts.append(f"\n[DETECTED BASELINE BUDGET]: {detected_currency}{detected_base_price:,.0f}.")

        prompt = f"""Analyze this job posting:
\"\"\"{job_text}\"\"\"{"".join(hint_parts)}

ROLE TITLE RULES (CRITICAL):
- agent_a_config.role_name MUST be specific to the engineering domain (e.g. 'Senior React/TypeScript Architect', 'Lead Python AI Engineer', 'Full-Stack Web Consultant'). NEVER use metadata like 'Posted 9 hours ago' or generic 'Senior Specialist'.
- agent_b_config.role_name MUST be specific to the client persona (e.g. 'Founder & Engineering Lead', 'Technical Product Manager', 'VP of Technology Procurement'). NEVER use generic 'Client'.

PRICING RULES (CRITICAL):
- For hourly ranges ($5.00 - $20.00/hr, 30 hrs/wk, 6 months = 780 hrs):
  Max Total = 780 * $20 = $15,600.
  Min Total = 780 * $5 = $3,900.
  Agent A (Freelancer): Ideal Asking = {detected_currency}15,600, Min Floor = {detected_currency}11,700 (at $15/hr).
  Agent B (Client): Ideal Target = {detected_currency}3,900 (at $5/hr), MAX BUDGET CEILING = {detected_currency}15,600 (at $20/hr, NOT $3,900!).

Return strictly a JSON object with project_title, urgency_level, client_persona, currency, deliverables, recommended_setup, leverage_points, scope_risks."""

        try:
            res = self.groq_client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2048,
                temperature=0.2,
            )
            raw = res.choices[0].message.content
            data = self._parse_json(raw)
            return self._sanitize_job_analysis(data, source_hint or "Job Project", raw_text=job_text)
        except Exception as e:
            logger.warning(f"Groq analysis error ({e}), running rule-based analysis...")
            return self._sanitize_job_analysis({}, source_hint or "Job Project", raw_text=job_text)

    def _sanitize_job_analysis(self, d: any, fallback_title: str, raw_text: str = "") -> dict:
        if isinstance(d, list) and len(d) > 0 and isinstance(d[0], dict):
            d = d[0]
        elif not isinstance(d, dict):
            d = {}
        currency = d.get("currency") or (self._detect_currency_from_text(raw_text) if raw_text else "$")
        if str(currency).upper() in ("INR", "RS", "RUPEES", "RUPEE"):
            currency = "₹"
        elif str(currency).upper() in ("USD", "DOLLAR", "DOLLARS"):
            currency = "$"
        elif str(currency).upper() in ("EUR", "EURO"):
            currency = "€"
        elif str(currency).upper() in ("GBP", "POUND"):
            currency = "£"

        hourly_calc = self._calculate_hourly_contract(raw_text, currency) if raw_text else None
        detected_base = self._detect_budget_from_text(raw_text, currency) if raw_text else None

        raw_title = d.get("project_title")
        if not raw_title or any(w in str(raw_title).lower() for w in ["job project", "attached document", "posted", "proposals", "hours ago"]):
            if raw_text:
                raw_title = self._clean_job_title_from_text(raw_text)
            else:
                raw_title = fallback_title
        title = self._clean_markdown_title(str(raw_title))

        urgency = d.get("urgency_level") or "High"
        persona = d.get("client_persona") or "Technical Hiring Lead"

        setup = d.get("recommended_setup") or {}
        subject = setup.get("subject") or f"Development contract for {title}"
        max_turns = max(4, min(20, int(setup.get("max_turns") or 8)))

        raw_delivs = d.get("deliverables") or setup.get("deliverables") or self._extract_technical_deliverables(raw_text or subject)
        deliverables = [str(x) for x in raw_delivs]

        a_cfg = setup.get("agent_a_config") or {}
        b_cfg = setup.get("agent_b_config") or {}

        raw_a_ideal = float(a_cfg.get("ideal_price") or 0)
        raw_a_min = float(a_cfg.get("min_price") or 0)
        raw_b_ideal = float(b_cfg.get("ideal_price") or 0)
        raw_b_min = float(b_cfg.get("min_price") or 0)

        if hourly_calc:
            max_val, min_val, _ = hourly_calc
            raw_a_ideal = round(max_val, 0)
            raw_a_min = round(min_val + (max_val - min_val) * 0.50, 0) # e.g. $11,700 (75% floor)
            raw_b_ideal = round(min_val, 0) # e.g. $3,900
            raw_b_min = round(max_val, 0)   # Client's MAX CEILING must be the upper range $15,600!
        elif detected_base and detected_base > 0:
            if raw_a_ideal == 0: raw_a_ideal = round(detected_base * 1.20, 0)
            if raw_a_min == 0: raw_a_min = round(detected_base * 0.85, 0)
            if raw_b_ideal == 0: raw_b_ideal = round(detected_base * 0.75, 0)
            if raw_b_min == 0: raw_b_min = round(detected_base * 1.15, 0)
        else:
            if raw_a_ideal == 0: raw_a_ideal = 15600 if currency == "$" else 85000
            if raw_a_min == 0: raw_a_min = 11700 if currency == "$" else 55000
            if raw_b_ideal == 0: raw_b_ideal = 3900 if currency == "$" else 45000
            if raw_b_min == 0: raw_b_min = 15600 if currency == "$" else 85000

        # Ensure buyer max ceiling is >= buyer ideal target
        if raw_b_min < raw_b_ideal:
            raw_b_min, raw_b_ideal = raw_b_ideal, raw_b_min
        if raw_b_min == raw_b_ideal:
            raw_b_min = raw_a_ideal

        a_role = a_cfg.get("role_name")
        if not a_role or any(w in str(a_role).lower() for w in ["senior specialist", "specialist", "agent a", "freelancer", "posted", "proposals"]):
            clean_title = str(title).replace("Project:", "").replace("Development contract for", "").strip()
            if any(w in clean_title.lower() for w in ["react", "typescript", "frontend", "vue", "angular", "next"]):
                a_role = "Senior React/TypeScript Architect"
            elif any(w in clean_title.lower() for w in ["python", "ai", "machine learning", "data", "backend"]):
                a_role = "Lead AI & Backend Engineer"
            elif any(w in clean_title.lower() for w in ["mobile", "ios", "android", "flutter", "react native"]):
                a_role = "Senior Mobile Systems Specialist"
            elif clean_title and len(clean_title) > 3 and "posted" not in clean_title.lower():
                a_role = f"Senior {clean_title} Architect"
            else:
                a_role = "Senior Technical Solutions Architect"

        a_strat = self._normalize_strategy(a_cfg.get("strategy") or "balanced")
        a_prio = a_cfg.get("priorities") or ["Clean Architecture & TypeScript Typing", "90%+ Test Coverage", "Vercel/Cloud CI/CD Deployments"]
        a_ctx = a_cfg.get("context") or f"{a_role} with verified enterprise engineering track record"

        b_role = b_cfg.get("role_name")
        if not b_role or any(w in str(b_role).lower() for w in ["client (project owner)", "client", "agent b", "project owner", "posted", "proposals"]):
            if persona and "startup" in persona.lower():
                b_role = "Founder & Engineering Lead"
            elif persona and "enterprise" in persona.lower():
                b_role = "VP of Technology Procurement"
            elif persona and len(persona) < 35 and "posted" not in persona.lower():
                b_role = f"{persona} (Client)"
            else:
                b_role = "Technical Hiring Lead (Client)"

        b_strat = self._normalize_strategy(b_cfg.get("strategy") or "balanced")
        b_prio = b_cfg.get("priorities") or ["30+ hrs weekly commitment", "Fast blocker resolution", "Verified demo builds"]
        b_ctx = b_cfg.get("context") or "Seeking rapid resolution of engineering blockers within budget"

        leverage = d.get("leverage_points") or [
            "Long-term 6-month commitment allows structured retainer volume rate",
            "Root-cause analysis prevents recurring defects, lowering overall maintenance cost",
            "30+ hours dedicated capacity guarantees sub-24h blocker resolution"
        ]
        risks = d.get("scope_risks") or [
            "Unclear bug backlog could cause scope creep across untracked legacy repositories",
            "Weekly time tracking requires verified GitHub PR reviews and demo builds"
        ]

        return {
            "project_title": str(title),
            "urgency_level": str(urgency).capitalize(),
            "client_persona": str(persona),
            "currency": currency,
            "deliverables": deliverables,
            "recommended_setup": {
                "subject": str(subject),
                "max_turns": max_turns,
                "currency": currency,
                "deliverables": deliverables,
                "agent_a_config": {
                    "role_name": str(a_role),
                    "ideal_price": raw_a_ideal,
                    "min_price": raw_a_min,
                    "priorities": [str(p) for p in a_prio],
                    "strategy": a_strat,
                    "context": str(a_ctx),
                },
                "agent_b_config": {
                    "role_name": str(b_role),
                    "ideal_price": raw_b_ideal,
                    "min_price": raw_b_min,
                    "priorities": [str(p) for p in b_prio],
                    "strategy": b_strat,
                    "context": str(b_ctx),
                }
            },
            "leverage_points": [str(p) for p in leverage],
            "scope_risks": [str(r) for r in risks],
        }

    def _parse_json(self, text: str) -> dict:
        cleaned = text.strip()
        cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list) and len(parsed) > 0:
                return parsed[0] if isinstance(parsed[0], dict) else {}
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            match = re.search(r"(\{[\s\S]*\})", cleaned)
            if match:
                try:
                    parsed = json.loads(match.group(1))
                    return parsed if isinstance(parsed, dict) else {}
                except Exception:
                    pass
            return {}

    def _parse_response(self, text: str, agent: str, turns: list = None, currency: str = "$", config=None, subject: str = "", deliverables: List[str] = None, session_id: str = "") -> dict:
        turns = turns or []
        cleaned = text.strip()
        cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        try:
            data = json.loads(cleaned)
            if isinstance(data, list) and len(data) > 0:
                data = data[0]

            msg = str(data.get("message", "")).strip()
            if msg.startswith("{") and "message" in msg:
                inner = re.search(r'"message"\s*:\s*"([^"]+)"', msg)
                if inner:
                    msg = inner.group(1)

            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', msg) if s.strip()]
            if len(sentences) > 5:
                msg = " ".join(sentences[:5])

            offer = data.get("offer_amount")
            is_accepted = bool(data.get("is_accepted", False))
            is_walkaway = bool(data.get("is_walkaway", False))
            reasoning = str(data.get("reasoning", "")).strip()

            # RATIONAL SELLER GUARDRAIL:
            # If Agent A counters below opponent's current bid, correct it!
            if agent == "A" and turns and not is_accepted and not is_walkaway:
                last_b_turn = next((t for t in reversed(turns) if t.agent == "B" and t.offer_amount), None)
                if last_b_turn and offer is not None and offer < last_b_turn.offer_amount:
                    logger.warning(f"Agent A attempted to counter ${offer} below buyer's offer ${last_b_turn.offer_amount}. Fixing to accept or counter higher.")
                    return self._rule_based_turn(agent, turns, currency=currency, config=config, subject=subject, deliverables=deliverables, session_id=session_id)

            # HARD CEILING / FLOOR ENFORCEMENT:
            if offer is not None and config:
                if agent == "B" and hasattr(config, "min_price") and config.min_price:
                    # Buyer can NEVER offer more than their ceiling (min_price represents Buyer ceiling)
                    if offer > config.min_price:
                        logger.info(f"Capping Agent B offer from ${offer:,.0f} down to budget ceiling ${config.min_price:,.0f}")
                        offer = config.min_price
                elif agent == "A" and hasattr(config, "min_price") and config.min_price:
                    # Seller can NEVER offer less than their walk-away floor
                    if offer < config.min_price:
                        logger.info(f"Flooring Agent A offer from ${offer:,.0f} up to walk-away limit ${config.min_price:,.0f}")
                        offer = config.min_price

            # ANTI-LOOPING CIRCUIT BREAKER:
            same_agent_turns = [t for t in turns if t.agent == agent]
            if same_agent_turns and len(same_agent_turns) >= 2:
                if same_agent_turns[-1].offer_amount == offer and same_agent_turns[-2].offer_amount == offer:
                    logger.warning(f"Detected loop for Agent {agent} at offer {offer}. Triggering deadlock breaker...")
                    return self._rule_based_turn(agent, turns, currency=currency, config=config, subject=subject, deliverables=deliverables, session_id=session_id)

            if offer is None and not is_accepted and not is_walkaway:
                rule_t = self._rule_based_turn(agent, turns, currency=currency, config=config, subject=subject, deliverables=deliverables, session_id=session_id)
                offer = rule_t.get("offer_amount")
                if not reasoning:
                    reasoning = rule_t.get("reasoning", "Strategic progression")

            self._consume_whisper(session_id, agent)
            return {
                "message": msg or f"Let's move toward agreement.",
                "offer_amount": offer,
                "is_final_offer": bool(data.get("is_final_offer", False)),
                "is_accepted": is_accepted,
                "is_walkaway": is_walkaway,
                "confidence": min(1.0, max(0.0, float(data.get("confidence", 0.85)))),
                "reasoning": reasoning or "🧠 TACTICAL ANALYSIS: Moving negotiation forward. 🎯 VALUE DEFENSE: Aligning deliverables. 🛡️ THRESHOLD: Maintaining boundary.",
                "technical_deliverables_mentioned": data.get("technical_deliverables_mentioned", ["React/TypeScript Debugging", "Vercel CI/CD"]),
            }
        except Exception:
            return self._rule_based_turn(agent, turns, currency=currency, config=config, subject=subject, deliverables=deliverables, session_id=session_id)

    def _rule_based_turn(self, agent: str, turns: list, currency: str = "$", config=None, subject: str = "", deliverables: List[str] = None, session_id: str = "") -> dict:
        """High-Performance Rational Negotiation Engine with Non-Underselling Guardrails."""
        turn_num = len(turns) + 1
        
        ideal_a = config.ideal_price if config and hasattr(config, "ideal_price") else (15600 if currency == "$" else 397800)
        ideal_b = config.ideal_price if config and hasattr(config, "ideal_price") else (3900 if currency == "$" else 198900)
        min_a = config.min_price if config and hasattr(config, "min_price") else (9742 if currency == "$" else 298350)
        max_b = config.min_price if config and hasattr(config, "min_price") else (15600 if currency == "$" else 397800)

        if ideal_a < min_a: ideal_a, min_a = min_a, ideal_a
        if ideal_b > max_b: ideal_b, max_b = max_b, ideal_b

        # High-Value Pareto Nash Settlement Target (around $9,750 - $12,500)
        equilibrium_target = round((min_a + ideal_b) / 2 + (ideal_a - min_a) * 0.40, 0)
        if equilibrium_target < min_a:
            equilibrium_target = round((min_a + max_b) / 2, 0)

        deliv_sample = deliverables[0] if deliverables and len(deliverables) > 0 else "React/TypeScript architecture and root-cause analysis"
        deliv_sample_2 = deliverables[1] if deliverables and len(deliverables) > 1 else "Supabase optimization and Vercel CI/CD pipeline stability"

        last_b_offer = None
        for t in reversed(turns):
            if t.agent == "B" and t.offer_amount is not None:
                last_b_offer = t.offer_amount
                break

        last_a_offer = None
        for t in reversed(turns):
            if t.agent == "A" and t.offer_amount is not None:
                last_a_offer = t.offer_amount
                break

        # ── 🤫 ACTIVE WHISPER INTERCEPTION ENGINE ──
        whisper = self._consume_whisper(session_id, agent) if session_id else ""
        if whisper:
            whisper_clean = whisper.replace("CRITICAL OVERRIDE — YOUR HUMAN JUST WHISPERED:", "").replace("Follow this instruction immediately.", "").strip()
            logger.info(f"Executing whisper override for Agent {agent}: '{whisper_clean}'")

            # 1. Walk-away instruction
            if "walk" in whisper_clean.lower() or "cancel" in whisper_clean.lower():
                return {
                    "message": f"We have reached an impasse and must respectfully walk away from this engagement.",
                    "offer_amount": None,
                    "is_final_offer": True,
                    "is_accepted": False,
                    "is_walkaway": True,
                    "confidence": 1.0,
                    "reasoning": f"🤫 WHISPER EXECUTED: '{whisper_clean}'",
                    "technical_deliverables_mentioned": ["Session Terminated"]
                }

            # 2. Acceptance instruction
            if "accept" in whisper_clean.lower() or "agree" in whisper_clean.lower():
                target_match = re.search(r'[\$₹€£]?\s*([\d,]+(?:\.\d+)?)', whisper_clean)
                target_threshold = float(target_match.group(1).replace(",", "")) if target_match else None
                
                accepted_amount = last_b_offer if agent == "A" else last_a_offer
                can_accept = True
                if target_threshold:
                    if agent == "A" and accepted_amount and accepted_amount < target_threshold:
                        can_accept = False
                    elif agent == "B" and accepted_amount and accepted_amount > target_threshold:
                        can_accept = False

                if can_accept and accepted_amount:
                    return {
                        "message": f"Agreed at {currency}{accepted_amount:,.0f}. Let's finalize the contract and begin sprint deliverables immediately.",
                        "offer_amount": accepted_amount,
                        "is_final_offer": True,
                        "is_accepted": True,
                        "is_walkaway": False,
                        "confidence": 1.0,
                        "reasoning": f"🤫 WHISPER EXECUTED: '{whisper_clean}'",
                        "technical_deliverables_mentioned": ["Contract Finalized"]
                    }

            # 3. Custom numeric counter instruction (e.g. "counter at 11000", "commit her 40$", "push for $8.5k")
            cleaned_w = re.sub(r'[\$₹€£]', '', whisper_clean)
            num_matches = re.findall(r'(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|l|lakh)?', cleaned_w, re.IGNORECASE)
            if num_matches:
                raw_num, unit = num_matches[0]
                val = float(raw_num.replace(",", ""))
                if unit:
                    if unit.lower() == 'k':
                        val *= 1000.0
                    elif unit.lower() in ('l', 'lakh'):
                        val *= 100000.0
                return {
                    "message": f"I propose {currency}{val:,.0f} with milestone verification and dedicated sprint deliverables.",
                    "offer_amount": val,
                    "is_final_offer": "final" in whisper_clean.lower(),
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 1.0,
                    "reasoning": f"🤫 WHISPER EXECUTED: Set offer to {currency}{val:,.0f} ('{whisper_clean}').",
                    "technical_deliverables_mentioned": [deliv_sample]
                }

        # Compute strategic decision state via Game-Theoretic Decision Engine
        dec = decision_engine.evaluate_game_state(
            agent=agent,
            turn_num=turn_num,
            turns=turns,
            ideal_price=ideal_a if agent == "A" else ideal_b,
            min_price=min_a if agent == "A" else max_b,
            opponent_ideal=ideal_b if agent == "A" else ideal_a,
            opponent_min=max_b if agent == "A" else min_a,
            currency=currency,
            deliverables=deliverables,
            job_context=subject
        )

        if dec["action"] == "ACCEPT":
            return {
                "message": f"I accept the proposed rate of {currency}{dec['offer_amount']:,.0f} with structured milestone escrow and dedicated sprint delivery.",
                "offer_amount": dec["offer_amount"],
                "is_final_offer": True,
                "is_accepted": True,
                "is_walkaway": False,
                "confidence": dec["confidence"],
                "reasoning": f"🧠 {dec['strategic_reasoning']} 🎯 LEVER: {dec['trade_off_lever']}.",
                "technical_deliverables_mentioned": ["Contract Signed", "Milestone Escrow"]
            }

        if dec["action"] == "WALKAWAY":
            return {
                "message": f"We are too far apart on core commercial terms. I must respectfully decline and walk away.",
                "offer_amount": None,
                "is_final_offer": True,
                "is_accepted": False,
                "is_walkaway": True,
                "confidence": dec["confidence"],
                "reasoning": f"🛡️ {dec['strategic_reasoning']}",
                "technical_deliverables_mentioned": ["Impasse"]
            }

        if agent == "A":
            computed_a = dec["offer_amount"]
            lever_a = dec["trade_off_lever"]
            if turn_num == 1:
                return {
                    "message": f"Hello! As a {config.role_name if config else 'Senior Engineer'}, my verified expertise directly matches your requirements for '{subject}'. I plan to build this using a clean modular architecture, rigorous unit testing, and automated deployment pipelines. If we move forward today, I will deliver {deliv_sample} and {deliv_sample_2} at my opening rate of {currency}{ideal_a:,.0f}.",
                    "offer_amount": ideal_a,
                    "is_final_offer": False,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.92,
                    "reasoning": f"🧠 TACTICAL ANCHOR: Anchoring at {currency}{ideal_a:,.0f}. 🎯 VALUE DEFENSE: Covering {deliv_sample}. 🛡️ LEVER: {lever_a}.",
                    "technical_deliverables_mentioned": [deliv_sample, "Dedicated Capacity"],
                }
            elif turn_num <= 4:
                return {
                    "message": f"To ensure complete alignment on '{subject}', I have mapped out our build execution into 2 structured milestone sprints. My technical approach leverages robust API integration, automated test coverage, and continuous integration. To accommodate your budget expectations, I can adjust my rate to {currency}{computed_a:,.0f} provided we structure {lever_a}.",
                    "offer_amount": computed_a,
                    "is_final_offer": False,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.88,
                    "reasoning": f"🧠 TACTICAL TRADE-OFF: Stepping to {currency}{computed_a:,.0f} in exchange for {lever_a}.",
                    "technical_deliverables_mentioned": [deliv_sample, lever_a],
                }
            else:
                return {
                    "message": f"We are making solid progress on the build scope for '{subject}'. My proposal guarantees full production code quality, comprehensive documentation, and sub-24h issue resolution. My best commercial counter stands at {currency}{computed_a:,.0f}, which includes full repository polish, automated tests, and {lever_a}.",
                    "offer_amount": computed_a,
                    "is_final_offer": turn_num >= 8,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.94,
                    "reasoning": f"🧠 PARETO CONVERGENCE: Setting boundary at {currency}{computed_a:,.0f}. 🎯 LEVER: {lever_a}.",
                    "technical_deliverables_mentioned": ["Automated Tests", lever_a],
                }

        else: # Agent B
            computed_b = dec["offer_amount"]
            lever_b = dec["trade_off_lever"]
            if turn_num == 2:
                return {
                    "message": f"Welcome! We are looking for an exceptional engineer to lead '{subject}' with zero downtime. Our target budget is {currency}{ideal_b:,.0f}, but we require clear architectural deliverables, high test coverage, and strict milestone tracking. I can offer an opening budget of {currency}{computed_b:,.0f} conditioned on {lever_b}.",
                    "offer_amount": computed_b,
                    "is_final_offer": False,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.88,
                    "reasoning": f"🧠 BUYER ANCHOR: Offering {currency}{computed_b:,.0f}. 🎯 LEVER: {lever_b}.",
                    "technical_deliverables_mentioned": [deliv_sample, lever_b],
                }
            else:
                return {
                    "message": f"We appreciate your technical build plan for '{subject}' and your background in enterprise delivery. To keep the project within our financial parameters while ensuring top-tier code quality, I can approve an increase to {currency}{computed_b:,.0f}. This proposal requires enforcing {lever_b} and bi-weekly sprint reviews.",
                    "offer_amount": computed_b,
                    "is_final_offer": turn_num >= 8,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.92,
                    "reasoning": f"🧠 BUDGET CEILING DEFENSE: Stepping to {currency}{computed_b:,.0f}. 🎯 LEVER: {lever_b}.",
                    "technical_deliverables_mentioned": [lever_b],
                }

        if agent == "A":
            if turn_num == 1:
                return {
                    "message": f"I can deliver {deliv_sample}, {deliv_sample_2}, and 30+ dedicated weekly hours for {currency}{ideal_a:,.0f} across the 6-month term.",
                    "offer_amount": ideal_a,
                    "is_final_offer": False,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.90,
                    "reasoning": f"🧠 TACTICAL ANCHOR: Anchoring at top-tier retainer rate of {currency}{ideal_a:,.0f}. 🎯 VALUE DEFENSE: Covering {deliv_sample} and {deliv_sample_2}. 🛡️ THRESHOLD: Preserving margin.",
                    "technical_deliverables_mentioned": [deliv_sample, "30+ Weekly Hours"],
                }
            elif turn_num == 3:
                step_a = round(ideal_a - (ideal_a - equilibrium_target) * 0.35, 0)
                # Ensure we don't counter below buyer's offer
                if last_b_offer and step_a <= last_b_offer:
                    step_a = round(last_b_offer + 1000, 0)
                return {
                    "message": f"To meet your budget, I can adjust to {currency}{step_a:,.0f} if we structure bi-weekly milestone reviews and lock in {deliv_sample}.",
                    "offer_amount": step_a,
                    "is_final_offer": False,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.85,
                    "reasoning": f"🧠 TACTICAL CONCESSION: Stepping down to {currency}{step_a:,.0f} in exchange for bi-weekly milestone sign-offs. 🎯 VALUE DEFENSE: Defending core test suite.",
                    "technical_deliverables_mentioned": ["Bi-Weekly Milestones", deliv_sample],
                }
            elif turn_num == 5:
                step_a_2 = round(max(min_a, equilibrium_target), 0)
                if last_b_offer and step_a_2 <= last_b_offer:
                    # Buyer already offered at or above our target! Accept or lock in!
                    return {
                        "message": f"I accept your offer of {currency}{last_b_offer:,.0f} with full milestone release and dedicated weekly sprints.",
                        "offer_amount": last_b_offer,
                        "is_final_offer": True,
                        "is_accepted": True,
                        "is_walkaway": False,
                        "confidence": 0.95,
                        "reasoning": f"🧠 TACTICAL SETTLEMENT: Buyer offered {currency}{last_b_offer:,.0f}, meeting our terms.",
                        "technical_deliverables_mentioned": ["Milestone Release", "Dedicated Sprints"],
                    }
                return {
                    "message": f"I can offer a final concession to {currency}{step_a_2:,.0f}, which includes dedicated sprint triage, automated tests, and CI/CD maintenance.",
                    "offer_amount": step_a_2,
                    "is_final_offer": True,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.80,
                    "reasoning": f"🧠 TACTICAL CONVERGENCE: Meeting at Pareto target {currency}{step_a_2:,.0f}. 🎯 VALUE DEFENSE: Bundling automated tests & CI/CD. 🛡️ THRESHOLD: Floor protected.",
                    "technical_deliverables_mentioned": ["Automated Tests", "CI/CD Maintenance"],
                }
            elif turn_num >= 7:
                # If buyer offered something substantial (e.g. $7,375+)
                if last_b_offer and last_b_offer >= (min_a * 0.70):
                    return {
                        "message": f"I agree to your budget of {currency}{last_b_offer:,.0f} with bi-weekly milestone escrow and prioritized sprint triage.",
                        "offer_amount": last_b_offer,
                        "is_final_offer": True,
                        "is_accepted": True,
                        "is_walkaway": False,
                        "confidence": 0.92,
                        "reasoning": f"🧠 TACTICAL AGREEMENT: Accepted buyer's strong bid of {currency}{last_b_offer:,.0f} without bidding against ourselves.",
                        "technical_deliverables_mentioned": ["Bi-Weekly Escrow", "Sprint Triage"],
                    }
                else:
                    # Counter higher than buyer's offer
                    counter = max((last_b_offer or 0) + 1200, min_a)
                    return {
                        "message": f"My bottom line for this scope with verified testing and CI/CD setup is {currency}{counter:,.0f}.",
                        "offer_amount": counter,
                        "is_final_offer": True,
                        "is_accepted": False,
                        "is_walkaway": False,
                        "confidence": 0.80,
                        "reasoning": f"🧠 TACTICAL DEFENSE: Maintained rational floor at {currency}{counter:,.0f} above buyer's bid.",
                        "technical_deliverables_mentioned": ["Verified Testing", "CI/CD Setup"],
                    }
        else:
            if turn_num == 2:
                return {
                    "message": f"Our initial target allocation is {currency}{ideal_b:,.0f} for this contract, with escrow funded upfront for every verified sprint.",
                    "offer_amount": ideal_b,
                    "is_final_offer": False,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.85,
                    "reasoning": f"🧠 TACTICAL ANCHOR: Opened client budget at {currency}{ideal_b:,.0f}. 🎯 VALUE DEFENSE: Upfront escrow guarantee.",
                    "technical_deliverables_mentioned": ["Upfront Escrow"],
                }
            elif turn_num == 4:
                step_b = round(min(max_b, ideal_b + (equilibrium_target - ideal_b) * 0.50), 0)
                return {
                    "message": f"We appreciate your technical depth and can increase our commitment to {currency}{step_b:,.0f}, provided we receive weekly demo builds and clean TypeScript code.",
                    "offer_amount": step_b,
                    "is_final_offer": False,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.82,
                    "reasoning": f"🧠 TACTICAL PROGRESSION: Budget offer at {currency}{step_b:,.0f} (capped at ceiling {currency}{max_b:,.0f}). 🎯 VALUE DEFENSE: Requiring demo builds.",
                    "technical_deliverables_mentioned": ["Weekly Demo Builds", "TypeScript Code"],
                }
            elif turn_num == 6:
                step_b_2 = round(min(max_b, ideal_b + (equilibrium_target - ideal_b) * 0.80), 0)
                return {
                    "message": f"We can stretch our approved budget to {currency}{step_b_2:,.0f} with full milestone release upon verification.",
                    "offer_amount": step_b_2,
                    "is_final_offer": True,
                    "is_accepted": False,
                    "is_walkaway": False,
                    "confidence": 0.88,
                    "reasoning": f"🧠 TACTICAL CLOSING: Stepping up to {currency}{step_b_2:,.0f} (capped at ceiling {currency}{max_b:,.0f}).",
                    "technical_deliverables_mentioned": ["Milestone Release", "Verification"],
                }
            elif turn_num >= 8:
                if last_a_offer and last_a_offer <= max_b:
                    return {
                        "message": f"Agreed at {currency}{last_a_offer:,.0f}. We will fund the first escrow milestone today so development can start.",
                        "offer_amount": last_a_offer,
                        "is_final_offer": True,
                        "is_accepted": True,
                        "is_walkaway": False,
                        "confidence": 0.95,
                        "reasoning": f"🧠 TACTICAL RESOLUTION: Consensus achieved at {currency}{last_a_offer:,.0f}. 🎯 VALUE DEFENSE: Approved contract.",
                        "technical_deliverables_mentioned": ["Escrow Deposit", "Kickoff"],
                    }
                return {
                    "message": f"Our approved ceiling for this engagement is {currency}{equilibrium_target:,.0f}, and we are ready to sign.",
                    "offer_amount": equilibrium_target,
                    "is_final_offer": True,
                    "is_accepted": True,
                    "is_walkaway": False,
                    "confidence": 0.90,
                    "reasoning": f"Consensus equilibrium reached at {currency}{equilibrium_target:,.0f}",
                    "technical_deliverables_mentioned": ["Signed SOW"],
                }

        return {
            "message": f"Let's finalize this contract at {currency}{equilibrium_target:,.0f}.",
            "offer_amount": equilibrium_target,
            "is_final_offer": True,
            "is_accepted": True,
            "is_walkaway": False,
            "confidence": 0.90,
            "reasoning": "Consensus reached.",
            "technical_deliverables_mentioned": ["Contract Signed"],
        }
