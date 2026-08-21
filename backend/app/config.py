"""Application configuration loaded from environment."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Gemini (Agent A)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Groq (Agent B)
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    # ElevenLabs TTS - Energetic Voices
    elevenlabs_api_key: str = ""
    elevenlabs_model_id: str = "eleven_multilingual_v2"
    agent_a_voice: str = "Xb7hH8MSUJpSbSDYk0k2"  # Sarah (Confident, Sharp, Fast)
    agent_b_voice: str = "TX3LPaxmHKxFdv7VOQHJ"  # Liam (Energetic, Punchy, Fast)

    # Fallback edge-tts
    tts_fallback: str = "edge-tts"
    edge_tts_voice_a: str = "en-US-JennyNeural"
    edge_tts_voice_b: str = "en-US-ChristopherNeural"

    # Server
    server_host: str = "0.0.0.0"
    server_port: int = 10000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
