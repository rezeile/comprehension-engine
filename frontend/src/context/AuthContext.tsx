import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: () => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
  const BOOTSTRAP_TIMEOUT_MS = Number(process.env.REACT_APP_AUTH_BOOTSTRAP_TIMEOUT_MS || '2000');

  // One-shot bootstrap: capture tokens from callback if present, save them, then fetch /me.
  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const url = new URL(window.location.href);

        // If we're on /auth/callback, persist tokens then clean URL
        if (url.pathname === '/auth/callback') {
          let accessTokenFromUrl = url.searchParams.get('access_token');
          let refreshTokenFromUrl = url.searchParams.get('refresh_token');
          // Also support tokens in hash fragment, e.g. #access_token=...&refresh_token=...
          if ((!accessTokenFromUrl || !refreshTokenFromUrl) && url.hash) {
            const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
            accessTokenFromUrl = accessTokenFromUrl || hashParams.get('access_token');
            refreshTokenFromUrl = refreshTokenFromUrl || hashParams.get('refresh_token');
          }
          if (accessTokenFromUrl && refreshTokenFromUrl) {
            console.log('[Auth] Storing tokens from callback');
            localStorage.setItem('access_token', accessTokenFromUrl);
            localStorage.setItem('refresh_token', refreshTokenFromUrl);
            // also sync cookies for dev
            document.cookie = `ce_access_token=${encodeURIComponent(accessTokenFromUrl)}; path=/; samesite=lax`;
            document.cookie = `ce_refresh_token=${encodeURIComponent(refreshTokenFromUrl)}; path=/; samesite=lax`;
            window.history.replaceState({}, document.title, '/');
          }
        }

        // Call backend with credentials included so cookies are sent.
        // Add a timeout so the UI doesn't hang indefinitely if backend is slow/unreachable.
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS);
        let response: Response;
        try {
          response = await fetch(`${API_BASE}/api/auth/me`, {
            credentials: 'include',
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Clear any leftover tokens to prefer cookie mode
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      } catch (error: any) {
        // Suppress expected abort noise; only log real failures
        const isAbort = error && (error.name === 'AbortError' || error?.code === 20);
        if (!isAbort) {
          console.error('Auth bootstrap failed:', error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAuth();
  }, []);



  const loginWithGoogle = () => {
    // Redirect to Google OAuth
    window.location.href = `${API_BASE}/api/auth/login`;
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      // ignore network errors; still clear local state
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
  };

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
      } else {
        // Refresh failed, logout user
        logout();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    loginWithGoogle,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
