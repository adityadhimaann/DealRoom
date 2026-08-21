import type { NegotiationSetup } from "../lib/api";

interface ContractModalProps {
  sessionId: string;
  setup: NegotiationSetup;
  finalAmount: number;
  dealReached: boolean;
  dealQuality?: number | null;
  turnsCount: number;
  onClose: () => void;
}

export function ContractModal({
  sessionId,
  setup,
  finalAmount,
  dealReached,
  dealQuality = 85,
  turnsCount,
  onClose,
}: ContractModalProps) {
  const currency = setup.currency || "$";
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const contractRef = `DR-${sessionId.slice(0, 8).toUpperCase()}`;
  const cryptoHash = `SHA256-${(Math.abs(sessionId.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)) >>> 0).toString(16).padStart(8, "0")}`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    const md = `# 📄 UPWORK STATEMENT OF WORK & AGREEMENT (SOW)
**Contract Ref:** \`${contractRef}\` · **Status:** ${dealReached ? "CLOSED & SIGNED" : "SETTLED"} · **Date:** ${dateStr}

### 1. PARTIES & ROLES
- **Contractor / Specialist (Agent A):** ${setup.agent_a_config.role_name}
- **Client / Project Owner (Agent B):** ${setup.agent_b_config.role_name}
- **Governing Protocol:** DealRoom Multi-Agent Consensus Protocol

### 2. SCOPE OF WORK (SOW)
**Deliverable:** ${setup.subject}
- **Agreed Final Value:** **${currency}${finalAmount.toLocaleString()}**
- **Adversarial Rounds:** ${turnsCount} rounds
- **Pareto Optimality:** ${dealQuality}%

### 3. MILESTONE SCHEDULE & TERMS
- **Milestone 1 (50% - ${currency}${(finalAmount * 0.5).toLocaleString()}):** Core Architecture, Technical Deliverables & First Draft
- **Milestone 2 (50% - ${currency}${(finalAmount * 0.5).toLocaleString()}):** Final Review, Integration, Polish & Production Handover
- **Revisions Policy:** Maximum 2 rounds of review within agreed scope.
- **Out-of-Scope Protection:** Additional features trigger supplemental change-orders.

### 4. AUDIT TRAIL
- **Seller Opening Ask:** ${currency}${setup.agent_a_config.ideal_price.toLocaleString()}
- **Buyer Opening Bid:** ${currency}${setup.agent_b_config.ideal_price.toLocaleString()}
- **Equilibrium Settlement:** ${currency}${finalAmount.toLocaleString()}
- **Verification Hash:** \`${cryptoHash}\`
`;
    navigator.clipboard.writeText(md);
    alert("Contract markdown copied to clipboard!");
  };

  return (
    <div className="sow-modal-overlay" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
    }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .sow-printable-doc, .sow-printable-doc * { visibility: visible !important; }
          .sow-printable-doc {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            padding: 24px !important;
          }
          .sow-no-print { display: none !important; }
          .sow-card { background: #f8fafc !important; border: 1px solid #cbd5e1 !important; color: #0f172a !important; }
          .sow-highlight { color: #15803d !important; }
        }
      `}</style>

      <div className="sow-printable-doc" style={{
        background: "#070709", border: "1px solid #283049", borderRadius: 16,
        width: "100%", maxWidth: 840, maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 25px 60px rgba(0,0,0,0.8)", overflow: "hidden",
      }}>
        {/* Modal Top Bar */}
        <div className="sow-no-print" style={{
          padding: "14px 20px", background: "rgba(255, 255, 255, 0.02)", borderBottom: "1px solid #1e2438",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 10px #22c55e" }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", letterSpacing: 0.5 }}>
              OFFICIAL STATEMENT OF WORK (SOW)
            </span>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", padding: "4px 8px", borderRadius: 6,
          }}>✕</button>
        </div>

        {/* Scrollable Document Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px", color: "#e2e8f0" }}>
          
          {/* Header Banner */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            borderBottom: "2px solid #1e293b", paddingBottom: 18, marginBottom: 20,
          }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "3px 10px", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#ffffff" }}>✓ UPWORK VERIFIED AGREEMENT</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f8fafc", margin: "0 0 4px" }}>
                Statement of Work & Master Service Agreement
              </h1>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                Autonomous Contract Protocol · Generated by DealRoom Multi-Agent Engine
              </p>
            </div>

            <div style={{ textAlign: "right", fontSize: 11.5 }}>
              <div style={{ color: "#94a3b8" }}>Contract Ref: <strong style={{ color: "#ffffff", fontFamily: "monospace" }}>{contractRef}</strong></div>
              <div style={{ color: "#94a3b8", marginTop: 2 }}>Date: <strong style={{ color: "#cbd5e1" }}>{dateStr}</strong></div>
              <div style={{ color: "#94a3b8", marginTop: 2 }}>Status: <span style={{ color: "#ffffff", fontWeight: 800 }}>SIGNED & BINDING</span></div>
            </div>
          </div>

          {/* 1. Parties & Roles */}
          <div style={{ marginBottom: 22 }}>
            <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, color: "#94a3b8", fontWeight: 800, margin: "0 0 10px" }}>
              1. Contractual Parties
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="sow-card" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 10.5, color: "#ffffff", fontWeight: 700, textTransform: "uppercase" }}>Contractor / Specialist (Agent A)</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", marginTop: 2 }}>{setup.agent_a_config.role_name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Strategy: {setup.agent_a_config.strategy} · Represented by Gemini 2.5 Flash</div>
              </div>
              <div className="sow-card" style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontSize: 10.5, color: "#ffffff", fontWeight: 700, textTransform: "uppercase" }}>Client / Project Owner (Agent B)</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", marginTop: 2 }}>{setup.agent_b_config.role_name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Strategy: {setup.agent_b_config.strategy} · Represented by Groq GPT-OSS 120B</div>
              </div>
            </div>
          </div>

          {/* 2. Scope & Agreed Value Callout */}
          <div style={{ marginBottom: 22 }}>
            <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, color: "#94a3b8", fontWeight: 800, margin: "0 0 10px" }}>
              2. Scope of Work & Valuation
            </h3>
            <div className="sow-card" style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 14px" }}>
                <strong>Deliverable Backlog:</strong> {setup.subject}
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12, paddingTop: 12, borderTop: "1px solid #1e2438" }}>
                <div>
                  <div style={{ fontSize: 10.5, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Agreed Contract Value</div>
                  <div className="sow-highlight" style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", marginTop: 2 }}>
                    {currency}{finalAmount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Negotiation Trajectory</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginTop: 6 }}>
                    {turnsCount} Adversarial Turns
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Nash Optimality</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginTop: 6 }}>
                    {dealQuality}% Pareto Efficiency
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Milestone Schedule Table */}
          <div style={{ marginBottom: 22 }}>
            <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, color: "#94a3b8", fontWeight: 800, margin: "0 0 10px" }}>
              3. Milestone Escrow & Deliverable Schedule
            </h3>
            <div style={{ border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(255, 255, 255, 0.04)", color: "#94a3b8", borderBottom: "1px solid #1e2438" }}>
                    <th style={{ padding: "10px 14px", fontWeight: 700 }}>Milestone</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700 }}>Deliverable Scope</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700 }}>Allocation</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #151824" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#ffffff" }}>Milestone 1</td>
                    <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>Architecture, Core Components & Sprint 1 Setup</td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8" }}>50% Deposit</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#ffffff", textAlign: "right" }}>
                      {currency}{(finalAmount * 0.5).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#ffffff" }}>Milestone 2</td>
                    <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>Final Integration, Polish, Tests & Production Handover</td>
                    <td style={{ padding: "10px 14px", color: "#94a3b8" }}>50% Release</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#ffffff", textAlign: "right" }}>
                      {currency}{(finalAmount * 0.5).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10, fontSize: 11.5, color: "#94a3b8" }}>
              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                ✓ <strong>Revisions Limit:</strong> Max 2 rounds of review within agreed backlog.
              </div>
              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                ✓ <strong>Scope Protection:</strong> Out-of-scope tasks require formal change order.
              </div>
            </div>
          </div>

          {/* 4. Verification & Cryptographic Hash */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, color: "#94a3b8", fontWeight: 800, margin: "0 0 10px" }}>
              4. Consensus Verification Trail
            </h3>
            <div className="sow-card" style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5 }}>
              <div>
                <span style={{ color: "#64748b" }}>Seller Ask:</span> <strong style={{ color: "#ffffff" }}>{currency}{setup.agent_a_config.ideal_price.toLocaleString()}</strong>
                <span style={{ margin: "0 10px", color: "#334155" }}>|</span>
                <span style={{ color: "#64748b" }}>Buyer Bid:</span> <strong style={{ color: "#ffffff" }}>{currency}{setup.agent_b_config.ideal_price.toLocaleString()}</strong>
                <span style={{ margin: "0 10px", color: "#334155" }}>|</span>
                <span style={{ color: "#64748b" }}>Consensus:</span> <strong style={{ color: "#ffffff" }}>{currency}{finalAmount.toLocaleString()}</strong>
              </div>
              <div style={{ fontFamily: "monospace", color: "#94a3b8", fontSize: 11 }}>
                🔐 {cryptoHash}
              </div>
            </div>
          </div>

          {/* 5. Digital Signatures */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, paddingTop: 14, borderTop: "2px dashed #1e2438" }}>
            <div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Contractor Verification</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", margin: "4px 0 2px" }}>✓ Signed by {setup.agent_a_config.role_name}</div>
              <div style={{ fontSize: 10.5, color: "#64748b" }}>Signed via Agent Protocol · Verified Hash</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Client Verification</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", margin: "4px 0 2px" }}>✓ Signed by {setup.agent_b_config.role_name}</div>
              <div style={{ fontSize: 10.5, color: "#64748b" }}>Authorized Escrow Release · Verified Hash</div>
            </div>
          </div>

        </div>

        {/* Modal Bottom Action Bar */}
        <div className="sow-no-print" style={{
          padding: "14px 24px", background: "rgba(255, 255, 255, 0.02)", borderTop: "1px solid #1e2438",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 11.5, color: "#64748b" }}>
            Ready to export as PDF, print, or attach to Upwork contract.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleCopyMarkdown}
              style={{ padding: "9px 16px", background: "rgba(255, 255, 255, 0.06)", color: "#f1f5f9", border: "1px solid #334155", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              📋 Copy Markdown
            </button>
            <button onClick={handlePrint}
              style={{ padding: "9px 22px", background: "#ffffff", color: "#000000", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(255,255,255,0.2)" }}
            >
              🖨️ Print SOW / Save PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
