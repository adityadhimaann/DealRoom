/** API client for DealRoom backend. */

const API_BASE = "http://localhost:10000/api";
export const WS_BASE = "ws://localhost:10000/ws";

export interface AgentConfig {
  role_name: string;
  min_price: number;
  ideal_price: number;
  priorities: string[];
  strategy: "aggressive" | "collaborative" | "balanced";
  context: string;
}

export interface NegotiationSetup {
  agent_a_config: AgentConfig;
  agent_b_config: AgentConfig;
  subject: string;
  max_turns: number;
  currency?: string;
  deliverables?: string[];
}

export interface NegotiationTurn {
  turn_number: number;
  agent: "A" | "B";
  message: string;
  offer_amount?: number;
  is_final_offer: boolean;
  is_accepted: boolean;
  is_walkaway: boolean;
  confidence: number;
  reasoning: string;
  technical_deliverables_mentioned?: string[];
}

export interface NegotiationState {
  session_id: string;
  setup: NegotiationSetup;
  turns: NegotiationTurn[];
  is_complete: boolean;
  deal_reached: boolean;
  final_amount?: number;
  deal_quality_score?: number;
}

export interface JobAnalysisResult {
  project_title: string;
  urgency_level: string;
  client_persona: string;
  currency: string;
  deliverables?: string[];
  recommended_setup: NegotiationSetup;
  leverage_points: string[];
  scope_risks: string[];
}

// ── Matchmaking Lobby Types ──────────────────────────────────

export interface CVProject {
  name: str;
  description: str;
  year: str;
}

export interface FreelancerProfile {
  user_id: string;
  display_name: string;
  role_title: string;
  skills: string[];
  min_rate: number;
  max_rate: number;
  currency: string;
  job_text: string;
  avatar_color: string;
  status: string;
  projects?: CVProject[];
  years_of_experience?: number;
  education?: string;
  match_score?: number;
}

export interface ClientProfileData {
  user_id: string;
  display_name: string;
  company: string;
  job_description: string;
  budget_min: number;
  budget_max: number;
  currency: string;
  avatar_color: string;
  status: string;
}

export interface DealInvite {
  invite_id: string;
  client_id: string;
  freelancer_id: string;
  client_name: string;
  client_company: string;
  job_description: string;
  budget_min: number;
  budget_max: number;
  currency: string;
  status: string;
}

// ── Negotiation API ──────────────────────────────────────────

export async function createSession(setup: NegotiationSetup): Promise<NegotiationState> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(setup),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function analyzeJob(jobText: string): Promise<JobAnalysisResult> {
  const res = await fetch(`${API_BASE}/analyze-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_text: jobText }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function extractUrl(url: string): Promise<JobAnalysisResult> {
  const res = await fetch(`${API_BASE}/extract-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadProjectDocument(file: File): Promise<JobAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload-document`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadCv(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/lobby/upload-cv`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Lobby API ────────────────────────────────────────────────

export async function registerFreelancer(profile: {
  display_name: string;
  role_title: string;
  skills: string[];
  min_rate: number;
  max_rate: number;
  currency: string;
  job_text: string;
}): Promise<{ user_id: string }> {
  const res = await fetch(`${API_BASE}/lobby/register/freelancer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function registerClient(profile: {
  display_name: string;
  company: string;
  job_description: string;
  budget_min: number;
  budget_max: number;
  currency: string;
}): Promise<{ user_id: string }> {
  const res = await fetch(`${API_BASE}/lobby/register/client`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getActiveFreelancers(): Promise<{ freelancers: FreelancerProfile[]; count: number }> {
  const res = await fetch(`${API_BASE}/lobby/freelancers`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendDealInvite(clientId: string, freelancerId: string, jobDescription: string = ""): Promise<{ invite_id: string }> {
  const res = await fetch(`${API_BASE}/lobby/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, freelancer_id: freelancerId, job_description: jobDescription }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function acceptInvite(inviteId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/lobby/invite/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invite_id: inviteId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function declineInvite(inviteId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/lobby/invite/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invite_id: inviteId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFreelancerProfile(userId: string): Promise<FreelancerProfile> {
  const res = await fetch(`${API_BASE}/lobby/freelancer/${userId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getClientProfile(userId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/lobby/client/${userId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
