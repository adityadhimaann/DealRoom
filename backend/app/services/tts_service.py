"""High-Performance Text-to-Speech Engine with Behavioral Game-Theoretic Prosody Modulation and Symbol Sanitization."""
import httpx
import edge_tts
import base64
import logging
import re
from typing import AsyncGenerator, Optional

logger = logging.getLogger(__name__)


class TTSService:
    """Synthesizes high-fidelity articulate speech with game-theoretic vocal conviction and prosody modulation."""

    def __init__(self, elevenlabs_api_key: str, elevenlabs_model_id: str,
                 agent_a_voice: str = "Xb7hH8MSUJpSbSDYk0k2",  # Alice (ElevenLabs)
                 agent_b_voice: str = "TX3LPaxmHKxFdv7VOQHJ",  # Liam (ElevenLabs)
                 edge_voice_a: str = "en-US-JennyNeural",       # Jenny: Clear articulate female
                 edge_voice_b: str = "en-US-ChristopherNeural" # Christopher: Executive articulate male
                 ):
        self.api_key = elevenlabs_api_key
        self.model_id = elevenlabs_model_id
        self.voices = {"A": agent_a_voice, "B": agent_b_voice}
        self.edge_voices = {"A": edge_voice_a, "B": edge_voice_b}
        self.base_url = "https://api.elevenlabs.io/v1/text-to-speech"
        self.elevenlabs_quota_exhausted = False
        self._audio_cache = {}  # In-memory fast audio cache for 0ms returns
        self._http_client = httpx.AsyncClient(
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            timeout=httpx.Timeout(connect=1.5, read=3.0, write=1.5, pool=1.5)
        )
        logger.info(f"TTS Engine initialized — Prosody Modulation Active: {edge_voice_a} / {edge_voice_b}")

    def _clean_text_for_speech(self, text: str) -> str:
        """
        Sanitizes text for natural articulate vocalization:
        - Removes Markdown formatting (*, **, _, `, #, >)
        - Converts currency symbols ($250 -> 250 dollars, ₹5000 -> 5000 rupees)
        - Strips punctuation clutter ([], (), {}, /, \\, |, +, @, =, ^)
        - Cleans bullet points, hashes, and markdown URLs
        """
        if not text:
            return ""

        t = text

        # 1. Replace ampersands with 'and'
        t = re.sub(r'\s*&\s*', ' and ', t)

        # 1b. Remove Markdown links [Label](url) -> Label
        t = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', t)

        # 2. Convert currency symbols to natural spoken words
        t = re.sub(r'\$\s*([\d,]+(?:\.\d+)?)', lambda m: m.group(1).replace(',', '') + ' dollars', t)
        t = re.sub(r'₹\s*([\d,]+(?:\.\d+)?)', lambda m: m.group(1).replace(',', '') + ' rupees', t)
        t = re.sub(r'€\s*([\d,]+(?:\.\d+)?)', lambda m: m.group(1).replace(',', '') + ' euros', t)
        t = re.sub(r'£\s*([\d,]+(?:\.\d+)?)', lambda m: m.group(1).replace(',', '') + ' pounds', t)

        # 3. Strip Markdown asterisks, bold/italic markers, backticks, tildes, hashes
        t = re.sub(r'[*_~`#>]', ' ', t)

        # 4. Remove brackets, braces, slashes, pipes, quotes, ampersands, plus
        t = re.sub(r'[\[\]\(\)\{\}\\\/\|\+\@\=\^\<\>]', ' ', t)
        t = re.sub(r'["\']', '', t)

        # 5. Remove bullet point markers at start of lines
        t = re.sub(r'(?m)^\s*[-•]\s*', ' ', t)
        t = re.sub(r'(?m)^\s*\d+\.\s*', ' ', t)

        # 6. Replace multiple dashes or underscores
        t = re.sub(r'[-_]{2,}', ' ', t)

        # 7. Collapse whitespace and strip
        t = re.sub(r'\s+', ' ', t).strip()

        return t

    async def stream_audio_chunks(self, text: str, agent: str, turn_num: int = 1, is_final: bool = False) -> AsyncGenerator[bytes, None]:
        """Stream natural articulate audio with behavioral game-theoretic conviction tuning."""
        spoken_text = self._clean_text_for_speech(text)
        voice_id = self.voices.get(agent, self.voices["A"])
        success = False

        # Attempt ElevenLabs if quota was enabled
        if not self.elevenlabs_quota_exhausted and self.api_key and len(self.api_key) > 10:
            headers = {
                "xi-api-key": self.api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            }
            stability = 0.70 if is_final else 0.55
            payload = {
                "text": spoken_text,
                "model_id": self.model_id or "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": 0.85,
                    "style": 0.20,
                    "use_speaker_boost": True,
                },
                "output_format": "mp3_44100_128",
            }

            try:
                async with self._http_client.stream("POST", url=f"{self.base_url}/{voice_id}/stream", json=payload, headers=headers) as response:
                    if response.status_code == 200:
                        async for audio_chunk in response.aiter_bytes(chunk_size=4096):
                            if audio_chunk:
                                yield audio_chunk
                        success = True
                    elif response.status_code in (401, 403, 429):
                        self.elevenlabs_quota_exhausted = True
            except Exception:
                self.elevenlabs_quota_exhausted = True

        # Ultra-Fast Neural Voice with Game-Theoretic Prosody Cadence
        if not success:
            async for chunk in self._edge_tts_chunks(spoken_text, agent, turn_num, is_final):
                yield chunk

    async def _edge_tts_chunks(self, text: str, agent: str, turn_num: int = 1, is_final: bool = False) -> AsyncGenerator[bytes, None]:
        """Generate articulate neural audio with dynamic rate/pitch conviction modulation."""
        voice = self.edge_voices.get(agent, self.edge_voices["A"])
        
        # Behavioral Prosody Calculation based on Game-Theoretic Negotiation Stage:
        if turn_num == 1:
            rate_str = "-2%"
            pitch_str = "-2Hz"
        elif is_final or turn_num >= 6:
            rate_str = "+3%"
            pitch_str = "+0Hz"
        else:
            rate_str = "+0%"
            pitch_str = "+0Hz"

        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate_str, pitch=pitch_str)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
        except Exception as e:
            logger.error(f"Neural voice generation error: {e}")

    async def synthesize(self, text: str, agent: str, turn_num: int = 1, is_final: bool = False) -> bytes:
        """Get complete audio bytes with prosody settings."""
        chunks = []
        async for chunk in self.stream_audio_chunks(text, agent, turn_num, is_final):
            chunks.append(chunk)
        return b"".join(chunks)

    async def synthesize_base64(self, text: str, agent: str, turn_num: int = 1, is_final: bool = False) -> str:
        """Get complete base64-encoded audio with in-memory caching and prosody modulation."""
        cache_key = f"{agent}:{turn_num}:{is_final}:{text.strip()}"
        if cache_key in self._audio_cache:
            return self._audio_cache[cache_key]

        audio_bytes = await self.synthesize(text, agent, turn_num, is_final)
        b64_str = base64.b64encode(audio_bytes).decode("utf-8")
        if len(self._audio_cache) > 200:
            self._audio_cache.pop(next(iter(self._audio_cache)))
        self._audio_cache[cache_key] = b64_str
        return b64_str
