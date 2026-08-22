"""DealRoom — Two AI Agents Negotiating by Voice in Real-Time.

Main application entry point.
"""
import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.config import get_settings
from app.services.agent_service import AgentService
from app.services.tts_service import TTSService
from app.services.negotiation_orchestrator import NegotiationOrchestrator
from app.routers import negotiation
from app.routers import lobby

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DealRoom API",
    description="Real-Time Freelancer ↔ Client Matchmaking & AI-Powered Voice Negotiation Platform",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = get_settings()

agent_service = AgentService(
    gemini_api_key=settings.gemini_api_key,
    gemini_model=settings.gemini_model,
    groq_api_key=settings.groq_api_key,
    groq_model=settings.groq_model,
)

tts_service = TTSService(
    elevenlabs_api_key=settings.elevenlabs_api_key,
    elevenlabs_model_id=settings.elevenlabs_model_id,
    agent_a_voice=settings.agent_a_voice,
    agent_b_voice=settings.agent_b_voice,
    edge_voice_a=settings.edge_tts_voice_a,
    edge_voice_b=settings.edge_tts_voice_b,
)

orchestrator = NegotiationOrchestrator(agent_service, tts_service)

negotiation.set_orchestrator(orchestrator)
app.include_router(negotiation.router)
app.include_router(negotiation.ws_router)
app.include_router(lobby.router)
app.include_router(lobby.ws_router)



@app.get("/")
@app.get("/api")
async def root_index():
    return {
        "status": "online",
        "service": "DealRoom — Real-Time AI Negotiation Platform",
        "version": "3.0.0",
        "docs_url": "/docs",
        "endpoints": {
            "freelancers": "/api/lobby/freelancers",
            "clients": "/api/lobby/clients",
            "health": "/health"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "project": "DealRoom",
        "version": "2.0.0 (Streaming)",
        "models": {
            "agent_a": f"Gemini ({settings.gemini_model})",
            "agent_b": f"Groq ({settings.groq_model})",
        },
        "tts": {
            "provider": "ElevenLabs Streaming (Multilingual v2)",
            "agent_a_voice": settings.agent_a_voice,
            "agent_b_voice": settings.agent_b_voice,
            "fallback": "edge-tts",
        }
    }


if __name__ == "__main__":
    logger.info("🏛️  DealRoom — Starting server with ElevenLabs streaming...")
    uvicorn.run(app, host=settings.server_host, port=settings.server_port)
