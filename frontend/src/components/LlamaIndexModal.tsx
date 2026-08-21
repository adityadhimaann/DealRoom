import React, { useState, useEffect } from 'react';
import { DocIcon, CloseIcon } from './Icons';

interface LlamaIndexModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LlamaIndexModal: React.FC<LlamaIndexModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const executeQuery = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:10000/api/llamaindex/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), doc_id: 'active_contract' })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error('LlamaIndex Query Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch default overview when modal opens
  useEffect(() => {
    if (isOpen && !result) {
      executeQuery('What are the milestone deliverables, budget, and warranty terms?');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeQuery(query);
  };

  const sampleQueries = [
    "Milestone payment schedule",
    "Warranty period and SLA uptime",
    "Deliverable scope and tech stack",
    "Contract-to-hire opportunity"
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#070709',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.15), 0 30px 60px rgba(0,0,0,0.9)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '860px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f8fafc',
        fontFamily: 'inherit'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DocIcon size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>
                  LlamaIndex Clause & Citation Inspector
                </h2>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.18)'
                }}>
                  INDEX ACTIVE
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '3px 0 0 0' }}>
                Sentence-chunked semantic knowledge base indexing active RFP and contract terms.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Query Form */}
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about active contract clauses, milestones, or warranty..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              style={{
                padding: '12px 22px',
                borderRadius: '10px',
                background: '#ffffff',
                color: '#000000',
                border: 'none',
                fontWeight: '700',
                fontSize: '13px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(255,255,255,0.15)'
              }}
            >
              {loading ? 'Querying...' : 'Search Index'}
            </button>
          </form>

          {/* Quick Suggestions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', alignSelf: 'center' }}>
              Suggested Queries:
            </span>
            {sampleQueries.map((sq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setQuery(sq); executeQuery(sq); }}
                style={{
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  borderRadius: '16px',
                  padding: '4px 12px',
                  cursor: 'pointer'
                }}
              >
                {sq}
              </button>
            ))}
          </div>

          {/* Results Display */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              Querying LlamaIndex sentence nodes...
            </div>
          ) : result ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  {result.citations?.length || 0} RELEVANT CLAUSES CITED
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Knowledge Source: {result.doc_id || 'active_contract'}
                </span>
              </div>

              <p style={{ fontSize: '13.5px', color: '#f1f5f9', lineHeight: 1.6, margin: '0 0 16px 0', fontWeight: '500' }}>
                {result.response}
              </p>

              {result.citations && result.citations.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Cited LlamaIndex Nodes & Exact Text Excerpts:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {result.citations.map((c: any, idx: number) => (
                      <div key={idx} style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '14px',
                        fontSize: '12px',
                        color: '#cbd5e1'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10.5px', color: '#64748b' }}>
                          <span>Node ID: {c.node_id?.substring(0, 16)}...</span>
                          <span style={{ color: '#ffffff', fontWeight: '600' }}>Relevance: {c.score}</span>
                        </div>
                        <div style={{ fontStyle: 'italic', color: '#ffffff', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                          "{c.text}"
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
