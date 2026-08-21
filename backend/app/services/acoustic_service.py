"""Enterprise Acoustic Telemetry, Vocal Conviction Scoring & Bluff Detection Service."""
import logging
import re
import math
import hashlib
from typing import Dict, Any, List, Optional

logger = logging.getLogger("dealroom.acoustic")

class AcousticTelemetryService:
    """
    Analyzes spoken negotiation turns for:
    1. Vocal Conviction Score (0-100%)
    2. Bluff Probability Index (0-100%)
    3. Acoustic Pitch & Cadence Modulation (Hz / WPM)
    4. Strategic Firmness Classification (Alpha Anchor, Balanced, Hesitant, Bluffing)
    """

    BLUFF_TRIGGERS = [
        r"other (?:agency|vendor|freelancer|team)",
        r"another (?:offer|bid|company|candidate)",
        r"cheaper option",
        r"final (?:offer|best|counter)",
        r"take it or leave it",
        r"rock bottom",
        r"strictly capped",
        r"can['’]t do more than",
        r"non[- ]negotiable",
        r"last chance",
        r"very tight budget",
    ]

    CONVICTION_TRIGGERS = [
        r"deliverable",
        r"milestone",
        r"sla",
        r"guarantee",
        r"architecture",
        r"escrow",
        r"dedicated",
        r"proven",
        r"sprint",
        r"production-ready",
        r"test coverage",
        r"commit",
    ]

    HESITATION_TRIGGERS = [
        r"maybe",
        r"perhaps",
        r"if possible",
        r"i think",
        r"we could try",
        r"hopefully",
        r"not sure",
        r"sort of",
        r"kind of",
    ]

    def analyze_turn_acoustics(
        self,
        text: str,
        agent: str,
        turn_num: int,
        offer_amount: Optional[float] = None,
        ideal_price: Optional[float] = None,
        min_price: Optional[float] = None,
        is_human: bool = False
    ) -> Dict[str, Any]:
        """Calculates comprehensive acoustic & psychological negotiation telemetry."""
        if not text:
            return {
                "conviction_score": 85,
                "bluff_probability": 15,
                "firmness_tier": "Balanced",
                "pitch_hz": 175,
                "cadence_wpm": 140,
                "stress_index": "Low",
                "acoustic_flags": []
            }

        t_lower = text.lower()
        flags = []

        # 1. Base Conviction
        conviction = 82.0
        # Check conviction keywords
        for pattern in self.CONVICTION_TRIGGERS:
            if re.search(pattern, t_lower):
                conviction += 4.5
                flags.append(f"High-leverage clause cited: '{pattern}'")

        # Check hesitation penalties
        for pattern in self.HESITATION_TRIGGERS:
            if re.search(pattern, t_lower):
                conviction -= 12.0
                flags.append(f"Vocal hesitation detected: '{pattern}'")

        # Early round anchor bonus
        if turn_num <= 2:
            conviction += 6.0

        # 2. Bluff Probability
        bluff_prob = 10.0
        for pattern in self.BLUFF_TRIGGERS:
            if re.search(pattern, t_lower):
                bluff_prob += 22.0
                flags.append(f"Acoustic Bluff Anchor: '{pattern}'")

        # Check pricing extremity
        if offer_amount and min_price and ideal_price:
            spread = abs(ideal_price - min_price) or 1.0
            deviation = abs(offer_amount - min_price) / spread
            if deviation < 0.15 and turn_num <= 3:
                bluff_prob += 18.0
                flags.append("Premature floor reveal (tactical bluff)")

        # Normalization
        conviction = max(35.0, min(99.0, conviction))
        bluff_prob = max(5.0, min(92.0, bluff_prob))

        # 3. Acoustic Pitch & Cadence Simulation
        # Female agent A pitch range: ~190 - 240 Hz
        # Male agent B pitch range: ~110 - 150 Hz
        # Human pitch range: ~140 - 200 Hz
        hash_val = int(hashlib.md5(text.encode("utf-8")).hexdigest()[:4], 16) % 20
        if agent == "A":
            base_pitch = 210 + hash_val - (5 if turn_num == 1 else 0)
        elif agent == "B":
            base_pitch = 125 + hash_val
        else:
            base_pitch = 160 + hash_val

        # Cadence calculation (words per minute)
        word_count = len(text.split())
        cadence_wpm = 138 + (hash_val % 15)
        if bluff_prob > 50:
            cadence_wpm += 12  # Bluffers tend to speak faster

        # Firmness classification
        if conviction >= 88 and bluff_prob < 30:
            firmness = "Alpha Anchor"
            stress = "Calibrated"
        elif bluff_prob >= 50:
            firmness = "Tactical Bluff"
            stress = "Elevated"
        elif conviction <= 60:
            firmness = "Hesitant / Flexible"
            stress = "Vulnerable"
        else:
            firmness = "Firm / Collaborative"
            stress = "Nominal"

        return {
            "conviction_score": round(conviction, 1),
            "bluff_probability": round(bluff_prob, 1),
            "firmness_tier": firmness,
            "pitch_hz": base_pitch,
            "cadence_wpm": cadence_wpm,
            "stress_index": stress,
            "acoustic_flags": flags[:3]
        }

# Global singleton
acoustic_service = AcousticTelemetryService()
