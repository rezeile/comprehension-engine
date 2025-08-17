import React, { useMemo } from 'react';

interface MicVisualizerProps {
  isActive: boolean;
  variant?: 'bars' | 'waveform';
  intensity?: number; // 0-1; optional, we animate if not provided
}

const MicVisualizer: React.FC<MicVisualizerProps> = ({ isActive, variant = 'bars', intensity }) => {
  const bars = useMemo(() => new Array(5).fill(0).map((_, i) => i), []);

  if (variant === 'bars') {
    return (
      <div className="mic-visualizer mic-visualizer--bars" aria-hidden>
        {bars.map((i) => {
          const style: React.CSSProperties = {};
          if (typeof intensity === 'number') {
            const base = 0.3 + intensity * 0.7;
            style.transform = `scaleY(${base})`;
          }
          // Staggered animation for motion when intensity is not provided
          style.animationDelay = `${i * 0.06}s`;
          return <span key={i} style={style} className={isActive ? 'active' : ''} />;
        })}
      </div>
    );
  }

  // Placeholder for future waveform variant
  return (
    <div className="mic-visualizer mic-visualizer--waveform" aria-hidden>
      <div className="mic-wave" />
    </div>
  );
};

export default MicVisualizer;


