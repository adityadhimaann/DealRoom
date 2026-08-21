import React, { useState, useRef, useEffect } from "react";
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
  WS_BASE,
  type NegotiationSetup,
  type NegotiationTurn,
  type JobAnalysisResult,
} from "./lib/api";

function cleanTitle(title: string): string {
  if (!title) return "Commercial Negotiation Engagement";
  return title
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_`~|]/g, "")
    .replace(/^[\s·•\-_/]+|[\s·•\-_/]+$/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Commercial Negotiation Engagement";
}

// ── Bulletproof Audio Player ───────────────────────────────
function playBase64Audio(b64: string): Promise<void> {
  return new Promise((resolve) => {
    if (!b64 || b64.length < 100) {
      resolve();
      return;
    }
    try {
      const binaryString = atob(b64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = 1.0;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => resolve());
      }
    } catch {
      resolve();
    }
  });
}

interface TurnWithAudio extends NegotiationTurn {
  audioBase64?: string;
  acoustics?: AcousticData;
}

// ── Compact Modern UI Input Field ──────────────────────────
function ModernInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  suffix
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  type?: string;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <label style={{ fontSize: "10px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "8px",
            color: "#f8fafc",
            fontSize: "12.5px",
            outline: "none",
            boxSizing: "border-box"
          }}
        />
        {suffix && (
          <span style={{ position: "absolute", right: "10px", fontSize: "11px", color: "#64748b", fontWeight: 700 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// 1. SETUP PANEL (SINGLE-VIEWPORT HIGH-DENSITY DASHBOARD)
// ═════════════════════════════════════════════════════════════
function SetupPanel({ onStart }: { onStart: (setup: NegotiationSetup, docName?: string) => void }) {
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isLlamaModalOpen, setIsLlamaModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "url" | "text">("text");
  const [currency, setCurrency] = useState<string>("$");

  const [subject, setSubject] = useState("Enterprise Cloud & AI Security Platform Retainer");
  const [maxTurns, setMaxTurns] = useState(8);

  const [aRole, setARole] = useState("Cloud Security Lead");
  const [aIdeal, setAIdeal] = useState<number | "">(45000);
  const [aMin, setAMin] = useState<number | "">(35000);
  const [aStrategy, setAStrategy] = useState<"aggressive" | "collaborative" | "balanced">("balanced");
  const [aPriorities, setAPriorities] = useState("25% upfront escrow, SLA penalty cap");

  const [bRole, setBRole] = useState("VP Technology Procurement");
  const [bIdeal, setBIdeal] = useState<number | "">(28000);
  const [bMin, setBMin] = useState<number | "">(35000);
  const [bStrategy, setBStrategy] = useState<"aggressive" | "collaborative" | "balanced">("balanced");
  const [bPriorities, setBPriorities] = useState("24/7 SLA guarantee, milestone sign-offs");

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [rawTextInput, setRawTextInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [analysisInsights, setAnalysisInsights] = useState<JobAnalysisResult | null>(null);
  const [isAutoConfigured, setIsAutoConfigured] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const applyAnalysisToForm = (result: any) => {
    if (!result) return;
    setAnalysisInsights(result);
    setIsAutoConfigured(true);

    if (result.currency) setCurrency(result.currency);
    if (result.detected_currency) setCurrency(result.detected_currency);
    setSubject(cleanTitle(result.project_title || "Enterprise Commercial Engagement"));

    const cfgA = result.recommended_setup?.agent_a_config || result.agent_a || {};
    const cfgB = result.recommended_setup?.agent_b_config || result.agent_b || {};

    if (cfgA.role_name) setARole(cfgA.role_name);
    if (cfgA.ideal_price !== undefined) setAIdeal(cfgA.ideal_price);
    if (cfgA.min_price !== undefined) setAMin(cfgA.min_price);
    if (cfgA.strategy) setAStrategy(cfgA.strategy as any);
    if (cfgA.priorities) {
      setAPriorities(Array.isArray(cfgA.priorities) ? cfgA.priorities.join(", ") : String(cfgA.priorities));
    }

    if (cfgB.role_name) setBRole(cfgB.role_name);
    if (cfgB.ideal_price !== undefined) setBIdeal(cfgB.ideal_price);
    if (cfgB.min_price !== undefined) setBMin(cfgB.min_price);
    if (cfgB.strategy) setBStrategy(cfgB.strategy as any);
    if (cfgB.priorities) {
      setBPriorities(Array.isArray(cfgB.priorities) ? cfgB.priorities.join(", ") : String(cfgB.priorities));
    }

    const delivCount = result.deliverables?.length || result.technical_deliverables?.length || 0;
    setSuccessMessage(`Parsed ${delivCount} deliverables & calibrated dual-agent strategy!`);
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await uploadProjectDocument(file);
      applyAnalysisToForm(result);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to analyze document.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await extractUrl(urlInput.trim());
      applyAnalysisToForm(result);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to extract URL.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!rawTextInput.trim()) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await analyzeJob(rawTextInput.trim());
      applyAnalysisToForm(result);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to parse text.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setErrorMessage("Please specify negotiation subject / scope.");
      return;
    }
    setIsLaunching(true);
    const setup: NegotiationSetup = {
      subject: subject.trim(),
      max_turns: maxTurns,
      currency,
      deliverables: analysisInsights?.deliverables || [
        "Kubernetes Multi-Region Cluster Architecture",
        "Real-Time LLM Guardrails & PII Masking Pipeline",
        "PostgreSQL High-Availability Replication",
        "99.95% System Uptime SLA with 24/7 Support"
      ],
      agent_a_config: {
        role_name: aRole || "Vendor Lead",
        ideal_price: Number(aIdeal) || 45000,
        min_price: Number(aMin) || 35000,
        strategy: aStrategy,
        priorities: aPriorities ? aPriorities.split(",").map(p => p.trim()) : ["25% upfront escrow", "SLA penalty cap"],
        context: "Production-ready enterprise delivery"
      },
      agent_b_config: {
        role_name: bRole || "Procurement Lead",
        ideal_price: Number(bIdeal) || 28000,
        min_price: Number(bMin) || 35000,
        strategy: bStrategy,
        priorities: bPriorities ? bPriorities.split(",").map(p => p.trim()) : ["Budget control", "24/7 SLA guarantee"],
        context: "Strict commercial oversight"
      },
    };
    onStart(setup, uploadedFile?.name);
  };

  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      padding: "16px 24px",
      background: "radial-gradient(circle at 50% 0%, #111115 0%, #050507 60%, #000000 100%)",
      color: "#f8fafc"
    }}>
      {/* ── TOP NAV BAR ── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: "12px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <DealRoomLogo size={32} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ fontSize: "18px", fontWeight: "900", margin: 0, letterSpacing: "-0.5px" }}>
                DealRoom
              </h1>
              <span style={{ fontSize: "10px", fontWeight: "800", padding: "2px 8px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)" }}>
                AI COMMERCIAL NEGOTIATION ARENA
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
              Autonomous Multi-Agent Contract Negotiation & Live Voice Flight Simulator
            </p>
          </div>
        </div>

        {/* Global Action Header Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Currency Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "3px", background: "rgba(255,255,255,0.04)", padding: "3px 6px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
            {["$", "₹", "€", "£"].map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setCurrency(cur)}
                style={{
                  padding: "3px 8px",
                  borderRadius: "5px",
                  border: "none",
                  background: currency === cur ? "#ffffff" : "transparent",
                  color: currency === cur ? "#000000" : "#94a3b8",
                  fontWeight: 800,
                  fontSize: "11px",
                  cursor: "pointer"
                }}
              >
                {cur} {cur === "$" ? "USD" : cur === "₹" ? "INR" : cur === "€" ? "EUR" : "GBP"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsLlamaModalOpen(true)}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f8fafc",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "11.5px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <DocIcon size={14} /> LlamaIndex Citations
          </button>

          <button
            type="button"
            onClick={() => setIsDbModalOpen(true)}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f8fafc",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "11.5px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <NeonLogo size={14} /> Neon DB
          </button>
        </div>
      </div>

      {/* ── MAIN DASHBOARD (2-COLUMN HIGH DENSITY GRID) ── */}
      <form onSubmit={handleStartSubmit} style={{
        display: "grid",
        gridTemplateColumns: "440px 1fr",
        gap: "18px",
        flex: 1,
        overflow: "hidden",
        marginTop: "14px"
      }}>
        {/* LEFT COLUMN: DOCUMENT INGESTION & TACTICAL RADAR */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          background: "rgba(255, 255, 255, 0.025)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "14px",
          padding: "16px",
          overflowY: "auto"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10.5px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              1. Document / RFP Ingestion
            </span>
            {isAutoConfigured && (
              <span style={{ fontSize: "10px", fontWeight: "800", color: "#4ade80", background: "rgba(74,222,128,0.12)", padding: "2px 8px", borderRadius: "10px", border: "1px solid rgba(74,222,128,0.25)" }}>
                ✓ AI CALIBRATED
              </span>
            )}
          </div>

          {/* Ingestion Tabs */}
          <div style={{ display: "flex", gap: "6px", background: "rgba(255,255,255,0.03)", padding: "3px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              type="button"
              onClick={() => setActiveTab("text")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "text" ? "#ffffff" : "transparent",
                color: activeTab === "text" ? "#000000" : "#94a3b8",
                fontWeight: 700,
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px"
              }}
            >
              <DocIcon size={12} /> Paste SOW / Job
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "upload" ? "#ffffff" : "transparent",
                color: activeTab === "upload" ? "#000000" : "#94a3b8",
                fontWeight: 700,
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px"
              }}
            >
              <UploadIcon size={12} /> Drop PDF
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("url")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "url" ? "#ffffff" : "transparent",
                color: activeTab === "url" ? "#000000" : "#94a3b8",
                fontWeight: 700,
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px"
              }}
            >
              <GlobeIcon size={12} /> URL
            </button>
          </div>

          {/* Ingestion Content */}
          {activeTab === "text" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
              <textarea
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
                placeholder="Paste RFP contract terms, Upwork job posting, or Master Services Agreement..."
                style={{
                  width: "100%",
                  minHeight: "220px",
                  maxHeight: "320px",
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#f8fafc",
                  fontSize: "12.5px",
                  lineHeight: 1.5,
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit"
                }}
              />
              <button
                type="button"
                onClick={handleTextSubmit}
                disabled={isAnalyzing || !rawTextInput.trim()}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  background: "#ffffff",
                  color: "#000",
                  fontWeight: 800,
                  fontSize: "12px",
                  border: "none",
                  cursor: isAnalyzing ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(255,255,255,0.15)"
                }}
              >
                {isAnalyzing ? "🧠 Analyzing Contract Terms..." : "Analyze Scope & Calibrate Agents ➔"}
              </button>
            </div>
          )}

          {activeTab === "upload" && (
            <label style={{
              border: "1px dashed rgba(255, 255, 255, 0.22)",
              borderRadius: "10px",
              minHeight: "180px",
              padding: "30px 18px",
              textAlign: "center",
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.02)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              flex: 1
            }}>
              <UploadIcon size={24} />
              <span style={{ fontSize: "12.5px", color: "#f1f5f9", fontWeight: "600" }}>
                {uploadedFile ? uploadedFile.name : "Drop SOW / RFP PDF or Contract"}
              </span>
              <span style={{ fontSize: "10.5px", color: "#64748b" }}>Supports PDF, TXT, MD, DOCX</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.docx,image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                style={{ display: "none" }}
              />
            </label>
          )}

          {activeTab === "url" && (
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste Upwork / RFP URL..."
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: "12px",
                  outline: "none"
                }}
              />
              <button
                type="button"
                onClick={handleUrlSubmit}
                disabled={isAnalyzing || !urlInput.trim()}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "#ffffff",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "11.5px",
                  border: "none",
                  cursor: isAnalyzing ? "not-allowed" : "pointer"
                }}
              >
                {isAnalyzing ? "..." : "Extract"}
              </button>
            </div>
          )}

          {/* Feedback Badges */}
          {errorMessage && (
            <div style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: "11px" }}>
              ⚠ {errorMessage}
            </div>
          )}
          {successMessage && (
            <div style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac", fontSize: "11px", fontWeight: 600 }}>
              {successMessage}
            </div>
          )}

          {/* Extracted Tactical Leverage Radar */}
          {analysisInsights && (
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "11px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "#38bdf8" }}>Extracted Scope Breakdown</span>
                <span style={{ color: "#fbbf24", background: "rgba(251,191,36,0.1)", padding: "1px 6px", borderRadius: "4px" }}>
                  Urgency: {analysisInsights.urgency_level}
                </span>
              </div>
              <div>
                <span style={{ color: "#4ade80", fontWeight: 700 }}>✓ Key Leverage:</span>
                <ul style={{ margin: "2px 0 0 0", paddingLeft: "14px", color: "#cbd5e1", lineHeight: 1.3 }}>
                  {analysisInsights.leverage_points.slice(0, 2).map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
              <div>
                <span style={{ color: "#f87171", fontWeight: 700 }}>⚠ Execution Risks:</span>
                <ul style={{ margin: "2px 0 0 0", paddingLeft: "14px", color: "#cbd5e1", lineHeight: 1.3 }}>
                  {analysisInsights.scope_risks.slice(0, 2).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: NEGOTIATION SCOPE & DUAL AGENT COCKPIT */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          background: "rgba(255, 255, 255, 0.025)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "14px",
          padding: "16px",
          overflowY: "auto"
        }}>
          {/* Topic & Global Parameters */}
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <ModernInput
                label="Commercial Topic / Contract Scope"
                value={subject}
                onChange={setSubject}
                placeholder="e.g. Enterprise Cloud & AI Security Platform Retainer"
              />
            </div>
            <div style={{ width: "110px" }}>
              <ModernInput
                label="Rounds"
                value={maxTurns}
                onChange={(v) => setMaxTurns(Number(v))}
                type="number"
                placeholder="8"
              />
            </div>
          </div>

          {/* Dual Agent Side-by-Side Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", flex: 1 }}>
            {/* Agent A Card */}
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(192, 132, 252, 0.25)",
              borderRadius: "12px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(192,132,252,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AgentALogo size={16} />
                </div>
                <div>
                  <span style={{ fontSize: "12.5px", fontWeight: 800, color: "#ffffff" }}>Agent A (Vendor)</span>
                  <p style={{ fontSize: "10px", color: "#64748b", margin: 0 }}>Voice: Jenny Neural</p>
                </div>
              </div>

              <ModernInput label="Role Title" value={aRole} onChange={setARole} placeholder="e.g. Cloud Security Lead" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <ModernInput label={`Asking Rate (${currency})`} value={aIdeal} onChange={(v) => setAIdeal(v === "" ? "" : Number(v))} type="number" placeholder="45000" />
                <ModernInput label={`Floor Limit (${currency})`} value={aMin} onChange={(v) => setAMin(v === "" ? "" : Number(v))} type="number" placeholder="35000" />
              </div>
              <ModernInput label="Key Priorities" value={aPriorities} onChange={setAPriorities} placeholder="25% upfront escrow, SLA penalty cap" />
            </div>

            {/* Agent B Card */}
            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "12px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AgentBLogo size={16} />
                </div>
                <div>
                  <span style={{ fontSize: "12.5px", fontWeight: 800, color: "#ffffff" }}>Agent B (Buyer)</span>
                  <p style={{ fontSize: "10px", color: "#64748b", margin: 0 }}>Voice: Christopher Neural</p>
                </div>
              </div>

              <ModernInput label="Role Title" value={bRole} onChange={setBRole} placeholder="e.g. VP Procurement" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <ModernInput label={`Target Bid (${currency})`} value={bIdeal} onChange={(v) => setBIdeal(v === "" ? "" : Number(v))} type="number" placeholder="28000" />
                <ModernInput label={`Ceiling Limit (${currency})`} value={bMin} onChange={(v) => setBMin(v === "" ? "" : Number(v))} type="number" placeholder="35000" />
              </div>
              <ModernInput label="Key Priorities" value={bPriorities} onChange={setBPriorities} placeholder="24/7 SLA guarantee, milestone sign-offs" />
            </div>
          </div>

          {/* Launch Arena Button */}
          <button
            type="submit"
            disabled={isLaunching}
            style={{
              marginTop: "4px",
              padding: "12px 24px",
              borderRadius: "10px",
              background: isLaunching ? "#38bdf8" : "#ffffff",
              color: "#000000",
              border: "none",
              fontWeight: "900",
              fontSize: "13.5px",
              cursor: isLaunching ? "wait" : "pointer",
              boxShadow: "0 4px 20px rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.15s ease"
            }}
          >
            <PlayIcon size={14} /> {isLaunching ? "Launching Live Arena..." : "Launch Autonomous Negotiation Arena ➔"}
          </button>
        </div>
      </form>

      {/* Modals */}
      <LlamaIndexModal isOpen={isLlamaModalOpen} onClose={() => setIsLlamaModalOpen(false)} />
      <NeonDatabaseModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// 2. LIVE NEGOTIATION ARENA (CONTAINED SINGLE-PAGE COCKPIT)
// ═════════════════════════════════════════════════════════════
function NegotiationArena({
  sessionId,
  setup,
  docName,
  onReset
}: {
  sessionId: string;
  setup: NegotiationSetup;
  docName?: string;
  onReset: () => void;
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

  useEffect(() => {
    autoRunningRef.current = isAutoRunning;
  }, [isAutoRunning]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, isThinking]);

  // Speech-to-Text Recognition
  const startVoiceInput = (target: "manualA" | "whisperA" | "whisperB") => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    if (target === "manualA") setIsRecordingA(true);
    if (target === "whisperA") setIsRecordingWhisperA(true);
    if (target === "whisperB") setIsRecordingWhisperB(true);

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      if (target === "manualA") setManualMsgA(transcript);
      else if (target === "whisperA") setWhisperA(transcript);
      else if (target === "whisperB") setWhisperB(transcript);
    };

    recognition.onerror = () => {
      setIsRecordingA(false);
      setIsRecordingWhisperA(false);
      setIsRecordingWhisperB(false);
    };
    recognition.onend = () => {
      setIsRecordingA(false);
      setIsRecordingWhisperA(false);
      setIsRecordingWhisperB(false);
    };

    recognition.start();
  };

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/sessions/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "turn_thinking") {
          setIsThinking(data.agent);
          setSpeakingAgent(null);
        } else if (data.type === "turn_ready") {
          setIsThinking(null);
          setSpeakingAgent(data.turn.agent);

          const turnRecord: TurnWithAudio = {
            ...data.turn,
            audioBase64: data.audio_base64,
            acoustics: data.acoustics,
          };

          setTurns((prev) => {
            if (prev.some((t) => t.turn_number === data.turn.turn_number)) return prev;
            return [...prev, turnRecord];
          });

          if (data.turn.agent === "A") {
            if (data.acoustics) setLatestAcousticsA(data.acoustics);
          }
          if (data.turn.agent === "B") {
            if (data.acoustics) setLatestAcousticsB(data.acoustics);
          }

          if (data.audio_base64) {
            await playBase64Audio(data.audio_base64);
          }
          setSpeakingAgent(null);

          if (data.is_complete) {
            setIsComplete(true);
            setIsAutoRunning(false);
            setDealReached(data.deal_reached);
            setFinalAmount(data.final_amount);
            setDealQuality(data.deal_quality_score);
          } else if (autoRunningRef.current) {
            setTimeout(() => {
              if (autoRunningRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ action: "step" }));
              }
            }, 350);
          }
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  const handleStartAuto = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsAutoRunning(true);
      autoRunningRef.current = true;
      wsRef.current.send(JSON.stringify({ action: "step" }));
    }
  };

  const handlePause = () => {
    setIsAutoRunning(false);
    autoRunningRef.current = false;
  };

  const handleStepTurn = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "step" }));
    }
  };

  const handleSendManualTurn = (agent: "A" | "B") => {
    if (!manualMsgA.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: "manual_turn",
        agent,
        message: manualMsgA.trim(),
      }));
      setManualMsgA("");
    }
  };

  const handleSendWhisper = (agent: "A" | "B") => {
    const text = agent === "A" ? whisperA : whisperB;
    if (!text.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "whisper", agent, instruction: text.trim() }));
      if (agent === "A") setWhisperA(""); else setWhisperB("");
    }
  };

  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      padding: "12px 20px",
      background: "radial-gradient(circle at 50% 0%, #111115 0%, #050507 60%, #000000 100%)",
      color: "#f8fafc"
    }}>
      {/* ── TOP HEADER (COMPACT & CONTAINED) ── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: "10px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        flexShrink: 0,
        height: "46px",
        boxSizing: "border-box"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flexShrink: 1 }}>
          <DealRoomLogo size={24} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <span
              title={cleanTitle(setup.subject)}
              style={{
                fontSize: "13.5px",
                fontWeight: "800",
                color: "#ffffff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "280px"
              }}
            >
              {cleanTitle(setup.subject)}
            </span>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
              #{sessionId.substring(0, 8)}
            </span>
            {docName && (
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.1)", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(74,222,128,0.2)", display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                <DocIcon size={10} /> {docName}
              </span>
            )}
          </div>
        </div>

        {/* Centered Voice Visualizer */}
        <div style={{ flex: 1, maxWidth: "360px", margin: "0 16px" }}>
          <AudioVisualizer
            isSpeaking={speakingAgent !== null}
            color={speakingAgent === "A" ? "#c084fc" : speakingAgent === "B" ? "#38bdf8" : "#ffffff"}
            label={
              speakingAgent === "A"
                ? `${setup.agent_a_config.role_name} speaking`
                : speakingAgent === "B"
                ? `${setup.agent_b_config.role_name} speaking`
                : "Neural Voice Active"
            }
          />
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setIsLlamaModalOpen(true)}
            style={{ padding: "5px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
          >
            <DocIcon size={12} /> LlamaIndex
          </button>
          <button
            onClick={() => setIsDbModalOpen(true)}
            style={{ padding: "5px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
          >
            <NeonLogo size={12} /> Neon DB
          </button>
          {isComplete && (
            <button
              onClick={() => setShowContract(true)}
              style={{ padding: "5px 12px", borderRadius: "6px", background: "#ffffff", color: "#000000", border: "none", fontSize: "11px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", boxShadow: "0 2px 10px rgba(255,255,255,0.2)" }}
            >
              <ContractIcon size={12} /> SOW Agreement
            </button>
          )}
          <button
            onClick={onReset}
            style={{ padding: "5px 10px", borderRadius: "6px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
          >
            Exit Arena
          </button>
        </div>
      </div>

      {/* ── 3-COLUMN INTEGRATED ARENA (CONTAINED HEIGHT) ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "310px 1fr 310px",
        gap: "14px",
        flex: 1,
        overflow: "hidden",
        marginTop: "12px"
      }}>
        {/* ── LEFT PANEL: AGENT A (VENDOR) ── */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          background: "rgba(255, 255, 255, 0.02)",
          border: `1px solid ${speakingAgent === "A" ? "#c084fc" : "rgba(255, 255, 255, 0.08)"}`,
          borderRadius: "14px",
          padding: "14px",
          overflowY: "auto"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: speakingAgent === "A" ? "rgba(192,132,252,0.2)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${speakingAgent === "A" ? "#c084fc" : "rgba(255,255,255,0.15)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: speakingAgent === "A" ? "pulse 1.5s infinite" : "none"
            }}>
              <AgentALogo size={20} />
            </div>
            <div>
              <span style={{ fontSize: "13px", fontWeight: "800", color: "#ffffff" }}>
                {setup.agent_a_config.role_name}
              </span>
              <p style={{ fontSize: "10.5px", color: "#94a3b8", margin: 0 }}>Agent A · Vendor Side</p>
            </div>
          </div>

          {/* Pricing Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", fontSize: "11px" }}>
            <div>
              <span style={{ color: "#94a3b8" }}>Target Ask:</span>
              <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "12.5px" }}>{currency}{setup.agent_a_config.ideal_price.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Walk Floor:</span>
              <div style={{ fontWeight: 800, color: "#f87171", fontSize: "12.5px" }}>{currency}{setup.agent_a_config.min_price.toLocaleString()}</div>
            </div>
          </div>

          {/* Acoustic Telemetry Card */}
          <AcousticTelemetryCard
            acoustics={latestAcousticsA}
            agent="A"
            roleName={setup.agent_a_config.role_name}
            isSpeaking={speakingAgent === "A"}
          />

          {/* Secret Whisper Box */}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <WhisperIcon size={12} />
              <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                Secret Whisper to Agent A
              </span>
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <input
                type="text"
                value={whisperA}
                onChange={(e) => setWhisperA(e.target.value)}
                placeholder="Whisper: 'Push for $38k'..."
                style={{ flex: 1, padding: "6px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "11.5px", outline: "none" }}
              />
              <button
                type="button"
                onClick={() => startVoiceInput("whisperA")}
                style={{ padding: "6px 8px", borderRadius: "6px", background: isRecordingWhisperA ? "#ef4444" : "rgba(255,255,255,0.08)", border: "none", color: "#fff", cursor: "pointer" }}
              >
                <MicIcon size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleSendWhisper("A")}
                style={{ padding: "6px 10px", borderRadius: "6px", background: "#ffffff", color: "#000", fontWeight: 800, border: "none", fontSize: "11px", cursor: "pointer" }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* ── CENTER PANEL: CONTROLS, RADAR, FLIGHT COCKPIT & TRANSCRIPT ── */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "14px",
          padding: "14px",
          overflow: "hidden"
        }}>
          {/* Top Center Controls & Mode Switcher */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            {/* Mode Switcher */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.04)", padding: "3px 6px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                type="button"
                onClick={() => setIsFlightMode(false)}
                style={{
                  background: !isFlightMode ? "#ffffff" : "transparent",
                  color: !isFlightMode ? "#000000" : "#94a3b8",
                  border: "none", borderRadius: "5px", padding: "4px 10px", fontSize: "11px", fontWeight: 800, cursor: "pointer"
                }}
              >
                🤖 Autonomous AI
              </button>
              <button
                type="button"
                onClick={() => setIsFlightMode(true)}
                style={{
                  background: isFlightMode ? "#38bdf8" : "transparent",
                  color: isFlightMode ? "#000000" : "#94a3b8",
                  border: "none", borderRadius: "5px", padding: "4px 10px", fontSize: "11px", fontWeight: 800, cursor: "pointer"
                }}
              >
                🥊 Voice Flight Simulator
              </button>
            </div>

            {/* Playback Controls */}
            {!isComplete && (
              <div style={{ display: "flex", gap: "6px" }}>
                {!isAutoRunning ? (
                  <button
                    onClick={handleStartAuto}
                    style={{ padding: "6px 14px", borderRadius: "8px", background: "#ffffff", color: "#000000", border: "none", fontWeight: 800, fontSize: "11.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <PlayIcon size={12} /> Auto-Negotiate
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    style={{ padding: "6px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.12)", color: "#ffffff", border: "none", fontWeight: 800, fontSize: "11.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <PauseIcon size={12} /> Pause
                  </button>
                )}
                <button
                  onClick={handleStepTurn}
                  style={{ padding: "6px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#ffffff", fontWeight: 700, fontSize: "11.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <StepIcon size={12} /> Step
                </button>
              </div>
            )}
          </div>

          {/* Voice Flight Simulator Cockpit Banner */}
          {isFlightMode && !isComplete && (
            <div style={{
              background: "linear-gradient(135deg, rgba(56,189,248,0.1), rgba(7,7,9,0.95))",
              border: "1px solid rgba(56,189,248,0.35)",
              borderRadius: "10px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0
            }}>
              <button
                type="button"
                onClick={() => startVoiceInput("manualA")}
                style={{
                  background: isRecordingA ? "#ef4444" : "#ffffff",
                  color: isRecordingA ? "#ffffff" : "#000000",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontWeight: 800,
                  fontSize: "11.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: isRecordingA ? "0 0 16px rgba(239,68,68,0.5)" : "none"
                }}
              >
                <MicIcon size={13} />
                {isRecordingA ? "Listening..." : "Speak Offer"}
              </button>
              <input
                type="text"
                value={manualMsgA}
                onChange={(e) => setManualMsgA(e.target.value)}
                placeholder="Speak or type your pitch e.g. 'I can do $38,000 with 25% upfront escrow'..."
                style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(56,189,248,0.3)", color: "#ffffff", fontSize: "12px", outline: "none" }}
              />
              <button
                type="button"
                onClick={() => handleSendManualTurn("A")}
                disabled={!manualMsgA.trim()}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: manualMsgA.trim() ? "#38bdf8" : "rgba(255,255,255,0.08)",
                  color: manualMsgA.trim() ? "#000000" : "#64748b",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "11.5px",
                  cursor: manualMsgA.trim() ? "pointer" : "not-allowed"
                }}
              >
                Send ➔
              </button>
            </div>
          )}

          {/* Compact Pareto Frontier Radar */}
          <div style={{ flexShrink: 0 }}>
            <DealRadar setup={setup} turns={turns} currency={currency} />
          </div>

          {/* Live Transcript Stream (Scrolls smoothly inside container) */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: "6px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            {turns.length === 0 && !isThinking && (
              <div style={{ textAlign: "center", color: "#64748b", margin: "auto", padding: "20px 0" }}>
                <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 4px 0" }}>Click "Auto-Negotiate" to launch voice debate</p>
                <span style={{ fontSize: "11px" }}>Both agents will vocalize turns with game-theoretic conviction</span>
              </div>
            )}

            {turns.map((turn) => {
              const isA = turn.agent === "A";
              return (
                <div
                  key={turn.turn_number}
                  style={{
                    display: "flex",
                    flexDirection: isA ? "row" : "row-reverse",
                    gap: "8px",
                    alignItems: "flex-start"
                  }}
                >
                  <div style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    flexShrink: 0,
                    background: isA ? "rgba(192,132,252,0.15)" : "rgba(56,189,248,0.15)",
                    border: `1px solid ${isA ? "#c084fc" : "#38bdf8"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    {isA ? <AgentALogo size={14} /> : <AgentBLogo size={14} />}
                  </div>

                  <div style={{
                    maxWidth: "82%",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: isA ? "rgba(192,132,252,0.06)" : "rgba(56,189,248,0.06)",
                    border: `1px solid ${isA ? "rgba(192,132,252,0.18)" : "rgba(56,189,248,0.18)"}`,
                    fontSize: "12px",
                    color: "#f1f5f9"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: isA ? "#c084fc" : "#38bdf8" }}>
                        {isA ? setup.agent_a_config.role_name : setup.agent_b_config.role_name} · Round {turn.turn_number}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {turn.offer_amount && (
                          <span style={{ fontSize: "11px", fontWeight: 800, color: "#ffffff", background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: "4px" }}>
                            {currency}{turn.offer_amount.toLocaleString()}
                          </span>
                        )}
                        {turn.acoustics && turn.acoustics.bluff_probability >= 50 && (
                          <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#fca5a5", background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)", padding: "1px 5px", borderRadius: "4px" }}>
                            🚨 BLUFF {turn.acoustics.bluff_probability}%
                          </span>
                        )}
                        {turn.acoustics && turn.acoustics.conviction_score >= 88 && turn.acoustics.bluff_probability < 50 && (
                          <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#7dd3fc", background: "rgba(56,189,248,0.18)", border: "1px solid rgba(56,189,248,0.35)", padding: "1px 5px", borderRadius: "4px" }}>
                            🔥 ALPHA {turn.acoustics.conviction_score}%
                          </span>
                        )}
                        {turn.audioBase64 && (
                          <button
                            onClick={() => playBase64Audio(turn.audioBase64!)}
                            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "0 2px" }}
                          >
                            <SpeakerIcon size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.4 }}>{turn.message}</p>
                    {turn.reasoning && (
                      <p style={{ margin: "4px 0 0 0", fontSize: "10.5px", color: "#94a3b8", fontStyle: "italic" }}>
                        {turn.reasoning}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "11.5px", padding: "4px 0" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8", animation: "pulse 1s infinite" }} />
                {isThinking === "A" ? setup.agent_a_config.role_name : setup.agent_b_config.role_name} is computing Pareto counter...
              </div>
            )}

            {/* Outcome Card */}
            {isComplete && (
              <div style={{
                textAlign: "center",
                padding: "14px",
                borderRadius: "10px",
                background: dealReached ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${dealReached ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                marginTop: "6px"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "14px", fontWeight: 800, color: dealReached ? "#4ade80" : "#f87171" }}>
                  {dealReached ? <HandshakeIcon size={16} /> : <WalkawayIcon size={16} />}
                  {dealReached ? "DEAL AGREED & LOCKED" : "NEGOTIATION IMPASSE (WALK-AWAY)"}
                </div>
                {finalAmount && (
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#ffffff", margin: "4px 0" }}>
                    {currency}{finalAmount.toLocaleString()}
                  </div>
                )}
                {dealQuality !== null && (
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "8px" }}>
                    Pareto Optimality Score: <strong style={{ color: "#ffffff" }}>{dealQuality}%</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                  <button
                    onClick={() => setShowContract(true)}
                    style={{ padding: "6px 14px", borderRadius: "6px", background: "#ffffff", color: "#000", fontWeight: 800, fontSize: "11.5px", border: "none", cursor: "pointer" }}
                  >
                    Generate SOW Agreement ➔
                  </button>
                  <button
                    onClick={onReset}
                    style={{ padding: "6px 14px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: "11.5px", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}
                  >
                    New Negotiation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: AGENT B (BUYER) ── */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          background: "rgba(255, 255, 255, 0.02)",
          border: `1px solid ${speakingAgent === "B" ? "#38bdf8" : "rgba(255, 255, 255, 0.08)"}`,
          borderRadius: "14px",
          padding: "14px",
          overflowY: "auto"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: speakingAgent === "B" ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${speakingAgent === "B" ? "#38bdf8" : "rgba(255,255,255,0.15)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: speakingAgent === "B" ? "pulse 1.5s infinite" : "none"
            }}>
              <AgentBLogo size={20} />
            </div>
            <div>
              <span style={{ fontSize: "13px", fontWeight: "800", color: "#ffffff" }}>
                {setup.agent_b_config.role_name}
              </span>
              <p style={{ fontSize: "10.5px", color: "#94a3b8", margin: 0 }}>Agent B · Buyer Side</p>
            </div>
          </div>

          {/* Pricing Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", fontSize: "11px" }}>
            <div>
              <span style={{ color: "#94a3b8" }}>Target Bid:</span>
              <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "12.5px" }}>{currency}{setup.agent_b_config.ideal_price.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Ceiling:</span>
              <div style={{ fontWeight: 800, color: "#fbbf24", fontSize: "12.5px" }}>{currency}{setup.agent_b_config.min_price.toLocaleString()}</div>
            </div>
          </div>

          {/* Acoustic Telemetry Card */}
          <AcousticTelemetryCard
            acoustics={latestAcousticsB}
            agent="B"
            roleName={setup.agent_b_config.role_name}
            isSpeaking={speakingAgent === "B"}
          />

          {/* Secret Whisper Box */}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <WhisperIcon size={12} />
              <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                Secret Whisper to Agent B
              </span>
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              <input
                type="text"
                value={whisperB}
                onChange={(e) => setWhisperB(e.target.value)}
                placeholder="Whisper: 'Cap at $32k'..."
                style={{ flex: 1, padding: "6px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "11.5px", outline: "none" }}
              />
              <button
                type="button"
                onClick={() => startVoiceInput("whisperB")}
                style={{ padding: "6px 8px", borderRadius: "6px", background: isRecordingWhisperB ? "#ef4444" : "rgba(255,255,255,0.08)", border: "none", color: "#fff", cursor: "pointer" }}
              >
                <MicIcon size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleSendWhisper("B")}
                style={{ padding: "6px 10px", borderRadius: "6px", background: "#ffffff", color: "#000", fontWeight: 800, border: "none", fontSize: "11px", cursor: "pointer" }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showContract && (
        <ContractModal
          sessionId={sessionId}
          setup={setup}
          finalAmount={finalAmount || setup.agent_a_config.min_price}
          dealReached={dealReached}
          dealQuality={dealQuality}
          turnsCount={turns.length}
          onClose={() => setShowContract(false)}
        />
      )}
      <LlamaIndexModal isOpen={isLlamaModalOpen} onClose={() => setIsLlamaModalOpen(false)} />
      <NeonDatabaseModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// 3. MAIN APP ROUTER
// ═════════════════════════════════════════════════════════════
export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [setup, setSetup] = useState<NegotiationSetup | null>(null);
  const [attachedDocName, setAttachedDocName] = useState<string | undefined>(undefined);

  const handleStart = async (s: NegotiationSetup, docName?: string) => {
    try {
      const state = await createSession(s);
      setSessionId(state.session_id);
      setSetup(s);
      setAttachedDocName(docName);
    } catch (err: any) {
      alert("Failed to initialize session: " + err.message);
    }
  };

  const handleReset = () => {
    setSessionId(null);
    setSetup(null);
    setAttachedDocName(undefined);
  };

  if (sessionId && setup) {
    return (
      <NegotiationArena
        sessionId={sessionId}
        setup={setup}
        docName={attachedDocName}
        onReset={handleReset}
      />
    );
  }

  return <SetupPanel onStart={handleStart} />;
}
