import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);



  const handleGoogleLogin = () => {
    setIsRedirecting(true);
    loginWithGoogle();
  };

  const loginVariant = process.env.REACT_APP_LOGIN_MOTIF || 'motif';
  const containerClass = `login-container ${loginVariant === 'animated' ? 'motif-animated' : loginVariant === 'minimal' ? 'motif-minimal' : 'motif'}`;

  return (
    <div className={containerClass}>
      <div className="login-card">
        <div className="login-header">
          <h1 className="hero-title">The Comprehension Engine</h1>
          <p className="hero-subtitle">Master complex concepts, one conversation at a time.</p>
        </div>



        <div className="login-options">
          <button
            type="button"
            className="google-login-btn btn-xl"
            onClick={handleGoogleLogin}
            disabled={isRedirecting}
          >
            <svg className="google-icon" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isRedirecting ? 'Redirecting…' : 'Continue with Google'}
          </button>
          <div className="login-subcopy">We’ll never post or share without your permission.</div>

          <div className="divider"><span>or</span></div>

          {!showEmail ? (
            <button
              type="button"
              className="email-login-btn"
              onClick={() => setShowEmail(true)}
            >
              Continue with Email
            </button>
          ) : (
            <form className="email-form" onSubmit={(e) => { e.preventDefault(); }}>
              <input
                type="email"
                className="email-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="email-submit-btn" disabled>
                Continue
              </button>
              <div className="login-subcopy small">Email sign-in coming soon</div>
            </form>
          )}
        </div>


      </div>
    </div>
  );
};

export default Login;
