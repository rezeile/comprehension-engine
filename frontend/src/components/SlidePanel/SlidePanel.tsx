import React from 'react';
import './SlidePanel.css';

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: number | string;
  id?: string;
  children: React.ReactNode;
}

const SlidePanel: React.FC<SlidePanelProps> = ({ isOpen, onClose, title, width = 400, id, children }) => {
  const panelStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
  };

  return (
    <>
      {isOpen && (
        <div className="slide-panel-backdrop" onClick={onClose} />
      )}
      <div
        id={id}
        className={`slide-panel${isOpen ? ' open' : ''}`}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
      >
        <div className="slide-panel-header">
          <div className="slide-panel-title">{title}</div>
          <button className="slide-panel-close-btn" onClick={onClose} aria-label={`Close ${title}`}>
            ×
          </button>
        </div>
        <div className="slide-panel-content">
          {children}
        </div>
      </div>
    </>
  );
};

export default SlidePanel;


