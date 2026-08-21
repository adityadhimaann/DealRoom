"""Pydantic schemas for DealRoom with technical deliverables, Pareto radar, and dynamic currency."""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class StrategyStyle(str, Enum):
    AGGRESSIVE = "aggressive"
    COLLABORATIVE = "collaborative"
    BALANCED = "balanced"


class AgentConfig(BaseModel):
    """Configuration for a negotiation agent."""
    role_name: str = Field(..., description="e.g. 'Senior Frontend Specialist', 'Client'")
    min_price: float = Field(..., description="Walk-away price (minimum for seller, maximum for buyer)")
    ideal_price: float = Field(..., description="Ideal target price")
    priorities: List[str] = Field(default_factory=list, description="e.g. ['React + TypeScript', 'Vitest BDD', 'Milestone Payments']")
    strategy: StrategyStyle = StrategyStyle.BALANCED
    context: str = Field(default="", description="Technical expertise or project constraints")


class NegotiationSetup(BaseModel):
    """Initial setup for a negotiation session."""
    agent_a_config: AgentConfig
    agent_b_config: AgentConfig
    subject: str = Field(..., description="What is being negotiated with technical scope")
    max_turns: int = Field(default=8, ge=4, le=20)
    currency: str = Field(default="$", description="Currency symbol: '$', '₹', '€', '£'")
    deliverables: List[str] = Field(default_factory=list, description="Concrete technical deliverables")


class NegotiationTurn(BaseModel):
    """A single turn in the negotiation."""
    turn_number: int
    agent: str  # "A" or "B"
    message: str
    offer_amount: Optional[float] = None
    is_final_offer: bool = False
    is_accepted: bool = False
    is_walkaway: bool = False
    confidence: float = Field(default=0.5, ge=0.0, le=1.0, description="How favorable this deal is for this agent")
    reasoning: str = Field(default="", description="Internal reasoning (shown to agent's human)")
    technical_deliverables_mentioned: List[str] = Field(default_factory=list)


class NegotiationState(BaseModel):
    """Full state of a negotiation session."""
    session_id: str
    setup: NegotiationSetup
    turns: List[NegotiationTurn] = Field(default_factory=list)
    is_complete: bool = False
    deal_reached: bool = False
    final_amount: Optional[float] = None
    deal_quality_score: Optional[float] = None
    tactical_advice: Optional[str] = None


class WhisperInput(BaseModel):
    """Human whisper override mid-negotiation."""
    session_id: str
    agent: str  # "A" or "B"
    instruction: str


class NegotiationResponse(BaseModel):
    """Response from a negotiation turn."""
    turn: NegotiationTurn
    audio_base64: Optional[str] = None
    is_complete: bool = False
    deal_reached: bool = False
    final_amount: Optional[float] = None
    deal_quality_score: Optional[float] = None
    tactical_advice: Optional[str] = None


class JobAnalysisRequest(BaseModel):
    text: Optional[str] = None
    job_text: Optional[str] = None
    job_description: Optional[str] = None

    def get_text(self) -> str:
        return self.text or self.job_text or self.job_description or ""


class UrlAnalysisRequest(BaseModel):
    url: str = Field(..., description="URL of job posting or RFP page")


class JobAnalysisResponse(BaseModel):
    project_title: str
    urgency_level: str
    client_persona: str
    currency: str = "$"
    recommended_setup: NegotiationSetup
    deliverables: List[str] = Field(default_factory=list)
    leverage_points: List[str]
    scope_risks: List[str]
