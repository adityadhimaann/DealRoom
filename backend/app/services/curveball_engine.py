"""Domain-Specific Commercial Curveballs, Objections & Tactical Defenses Engine."""
from typing import List, Dict, Any

CLIENT_CURVEBALLS = [
    {
        "type": "OFFSHORE_COMPETITION",
        "label": "Low-Cost Offshore Bidding Pressure",
        "objection": "We already have over 40 proposals offering full completion at a fraction of your price. Justify why we should approve your rate over cheaper bids.",
        "defense": "Cheap implementations inevitably result in brittle technical debt and frequent production rollbacks. My rate covers production-ready TypeScript, 90%+ automated test coverage, and root-cause stability that saves thousands in post-launch hotfixes."
    },
    {
        "type": "UNPAID_TRIAL_WORK",
        "label": "Free Proof-of-Concept / Unpaid Trial Demand",
        "objection": "Before funding escrow, our leadership requires a 3-day unpaid proof-of-concept sprint to evaluate code quality on our live repository.",
        "defense": "I do not perform unpaid exploratory triage, as dedicated engineering hours require reserved bandwidth. Instead, we can structure Milestone 1 as a focused, paid architectural diagnostic sprint with complete deliverables release upon your approval."
    },
    {
        "type": "UNREALISTIC_SLA",
        "label": "24/7 Production SLA & Blocker Turnaround",
        "objection": "Our platform handles live customer revenue. We require a 15-minute response SLA for critical bugs 24/7 without additional retainer fees.",
        "defense": "For core sprint deliverables, I provide dedicated 30-minute response triage during standard working windows. For 24/7 emergency pager duty, we can attach a formal Level-1 On-Call SLA addendum to the contract."
    },
    {
        "type": "ESCROW_RETENTION",
        "label": "Delayed Escrow & Extended 60-Day Payment Hold",
        "objection": "We operate on a 45-day post-delivery audit cycle. We will release 30% upfront and hold the remaining 70% until our QA team completes multi-browser validation.",
        "defense": "To maintain dedicated sprint momentum, we must align on bi-weekly milestone sign-offs. Each completed module is escrow-funded upfront and released upon verified demo verification."
    },
    {
        "type": "IP_AND_NON_COMPETE",
        "label": "Exclusive IP Assignment & Strict Non-Compete",
        "objection": "We require exclusive worldwide IP assignment upon creation and a 12-month non-compete preventing you from consulting in our vertical.",
        "defense": "Full custom IP assignment is granted upon final milestone payment release, preserving standard pre-existing developer tooling and non-conflicting client engagements."
    }
]

def get_curveball_for_round(turn_num: int, deliverables: List[str] = None) -> Dict[str, str]:
    """Retrieve tailored tactical objection and defense for the given negotiation turn."""
    idx = (turn_num // 2 - 1) % len(CLIENT_CURVEBALLS)
    return CLIENT_CURVEBALLS[idx]
