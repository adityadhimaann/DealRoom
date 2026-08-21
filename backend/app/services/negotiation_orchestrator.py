"""Negotiation orchestrator managing session state and multi-agent coordination."""
import uuid
import logging
from typing import Optional
from app.models.schemas import (
    NegotiationSetup, NegotiationState, NegotiationTurn,
    NegotiationResponse, WhisperInput
)
from app.services.agent_service import AgentService
from app.services.tts_service import TTSService

logger = logging.getLogger(__name__)


class NegotiationOrchestrator:
    """Coordinates negotiation sessions, turn execution, and audio synthesis."""

    def __init__(self, agent_service: AgentService, tts_service: TTSService):
        self.agent_service = agent_service
        self.tts_service = tts_service
        self.sessions: dict[str, NegotiationState] = {}

    def create_session(self, setup: NegotiationSetup) -> NegotiationState:
        """Create a new negotiation session with unique ID."""
        session_id = str(uuid.uuid4())[:8]
        state = NegotiationState(
            session_id=session_id,
            setup=setup,
            turns=[],
            is_complete=False,
            deal_reached=False,
            final_amount=None,
            deal_quality_score=None,
        )
        self.sessions[session_id] = state
        logger.info(f"Created negotiation session {session_id}: {setup.subject}")
        return state

    def get_session(self, session_id: str) -> Optional[NegotiationState]:
        """Retrieve session state by ID."""
        return self.sessions.get(session_id)

    def whisper(self, input_data: WhisperInput) -> bool:
        """Inject human whisper instruction and enforce hard strategic price caps."""
        state = self.sessions.get(input_data.session_id)
        if not state or state.is_complete:
            return False
        
        import re
        instr = input_data.instruction
        self.agent_service.set_whisper(
            input_data.session_id, input_data.agent, instr
        )

        # ── EXTRACT PRICE CONSTRAINT & PERMANENTLY LOCK BOUNDARIES ──
        cleaned = re.sub(r'[\$₹€£]', '', instr)
        matches = re.findall(r'(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|l|lakh)?', cleaned, re.IGNORECASE)
        if matches:
            raw_num, unit = matches[0]
            val = float(raw_num.replace(",", ""))
            if unit:
                if unit.lower() == 'k':
                    val *= 1000.0
                elif unit.lower() in ('l', 'lakh'):
                    val *= 100000.0
            
            if input_data.agent == "B":
                # Cap Buyer maximum ceiling permanently to the whispered value!
                state.setup.agent_b_config.min_price = val
                state.setup.agent_b_config.ideal_price = min(state.setup.agent_b_config.ideal_price, val)
                logger.info(f"Session {input_data.session_id}: Permanently locked Buyer (Agent B) ceiling to ${val:,.0f} from whisper.")
            elif input_data.agent == "A":
                # Floor Seller minimum walk-away permanently to the whispered value!
                state.setup.agent_a_config.min_price = val
                state.setup.agent_a_config.ideal_price = max(state.setup.agent_a_config.ideal_price, val)
                logger.info(f"Session {input_data.session_id}: Permanently locked Seller (Agent A) floor to ${val:,.0f} from whisper.")

        logger.info(
            f"Whisper injected for Agent {input_data.agent} in session {input_data.session_id}: "
            f"'{input_data.instruction}'"
        )
        return True

    async def execute_step(self, session_id: str) -> Optional[NegotiationResponse]:
        """Execute the next turn in the negotiation (Agent A -> Agent B -> ...)."""
        state = self.sessions.get(session_id)
        if not state or state.is_complete:
            return None

        setup = state.setup
        turn_number = len(state.turns) + 1
        current_agent = "A" if turn_number % 2 == 1 else "B"
        currency = setup.currency or "$"
        deliverables = getattr(setup, "deliverables", []) or []

        # Generate agent turn
        if current_agent == "A":
            result = await self.agent_service.generate_turn_agent_a(
                config=setup.agent_a_config,
                subject=setup.subject,
                turns=state.turns,
                session_id=session_id,
                currency=currency,
                deliverables=deliverables,
            )
        else:
            result = await self.agent_service.generate_turn_agent_b(
                config=setup.agent_b_config,
                subject=setup.subject,
                turns=state.turns,
                session_id=session_id,
                currency=currency,
                deliverables=deliverables,
            )

        turn = NegotiationTurn(
            turn_number=turn_number,
            agent=current_agent,
            message=result["message"],
            offer_amount=result.get("offer_amount"),
            is_final_offer=result.get("is_final_offer", False),
            is_accepted=result.get("is_accepted", False),
            is_walkaway=result.get("is_walkaway", False),
            confidence=result.get("confidence", 0.85),
            reasoning=result.get("reasoning", ""),
            technical_deliverables_mentioned=result.get("technical_deliverables_mentioned", []),
        )
        state.turns.append(turn)

        # Synthesize TTS
        try:
            audio_b64 = await self.tts_service.synthesize_base64(turn.message, current_agent)
        except Exception as e:
            logger.error(f"TTS failed for turn {turn_number}: {e}")
            audio_b64 = None

        # Check if negotiation is complete
        is_complete = False
        deal_reached = False
        final_amount = None
        deal_quality = None

        if turn.is_accepted:
            is_complete = True
            deal_reached = True
            for t in reversed(state.turns):
                if t.offer_amount is not None:
                    final_amount = t.offer_amount
                    break
            deal_quality = self._calculate_deal_quality(state, final_amount)

        elif turn.is_walkaway:
            is_complete = True
            deal_reached = False

        elif turn_number >= setup.max_turns:
            is_complete = True
            deal_reached = False
            logger.info(f"Session {session_id}: Max turns ({setup.max_turns}) reached")

        if is_complete:
            state.is_complete = True
            state.deal_reached = deal_reached
            state.final_amount = final_amount
            state.deal_quality_score = deal_quality

        return NegotiationResponse(
            turn=turn,
            audio_base64=audio_b64,
            is_complete=is_complete,
            deal_reached=deal_reached,
            final_amount=final_amount,
            deal_quality_score=deal_quality,
        )

    def _calculate_deal_quality(self, state: NegotiationState, final_amount: Optional[float]) -> Optional[float]:
        """Calculate deal quality as Pareto Nash Bargaining Optimality."""
        if final_amount is None:
            return None

        setup = state.setup
        seller_ask = setup.agent_a_config.ideal_price
        seller_floor = setup.agent_a_config.min_price
        buyer_bid = setup.agent_b_config.ideal_price
        buyer_ceiling = setup.agent_b_config.min_price

        # Full negotiation boundaries
        lower_bound = min(buyer_bid, seller_floor)
        upper_bound = max(seller_ask, buyer_ceiling)

        nash_solution = (lower_bound + upper_bound) / 2.0
        full_span = upper_bound - lower_bound

        if full_span <= 0:
            return 85.0

        # Distance as percentage of full bargaining corridor
        distance_ratio = abs(final_amount - nash_solution) / (full_span / 2.0)
        # Score scaled between 65% and 98% for verified consensus
        optimality = max(65.0, min(98.0, 98.0 - (distance_ratio * 25.0)))

        logger.info(f"Deal quality: final={final_amount}, nash={nash_solution}, score={optimality:.1f}%")
        return round(optimality, 1)

    def get_all_sessions(self) -> list[dict]:
        """Return summary of all sessions."""
        return [
            {
                "session_id": s.session_id,
                "subject": s.setup.subject,
                "turns": len(s.turns),
                "is_complete": s.is_complete,
                "deal_reached": s.deal_reached,
                "final_amount": s.final_amount,
                "deal_quality_score": s.deal_quality_score,
            }
            for s in self.sessions.values()
        ]
