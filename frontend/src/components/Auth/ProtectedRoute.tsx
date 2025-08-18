import React from 'react';
import { useAuth } from '../../context/AuthContext';
import AuthProcessing from './AuthProcessing';
import Login from './Login';
import './ProtectedRoute.css';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const locationPath = typeof window !== 'undefined' ? window.location.pathname : '';

  // While auth state is loading or on processing path, show processing UI
  if (!isAuthenticated && (isLoading || locationPath.startsWith('/auth/processing'))) {
    return <AuthProcessing />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
