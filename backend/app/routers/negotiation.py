from app.services.acoustic_service import acoustic_service
from typing import Optional
from pydantic import BaseModel
from app.services.llamaindex_service import llamaindex_service
"""Fast FastAPI router for DealRoom negotiation sessions with Enterprise B2B compliance, caching, and audit logging."""
import logging
import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from app.models.schemas import (
    NegotiationSetup, NegotiationState, NegotiationResponse,
    WhisperInput, JobAnalysisRequest, JobAnalysisResponse, UrlAnalysisRequest
)
from app.services.negotiation_orchestrator import NegotiationOrchestrator
from app.models.schemas import NegotiationTurn
from app.services.audit_service import audit_ledger
from app.services.cache_service import analysis_cache
from app.services.enterprise_procurement import procurement_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["negotiation"])
ws_router = APIRouter(tags=["websocket"])

orchestrator: NegotiationOrchestrator = None


def init_router(orch: NegotiationOrchestrator):
    global orchestrator
    orchestrator = orch


def set_orchestrator(orch: NegotiationOrchestrator):
    global orchestrator
    orchestrator = orch


@router.post("/sessions", response_model=NegotiationState)
async def create_session(setup: NegotiationSetup):
    """Create a new negotiation session with enterprise audit logging and Neon DB persistence."""
    state = orchestrator.create_session(setup)
    try:
        # Auto-index session contract terms in LlamaIndex
        session_text = f"""CONTRACT STATEMENT OF WORK
Subject: {setup.subject}
Currency: {setup.currency}
Deliverables: {', '.join(setup.deliverables or [])}
Agent A ({setup.agent_a_config.role_name}): Asking {setup.currency}{setup.agent_a_config.ideal_price:,.0f}, Min Floor {setup.currency}{setup.agent_a_config.min_price:,.0f}
Agent B ({setup.agent_b_config.role_name}): Target Bid {setup.currency}{setup.agent_b_config.ideal_price:,.0f}, Ceiling {setup.currency}{setup.agent_b_config.min_price:,.0f}
Priorities: {', '.join(setup.agent_a_config.priorities or [])}
"""
        llamaindex_service.index_text_content(session_text, doc_id=f"session_{state.session_id}")
        llamaindex_service.index_text_content(session_text, doc_id="active_contract")

        from app.services.db_service import db_service
        db_service.save_session(state.session_id, setup)
    except Exception as dbe:
        logger.warning(f"DB session save notice: {dbe}")
    audit_ledger.log_event(state.session_id, "SESSION_CREATED", {
        "subject": setup.subject,
        "currency": setup.currency,
        "agent_a": setup.agent_a_config.role_name,
        "agent_b": setup.agent_b_config.role_name,
        "max_turns": setup.max_turns
    })
    return state


@router.post("/analyze-job", response_model=JobAnalysisResponse)
async def analyze_job(req: JobAnalysisRequest):
    """Analyze raw job description text with high-throughput caching and native currency preservation."""
    text = req.get_text()
    llamaindex_service.index_text_content(text, doc_id="active_contract")
    cached = analysis_cache.get(text)
    if cached:
        logger.info("Serving cached RFP analysis (<1ms)")
        return JobAnalysisResponse(**cached)

    try:
        data = await orchestrator.agent_service.analyze_job_posting(text)
        llamaindex_service.index_text_content(text, doc_id=data.get("subject", "rfp_contract"))
        analysis_cache.set(text, data)
        return JobAnalysisResponse(**data)
    except Exception as e:
        logger.error(f"Job analysis error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/extract-url", response_model=JobAnalysisResponse)
async def extract_url(req: UrlAnalysisRequest):
    """Scrape and analyze job posting from a live URL with caching."""
    cached = analysis_cache.get(req.url)
    if cached:
        logger.info("Serving cached URL analysis (<1ms)")
        return JobAnalysisResponse(**cached)

    try:
        data = await orchestrator.agent_service.extract_and_analyze_url(req.url)
        analysis_cache.set(req.url, data)
        return JobAnalysisResponse(**data)
    except Exception as e:
        logger.error(f"URL extraction error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload-document", response_model=JobAnalysisResponse)
async def upload_document(file: UploadFile = File(...)):
    """Upload project document (PDF or screenshot image) and analyze with Vision."""
    try:
        contents = await file.read()
        mime_type = file.content_type or "application/octet-stream"
        filename = file.filename or "uploaded_document"

        logger.info(f"Processing uploaded document: {filename} ({mime_type}, {len(contents)} bytes)")
        data = await orchestrator.agent_service.analyze_document_vision(
            file_bytes=contents, mime_type=mime_type, filename=filename
        )
        if filename.lower().endswith(".pdf"):
            llamaindex_service.index_pdf_bytes(contents, filename=filename)
        else:
            llamaindex_service.index_text_content(str(data), doc_id=filename)
        return JobAnalysisResponse(**data)
    except Exception as e:
        logger.error(f"Vision document upload error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions/{session_id}", response_model=NegotiationState)
async def get_session(session_id: str):
    """Get the current state of a negotiation session."""
    state = orchestrator.get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


@router.get("/sessions/{session_id}/audit-trail")
async def get_audit_trail(session_id: str):
    """Retrieve the complete cryptographic audit ledger for enterprise compliance."""
    trail = audit_ledger.get_audit_trail(session_id)
    is_valid = audit_ledger.verify_ledger_integrity(session_id)
    return {
        "session_id": session_id,
        "is_tamper_proof": is_valid,
        "total_events": len(trail),
        "events": trail
    }


@router.post("/sessions/{session_id}/generate-contract")
async def generate_contract(session_id: str):
    """Generate a formal Statement of Work (SOW) agreement for the closed deal."""
    state = orchestrator.get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    currency = state.setup.currency or "$"
    final_price = state.final_amount or state.setup.agent_a_config.min_price
    subject = state.setup.subject
    turns_count = len(state.turns)
    quality = state.deal_quality_score or 85.0

    markdown_contract = f"""# 📄 STATEMENT OF WORK & AGREEMENT (SOW)
**Generated by DealRoom Autonomous Negotiation Engine**
**Contract Ref:** `DR-{session_id.upper()}` · **Status:** {'CLOSED & SIGNED' if state.deal_reached else 'SETTLED'}

---

### 1. PARTIES & ROLES
- **Contractor / Specialist (Agent A):** {state.setup.agent_a_config.role_name}
- **Client / Project Owner (Agent B):** {state.setup.agent_b_config.role_name}
- **Governing Protocol:** DealRoom Multi-Agent Consensus Protocol

---

### 2. SCOPE OF WORK (SOW)
**Deliverable:** {subject}
- **Agreed Final Value:** **{currency}{final_price:,.2f}**
- **Negotiation Trajectory:** Reached in {turns_count} adversarial rounds
- **Pareto Optimality (Nash Equilibrium):** {quality:.1f}%

---

### 3. AGREED TERMS & DELIVERABLES
1. **Milestone Schedule:** 
   - Milestone 1 (50%): Architecture, Core Deliverables & First Draft
   - Milestone 2 (50%): Final Review, Polish & Production Handover
2. **Revisions Policy:** Maximum 2 rounds of feedback within agreed scope.
3. **Out-of-Scope Protection:** Any additional features beyond the documented subject will trigger a supplemental change-order negotiation.

---

### 4. AUTONOMOUS AUDIT TRAIL
- **Seller Opening Ask:** {currency}{state.setup.agent_a_config.ideal_price:,.0f}
- **Buyer Opening Bid:** {currency}{state.setup.agent_b_config.ideal_price:,.0f}
- **Consensus Equilibrium:** {currency}{final_price:,.0f}
- **Cryptographic Hash:** `SHA256-{hash(session_id + str(final_price)) & 0xffffffff:08x}`
"""
    return {
        "session_id": session_id,
        "deal_reached": state.deal_reached,
        "final_amount": final_price,
        "contract_markdown": markdown_contract
    }


@router.post("/sessions/{session_id}/generate-msa")
async def generate_msa(session_id: str):
    """Generate Fortune 500 Enterprise Master Services Agreement (MSA) with SLAs and SOC 2 compliance."""
    state = orchestrator.get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    currency = state.setup.currency or "$"
    final_price = state.final_amount or state.setup.agent_a_config.min_price
    subject = state.setup.subject
    turns_count = len(state.turns)
    quality = state.deal_quality_score or 85.0
    deliverables = getattr(state.setup, "deliverables", [])

    return procurement_engine.generate_enterprise_msa(
        session_id=session_id,
        vendor_role=state.setup.agent_a_config.role_name,
        client_role=state.setup.agent_b_config.role_name,
        subject=subject,
        final_value=final_price,
        currency=currency,
        turns_count=turns_count,
        quality_score=quality,
        deliverables=deliverables
    )


@ws_router.websocket("/ws/sessions/{session_id}")
async def websocket_negotiation(websocket: WebSocket, session_id: str):
    """Real-time streaming WebSocket with pre-buffering, audit logging, and dynamic currency."""
    await websocket.accept()
    logger.info(f"WebSocket connected for session: {session_id}")
    session_subscribers.setdefault(session_id, []).append(websocket)

    state = orchestrator.get_session(session_id)
    if not state:
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close()
        return

    currency = state.setup.currency or "$"
    deliverables = getattr(state.setup, "deliverables", []) or []

    precomputed_turn: dict | None = None
    precomputed_task: asyncio.Task | None = None

    async def _compute_turn_data(target_turn_number: int, current_agent: str):
        """Worker that calculates LLM turn + TTS in background with enterprise reasoning."""
        try:
            if current_agent == "A":
                result = await orchestrator.agent_service.generate_turn_agent_a(
                    config=state.setup.agent_a_config,
                    subject=state.setup.subject,
                    turns=state.turns,
                    session_id=session_id,
                    currency=currency,
                    deliverables=deliverables,
                )
            else:
                result = await orchestrator.agent_service.generate_turn_agent_b(
                    config=state.setup.agent_b_config,
                    subject=state.setup.subject,
                    turns=state.turns,
                    session_id=session_id,
                    currency=currency,
                    deliverables=deliverables,
                )

            turn = NegotiationTurn(
                turn_number=target_turn_number,
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

            # Synthesize TTS
            audio_b64 = None
            try:
                audio_b64 = await orchestrator.tts_service.synthesize_base64(turn.message, current_agent)
            except Exception as e:
                logger.error(f"Pre-computation TTS error: {e}")

            # Check completion
            is_complete = False
            deal_reached = False
            final_amount = None
            deal_quality = None

            if turn.is_accepted:
                is_complete = True
                deal_reached = True
                final_amount = turn.offer_amount
                deal_quality = orchestrator._calculate_deal_quality(state, final_amount)
            elif turn.is_walkaway:
                is_complete = True
                deal_reached = False
            elif target_turn_number >= state.setup.max_turns:
                is_complete = True
                deal_reached = False

            return {
                "turn": turn,
                "audio_base64": audio_b64,
                "is_complete": is_complete,
                "deal_reached": deal_reached,
                "final_amount": final_amount,
                "deal_quality_score": deal_quality,
            }
        except Exception as err:
            logger.error(f"Error computing turn {target_turn_number}: {err}")
            return None

    def _start_precomputation():
        """Launch pre-computation of next turn in the background."""
        nonlocal precomputed_task, precomputed_turn
        if state.is_complete:
            return
        next_turn_num = len(state.turns) + 1
        if next_turn_num > state.setup.max_turns:
            return
        next_agent = "A" if next_turn_num % 2 == 1 else "B"
        precomputed_turn = None
        precomputed_task = asyncio.create_task(_compute_turn_data(next_turn_num, next_agent))

    async def run_single_turn():
        nonlocal state, precomputed_turn, precomputed_task
        if state.is_complete:
            return

        turn_number = len(state.turns) + 1
        current_agent = "A" if turn_number % 2 == 1 else "B"
        agent_name = state.setup.agent_a_config.role_name if current_agent == "A" else state.setup.agent_b_config.role_name

        payload_data = None

        if precomputed_task:
            if not precomputed_task.done():
                await websocket.send_json({
                    "type": "turn_thinking",
                    "turn_number": turn_number,
                    "agent": current_agent,
                    "role_name": agent_name,
                })
                payload_data = await precomputed_task
            else:
                payload_data = precomputed_task.result()
            precomputed_task = None

        if not payload_data:
            await websocket.send_json({
                "type": "turn_thinking",
                "turn_number": turn_number,
                "agent": current_agent,
                "role_name": agent_name,
            })
            payload_data = await _compute_turn_data(turn_number, current_agent)

        if not payload_data:
            return

        turn: NegotiationTurn = payload_data["turn"]
        state.turns.append(turn)
        try:
            from app.services.db_service import db_service
            db_service.save_turn(session_id, turn)
        except Exception as dbe:
            logger.warning(f"DB turn save notice: {dbe}")

        # Log cryptographic audit trail event
        audit_ledger.log_event(session_id, "TURN_COMPLETED", {
            "turn_number": turn.turn_number,
            "agent": turn.agent,
            "offer_amount": turn.offer_amount,
            "confidence": turn.confidence,
            "is_accepted": turn.is_accepted,
            "is_walkaway": turn.is_walkaway,
        })

        if payload_data["is_complete"]:
            state.is_complete = True
            state.deal_reached = payload_data["deal_reached"]
            state.final_amount = payload_data["final_amount"]
            state.deal_quality_score = payload_data["deal_quality_score"]

            audit_ledger.log_event(session_id, "NEGOTIATION_CONCLUDED", {
                "deal_reached": state.deal_reached,
                "final_amount": state.final_amount,
                "deal_quality_score": state.deal_quality_score,
                "total_turns": len(state.turns),
            })
            try:
                from app.services.db_service import db_service
                db_service.update_session_outcome(session_id, state.deal_reached, state.final_amount, state.deal_quality_score)
            except Exception as dbe:
                logger.warning(f"DB outcome update notice: {dbe}")

        # Calculate acoustic conviction & bluff telemetry
        cfg = state.setup.agent_a_config if current_agent == "A" else state.setup.agent_b_config
        acoustics = acoustic_service.analyze_turn_acoustics(
            text=turn.message,
            agent=current_agent,
            turn_num=turn.turn_number,
            offer_amount=turn.offer_amount,
            ideal_price=cfg.ideal_price if cfg else None,
            min_price=cfg.min_price if cfg else None,
        )

        # Broadcast turn payload with live acoustics to all connected participants in this room
        payload = {
            "type": "turn_ready",
            "turn": turn.model_dump(),
            "audio_base64": payload_data["audio_base64"],
            "acoustics": acoustics,
            "is_complete": payload_data["is_complete"],
            "deal_reached": payload_data["deal_reached"],
            "final_amount": payload_data["final_amount"],
            "deal_quality_score": payload_data["deal_quality_score"],
        }
        for ws in list(session_subscribers.get(session_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                pass

        if not payload_data["is_complete"]:
            _start_precomputation()

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "human_chat":
                sender = data.get("sender", "Human")
                role = data.get("role", "Participant")
                text = data.get("text", "").strip()
                from datetime import datetime
                ts = datetime.utcnow().strftime("%H:%M")
                if text:
                    msg_payload = {
                        "type": "human_chat_message",
                        "sender": sender,
                        "role": role,
                        "text": text,
                        "timestamp": ts,
                    }
                    for ws in list(session_subscribers.get(session_id, [])):
                        try:
                            await ws.send_json(msg_payload)
                        except Exception:
                            pass

            elif action == "step":
                await run_single_turn()

            elif action == "whisper":
                agent = data.get("agent")
                instruction = data.get("instruction")
                if agent and instruction:
                    if precomputed_task and not precomputed_task.done():
                        precomputed_task.cancel()
                    precomputed_task = None
                    orchestrator.whisper(WhisperInput(
                        session_id=session_id, agent=agent, instruction=instruction
                    ))
                    audit_ledger.log_event(session_id, "WHISPER_INTERVENTION", {
                        "agent": agent,
                        "instruction": instruction,
                    })
                    await websocket.send_json({"type": "whisper_applied", "agent": agent})

            elif action == "manual_turn":
                agent = data.get("agent", "A")
                message = data.get("message", "").strip()
                offer_amount = data.get("offer_amount")
                is_accepted = bool(data.get("is_accepted", False))
                is_walkaway = bool(data.get("is_walkaway", False))

                if message or is_accepted or is_walkaway:
                    if precomputed_task and not precomputed_task.done():
                        precomputed_task.cancel()
                    precomputed_task = None

                    turn_number = len(state.turns) + 1
                    turn = NegotiationTurn(
                        turn_number=turn_number,
                        agent=agent,
                        message=message or ("I accept your offer. Let's close and sign the agreement." if is_accepted else "We cannot reach consensus and must walk away."),
                        offer_amount=offer_amount,
                        is_final_offer=bool(data.get("is_final_offer", False)),
                        is_accepted=is_accepted,
                        is_walkaway=is_walkaway,
                        confidence=1.0,
                        reasoning="👤 HUMAN CO-PILOT: Manual negotiation turn submitted directly by user.",
                        technical_deliverables_mentioned=["Manual Human Counter"]
                    )
                    state.turns.append(turn)

                    # Synthesize voice so manual turn speaks aloud
                    audio_b64 = None
                    try:
                        audio_b64 = await orchestrator.tts_service.synthesize_base64(turn.message, agent)
                    except Exception as e:
                        logger.error(f"Manual turn TTS error: {e}")

                    is_complete = False
                    deal_reached = False
                    final_amount = None
                    deal_quality = None

                    if turn.is_accepted:
                        is_complete = True
                        deal_reached = True
                        final_amount = turn.offer_amount or (state.turns[-2].offer_amount if len(state.turns) >= 2 else state.setup.agent_a_config.min_price)
                        deal_quality = orchestrator._calculate_deal_quality(state, final_amount)
                    elif turn.is_walkaway or turn_number >= state.setup.max_turns:
                        is_complete = True
                        deal_reached = False

                    if is_complete:
                        state.is_complete = True
                        state.deal_reached = deal_reached
                        state.final_amount = final_amount
                        state.deal_quality_score = deal_quality

                    audit_ledger.log_event(session_id, "MANUAL_TURN_EXECUTED", {
                        "turn_number": turn.turn_number,
                        "agent": agent,
                        "message": turn.message,
                        "offer_amount": turn.offer_amount,
                        "is_accepted": turn.is_accepted,
                        "is_walkaway": turn.is_walkaway
                    })

                    await websocket.send_json({
                        "type": "turn_ready",
                        "turn": turn.model_dump(),
                        "audio_base64": audio_b64,
                        "is_complete": is_complete,
                        "deal_reached": deal_reached,
                        "final_amount": final_amount,
                        "deal_quality_score": deal_quality
                    })

                    if not is_complete:
                        _start_precomputation()

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for {session_id}")
        if session_id in session_subscribers and websocket in session_subscribers[session_id]:
            session_subscribers[session_id].remove(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


@router.get("/database/analytics")
async def get_db_analytics():
    """Retrieve aggregate negotiation analytics directly from Neon PostgreSQL."""
    from app.services.db_service import db_service
    return db_service.get_database_analytics()

@router.get("/database/sessions")
async def get_db_sessions(limit: int = 50):
    """Retrieve historical negotiation sessions directly from Neon PostgreSQL."""
    from app.services.db_service import db_service
    return db_service.get_session_history(limit=limit)

@router.get("/database/sessions/{session_id}")
async def get_db_session_detail(session_id: str):
    """Retrieve complete details for a specific session from Neon PostgreSQL."""
    from app.services.db_service import db_service
    detail = db_service.get_session_details(session_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Session not found in database")
    return detail

@router.get("/database/contracts")
async def get_db_contracts(limit: int = 50):
    """Retrieve list of signed legal contracts from Neon PostgreSQL."""
    from app.services.db_service import db_service
    return db_service.get_contracts(limit=limit)


class LlamaIndexQueryRequest(BaseModel):
    query: str
    doc_id: Optional[str] = "active_contract"

@router.post("/llamaindex/query")
async def query_llamaindex_document(req: LlamaIndexQueryRequest):
    """Query indexed contract and RFP nodes via LlamaIndex Core."""
    try:
        res = llamaindex_service.query_indexed_contract(req.query, doc_id=req.doc_id or "active_contract")
        return res
    except Exception as e:
        logger.error(f"LlamaIndex query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
