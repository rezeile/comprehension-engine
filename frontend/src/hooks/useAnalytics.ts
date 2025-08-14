import { useEffect, useCallback, useRef } from 'react';
import { mixpanelService } from '../services/MixpanelService';

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
}

export interface UserProfile {
  userId: string;
  firstName?: string;
  email?: string;
  learningLevel?: string;
  preferredSubjects?: string[];
}

export const useAnalytics = () => {
  const sessionStarted = useRef(false);

  // Initialize analytics when the hook is first used
  useEffect(() => {
    const token = process.env.REACT_APP_MIXPANEL_TOKEN;
    const enabled = process.env.REACT_APP_MIXPANEL_ENABLED === 'true';

    if (enabled && token && token !== 'your_mixpanel_project_token_here') {
      mixpanelService.updateToken(token);
    }

    // Start session if not already started
    if (!sessionStarted.current) {
      mixpanelService.startSession();
      sessionStarted.current = true;
    }

    // Cleanup on unmount
    return () => {
      if (sessionStarted.current) {
        mixpanelService.endSession();
        sessionStarted.current = false;
      }
    };
  }, []);

  // Track page views
  useEffect(() => {
    const trackPageView = () => {
      mixpanelService.track('Page Viewed', {
        page: window.location.pathname,
        title: document.title,
        referrer: document.referrer
      });
    };

    // Track initial page view
    trackPageView();

    // Track navigation changes
    const handlePopState = () => trackPageView();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Identify user
  const identifyUser = useCallback((profile: UserProfile) => {
    const properties = {
      first_name: profile.firstName,
      email: profile.email,
      learning_level: profile.learningLevel,
      preferred_subjects: profile.preferredSubjects,
      device_type: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
      platform: 'web'
    };

    mixpanelService.identify(profile.userId, properties);
  }, []);

  // Track custom events
  const trackEvent = useCallback((event: string, properties?: Record<string, any>) => {
    mixpanelService.track(event, properties);
  }, []);

  // Track user properties
  const setUserProperties = useCallback((properties: Record<string, any>) => {
    mixpanelService.setUserProperties(properties);
  }, []);

  // Track user properties once
  const setUserPropertiesOnce = useCallback((properties: Record<string, any>) => {
    mixpanelService.setUserPropertiesOnce(properties);
  }, []);

  // Update voice mode status
  const updateVoiceModeStatus = useCallback((enabled: boolean) => {
    mixpanelService.updateVoiceModeStatus(enabled);
  }, []);

  // Get current session info
  const getCurrentSession = useCallback(() => {
    return mixpanelService.getCurrentSession();
  }, []);

  // Check if analytics is ready
  const isReady = useCallback(() => {
    return mixpanelService.isReady();
  }, []);

  return {
    identifyUser,
    trackEvent,
    setUserProperties,
    setUserPropertiesOnce,
    updateVoiceModeStatus,
    getCurrentSession,
    isReady
  };
};
