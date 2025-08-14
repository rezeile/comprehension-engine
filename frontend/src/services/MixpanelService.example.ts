/**
 * Example usage of MixpanelService
 * This file demonstrates how to properly use the MixpanelService in your application
 */

import { mixpanelService } from './MixpanelService';

// Example 1: Basic initialization and usage
export function initializeAnalytics() {
  // Set your Mixpanel token (usually from environment variables)
  const token = process.env.REACT_APP_MIXPANEL_TOKEN;
  
  if (token) {
    mixpanelService.updateToken(token);
    console.log('Analytics initialized successfully');
  } else {
    console.warn('Mixpanel token not found, analytics will be disabled');
  }
}

// Example 2: User identification
export function identifyUser(userId: string, userProperties?: any) {
  mixpanelService.identify(userId, {
    first_name: userProperties?.firstName,
    email: userProperties?.email,
    learning_level: userProperties?.learningLevel || 'beginner',
    preferred_subjects: userProperties?.preferredSubjects || [],
    device_type: 'web', // or detect dynamically
    platform: 'web'
  });
}

// Example 3: Session management
export function startUserSession(voiceModeEnabled: boolean = false) {
  mixpanelService.startSession(voiceModeEnabled);
}

export function endUserSession() {
  mixpanelService.endSession();
}

// Example 4: Event tracking
export function trackUserAction(action: string, properties?: any) {
  mixpanelService.track(action, {
    ...properties,
    user_type: 'student',
    feature_used: action
  });
}

// Example 5: User properties
export function updateUserPreferences(preferences: any) {
  mixpanelService.setUserProperties({
    preferred_subjects: preferences.subjects,
    learning_style: preferences.learningStyle,
    difficulty_level: preferences.difficultyLevel
  });
}

// Example 6: Voice mode tracking
export function trackVoiceModeChange(enabled: boolean) {
  mixpanelService.updateVoiceModeStatus(enabled);
  
  // Track the change event
  mixpanelService.track('Voice Mode Toggled', {
    voice_mode_enabled: enabled,
    previous_state: !enabled
  });
}

// Example 7: Learning session tracking
export function trackLearningSession(sessionData: any) {
  const sessionStart = Date.now();
  
  // Start session
  startUserSession(sessionData.voiceModeEnabled);
  
  // Track session start
  trackUserAction('Learning Session Started', {
    subject: sessionData.subject,
    topic: sessionData.topic,
    difficulty: sessionData.difficulty,
    session_type: sessionData.sessionType
  });
  
  // Return function to end session
  return () => {
    const sessionDuration = Date.now() - sessionStart;
    
    // Track session end
    trackUserAction('Learning Session Ended', {
      subject: sessionData.subject,
      topic: sessionData.topic,
      session_duration: sessionDuration,
      questions_asked: sessionData.questionsAsked,
      concepts_learned: sessionData.conceptsLearned
    });
    
    // End session
    endUserSession();
  };
}

// Example 8: Error tracking
export function trackError(error: Error, context?: any) {
  mixpanelService.track('Error Occurred', {
    error_message: error.message,
    error_stack: error.stack,
    error_name: error.name,
    context: context,
    timestamp: new Date().toISOString()
  });
}

// Example 9: Feature usage tracking
export function trackFeatureUsage(feature: string, properties?: any) {
  mixpanelService.track('Feature Used', {
    feature_name: feature,
    feature_category: properties?.category || 'general',
    user_level: properties?.userLevel || 'unknown',
    ...properties
  });
}

// Example 10: Performance tracking
export function trackPerformance(metric: string, value: number, properties?: any) {
  mixpanelService.track('Performance Metric', {
    metric_name: metric,
    metric_value: value,
    unit: properties?.unit || 'ms',
    context: properties?.context || 'general',
    ...properties
  });
}

// Example 11: Check if analytics is ready
export function isAnalyticsReady(): boolean {
  return mixpanelService.isReady();
}

// Example 12: Get current session info
export function getCurrentSessionInfo() {
  return mixpanelService.getCurrentSession();
}

// Example 13: Reset analytics (useful for testing or logout)
export function resetAnalytics() {
  mixpanelService.reset();
}

// Example 14: Batch property updates
export function updateUserProfile(profile: any) {
  const properties = {
    first_name: profile.firstName,
    email: profile.email,
    learning_level: profile.learningLevel,
    preferred_subjects: profile.preferredSubjects,
    last_profile_update: new Date().toISOString()
  };
  
  // Set properties that can change
  mixpanelService.setUserProperties(properties);
  
  // Set properties that should only be set once
  mixpanelService.setUserPropertiesOnce({
    first_visit: profile.firstVisit || new Date().toISOString(),
    signup_source: profile.signupSource || 'direct'
  });
}

// Example 15: Conditional tracking based on analytics readiness
export function safeTrack(event: string, properties?: any) {
  if (mixpanelService.isReady()) {
    mixpanelService.track(event, properties);
  } else {
    console.warn(`Analytics not ready, skipping event: ${event}`);
  }
}
