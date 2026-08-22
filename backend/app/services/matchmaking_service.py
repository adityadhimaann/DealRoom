"""Persistent Matchmaking Registry for real-time Freelancer ↔ Client lobby presence and deal invites."""
import uuid
import logging
import asyncio
import json
import os
from datetime import datetime
from typing import Dict, Optional, List, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

DB_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "matchmaking_db.json")

class MatchmakingService:
    """File-persisted matchmaking registry with WebSocket presence broadcasting."""

    def __init__(self):
        self.freelancers: Dict[str, dict] = {}
        self.clients: Dict[str, dict] = {}
        self.invites: Dict[str, dict] = {}
        self.connections: Dict[str, WebSocket] = {}

        self._load_from_disk()
        logger.info("MatchmakingService initialized — persistent lobby ready")

    def _load_from_disk(self):
        if os.path.exists(DB_FILE):
            try:
                with open(DB_FILE, "r") as f:
                    data = json.load(f)
                    self.freelancers = data.get("freelancers", {})
                    self.clients = data.get("clients", {})
                    self.invites = data.get("invites", {})
                    logger.info(f"Loaded {len(self.freelancers)} freelancers, {len(self.clients)} clients from disk DB")
            except Exception as e:
                logger.error(f"Failed to load matchmaking DB from disk: {e}")

    def _save_to_disk(self):
        try:
            with open(DB_FILE, "w") as f:
                json.dump({
                    "freelancers": self.freelancers,
                    "clients": self.clients,
                    "invites": self.invites
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save matchmaking DB to disk: {e}")

    # ── Registration ──────────────────────────────────────────

    def register_freelancer(self, profile: dict) -> str:
        """Register a freelancer profile and return user_id."""
        user_id = profile.get("user_id") or f"fl_{uuid.uuid4().hex[:8]}"
        profile["user_id"] = user_id
        profile["status"] = "active"
        profile["registered_at"] = datetime.utcnow().isoformat()
        self.freelancers[user_id] = profile
        self._save_to_disk()
        logger.info(f"Freelancer registered: {user_id} — {profile.get('display_name', 'Unknown')}")
        return user_id

    def register_client(self, profile: dict) -> str:
        """Register a client profile and return user_id."""
        user_id = profile.get("user_id") or f"cl_{uuid.uuid4().hex[:8]}"
        profile["user_id"] = user_id
        profile["status"] = "active"
        profile["registered_at"] = datetime.utcnow().isoformat()
        self.clients[user_id] = profile
        self._save_to_disk()
        logger.info(f"Client registered: {user_id} — {profile.get('display_name', 'Unknown')}")
        return user_id

    # ── Queries ───────────────────────────────────────────────

    def get_active_freelancers(self, job_description: str = "") -> List[dict]:
        """Return all freelancers that are not currently in a deal."""
        freelancers = [
            f for f in self.freelancers.values()
            if f.get("status") != "in_deal"
        ]
        
        if not job_description or not job_description.strip():
            for f in freelancers:
                f["match_score"] = None
            return freelancers
            
        job_lower = job_description.lower()
        
        for f in freelancers:
            score = 0.0
            
            # 1. Skill overlap
            skills = [s.lower() for s in f.get("skills", [])]
            matched_skills = [s for s in skills if s in job_lower]
            if skills:
                score += (len(matched_skills) / len(skills)) * 50
                
            # 2. Project overlap
            projects = f.get("projects", [])
            for p in projects:
                if isinstance(p, dict):
                    desc = p.get("description", "").lower()
                    job_words = set(w for w in job_lower.split() if len(w) > 4)
                    desc_words = set(w for w in desc.split() if len(w) > 4)
                    overlap = job_words.intersection(desc_words)
                    if overlap:
                        score += min(20, len(overlap) * 5)
                        
            # Cap at 98%
            f["match_score"] = min(98.0, round(score + 15, 1))
            
        # Sort by match score descending
        freelancers.sort(key=lambda x: x.get("match_score", 0), reverse=True)
        return freelancers

    def get_active_clients(self) -> List[dict]:
        """Return all clients with status='active'."""
        return [
            c for c in self.clients.values()
            if c.get("status") == "active"
        ]

    def get_freelancer(self, user_id: str) -> Optional[dict]:
        return self.freelancers.get(user_id)

    def get_client(self, user_id: str) -> Optional[dict]:
        return self.clients.get(user_id)

    # ── Deal Invites ──────────────────────────────────────────

    def create_invite(self, client_id: str, freelancer_id: str, job_description: str = "") -> Optional[dict]:
        """Create a deal invite from client to freelancer."""
        client = self.clients.get(client_id)
        freelancer = self.freelancers.get(freelancer_id)
        if not client or not freelancer:
            logger.warning(f"Invite failed: client={client_id} or freelancer={freelancer_id} not found")
            return None

        if freelancer.get("status") == "in_deal":
            logger.warning(f"Invite failed: freelancer {freelancer_id} is in_deal")
            return None

        invite_id = f"inv_{uuid.uuid4().hex[:8]}"
        invite = {
            "invite_id": invite_id,
            "client_id": client_id,
            "freelancer_id": freelancer_id,
            "client_name": client.get("display_name", "Unknown Client"),
            "client_company": client.get("company", ""),
            "job_description": job_description or client.get("job_description", ""),
            "budget_min": client.get("budget_min", 0),
            "budget_max": client.get("budget_max", 0),
            "currency": client.get("currency", "$"),
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
        }
        self.invites[invite_id] = invite
        self._save_to_disk()
        logger.info(f"Deal invite created: {invite_id} | {client.get('display_name')} → {freelancer.get('display_name')}")
        return invite

    def accept_invite(self, invite_id: str) -> Optional[dict]:
        """Accept a deal invite. Transitions both parties to 'in_deal' status."""
        invite = self.invites.get(invite_id)
        if not invite or invite["status"] != "pending":
            return None

        invite["status"] = "accepted"

        fl = self.freelancers.get(invite["freelancer_id"])
        cl = self.clients.get(invite["client_id"])
        if fl:
            fl["status"] = "in_deal"
        if cl:
            cl["status"] = "in_deal"

        self._save_to_disk()
        logger.info(f"Deal invite ACCEPTED: {invite_id}")
        return invite

    def decline_invite(self, invite_id: str) -> Optional[dict]:
        """Decline a deal invite."""
        invite = self.invites.get(invite_id)
        if not invite or invite["status"] != "pending":
            return None

        invite["status"] = "declined"
        self._save_to_disk()
        logger.info(f"Deal invite DECLINED: {invite_id}")
        return invite

    def get_pending_invites_for_freelancer(self, freelancer_id: str) -> List[dict]:
        """Get all pending invites for a specific freelancer."""
        return [
            inv for inv in self.invites.values()
            if inv["freelancer_id"] == freelancer_id and inv["status"] == "pending"
        ]

    # ── WebSocket Presence ────────────────────────────────────

    def connect_user(self, user_id: str, ws: WebSocket):
        """Register a WebSocket connection for real-time events."""
        self.connections[user_id] = ws

    def disconnect_user(self, user_id: str):
        """Remove WebSocket connection without dropping active matchmaking availability."""
        self.connections.pop(user_id, None)
        logger.info(f"User {user_id} disconnected socket (retaining profile state)")

    async def send_to_user(self, user_id: str, message: dict):
        """Send a JSON message to a specific user via WebSocket."""
        ws = self.connections.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to {user_id}: {e}")
                self.disconnect_user(user_id)

    async def broadcast_to_clients(self, message: dict):
        """Broadcast a message to all connected clients (for freelancer presence updates)."""
        client_ids = list(self.clients.keys())
        for cid in client_ids:
            ws = self.connections.get(cid)
            if ws:
                try:
                    await ws.send_json(message)
                except Exception:
                    self.disconnect_user(cid)

    async def broadcast_freelancer_list(self):
        """Push the current active freelancer list to all connected clients."""
        freelancers = self.get_active_freelancers()
        await self.broadcast_to_clients({
            "type": "freelancer_list_update",
            "freelancers": freelancers,
            "count": len(freelancers)
        })

    def remove_user(self, user_id: str):
        """Full cleanup: remove from registry and connections."""
        self.disconnect_user(user_id)
        self.freelancers.pop(user_id, None)
        self.clients.pop(user_id, None)
        self._save_to_disk()


# Singleton instance
matchmaking = MatchmakingService()
