import React from 'react';
import { MicIcon } from './Icons';

export interface AcousticData {
  conviction_score: number;
  bluff_probability: number;
  firmness_tier: string;
  pitch_hz: number;
  cadence_wpm: number;
  stress_index: string;
  acoustic_flags?: string[];
}

interface AcousticTelemetryCardProps {
  acoustics: AcousticData | null;
  agent: string;
  roleName: string;
  isSpeaking: boolean;
}

export const AcousticTelemetryCard: React.FC<AcousticTelemetryCardProps> = ({
  acoustics,
  agent,
  roleName,
  isSpeaking,
}) => {
  if (!acoustics) return null;

  const isBluff = acoustics.bluff_probability >= 50;
  const isAlpha = acoustics.conviction_score >= 88 && !isBluff;

  return (
    <div style={{
      background: 'rgba(7, 7, 9, 0.75)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: isBluff 
        ? '1px solid rgba(239, 68, 68, 0.45)' 
        : isAlpha 
        ? '1px solid rgba(56, 189, 248, 0.45)' 
        : '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '14px',
      padding: '14px 16px',
      boxShadow: isBluff 
        ? '0 8px 32px rgba(239, 68, 68, 0.15)' 
        : '0 8px 32px rgba(0, 0, 0, 0.6)',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      color: '#f8fafc',
      fontFamily: 'inherit',
      marginTop: '8px',
      boxSizing: 'border-box'
    }}>
      {/* Header - Fixed Height */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', height: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: isSpeaking ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            border: isSpeaking ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <MicIcon size={12} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.6px', color: '#94a3b8', textTransform: 'uppercase' }}>
              {roleName} ({agent})
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                color: isBluff ? '#f87171' : isAlpha ? '#38bdf8' : '#ffffff'
              }}>
                {acoustics.firmness_tier}
              </span>
              <span style={{ fontSize: '9px', color: '#64748b' }}>•</span>
              <span style={{ fontSize: '10.5px', color: '#cbd5e1' }}>Stress: {acoustics.stress_index}</span>
            </div>
          </div>
        </div>

        {/* Live Audio Status Badge (Fixed footprint to prevent height jump) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '12px',
          background: isSpeaking ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
          border: isSpeaking ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '9.5px',
          fontWeight: '700',
          color: isSpeaking ? '#38bdf8' : '#64748b',
          transition: 'all 0.2s ease'
        }}>
          <span style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: isSpeaking ? '#38bdf8' : '#64748b',
            animation: isSpeaking ? 'pulse 1s infinite' : 'none'
          }} />
          {isSpeaking ? 'ACTIVE' : 'IDLE'}
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        {/* Conviction Score */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '6px 4px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
            Conviction
          </div>
          <div style={{
            fontSize: '15px',
            fontWeight: '800',
            color: acoustics.conviction_score >= 80 ? '#4ade80' : acoustics.conviction_score >= 60 ? '#fbbf24' : '#f87171',
            marginTop: '1px'
          }}>
            {acoustics.conviction_score}%
          </div>
        </div>

        {/* Bluff Probability */}
        <div style={{
          background: isBluff ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)',
          border: isBluff ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '6px 4px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: isBluff ? '#fca5a5' : '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
            Bluff
          </div>
          <div style={{
            fontSize: '15px',
            fontWeight: '800',
            color: isBluff ? '#f87171' : '#cbd5e1',
            marginTop: '1px'
          }}>
            {acoustics.bluff_probability}%
          </div>
        </div>

        {/* Pitch Frequency */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '6px 4px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
            Pitch
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff', marginTop: '2px' }}>
            {acoustics.pitch_hz}<span style={{ fontSize: '9px', color: '#64748b' }}>Hz</span>
          </div>
        </div>

        {/* Speech Cadence */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '6px 4px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
            Cadence
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff', marginTop: '2px' }}>
            {acoustics.cadence_wpm}<span style={{ fontSize: '9px', color: '#64748b' }}>wpm</span>
          </div>
        </div>
      </div>

      {/* Psychological Trigger Flags */}
      {acoustics.acoustic_flags && acoustics.acoustic_flags.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {acoustics.acoustic_flags.map((flag, idx) => (
            <span key={idx} style={{
              fontSize: '9.5px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: flag.includes('Bluff') || flag.includes('hesitation')
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(56, 189, 248, 0.12)',
              color: flag.includes('Bluff') || flag.includes('hesitation')
                ? '#fca5a5'
                : '#7dd3fc',
              border: flag.includes('Bluff') || flag.includes('hesitation')
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : '1px solid rgba(56, 189, 248, 0.25)',
              fontWeight: '600'
            }}>
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
