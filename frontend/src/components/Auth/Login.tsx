import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MarketingHeader from '../ChatHeader/MarketingHeader';
import './Login.css';

const Login: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const ctaRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ctaRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleGoogleLogin = () => {
    // Light haptic feedback where supported
    try { (navigator as any).vibrate?.(12); } catch {}
    // Use client-side navigation to avoid canceling timers
    navigate('/auth/processing', { replace: true });
    // immediately trigger oauth
    loginWithGoogle();
  };

  const handlePointerDown = () => {
    ctaRef.current?.classList.add('is-pressed');
    try { (navigator as any).vibrate?.(8); } catch {}
  };

  const clearPressed = () => {
    ctaRef.current?.classList.remove('is-pressed');
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      ctaRef.current?.classList.add('is-pressed');
    }
  };

  const handleKeyUp: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      ctaRef.current?.classList.remove('is-pressed');
    }
  };

  return (
    <div className="landing-root">
      <MarketingHeader />
      <main className="landing-main" aria-labelledby="landing-title">
        <div className="content-stack">
          <h1 id="landing-title" className="landing-title">Understand Faster. Remember Longer.</h1>
          <p className="landing-sub">AI tutor that adapts as you think.</p>
          <button
            ref={ctaRef}
            type="button"
            className="google-login-btn btn-xl landing-cta"
            onClick={handleGoogleLogin}
            onPointerDown={handlePointerDown}
            onPointerUp={clearPressed}
            onPointerLeave={clearPressed}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            aria-label="Continue with Google"
          >
            <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
        <img src="/brand-icon.png" alt="" className="bg-brand" />
      </main>
    </div>
  );
};

export default Login;
