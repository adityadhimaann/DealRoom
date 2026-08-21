import React, { useState, useEffect } from 'react';
import { NeonLogo } from "./Icons";

interface NeonDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession?: (sessionId: string) => void;
}

export const NeonDatabaseModal: React.FC<NeonDatabaseModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'history' | 'contracts'>('analytics');
  const [analytics, setAnalytics] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<any>(null);

  const fetchDatabaseData = async () => {
    setLoading(true);
    try {
      const [resAnalytics, resSessions, resContracts] = await Promise.all([
        fetch('http://localhost:10000/api/database/analytics').then(r => r.json()).catch(() => null),
        fetch('http://localhost:10000/api/database/sessions').then(r => r.json()).catch(() => []),
        fetch('http://localhost:10000/api/database/contracts').then(r => r.json()).catch(() => []),
      ]);

      if (resAnalytics) setAnalytics(resAnalytics);
      if (Array.isArray(resSessions)) setSessions(resSessions);
      if (Array.isArray(resContracts)) setContracts(resContracts);
    } catch (err) {
      console.error('Error fetching Neon database data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDatabaseData();
    }
  }, [isOpen]);

  const viewSessionDetails = async (sessionId: string) => {
    try {
      const res = await fetch(`http://localhost:10000/api/database/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSessionDetail(data);
      }
    } catch (e) {
      console.error('Failed to load session detail', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#070709',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.15), 0 30px 60px rgba(0,0,0,0.9)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '1050px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f8fafc',
        fontFamily: 'inherit'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '22px 28px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <NeonLogo size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '19px', fontWeight: '700', color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>
                  Neon Serverless PostgreSQL Database
                </h2>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
                  CONNECTED · AWS us-east-2
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Relational persistence for multi-turn dialogues, executed legal contracts, and SHA-256 audit ledger.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 28px',
          background: 'rgba(0, 0, 0, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <button
            onClick={() => { setActiveTab('analytics'); setSelectedSessionDetail(null); }}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeTab === 'analytics' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              color: activeTab === 'analytics' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'analytics' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            Live Metrics & KPIs
          </button>
          <button
            onClick={() => { setActiveTab('history'); setSelectedSessionDetail(null); }}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeTab === 'history' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              color: activeTab === 'history' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'history' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            Historical Negotiations ({sessions.length})
          </button>
          <button
            onClick={() => { setActiveTab('contracts'); setSelectedSessionDetail(null); }}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              background: activeTab === 'contracts' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              color: activeTab === 'contracts' ? '#ffffff' : '#94a3b8',
              border: activeTab === 'contracts' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            Signed Contracts & MSAs ({contracts.length})
          </button>
          <button
            onClick={fetchDatabaseData}
            style={{
              marginLeft: 'auto',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#cbd5e1',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            Refresh Database
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <p>Querying Neon PostgreSQL Cloud Cluster...</p>
            </div>
          ) : activeTab === 'analytics' ? (
            <div>
              {/* Top Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.5px' }}>TOTAL SETTLED VOLUME</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', marginTop: '6px' }}>
                    {analytics?.total_settled_volume || '$0.00'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Across executed deals</div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.5px' }}>SUCCESSFUL CLOSES</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', marginTop: '6px' }}>
                    {analytics?.successful_agreements || 0} / {analytics?.total_negotiations || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Win rate: {analytics?.success_rate || '0%'}</div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.5px' }}>AVG NASH OPTIMALITY</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', marginTop: '6px' }}>
                    {analytics?.average_nash_optimality || '0.0%'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Pareto efficiency frontier</div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '18px' }}>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.5px' }}>AUDIT CHAIN BLOCKS</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', marginTop: '6px' }}>
                    {analytics?.total_audit_blocks || 0} Blocks
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>SHA-256 tamper-proof ledger</div>
                </div>
              </div>

              {/* Infrastructure & Architecture Info */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Enterprise Compliance & Persistence Stack
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', color: '#cbd5e1' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: '#fff', marginBottom: '4px' }}>Serverless Postgres Persistence:</div>
                    <p style={{ margin: 0, color: '#94a3b8' }}>
                      Tables auto-provisioned with connection pooling, zero cold-starts, and instant point-in-time recovery for financial audits.
                    </p>
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#fff', marginBottom: '4px' }}>Cryptographic State Hashing:</div>
                    <p style={{ margin: 0, color: '#94a3b8' }}>
                      Every voice turn, counter-offer, and human whisper generates a SHA-256 block linked directly to the previous state.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'history' ? (
            <div>
              {selectedSessionDetail ? (
                <div>
                  <button
                    onClick={() => setSelectedSessionDetail(null)}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#ffffff',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      marginBottom: '16px'
                    }}
                  >
                    ← Back to All Sessions
                  </button>
                  <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 12px 0' }}>
                    Session #{selectedSessionDetail.session_id}: {selectedSessionDetail.subject}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedSessionDetail.turns?.map((t: any) => (
                      <div key={t.id} style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '14px 18px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '12px', color: '#ffffff' }}>
                            Round {t.turn_number} · Agent {t.agent}
                          </span>
                          <span style={{ fontWeight: '700', fontSize: '12px', color: '#ffffff' }}>
                            ${t.offer_amount?.toLocaleString()}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#e2e8f0' }}>{t.message}</p>
                        {t.reasoning && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                            {t.reasoning}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                  <p>No historical sessions recorded in Neon yet. Run a live negotiation to persist!</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Session ID</th>
                      <th style={{ padding: '10px' }}>Subject / Role Match</th>
                      <th style={{ padding: '10px' }}>Final Amount</th>
                      <th style={{ padding: '10px' }}>Nash Score</th>
                      <th style={{ padding: '10px' }}>Outcome</th>
                      <th style={{ padding: '10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.session_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 10px', fontFamily: 'monospace', color: '#ffffff' }}>
                          #{s.session_id?.substring(0, 8)}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#fff' }}>
                          <div style={{ fontWeight: '600' }}>{s.subject?.substring(0, 45)}...</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {s.agent_a_role} vs {s.agent_b_role}
                          </div>
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: '700', color: '#ffffff' }}>
                          {s.final_amount ? `${s.currency || '$'}${s.final_amount?.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#94a3b8' }}>
                          {s.deal_quality_score ? `${s.deal_quality_score}%` : '—'}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: s.deal_reached ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                            color: '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.2)'
                          }}>
                            {s.deal_reached ? 'AGREEMENT' : 'IN PROGRESS'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            onClick={() => viewSessionDetails(s.session_id)}
                            style={{
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#ffffff',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div>
              {contracts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                  <p>No legal contracts generated in Neon yet. Complete a deal to generate SOW/MSA!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {contracts.map((c) => (
                    <div key={c.contract_ref} style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>
                            {c.contract_ref}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.18)'
                          }}>
                            {c.contract_type}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>
                          SHA-256: {c.sha256_hash?.substring(0, 32)}...
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>
                          {c.currency || '$'}{c.final_amount?.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          STATUS: {c.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
