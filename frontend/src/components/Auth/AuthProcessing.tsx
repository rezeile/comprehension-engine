import React, { useEffect } from 'react';
import './Login.css';
import './AuthProcessing.css';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AuthProcessing: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/c/new', { replace: true });
    }
  }, [isAuthenticated]);

  return (
    <div className="processing-root" role="status" aria-live="polite">
      <div className="processing-loader" aria-hidden="true" />
      <p className="processing-text">Signing you in…</p>
    </div>
  );
};

export default AuthProcessing;


