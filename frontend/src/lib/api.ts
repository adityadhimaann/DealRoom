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
