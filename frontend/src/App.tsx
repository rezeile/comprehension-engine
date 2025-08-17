import React, { useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import { mixpanelService } from './services/MixpanelService';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';

function ChatRouteWrapper() {
  const params = useParams();
  const conversationId = params.conversationId as string | undefined;
  return <ChatInterface conversationId={conversationId} />;
}

function RedirectToLatestConversation() {
  const navigate = useNavigate();
  useEffect(() => {
    // Simply render ChatInterface without an id; the component will decide to create or navigate
    navigate('/c/new', { replace: true });
  }, [navigate]);
  return null;
}

function App() {
  useEffect(() => {
    // Initialize Mixpanel with token from environment
    const token = process.env.REACT_APP_MIXPANEL_TOKEN;
    
    if (token && token !== 'your_mixpanel_project_token_here') {
      mixpanelService.updateToken(token);
      
      // Track app load event
      if (mixpanelService.isReady()) {
        mixpanelService.track('App Loaded', {
          app_version: '1.0.0',
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        });
      }
    }
  }, []);

  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <ProtectedRoute>
            <Routes>
              <Route path="/" element={<Navigate to="/c/new" replace />} />
              <Route path="/c/new" element={<ChatRouteWrapper />} />
              <Route path="/c/:conversationId" element={<ChatRouteWrapper />} />
            </Routes>
          </ProtectedRoute>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;
