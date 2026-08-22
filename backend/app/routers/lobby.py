"""Matchmaking Lobby Router — REST + WebSocket endpoints for freelancer/client discovery and deal invites."""
import logging
import asyncio
from typing import Optional
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from pydantic import BaseModel

from app.services.matchmaking_service import matchmaking
from app.services.cv_service import cv_service
from app.services.llamaindex_service import llamaindex_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lobby", tags=["lobby"])
ws_router = APIRouter(tags=["lobby-ws"])


# ── REST Endpoints ────────────────────────────────────────────

class RegisterFreelancerRequest(BaseModel):
    display_name: str
    role_title: str = "Full-Stack Developer"
    skills: list[str] = []
    min_rate: float = 5000
    max_rate: float = 15000
    currency: str = "$"
    job_text: str = ""
    avatar_color: str = "#c084fc"
    projects: list[dict] = []
    years_of_experience: int = 0
    education: str = ""


class RegisterClientRequest(BaseModel):
    display_name: str
    company: str = ""
    job_description: str = ""
    budget_min: float = 3000
    budget_max: float = 10000
    currency: str = "$"
    avatar_color: str = "#38bdf8"


class SendInviteRequest(BaseModel):
    client_id: str
    freelancer_id: str
    job_description: str = ""


class InviteResponseRequest(BaseModel):
    invite_id: str



@router.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    """Extract profile from CV (PDF or Image) and parse into structured profile data."""
    fn = file.filename.lower()
    is_pdf = fn.endswith('.pdf')
    is_image = any(fn.endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.webp'])
    
    if not is_pdf and not is_image:
        raise HTTPException(status_code=400, detail="Only PDF and Image files (.png, .jpg, .jpeg, .webp) are supported for CV upload.")
    
    file_bytes = await file.read()
    
    try:
        if is_pdf:
            text = cv_service.extract_text_from_pdf(file_bytes)
            try:
                llamaindex_service.index_pdf_bytes(file_bytes, filename=file.filename)
            except Exception as le:
                logger.warning(f"LlamaIndex PDF indexing notice: {le}")
            structured_data = cv_service.parse_cv_to_structured_data(text)
            return structured_data
        else:
            mime = "image/png"
            if fn.endswith('.jpg') or fn.endswith('.jpeg'):
                mime = "image/jpeg"
            elif fn.endswith('.webp'):
                mime = "image/webp"
            structured_data = cv_service.parse_image_cv_to_structured_data(file_bytes, mime_type=mime)
            try:
                summary_txt = f"{structured_data.get('name', '')} {structured_data.get('role_title', '')}\n{structured_data.get('summary', '')}\nSkills: {', '.join(structured_data.get('skills', []))}"
                llamaindex_service.index_raw_text(summary_txt, doc_id=f"cv_{file.filename}")
            except Exception as le:
                logger.warning(f"LlamaIndex image indexing notice: {le}")
            return structured_data
    except Exception as e:
        logger.error(f"Fallback CV extraction triggered: {e}")
        # Guaranteed recovery fallback
        return cv_service._fallback_heuristic_extraction(file.filename)

@router.post("/register/freelancer")
async def register_freelancer(req: RegisterFreelancerRequest):
    """Register a freelancer profile and go active in the matchmaking pool."""
    profile = req.model_dump()
    user_id = matchmaking.register_freelancer(profile)

    # Broadcast presence update to all connected clients
    await matchmaking.broadcast_freelancer_list()

    return {"user_id": user_id, "status": "active", "message": f"Welcome, {req.display_name}! You are now visible to clients."}


@router.post("/register/client")
async def register_client(req: RegisterClientRequest):
    """Register a client profile in the matchmaking pool."""
    profile = req.model_dump()
    user_id = matchmaking.register_client(profile)
    return {"user_id": user_id, "status": "active", "message": f"Welcome, {req.display_name}! Browse active freelancers below."}


@router.get("/freelancers")
async def list_active_freelancers(job_description: Optional[str] = None):
    """List all currently active freelancer profiles, optionally matched against a job."""
    freelancers = matchmaking.get_active_freelancers(job_description=job_description)
    return {"freelancers": freelancers, "count": len(freelancers)}



@router.get("/freelancer/{user_id}")
async def get_freelancer_profile(user_id: str):
    """Fetch a specific registered freelancer profile by ID."""
    fl = matchmaking.get_freelancer(user_id)
    if not fl:
        raise HTTPException(status_code=404, detail="Freelancer profile not found")
    return fl


@router.get("/client/{user_id}")
async def get_client_profile(user_id: str):
    """Fetch a specific registered client profile by ID."""
    cl = matchmaking.get_client(user_id)
    if not cl:
        raise HTTPException(status_code=404, detail="Client profile not found")
    return cl

@router.get("/clients")
async def list_active_clients():
    """List all currently active client profiles."""
    clients = matchmaking.get_active_clients()
    return {"clients": clients, "count": len(clients)}


@router.post("/invite")
async def send_deal_invite(req: SendInviteRequest):
    """Client sends a deal invitation to a freelancer."""
    invite = matchmaking.create_invite(
        client_id=req.client_id,
        freelancer_id=req.freelancer_id,
        job_description=req.job_description,
    )
    if not invite:
        raise HTTPException(status_code=400, detail="Unable to create invite. Freelancer may not be active.")

    # Push real-time notification to freelancer
    await matchmaking.send_to_user(req.freelancer_id, {
        "type": "invite_received",
        "invite": invite,
    })

    return {"invite_id": invite["invite_id"], "status": "pending", "message": "Invite sent! Waiting for freelancer to accept."}


@router.post("/invite/accept")
async def accept_deal_invite(req: InviteResponseRequest):
    """Freelancer accepts a deal invite — both parties transition to DealRoom."""
    invite = matchmaking.accept_invite(req.invite_id)
    if not invite:
        raise HTTPException(status_code=400, detail="Invite not found or already responded to.")

    # Notify the client that the invite was accepted
    await matchmaking.send_to_user(invite["client_id"], {
        "type": "invite_accepted",
        "invite": invite,
    })

    # Broadcast updated freelancer list (this freelancer is now in_deal)
    await matchmaking.broadcast_freelancer_list()

    return {"status": "accepted", "invite": invite, "message": "Deal invite accepted! Entering DealRoom."}


@router.post("/invite/decline")
async def decline_deal_invite(req: InviteResponseRequest):
    """Freelancer declines a deal invite."""
    invite = matchmaking.decline_invite(req.invite_id)
    if not invite:
        raise HTTPException(status_code=400, detail="Invite not found or already responded to.")

    # Notify the client
    await matchmaking.send_to_user(invite["client_id"], {
        "type": "invite_declined",
        "invite": invite,
    })

    return {"status": "declined", "message": "Invite declined."}


@router.get("/invites/{user_id}")
async def get_pending_invites(user_id: str):
    """Get all pending invites for a freelancer."""
    invites = matchmaking.get_pending_invites_for_freelancer(user_id)
    return {"invites": invites, "count": len(invites)}


# ── WebSocket Endpoint ────────────────────────────────────────

@ws_router.websocket("/ws/lobby/{user_id}")
async def lobby_websocket(websocket: WebSocket, user_id: str):
    """Persistent WebSocket connection for real-time lobby events (presence, invites, deal transitions)."""
    await websocket.accept()
    matchmaking.connect_user(user_id, websocket)
    logger.info(f"Lobby WebSocket connected: {user_id}")

    # Send initial state
    is_freelancer = user_id in matchmaking.freelancers
    is_client = user_id in matchmaking.clients

    if is_client:
        # Send current freelancer list to newly connected client
        freelancers = matchmaking.get_active_freelancers()
        await websocket.send_json({
            "type": "freelancer_list_update",
            "freelancers": freelancers,
            "count": len(freelancers),
        })

    if is_freelancer:
        # Send any pending invites
        pending = matchmaking.get_pending_invites_for_freelancer(user_id)
        if pending:
            for inv in pending:
                await websocket.send_json({
                    "type": "invite_received",
                    "invite": inv,
                })

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "ping":
                await websocket.send_json({"type": "pong"})

            elif action == "refresh_freelancers":
                freelancers = matchmaking.get_active_freelancers()
                await websocket.send_json({
                    "type": "freelancer_list_update",
                    "freelancers": freelancers,
                    "count": len(freelancers),
                })

    except WebSocketDisconnect:
        logger.info(f"Lobby WebSocket disconnected: {user_id}")
        matchmaking.disconnect_user(user_id)
        # Broadcast updated list so disconnected freelancer disappears from clients
        await matchmaking.broadcast_freelancer_list()
    except Exception as e:
        logger.error(f"Lobby WebSocket error for {user_id}: {e}")
        matchmaking.disconnect_user(user_id)
        await matchmaking.broadcast_freelancer_list()
