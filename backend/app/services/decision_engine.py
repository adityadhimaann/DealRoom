"""Enterprise Game-Theoretic Strategic Decision Engine for DealRoom.
Implements Multi-Issue Trade-offs (Price, Scope, Timeline, Escrow), BATNA Reservation Boundaries,
and Reciprocal Concession Matching (Nash Equilibrium Optimizer).
"""
import logging
import math
import re
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("dealroom.decision_engine")

class StrategicDecisionEngine:
    """
    Calculates multi-dimensional negotiation decisions:
    1. Multi-Issue Trade-Offs (Price vs Scope vs Timeline vs Escrow terms)
    2. BATNA & Reservation Thresholds (Walkaway Boundary Defense)
    3. Dynamic ZOPA (Zone of Possible Agreement) Surplus Extraction
    4. Tit-for-Tat Reciprocal Concession Curves
    5. Bluff & Low-Ball Resistance
    """

    def __init__(self):
        logger.info("Strategic Decision Engine initialized with Multi-Issue Game Theory")

    def evaluate_game_state(
        self,
        agent: str,
        turn_num: int,
        turns: List[Any],
        ideal_price: float,
        min_price: float,
        opponent_ideal: float,
        opponent_min: float,
        currency: str = "$",
        deliverables: Optional[List[str]] = None,
        job_context: str = ""
    ) -> Dict[str, Any]:
        """
        Computes the optimal next action (ACCEPT, COUNTER, TRADE_OFF, WALKAWAY)
        and exact price/scope concession package.
        """
        if agent == "A":
            seller_ask = ideal_price
            seller_floor = min_price
            buyer_bid = opponent_ideal
            buyer_ceiling = opponent_min
        else:
            buyer_bid = ideal_price
            buyer_ceiling = min_price
            seller_ask = opponent_ideal
            seller_floor = opponent_min

        # Ensure correct directional boundaries
        if seller_ask < seller_floor:
            seller_ask, seller_floor = seller_floor, seller_ask
        if buyer_bid > buyer_ceiling:
            buyer_bid, buyer_ceiling = buyer_ceiling, buyer_bid

        # Calculate ZOPA (Zone of Possible Agreement)
        zopa_min = seller_floor
        zopa_max = buyer_ceiling
        has_zopa = zopa_max >= zopa_min
        nash_point = (zopa_min + zopa_max) / 2.0 if has_zopa else (seller_floor + buyer_bid) / 2.0

        # Extract last offers
        last_opponent_offer = None
        last_my_offer = None
        for t in reversed(turns):
            if t.agent != agent and t.offer_amount is not None:
                if last_opponent_offer is None:
                    last_opponent_offer = float(t.offer_amount)
            elif t.agent == agent and t.offer_amount is not None:
                if last_my_offer is None:
                    last_my_offer = float(t.offer_amount)

        # ── 1. ACCEPTANCE CHECK ──
        if last_opponent_offer is not None:
            if agent == "A":
                if last_opponent_offer >= seller_floor:
                    # Require at least 8 turns for thorough project & technical debate, or exact target match on turn >= 6
                    if turn_num >= 8 or (turn_num >= 6 and last_opponent_offer >= ideal_price):
                        return {
                            "action": "ACCEPT",
                            "offer_amount": last_opponent_offer,
                            "is_accepted": True,
                            "is_walkaway": False,
                            "is_final": True,
                            "tactical_phase": "Surplus Agreement",
                            "trade_off_lever": "Milestone Escrow Released",
                            "strategic_reasoning": f"Opponent offer of {currency}{last_opponent_offer:,.0f} meets Pareto surplus floor ({currency}{seller_floor:,.0f}). Locked consensus after thorough technical dialogue.",
                            "confidence": 0.98
                        }
            else:
                if last_opponent_offer <= buyer_ceiling:
                    # Require at least 8 turns for thorough project & technical debate, or exact target match on turn >= 6
                    if turn_num >= 8 or (turn_num >= 6 and last_opponent_offer <= ideal_price):
                        return {
                            "action": "ACCEPT",
                            "offer_amount": last_opponent_offer,
                            "is_accepted": True,
                            "is_walkaway": False,
                            "is_final": True,
                            "tactical_phase": "Surplus Agreement",
                            "trade_off_lever": "Standard 2-Sprint Release",
                            "strategic_reasoning": f"Seller ask of {currency}{last_opponent_offer:,.0f} is within budget ceiling ({currency}{buyer_ceiling:,.0f}). Contract accepted after thorough technical dialogue.",
                            "confidence": 0.98
                        }

        # ── 2. WALKAWAY / IMPASSE CHECK ──
        if turn_num >= 8:
            if last_opponent_offer is not None:
                if agent == "A" and last_opponent_offer < (seller_floor * 0.75):
                    return {
                        "action": "WALKAWAY",
                        "offer_amount": None,
                        "is_accepted": False,
                        "is_walkaway": True,
                        "is_final": True,
                        "tactical_phase": "Impasse",
                        "trade_off_lever": "BATNA Reservation Invoked",
                        "strategic_reasoning": f"Opponent offer ({currency}{last_opponent_offer:,.0f}) is below reservation floor ({currency}{seller_floor:,.0f}). Walking away to protect margin.",
                        "confidence": 0.95
                    }

        # ── 3. STRATEGIC COUNTER / TRADE-OFF ENGINE ──
        if turn_num <= 2:
            phase = "Anchor Defense"
            concession_factor = 0.05
        elif turn_num <= 5:
            phase = "Multi-Issue Trade-off"
            concession_factor = 0.35
        else:
            phase = "Nash Convergence"
            concession_factor = 0.70

        if agent == "A":
            target = seller_ask - (seller_ask - nash_point) * concession_factor
            computed_offer = max(seller_floor, round(target, 0))
            if last_opponent_offer and computed_offer <= last_opponent_offer:
                computed_offer = round(last_opponent_offer + (seller_ask - last_opponent_offer) * 0.15, 0)

            if computed_offer <= (seller_floor * 1.05):
                lever = "Scope Reduction (Drop non-critical revisions to preserve timeline)"
            elif turn_num >= 4:
                lever = "Bi-Weekly Escrow (50% upfront deposit in exchange for rate alignment)"
            else:
                lever = "Technical Guarantee (90%+ test coverage and Vercel CI/CD included)"
        else:
            target = buyer_bid + (nash_point - buyer_bid) * concession_factor
            computed_offer = min(buyer_ceiling, round(target, 0))
            if last_opponent_offer and computed_offer >= last_opponent_offer:
                computed_offer = round(last_opponent_offer - (last_opponent_offer - buyer_bid) * 0.15, 0)

            if computed_offer >= (buyer_ceiling * 0.95):
                lever = "Strict SLA Demand (Sub-24h bug triage required at maximum ceiling)"
            elif turn_num >= 4:
                lever = "Milestone Gating (Split payment across 2 milestone sign-offs)"
            else:
                lever = "Contract-to-Hire Pipeline (Potential long-term retainer volume)"

        return {
            "action": "COUNTER",
            "offer_amount": computed_offer,
            "is_accepted": False,
            "is_walkaway": False,
            "is_final": turn_num >= 6,
            "tactical_phase": phase,
            "trade_off_lever": lever,
            "strategic_reasoning": f"Calculated Pareto step {currency}{computed_offer:,.0f} (Phase: {phase}). Traded lever: '{lever}'.",
            "confidence": round(0.85 + (turn_num * 0.02), 2)
        }

# Global singleton
decision_engine = StrategicDecisionEngine()
