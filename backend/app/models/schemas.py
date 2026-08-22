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


# ── Matchmaking & Lobby Models ────────────────────────────────────

class CVProject(BaseModel):
    name: str = ""
    description: str = ""
    year: str = ""

class FreelancerProfile(BaseModel):
    """Active freelancer profile in the matchmaking registry."""
    user_id: str = ""
    display_name: str = Field(..., description="Freelancer's visible name")
    role_title: str = Field(default="Full-Stack Developer", description="e.g. 'Senior React Architect'")
    skills: List[str] = Field(default_factory=list, description="e.g. ['React', 'Node.js', 'AWS']")
    min_rate: float = Field(default=5000, description="Minimum acceptable project rate")
    max_rate: float = Field(default=15000, description="Ideal asking rate")
    currency: str = "$"
    job_text: str = Field(default="", description="Pasted SOW / job description / portfolio summary")
    avatar_color: str = Field(default="#c084fc", description="Avatar accent color hex")
    status: str = Field(default="active", description="active | in_deal | offline")
    
    # CV Intelligence fields
    projects: List[CVProject] = Field(default_factory=list)
    years_of_experience: int = Field(default=0)
    education: str = Field(default="")
    match_score: Optional[float] = Field(default=None, description="Match score for client lobby")


class ClientProfile(BaseModel):
    """Active client profile in the matchmaking registry."""
    user_id: str = ""
    display_name: str = Field(..., description="Client's visible name")
    company: str = Field(default="", description="Company or organization name")
    job_description: str = Field(default="", description="Pasted RFP / job posting / requirements")
    budget_min: float = Field(default=3000, description="Minimum budget")
    budget_max: float = Field(default=10000, description="Maximum budget ceiling")
    currency: str = "$"
    avatar_color: str = Field(default="#38bdf8", description="Avatar accent color hex")
    status: str = Field(default="active", description="active | in_deal | offline")


class LobbyRegistration(BaseModel):
    """Registration payload to join the matchmaking lobby."""
    role: str = Field(..., description="'freelancer' or 'client'")
    freelancer_profile: Optional[FreelancerProfile] = None
    client_profile: Optional[ClientProfile] = None


class DealInvite(BaseModel):
    """An invitation from a client to a freelancer to enter the DealRoom."""
    invite_id: str = ""
    client_id: str
    freelancer_id: str
    client_name: str = ""
    client_company: str = ""
    job_description: str = ""
    budget_min: float = 0
    budget_max: float = 0
    currency: str = "$"
    status: str = Field(default="pending", description="pending | accepted | declined | expired")
