import React, { useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import { mixpanelService } from './services/MixpanelService';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import './App.css';

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
        <ProtectedRoute>
          <ChatInterface />
        </ProtectedRoute>
      </div>
    </AuthProvider>
  );
}

export default App;
