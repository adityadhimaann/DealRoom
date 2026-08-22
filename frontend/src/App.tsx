import React, { useState, useRef, useEffect, useCallback } from "react";
import { LlamaIndexModal } from "./components/LlamaIndexModal";
import {
  DealRoomLogo,
  AgentALogo,
  AgentBLogo,
  NeonLogo,
  PlayIcon,
  PauseIcon,
  StepIcon,
  MicIcon,
  ContractIcon,
  HandshakeIcon,
  WalkawayIcon,
  WhisperIcon,
  SpeakerIcon,
  UploadIcon,
  GlobeIcon,
  DocIcon,
} from "./components/Icons";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { NeonDatabaseModal } from "./components/NeonDatabaseModal";
import { DealRadar } from "./components/DealRadar";
import { ContractModal } from "./components/ContractModal";
import { AcousticTelemetryCard, type AcousticData } from "./components/AcousticTelemetryCard";
import {
  createSession,
  analyzeJob,
  extractUrl,
  uploadProjectDocument,
  registerFreelancer,
  registerClient,
  getActiveFreelancers,
  sendDealInvite,
  acceptInvite,
  declineInvite,
  WS_BASE,
  type NegotiationSetup,
  type NegotiationTurn,
  type JobAnalysisResult,
  type FreelancerProfile,
  type DealInvite,
} from "./lib/api";

function cleanTitle(title: string): string {
  if (!title) return "Commercial Negotiation";
  return title
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_`~|]/g, "")
    .replace(/^[\s·•\-_/]+|[\s·•\-_/]+$/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Commercial Negotiation";
}

// ── Bulletproof Audio Player ───────────────────────────────
function playBase64Audio(b64: string): Promise<void> {
  return new Promise((resolve) => {
    if (!b64 || b64.length < 100) { resolve(); return; }
    try {
      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(() => resolve());
    } catch { resolve(); }
  });
}

interface TurnWithAudio extends NegotiationTurn {
  audioBase64?: string;
  acoustics?: AcousticData;
}

// ═══════════════════════════════════════════════════════════════
// 1. ROLE SELECTION SCREEN
// ═══════════════════════════════════════════════════════════════
function RoleSelectScreen({ onSelectRole }: { onSelectRole: (role: "freelancer" | "client") => void }) {
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  return (
    <div style={{
      height: "100vh", width: "100vw", overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.12), transparent 70%), radial-gradient(ellipse 60% 40% at 0% 100%, rgba(192,132,252,0.08), transparent 60%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(56,189,248,0.08), transparent 60%), #050508",
      color: "#f8fafc", gap: "40px", padding: "20px"
    }}>
      {/* Logo & Title */}
      <div style={{ textAlign: "center" }}>
        <DealRoomLogo size={48} />
        <h1 style={{ fontSize: "36px", fontWeight: 900, margin: "12px 0 4px 0", letterSpacing: "-1px" }}>
          DealRoom
        </h1>
        <p style={{ fontSize: "15px", color: "#94a3b8", margin: 0, maxWidth: "500px" }}>
          Real-time freelancer & client matchmaking with AI-powered voice negotiation
        </p>
      </div>

      {/* Role Cards */}
      <div style={{ display: "flex", gap: "24px" }}>
        {/* Freelancer Card */}
        <button
          onClick={() => onSelectRole("freelancer")}
          onMouseEnter={() => setHoveredRole("freelancer")}
          onMouseLeave={() => setHoveredRole(null)}
          style={{
            width: "280px", padding: "36px 28px",
            background: hoveredRole === "freelancer" ? "rgba(192,132,252,0.08)" : "rgba(255,255,255,0.025)",
            border: `1px solid ${hoveredRole === "freelancer" ? "#c084fc" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "20px", cursor: "pointer", color: "#f8fafc",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
            transition: "all 0.3s ease",
            boxShadow: hoveredRole === "freelancer" ? "0 0 40px rgba(192,132,252,0.2)" : "none",
            transform: hoveredRole === "freelancer" ? "translateY(-4px)" : "none"
          }}
        >
          <div style={{
            width: "64px", height: "64px", borderRadius: "16px",
            background: "rgba(192,132,252,0.15)", border: "1px solid rgba(192,132,252,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px"
          }}>💼</div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px 0" }}>I'm a Freelancer</h2>
            <p style={{ fontSize: "12.5px", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
              Post your skills & rates. Wait for clients to send you deal invites. Negotiate your worth.
            </p>
          </div>
          <span style={{
            fontSize: "12px", fontWeight: 800, padding: "6px 16px", borderRadius: "20px",
            background: hoveredRole === "freelancer" ? "#c084fc" : "rgba(255,255,255,0.06)",
            color: hoveredRole === "freelancer" ? "#000" : "#cbd5e1",
            border: `1px solid ${hoveredRole === "freelancer" ? "#c084fc" : "rgba(255,255,255,0.15)"}`,
            transition: "all 0.2s ease"
          }}>
            Enter as Freelancer →
          </span>
        </button>

        {/* Client Card */}
        <button
          onClick={() => onSelectRole("client")}
          onMouseEnter={() => setHoveredRole("client")}
          onMouseLeave={() => setHoveredRole(null)}
          style={{
            width: "280px", padding: "36px 28px",
            background: hoveredRole === "client" ? "rgba(56,189,248,0.08)" : "rgba(255,255,255,0.025)",
            border: `1px solid ${hoveredRole === "client" ? "#38bdf8" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "20px", cursor: "pointer", color: "#f8fafc",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
            transition: "all 0.3s ease",
            boxShadow: hoveredRole === "client" ? "0 0 40px rgba(56,189,248,0.2)" : "none",
            transform: hoveredRole === "client" ? "translateY(-4px)" : "none"
          }}
        >
          <div style={{
            width: "64px", height: "64px", borderRadius: "16px",
            background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px"
          }}>🏢</div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px 0" }}>I'm a Client</h2>
            <p style={{ fontSize: "12.5px", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
              Post your job or RFP. Browse active freelancers. Send deal invites and negotiate terms.
            </p>
          </div>
          <span style={{
            fontSize: "12px", fontWeight: 800, padding: "6px 16px", borderRadius: "20px",
            background: hoveredRole === "client" ? "#38bdf8" : "rgba(255,255,255,0.06)",
            color: hoveredRole === "client" ? "#000" : "#cbd5e1",
            border: `1px solid ${hoveredRole === "client" ? "#38bdf8" : "rgba(255,255,255,0.15)"}`,
            transition: "all 0.2s ease"
          }}>
            Enter as Client →
          </span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. FREELANCER LOBBY
// ═══════════════════════════════════════════════════════════════
function FreelancerLobby({ onDealAccepted, onBack }: {
  onDealAccepted: (invite: DealInvite, userId: string) => void;
  onBack: () => void;
}) {
  const handleBack = () => {
    localStorage.removeItem("dealroom_screen");
    onBack();
  };
  const [displayName, setDisplayName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [minRate, setMinRate] = useState<number>(5000);
  const [maxRate, setMaxRate] = useState<number>(15000);
  const [currency, setCurrency] = useState("$");
  const [jobText, setJobText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [experience, setExperience] = useState<number>(0);
  const [education, setEducation] = useState<string>("");
  const [isActive, setIsActive] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<DealInvite | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const isAcceptingRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const data = await uploadCv(file);
      setRoleTitle(data.role_title || "");
      if (data.skills) setSkillsText(data.skills.join(", "));
      if (data.projects) setProjects(data.projects);
      if (data.years_of_experience) setExperience(data.years_of_experience);
      if (data.education) setEducation(data.education);
      
      const updatedProfile = {
        display_name: displayName,
        role_title: data.role_title || "",
        skillsText: data.skills?.join(", ") || "",
        projects: data.projects || [],
        years_of_experience: data.years_of_experience || 0,
        education: data.education || ""
      };
      
      alert("CV Extracted successfully! Hit 'Go Active' to join the pool with this intelligence.");
    } catch (err: any) {
      alert("Failed to parse CV: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGoActive = async () => {
    if (!displayName.trim() || !roleTitle.trim()) return;
    setIsRegistering(true);
    try {
      const payload: any = {
        display_name: displayName.trim(),
        role_title: roleTitle.trim(),
        skills: skillsText.split(",").map(s => s.trim()).filter(Boolean),
        min_rate: minRate,
        max_rate: maxRate,
        currency,
        job_text: jobText.trim(),
        projects,
        years_of_experience: experience,
        education
      };
      
      const result = await registerFreelancer(payload);
      setUserId(result.user_id);
      setIsActive(true);

      // Connect WebSocket for real-time invite notifications
      const ws = new WebSocket(`${WS_BASE}/lobby/${result.user_id}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "invite_received") {
            setPendingInvite(data.invite);
          }
        } catch {}
      };
    } catch (err: any) {
      alert("Failed to register: " + err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!pendingInvite || !userId || isAcceptingRef.current) return;
    isAcceptingRef.current = true;
    setIsAccepting(true);
    try {
      await acceptInvite(pendingInvite.invite_id);
      onDealAccepted(pendingInvite, userId);
    } catch (err: any) {
      if (err.message && err.message.includes("already responded")) {
        onDealAccepted(pendingInvite, userId);
      } else {
        alert("Failed to accept: " + err.message);
        isAcceptingRef.current = false;
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineInvite = async () => {
    if (!pendingInvite) return;
    try {
      await declineInvite(pendingInvite.invite_id);
    } catch {}
    setPendingInvite(null);
  };

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  return (
    <div style={{
      height: "100vh", width: "100vw", overflow: "hidden",
      display: "flex", flexDirection: "column",
      background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(192,132,252,0.1), transparent 70%), #050508",
      color: "#f8fafc", padding: "20px 28px", boxSizing: "border-box"
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <DealRoomLogo size={28} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", fontWeight: 900 }}>Freelancer Lobby</span>
              <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "12px", background: "rgba(192,132,252,0.15)", border: "1px solid rgba(192,132,252,0.3)", color: "#c084fc" }}>💼 FREELANCER MODE</span>
            </div>
            <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>Set your profile, go active, and wait for client deal invites</p>
          </div>
        </div>
        <button onClick={handleBack} style={{ padding: "6px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>
          ← Back to Role Select
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", gap: "20px", marginTop: "16px", overflow: "hidden" }}>
        {/* Profile Form */}
        <div style={{ width: "420px", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "18px", overflowY: "auto" }}>
          
          {/* AI CV Upload */}
          <div style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.1), rgba(192,132,252,0.1))", border: "1px solid rgba(192,132,252,0.4)", borderRadius: "12px", padding: "16px", textAlign: "center", cursor: "pointer", transition: "0.2s" }} onClick={() => fileInputRef.current?.click()}>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" style={{ display: 'none' }} />
            <DocIcon size={24} />
            <h3 style={{ margin: "6px 0 3px 0", fontSize: "14px", color: "#c084fc" }}>AI CV Intelligence</h3>
            <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
              {isUploading ? "Extracting intelligence with Gemini 2.5 Flash..." : "Upload your PDF CV to auto-fill your profile."}
            </p>
          </div>

          <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginTop: "8px" }}>Your Freelancer Profile</span>
          
          {[
            { label: "Display Name", value: displayName, set: setDisplayName, ph: "e.g. Aditya Dhiman" },
            { label: "Role / Title", value: roleTitle, set: setRoleTitle, ph: "e.g. Senior React & Cloud Architect" },
            { label: "Skills (comma-separated)", value: skillsText, set: setSkillsText, ph: "React, Node.js, AWS, Python, Kubernetes" },
          ].map(({ label, value, set, ph }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</label>
              <input
                value={value} onChange={(e) => set(e.target.value)} placeholder={ph}
                disabled={isActive}
                style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f8fafc", fontSize: "12.5px", outline: "none" }}
              />
            </div>
          ))}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Min Rate ({currency})</label>
              <input type="number" value={minRate} onChange={(e) => setMinRate(Number(e.target.value))} disabled={isActive}
                style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f8fafc", fontSize: "12.5px", outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Max Rate ({currency})</label>
              <input type="number" value={maxRate} onChange={(e) => setMaxRate(Number(e.target.value))} disabled={isActive}
                style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f8fafc", fontSize: "12.5px", outline: "none" }} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <label style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Job / SOW / Portfolio Summary</label>
            <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} placeholder="Paste your SOW, past project brief, or expertise summary..." disabled={isActive}
              style={{ padding: "10px 12px", minHeight: "120px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f8fafc", fontSize: "12px", lineHeight: 1.5, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          </div>

          {!isActive && (
            <button onClick={handleGoActive} disabled={isRegistering || !displayName.trim() || !roleTitle.trim()}
              style={{ marginTop: "6px", padding: "12px", borderRadius: "10px", background: "#c084fc", color: "#000", border: "none", fontWeight: 900, fontSize: "13px", cursor: isRegistering ? "wait" : "pointer", boxShadow: "0 4px 20px rgba(192,132,252,0.3)" }}>
              {isRegistering ? "Registering..." : "🚀 Go Active — Join Matchmaking Pool"}
            </button>
          )}

          {isActive && (
            <div style={{ marginTop: "6px", padding: "12px", borderRadius: "10px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", textAlign: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#4ade80" }}>✓ YOU ARE ACTIVE</span>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0 0 0" }}>ID: {userId} — Visible to all clients</p>
            </div>
          )}
        </div>

        {/* Status / Waiting Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "30px", position: "relative" }}>
          {!isActive ? (
            <div style={{ textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>💼</div>
              <p style={{ fontSize: "15px", fontWeight: 700 }}>Fill your profile and go active</p>
              <p style={{ fontSize: "12px" }}>Once active, clients will be able to find you and send deal invites</p>
            </div>
          ) : !pendingInvite ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "rgba(192,132,252,0.1)", border: "2px solid rgba(192,132,252,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", animation: "pulse 2s infinite" }}>
                <span style={{ fontSize: "28px" }}>📡</span>
              </div>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff" }}>Waiting for client invites...</p>
              <p style={{ fontSize: "12px", color: "#94a3b8", maxWidth: "340px" }}>Your profile is live in the matchmaking pool. When a client sends you a deal invite, it will appear here instantly.</p>
            </div>
          ) : (
            /* Invite Notification Modal */
            <div style={{ width: "100%", maxWidth: "480px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "16px", padding: "24px", boxShadow: "0 0 40px rgba(56,189,248,0.15)", animation: "pulse 1.5s ease-in-out 1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <span style={{ fontSize: "24px" }}>🔔</span>
                <span style={{ fontSize: "16px", fontWeight: 900, color: "#38bdf8" }}>New Deal Invite!</span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>FROM</span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff" }}>{pendingInvite.client_name} {pendingInvite.client_company ? `(${pendingInvite.client_company})` : ""}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>BUDGET</span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#4ade80" }}>{pendingInvite.currency}{pendingInvite.budget_min.toLocaleString()} – {pendingInvite.currency}{pendingInvite.budget_max.toLocaleString()}</span>
                </div>
                {pendingInvite.job_description && (
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#cbd5e1", lineHeight: 1.4, maxHeight: "120px", overflowY: "auto" }}>
                    {pendingInvite.job_description.substring(0, 500)}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={handleAcceptInvite} disabled={isAccepting}
                  style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#4ade80", color: "#000", border: "none", fontWeight: 900, fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 16px rgba(74,222,128,0.3)" }}>
                  {isAccepting ? "Connecting..." : "✓ Accept & Enter DealRoom"}
                </button>
                <button onClick={handleDeclineInvite}
                  style={{ padding: "12px 20px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. CLIENT LOBBY
// ═══════════════════════════════════════════════════════════════
function ClientLobby({ onDealAccepted, onBack }: {
  onDealAccepted: (invite: DealInvite, userId: string) => void;
  onBack: () => void;
}) {
  const handleBack = () => {
    localStorage.removeItem("dealroom_screen");
    onBack();
  };
  const [displayName, setDisplayName] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState<number>(5000);
  const [budgetMax, setBudgetMax] = useState<number>(15000);
  const [currency, setCurrency] = useState("$");
  const [userId, setUserId] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [freelancers, setFreelancers] = useState<FreelancerProfile[]>([]);
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  const [waitingForAccept, setWaitingForAccept] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const data = await uploadProjectDocument(file);
      
      // Auto-fill form from JD extraction
      const desc = `Project: ${data.project_title}\n\nDeliverables:\n${(data.deliverables || []).join('\n- ')}`;
      setJobDescription(desc);
      if (data.recommended_setup?.agent_b_config) {
        setBudgetMin(data.recommended_setup.agent_b_config.ideal_price);
        setBudgetMax(data.recommended_setup.agent_b_config.min_price);
      }
      if (data.currency) setCurrency(data.currency);
      
      alert("Job Description extracted successfully! Hit 'Post Job' to browse matching freelancers.");
    } catch (err: any) {
      alert("Failed to parse Job Description: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRegister = async () => {
    if (!displayName.trim()) return;
    setIsRegistering(true);
    try {
      const result = await registerClient({
        display_name: displayName.trim(),
        company: company.trim(),
        job_description: jobDescription.trim(),
        budget_min: budgetMin,
        budget_max: budgetMax,
        currency,
      });
      setUserId(result.user_id);
      setIsRegistered(true);

      // Fetch initial freelancer list
      const fl = await getActiveFreelancers();
      setFreelancers(fl.freelancers);

      // Connect WebSocket for real-time updates
      const ws = new WebSocket(`${WS_BASE}/lobby/${result.user_id}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "freelancer_list_update") {
            setFreelancers(data.freelancers || []);
          } else if (data.type === "invite_accepted") {
            onDealAccepted(data.invite, result.user_id);
          } else if (data.type === "invite_declined") {
            setInviteSent(null);
            setWaitingForAccept(false);
            alert("The freelancer declined your invite. You can try another one.");
          }
        } catch {}
      };
    } catch (err: any) {
      alert("Failed to register: " + err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSendInvite = async (freelancerId: string) => {
    if (!userId) return;
    try {
      const result = await sendDealInvite(userId, freelancerId, jobDescription);
      setInviteSent(freelancerId);
      setWaitingForAccept(true);
    } catch (err: any) {
      alert("Failed to send invite: " + err.message);
    }
  };

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  return (
    <div style={{
      height: "100vh", width: "100vw", overflow: "hidden",
      display: "flex", flexDirection: "column",
      background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.1), transparent 70%), #050508",
      color: "#f8fafc", padding: "20px 28px", boxSizing: "border-box"
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <DealRoomLogo size={28} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", fontWeight: 900 }}>Client Lobby</span>
              <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "12px", background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8" }}>🏢 CLIENT MODE</span>
            </div>
            <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>Post your job, browse freelancers, and send deal invites</p>
          </div>
        </div>
        <button onClick={handleBack} style={{ padding: "6px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>
          ← Back to Role Select
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "20px", marginTop: "16px", overflow: "hidden" }}>
        {/* Left: Job Posting Form */}
        <div style={{ width: "380px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", overflowY: "auto" }}>
          
          {/* AI JD Upload */}
          <div style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.1), rgba(192,132,252,0.1))", border: "1px solid rgba(56,189,248,0.4)", borderRadius: "12px", padding: "16px", textAlign: "center", cursor: "pointer", transition: "0.2s" }} onClick={() => fileInputRef.current?.click()}>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.md" style={{ display: 'none' }} />
            <DocIcon size={24} />
            <h3 style={{ margin: "6px 0 3px 0", fontSize: "14px", color: "#38bdf8" }}>AI JD Intelligence</h3>
            <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
              {isUploading ? "Extracting intelligence with Gemini 2.5 Flash..." : "Upload your Job Description PDF to auto-fill."}
            </p>
          </div>

          <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", marginTop: "8px" }}>Your Job Posting</span>

          {[
            { label: "Your Name", value: displayName, set: setDisplayName, ph: "e.g. Product Manager at Acme" },
            { label: "Company", value: company, set: setCompany, ph: "e.g. Acme Inc." },
          ].map(({ label, value, set, ph }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</label>
              <input value={value} onChange={(e) => set(e.target.value)} placeholder={ph} disabled={isRegistered}
                style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f8fafc", fontSize: "12.5px", outline: "none" }} />
            </div>
          ))}

          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <label style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Job Description / RFP</label>
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste your full RFP, job description, or project requirements..." disabled={isRegistered}
              style={{ padding: "10px 12px", minHeight: "100px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f8fafc", fontSize: "12px", lineHeight: 1.5, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Min Budget ({currency})</label>
              <input type="number" value={budgetMin} onChange={(e) => setBudgetMin(Number(e.target.value))} disabled={isRegistered}
                style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f8fafc", fontSize: "12.5px", outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Max Budget ({currency})</label>
              <input type="number" value={budgetMax} onChange={(e) => setBudgetMax(Number(e.target.value))} disabled={isRegistered}
                style={{ padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#f8fafc", fontSize: "12.5px", outline: "none" }} />
            </div>
          </div>

          {!isRegistered ? (
            <button onClick={handleRegister} disabled={isRegistering || !displayName.trim()}
              style={{ marginTop: "6px", padding: "12px", borderRadius: "10px", background: "#38bdf8", color: "#000", border: "none", fontWeight: 900, fontSize: "13px", cursor: isRegistering ? "wait" : "pointer", boxShadow: "0 4px 20px rgba(56,189,248,0.3)" }}>
              {isRegistering ? "Registering..." : "🔍 Post Job & Browse Freelancers"}
            </button>
          ) : (
            <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", textAlign: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#4ade80" }}>✓ JOB POSTED</span>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: "2px 0 0 0" }}>Browse and invite freelancers →</p>
            </div>
          )}
        </div>

        {/* Right: Active Freelancers Grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#ffffff" }}>
              Active Freelancers ({freelancers.length})
            </span>
            <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>
              {isRegistered ? "Live — updates in real-time" : "Register to see freelancers"}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px", alignContent: "start", paddingRight: "4px" }}>
            {!isRegistered ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#64748b", padding: "40px 0" }}>
                <span style={{ fontSize: "36px" }}>🏢</span>
                <p style={{ fontSize: "14px", fontWeight: 700, margin: "8px 0" }}>Post your job to browse freelancers</p>
              </div>
            ) : freelancers.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#64748b", padding: "40px 0" }}>
                <span style={{ fontSize: "36px" }}>📡</span>
                <p style={{ fontSize: "14px", fontWeight: 700, margin: "8px 0" }}>No freelancers online yet</p>
                <p style={{ fontSize: "12px" }}>When freelancers go active, their profiles will appear here in real-time</p>
              </div>
            ) : (
              freelancers.map((fl) => (
                <div key={fl.user_id} style={{
                  background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px",
                  transition: "all 0.2s ease"
                }}>
                  {/* Freelancer Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "10px",
                      background: `${fl.avatar_color}25`, border: `1px solid ${fl.avatar_color}60`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "18px", fontWeight: 900, color: fl.avatar_color
                    }}>
                      {fl.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#ffffff" }}>{fl.display_name}</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>{fl.role_title}</div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite" }} />
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#4ade80" }}>ACTIVE</span>
                    </div>
                  </div>

                  {/* Rate */}
                  <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
                    Rate: <strong style={{ color: "#ffffff" }}>{fl.currency}{fl.min_rate.toLocaleString()} – {fl.currency}{fl.max_rate.toLocaleString()}</strong>
                  </div>

                  {/* Skills */}
                  {fl.skills && fl.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {fl.skills.slice(0, 6).map((skill, i) => (
                        <span key={i} style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1" }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Invite Button */}
                  <button
                    onClick={() => handleSendInvite(fl.user_id)}
                    disabled={inviteSent === fl.user_id}
                    style={{
                      marginTop: "auto", padding: "8px 14px", borderRadius: "8px",
                      background: inviteSent === fl.user_id ? "rgba(74,222,128,0.1)" : "#ffffff",
                      color: inviteSent === fl.user_id ? "#4ade80" : "#000",
                      border: inviteSent === fl.user_id ? "1px solid rgba(74,222,128,0.3)" : "none",
                      fontWeight: 800, fontSize: "11.5px",
                      cursor: inviteSent === fl.user_id ? "default" : "pointer",
                      boxShadow: inviteSent === fl.user_id ? "none" : "0 4px 14px rgba(255,255,255,0.15)"
                    }}
                  >
                    {inviteSent === fl.user_id ? (waitingForAccept ? "⏳ Waiting for response..." : "✓ Invite Sent") : "Send Deal Invite →"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// 4. LIVE NEGOTIATION ARENA (preserved from existing code)
// ═══════════════════════════════════════════════════════════════
function NegotiationArena({
  sessionId, setup, docName, onReset
}: {
  sessionId: string; setup: NegotiationSetup; docName?: string; onReset: () => void;
}) {
  const currency = setup.currency || "$";
  const [turns, setTurns] = useState<TurnWithAudio[]>([]);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [isThinking, setIsThinking] = useState<string | null>(null);
  const [speakingAgent, setSpeakingAgent] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [dealReached, setDealReached] = useState(false);
  const [finalAmount, setFinalAmount] = useState<number | null>(null);
  const [dealQuality, setDealQuality] = useState<number | null>(null);
  const [latestAcousticsA, setLatestAcousticsA] = useState<AcousticData | null>(null);
  const [latestAcousticsB, setLatestAcousticsB] = useState<AcousticData | null>(null);
  const [isFlightMode, setIsFlightMode] = useState(false);
  const [whisperA, setWhisperA] = useState("");
  const [whisperB, setWhisperB] = useState("");
  const [manualMsgA, setManualMsgA] = useState("");
  const [isRecordingA, setIsRecordingA] = useState(false);
  const [isRecordingWhisperA, setIsRecordingWhisperA] = useState(false);
  const [isRecordingWhisperB, setIsRecordingWhisperB] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isLlamaModalOpen, setIsLlamaModalOpen] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoRunningRef = useRef(false);

  useEffect(() => { autoRunningRef.current = isAutoRunning; }, [isAutoRunning]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [turns, isThinking]);

  const startVoiceInput = (target: "manualA" | "whisperA" | "whisperB") => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Speech not supported. Use Chrome or Edge."); return; }
    const r = new SR(); r.continuous = false; r.interimResults = true; r.lang = "en-US";
    if (target === "manualA") setIsRecordingA(true);
    if (target === "whisperA") setIsRecordingWhisperA(true);
    if (target === "whisperB") setIsRecordingWhisperB(true);
    r.onresult = (e: any) => {
      let t = ""; for (let i = e.resultIndex; i < e.results.length; ++i) t += e.results[i][0].transcript;
      if (target === "manualA") setManualMsgA(t);
      else if (target === "whisperA") setWhisperA(t);
      else if (target === "whisperB") setWhisperB(t);
    };
    r.onerror = r.onend = () => { setIsRecordingA(false); setIsRecordingWhisperA(false); setIsRecordingWhisperB(false); };
    r.start();
  };

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/sessions/${sessionId}`);
    wsRef.current = ws;
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "turn_thinking") { setIsThinking(data.agent); setSpeakingAgent(null); }
        else if (data.type === "turn_ready") {
          setIsThinking(null); setSpeakingAgent(data.turn.agent);
          const rec: TurnWithAudio = { ...data.turn, audioBase64: data.audio_base64, acoustics: data.acoustics };
          setTurns(p => p.some(t => t.turn_number === data.turn.turn_number) ? p : [...p, rec]);
          if (data.turn.agent === "A" && data.acoustics) setLatestAcousticsA(data.acoustics);
          if (data.turn.agent === "B" && data.acoustics) setLatestAcousticsB(data.acoustics);
          if (data.audio_base64) await playBase64Audio(data.audio_base64);
          setSpeakingAgent(null);
          if (data.is_complete) { setIsComplete(true); setIsAutoRunning(false); setDealReached(data.deal_reached); setFinalAmount(data.final_amount); setDealQuality(data.deal_quality_score); }
          else if (autoRunningRef.current) setTimeout(() => { if (autoRunningRef.current && wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ action: "step" })); }, 350);
        }
      } catch {}
    };
    return () => { ws.close(); };
  }, [sessionId]);

  const handleStartAuto = () => { if (wsRef.current?.readyState === WebSocket.OPEN) { setIsAutoRunning(true); autoRunningRef.current = true; wsRef.current.send(JSON.stringify({ action: "step" })); } };
  const handlePause = () => { setIsAutoRunning(false); autoRunningRef.current = false; };
  const handleStepTurn = () => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ action: "step" })); };

  const handleSendManualTurn = (agent: "A" | "B") => {
    if (!manualMsgA.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "manual_turn", agent, message: manualMsgA.trim() }));
    setManualMsgA("");
  };

  const handleSendWhisper = (agent: "A" | "B") => {
    const text = agent === "A" ? whisperA : whisperB;
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: "whisper", agent, instruction: text.trim() }));
    if (agent === "A") setWhisperA(""); else setWhisperB("");
  };

  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", display: "flex", flexDirection: "column", boxSizing: "border-box", padding: "12px 20px", background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.08), transparent 70%), #050508", color: "#f8fafc" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, height: "46px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flexShrink: 1 }}>
          <DealRoomLogo size={24} />
          <span title={cleanTitle(setup.subject)} style={{ fontSize: "13.5px", fontWeight: 800, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "280px" }}>
            {cleanTitle(setup.subject)}
          </span>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
            #{sessionId.substring(0, 8)}
          </span>
        </div>
        <div style={{ flex: 1, maxWidth: "360px", margin: "0 16px" }}>
          <AudioVisualizer isSpeaking={speakingAgent !== null} label={speakingAgent === "A" ? `${setup.agent_a_config.role_name} speaking` : speakingAgent === "B" ? `${setup.agent_b_config.role_name} speaking` : "Voice Channel"} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => setIsLlamaModalOpen(true)} style={{ padding: "5px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><DocIcon size={12} /> LlamaIndex</button>
          <button onClick={() => setIsDbModalOpen(true)} style={{ padding: "5px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><NeonLogo size={12} /> Neon DB</button>
          {isComplete && <button onClick={() => setShowContract(true)} style={{ padding: "5px 12px", borderRadius: "6px", background: "#fff", color: "#000", border: "none", fontSize: "11px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><ContractIcon size={12} /> SOW</button>}
          <button onClick={onReset} style={{ padding: "5px 10px", borderRadius: "6px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Exit</button>
        </div>
      </div>

      {/* 3-Column Arena */}
      <div style={{ display: "grid", gridTemplateColumns: "310px 1fr 310px", gap: "14px", flex: 1, overflow: "hidden", marginTop: "12px" }}>
        {/* Left: Agent A */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: speakingAgent === "A" ? "rgba(192,132,252,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${speakingAgent === "A" ? "#c084fc" : "rgba(255,255,255,0.08)"}`, boxShadow: speakingAgent === "A" ? "0 0 35px rgba(192,132,252,0.25)" : "none", borderRadius: "14px", padding: "14px", overflowY: "auto", transition: "all 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: speakingAgent === "A" ? "rgba(192,132,252,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${speakingAgent === "A" ? "#c084fc" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}><AgentALogo size={20} /></div>
            <div><span style={{ fontSize: "13px", fontWeight: 800 }}>{setup.agent_a_config.role_name}</span><p style={{ fontSize: "10.5px", color: "#94a3b8", margin: 0 }}>Agent A · Vendor</p></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", fontSize: "11px" }}>
            <div><span style={{ color: "#94a3b8" }}>Ask:</span><div style={{ fontWeight: 800, color: "#fff", fontSize: "12.5px" }}>{currency}{setup.agent_a_config.ideal_price.toLocaleString()}</div></div>
            <div><span style={{ color: "#94a3b8" }}>Floor:</span><div style={{ fontWeight: 800, color: "#f87171", fontSize: "12.5px" }}>{currency}{setup.agent_a_config.min_price.toLocaleString()}</div></div>
          </div>
          <AcousticTelemetryCard acoustics={latestAcousticsA} agent="A" roleName={setup.agent_a_config.role_name} isSpeaking={speakingAgent === "A"} />
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><WhisperIcon size={12} /><span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Whisper to Agent A</span></div>
            <div style={{ display: "flex", gap: "4px" }}>
              <input type="text" value={whisperA} onChange={(e) => setWhisperA(e.target.value)} placeholder="'Push for $38k'..." style={{ flex: 1, padding: "6px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "11.5px", outline: "none" }} />
              <button type="button" onClick={() => startVoiceInput("whisperA")} style={{ padding: "6px 8px", borderRadius: "6px", background: isRecordingWhisperA ? "#ef4444" : "rgba(255,255,255,0.08)", border: "none", color: "#fff", cursor: "pointer" }}><MicIcon size={12} /></button>
              <button type="button" onClick={() => handleSendWhisper("A")} style={{ padding: "6px 10px", borderRadius: "6px", background: "#fff", color: "#000", fontWeight: 800, border: "none", fontSize: "11px", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        </div>

        {/* Center: Controls + Radar + Transcript */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "14px", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.04)", padding: "3px 6px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <button type="button" onClick={() => setIsFlightMode(false)} style={{ background: !isFlightMode ? "#fff" : "transparent", color: !isFlightMode ? "#000" : "#94a3b8", border: "none", borderRadius: "5px", padding: "4px 10px", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>🤖 Autonomous AI</button>
              <button type="button" onClick={() => setIsFlightMode(true)} style={{ background: isFlightMode ? "#38bdf8" : "transparent", color: isFlightMode ? "#000" : "#94a3b8", border: "none", borderRadius: "5px", padding: "4px 10px", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>🥊 Voice Flight Sim</button>
            </div>
            {!isComplete && (
              <div style={{ display: "flex", gap: "6px" }}>
                {!isAutoRunning ? (
                  <button onClick={handleStartAuto} style={{ padding: "6px 14px", borderRadius: "8px", background: "#fff", color: "#000", border: "none", fontWeight: 800, fontSize: "11.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><PlayIcon size={12} /> Auto</button>
                ) : (
                  <button onClick={handlePause} style={{ padding: "6px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.12)", color: "#fff", border: "none", fontWeight: 800, fontSize: "11.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><PauseIcon size={12} /> Pause</button>
                )}
                <button onClick={handleStepTurn} style={{ padding: "6px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontWeight: 700, fontSize: "11.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><StepIcon size={12} /> Step</button>
              </div>
            )}
          </div>

          {isFlightMode && !isComplete && (
            <div style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.1), rgba(7,7,9,0.95))", border: "1px solid rgba(56,189,248,0.35)", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <button type="button" onClick={() => startVoiceInput("manualA")} style={{ background: isRecordingA ? "#ef4444" : "#fff", color: isRecordingA ? "#fff" : "#000", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: 800, fontSize: "11.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><MicIcon size={13} />{isRecordingA ? "Listening..." : "Speak Offer"}</button>
              <input type="text" value={manualMsgA} onChange={(e) => setManualMsgA(e.target.value)} placeholder="Speak or type your pitch..." style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(56,189,248,0.3)", color: "#fff", fontSize: "12px", outline: "none" }} />
              <button type="button" onClick={() => handleSendManualTurn("A")} disabled={!manualMsgA.trim()} style={{ padding: "6px 12px", borderRadius: "6px", background: manualMsgA.trim() ? "#38bdf8" : "rgba(255,255,255,0.08)", color: manualMsgA.trim() ? "#000" : "#64748b", border: "none", fontWeight: 800, fontSize: "11.5px", cursor: manualMsgA.trim() ? "pointer" : "not-allowed" }}>Send ➔</button>
            </div>
          )}

          <div style={{ flexShrink: 0 }}><DealRadar setup={setup} turns={turns} currency={currency} /></div>

          {/* Transcript */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingRight: "6px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {turns.length === 0 && !isThinking && <div style={{ textAlign: "center", color: "#64748b", margin: "auto", padding: "20px 0" }}><p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px 0" }}>Click "Auto" to launch voice debate</p></div>}
            {turns.map((turn) => {
              const isA = turn.agent === "A";
              return (
                <div key={turn.turn_number} style={{ display: "flex", flexDirection: isA ? "row" : "row-reverse", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "6px", flexShrink: 0, background: isA ? "rgba(192,132,252,0.15)" : "rgba(56,189,248,0.15)", border: `1px solid ${isA ? "#c084fc" : "#38bdf8"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isA ? <AgentALogo size={14} /> : <AgentBLogo size={14} />}
                  </div>
                  <div style={{ maxWidth: "82%", padding: "8px 12px", borderRadius: "10px", background: isA ? "rgba(192,132,252,0.06)" : "rgba(56,189,248,0.06)", border: `1px solid ${isA ? "rgba(192,132,252,0.18)" : "rgba(56,189,248,0.18)"}`, fontSize: "12px", color: "#f1f5f9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: isA ? "#c084fc" : "#38bdf8" }}>{isA ? setup.agent_a_config.role_name : setup.agent_b_config.role_name} · R{turn.turn_number}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {turn.offer_amount && <span style={{ fontSize: "11px", fontWeight: 800, color: "#fff", background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: "4px" }}>{currency}{turn.offer_amount.toLocaleString()}</span>}
                        {turn.acoustics && turn.acoustics.bluff_probability >= 50 && <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#fca5a5", background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)", padding: "1px 5px", borderRadius: "4px" }}>🚨 BLUFF {turn.acoustics.bluff_probability}%</span>}
                        {turn.audioBase64 && <button onClick={() => playBase64Audio(turn.audioBase64!)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "0 2px" }}><SpeakerIcon size={12} /></button>}
                      </div>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.4 }}>{turn.message}</p>
                    {turn.reasoning && <p style={{ margin: "4px 0 0 0", fontSize: "10.5px", color: "#94a3b8", fontStyle: "italic" }}>{turn.reasoning}</p>}
                  </div>
                </div>
              );
            })}
            {isThinking && <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "11.5px", padding: "4px 0" }}><span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8", animation: "pulse 1s infinite" }} />{isThinking === "A" ? setup.agent_a_config.role_name : setup.agent_b_config.role_name} computing...</div>}
            {isComplete && (
              <div style={{ textAlign: "center", padding: "14px", borderRadius: "10px", background: dealReached ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${dealReached ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, marginTop: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "14px", fontWeight: 800, color: dealReached ? "#4ade80" : "#f87171" }}>
                  {dealReached ? <><HandshakeIcon size={16} /> DEAL AGREED</> : <><WalkawayIcon size={16} /> WALK-AWAY</>}
                </div>
                {finalAmount && <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff", margin: "4px 0" }}>{currency}{finalAmount.toLocaleString()}</div>}
                {dealQuality !== null && <div style={{ fontSize: "11px", color: "#94a3b8" }}>Pareto Score: <strong style={{ color: "#fff" }}>{dealQuality}%</strong></div>}
                <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "8px" }}>
                  <button onClick={() => setShowContract(true)} style={{ padding: "6px 14px", borderRadius: "6px", background: "#fff", color: "#000", fontWeight: 800, fontSize: "11.5px", border: "none", cursor: "pointer" }}>Generate SOW ➔</button>
                  <button onClick={onReset} style={{ padding: "6px 14px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: "11.5px", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}>New Deal</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Agent B */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: speakingAgent === "B" ? "rgba(56,189,248,0.04)" : "rgba(255,255,255,0.02)", border: `1px solid ${speakingAgent === "B" ? "#38bdf8" : "rgba(255,255,255,0.08)"}`, boxShadow: speakingAgent === "B" ? "0 0 35px rgba(56,189,248,0.25)" : "none", borderRadius: "14px", padding: "14px", overflowY: "auto", transition: "all 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: speakingAgent === "B" ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${speakingAgent === "B" ? "#38bdf8" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}><AgentBLogo size={20} /></div>
            <div><span style={{ fontSize: "13px", fontWeight: 800 }}>{setup.agent_b_config.role_name}</span><p style={{ fontSize: "10.5px", color: "#94a3b8", margin: 0 }}>Agent B · Buyer</p></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", fontSize: "11px" }}>
            <div><span style={{ color: "#94a3b8" }}>Bid:</span><div style={{ fontWeight: 800, color: "#fff", fontSize: "12.5px" }}>{currency}{setup.agent_b_config.ideal_price.toLocaleString()}</div></div>
            <div><span style={{ color: "#94a3b8" }}>Ceiling:</span><div style={{ fontWeight: 800, color: "#fbbf24", fontSize: "12.5px" }}>{currency}{setup.agent_b_config.min_price.toLocaleString()}</div></div>
          </div>
          <AcousticTelemetryCard acoustics={latestAcousticsB} agent="B" roleName={setup.agent_b_config.role_name} isSpeaking={speakingAgent === "B"} />
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><WhisperIcon size={12} /><span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Whisper to Agent B</span></div>
            <div style={{ display: "flex", gap: "4px" }}>
              <input type="text" value={whisperB} onChange={(e) => setWhisperB(e.target.value)} placeholder="'Cap at $32k'..." style={{ flex: 1, padding: "6px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "11.5px", outline: "none" }} />
              <button type="button" onClick={() => startVoiceInput("whisperB")} style={{ padding: "6px 8px", borderRadius: "6px", background: isRecordingWhisperB ? "#ef4444" : "rgba(255,255,255,0.08)", border: "none", color: "#fff", cursor: "pointer" }}><MicIcon size={12} /></button>
              <button type="button" onClick={() => handleSendWhisper("B")} style={{ padding: "6px 10px", borderRadius: "6px", background: "#fff", color: "#000", fontWeight: 800, border: "none", fontSize: "11px", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        </div>
      </div>

      {showContract && <ContractModal sessionId={sessionId} setup={setup} finalAmount={finalAmount || setup.agent_a_config.min_price} dealReached={dealReached} dealQuality={dealQuality} turnsCount={turns.length} onClose={() => setShowContract(false)} />}
      <LlamaIndexModal isOpen={isLlamaModalOpen} onClose={() => setIsLlamaModalOpen(false)} />
      <NeonDatabaseModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// 5. MAIN APP ROUTER — 4-SCREEN FLOW
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState<"role_select" | "freelancer_lobby" | "client_lobby" | "arena">(() => {
    return (localStorage.getItem("dealroom_screen") as any) || "role_select";
  });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [setup, setSetup] = useState<NegotiationSetup | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const handleRoleSelect = (role: "freelancer" | "client") => {
    const nextScreen = role === "freelancer" ? "freelancer_lobby" : "client_lobby";
    setScreen(nextScreen);
    localStorage.setItem("dealroom_screen", nextScreen);
  };

  const handleDealAccepted = async (invite: DealInvite, userId: string) => {
    setMyUserId(userId);
    // Build a NegotiationSetup from the invite data
    const dealSetup: NegotiationSetup = {
      subject: cleanTitle(invite.job_description.substring(0, 100)) || "Live DealRoom Negotiation",
      max_turns: 8,
      currency: invite.currency || "$",
      deliverables: ["Scope & Deliverables", "Timeline & Milestones", "Payment Terms", "Quality Assurance"],
      agent_a_config: {
        role_name: "Freelancer Advisor (AI)",
        ideal_price: invite.budget_max * 1.2,
        min_price: invite.budget_max * 0.8,
        strategy: "balanced",
        priorities: ["Fair market rate", "Milestone escrow", "Scope protection"],
        context: "AI advisor representing the freelancer's interests"
      },
      agent_b_config: {
        role_name: "Client Advisor (AI)",
        ideal_price: invite.budget_min,
        min_price: invite.budget_max,
        strategy: "balanced",
        priorities: ["Budget efficiency", "Quality guarantee", "Deadline enforcement"],
        context: "AI advisor representing the client's interests"
      },
    };

    try {
      const state = await createSession(dealSetup);
      setSessionId(state.session_id);
      setSetup(dealSetup);
      setScreen("arena");
    } catch (err: any) {
      alert("Failed to create deal session: " + err.message);
    }
  };

  const handleBack = () => {
    setScreen("role_select");
    localStorage.removeItem("dealroom_screen");
  };

  const handleReset = () => {
    setSessionId(null);
    setSetup(null);
    setMyUserId(null);
    setScreen("role_select");
    localStorage.removeItem("dealroom_screen");
  };

  if (screen === "freelancer_lobby") {
    return <FreelancerLobby onDealAccepted={handleDealAccepted} onBack={handleBack} />;
  }

  if (screen === "client_lobby") {
    return <ClientLobby onDealAccepted={handleDealAccepted} onBack={handleBack} />;
  }

  if (screen === "arena" && sessionId && setup) {
    return <NegotiationArena sessionId={sessionId} setup={setup} onReset={handleReset} />;
  }

  return <RoleSelectScreen onSelectRole={handleRoleSelect} />;
}
