import React from 'react';

interface AudioVisualizerProps {
  isSpeaking: boolean;
  color?: string;
  label?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isSpeaking,
  label = 'Voice Channel Active'
}) => {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      height: '32px',
      minHeight: '32px',
      maxHeight: '32px',
      padding: '0 16px',
      background: isSpeaking ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderRadius: '30px',
      border: `1px solid ${isSpeaking ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
      boxShadow: isSpeaking ? '0 0 20px rgba(255, 255, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2)' : 'none',
      transition: 'border-color 0.2s, background-color 0.2s',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '14px', flexShrink: 0 }}>
        {[1, 2, 3, 4, 5].map((bar) => (
          <div
            key={bar}
            style={{
              width: '3px',
              height: isSpeaking ? `${Math.sin(bar * 1.5) * 6 + 10}px` : '3px',
              backgroundColor: isSpeaking ? '#ffffff' : '#64748b',
              borderRadius: '2px',
              animation: isSpeaking ? `soundWave 0.8s ease-in-out infinite alternate ${bar * 0.15}s` : 'none',
              transition: 'all 0.2s ease'
            }}
          />
        ))}
      </div>
      <span style={{
        fontSize: '11.5px',
        fontWeight: '600',
        color: isSpeaking ? '#ffffff' : '#94a3b8',
        letterSpacing: '0.3px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '220px'
      }}>
        {label}
      </span>
      <style>{`
        @keyframes soundWave {
          0% { height: 3px; }
          50% { height: 14px; }
          100% { height: 5px; }
        }
      `}</style>
    </div>
  );
};
