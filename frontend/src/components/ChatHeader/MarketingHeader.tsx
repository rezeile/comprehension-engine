import React from 'react';
import './MarketingHeader.css';

interface MarketingHeaderProps {
  wordmark?: string;
}

const MarketingHeader: React.FC<MarketingHeaderProps> = ({ wordmark = 'GraspWell' }) => {
  return (
    <header className="marketing-header" role="banner">
      <div className="marketing-header__inner">
        <div className="brand">
          <img src="/brand-icon.png" alt={`${wordmark} brand`} className="brand__logo" />
          <span className="brand__wordmark" aria-label={wordmark}>{wordmark}</span>
        </div>
        <div className="header-spacer" />
      </div>
    </header>
  );
};

export default MarketingHeader;


