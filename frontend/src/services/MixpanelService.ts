import mixpanel from 'mixpanel-browser';

// Extend Mixpanel types to include missing methods
declare module 'mixpanel-browser' {
  interface Mixpanel {
    set_once(properties: Record<string, any>): void;
    set(properties: Record<string, any>): void;
  }
}

// Types for Mixpanel events and properties
export interface MixpanelEvent {
  event: string;
  properties?: Record<string, any>;
}

export interface UserProperties {
  first_name?: string;
  email?: string;
  learning_level?: string;
  preferred_subjects?: string[];
  device_type?: string;
  platform?: string;
  voice_capabilities?: string[];
}

export interface SessionProperties {
  session_id: string;
  device_type: string;
  platform: string;
  voice_mode_enabled: boolean;
  start_time: number;
}

class MixpanelService {
  private isInitialized = false;
  private currentSessionId: string | null = null;
  private sessionStartTime: number | null = null;
  private isVoiceModeEnabled = false;
  private currentToken: string | null = null;

  constructor() {
    // Try to get token from environment variables
    const token = process.env.REACT_APP_MIXPANEL_TOKEN || 'placeholder_token';
    this.init(token);
  }

  /**
   * Initialize Mixpanel with the provided token
   */
  init(token: string): void {
    if (!token || token === 'placeholder_token') {
      console.warn('Mixpanel token not provided, analytics will be disabled');
      return;
    }

    if (this.isInitialized && this.currentToken === token) {
      console.warn('Mixpanel already initialized with the same token');
      return;
    }

    try {
      // Reset if reinitializing
      if (this.isInitialized) {
        this.reset();
      }

      mixpanel.init(token, {
        debug: process.env.NODE_ENV === 'development',
        track_pageview: true,
        persistence: 'localStorage',
        api_host: 'https://api.mixpanel.com'
      });

      this.isInitialized = true;
      this.currentToken = token;
    } catch (error) {
      console.error('Failed to initialize Mixpanel:', error);
      this.isInitialized = false;
      this.currentToken = null;
    }
  }

  /**
   * Update the Mixpanel token (useful when API key becomes available)
   */
  updateToken(token: string): void {
    if (token && token !== 'placeholder_token' && token !== this.currentToken) {
      this.init(token);
    }
  }

  /**
   * Start a new session
   */
  startSession(voiceModeEnabled: boolean = false): void {
    if (!this.isInitialized) {
      console.warn('Cannot start session: Mixpanel not initialized');
      return;
    }

    this.currentSessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.isVoiceModeEnabled = voiceModeEnabled;

    const sessionProperties: SessionProperties = {
      session_id: this.currentSessionId,
      device_type: this.getDeviceType(),
      platform: this.getPlatform(),
      voice_mode_enabled: voiceModeEnabled,
      start_time: this.sessionStartTime
    };

    this.track('Session Started', sessionProperties);
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (!this.isInitialized || !this.currentSessionId || !this.sessionStartTime) {
      console.warn('Cannot end session: No active session or Mixpanel not initialized');
      return;
    }

    const sessionDuration = Date.now() - this.sessionStartTime;
    
    this.track('Session Ended', {
      session_id: this.currentSessionId,
      session_duration: sessionDuration,
      voice_mode_enabled: this.isVoiceModeEnabled
    });

    this.currentSessionId = null;
    this.sessionStartTime = null;
    this.isVoiceModeEnabled = false;
  }

  /**
   * Identify a user
   */
  identify(userId: string, properties?: UserProperties): void {
    if (!this.isInitialized) {
      console.warn('Cannot identify user: Mixpanel not initialized');
      return;
    }

    if (!userId) {
      console.warn('Cannot identify user: No user ID provided');
      return;
    }

    try {
      mixpanel.identify(userId);
      
      if (properties) {
        // Set user properties
        mixpanel.set_once({
          ...properties,
          'first_visit': new Date().toISOString(),
          'last_updated': new Date().toISOString()
        });

        // Set user properties that can change
        mixpanel.set({
          ...properties,
          'last_updated': new Date().toISOString()
        });
      }


    } catch (error) {
      console.error('Failed to identify user:', error);
    }
  }

  /**
   * Track an event
   */
  track(event: string, properties?: Record<string, any>): void {
    if (!this.isInitialized) {
      console.warn('Cannot track event: Mixpanel not initialized');
      return;
    }

    if (!event) {
      console.warn('Cannot track event: No event name provided');
      return;
    }

    try {
      const eventProperties = {
        ...properties,
        timestamp: new Date().toISOString(),
        session_id: this.currentSessionId,
        ...(this.sessionStartTime && {
          session_duration: Date.now() - this.sessionStartTime
        })
      };

      mixpanel.track(event, eventProperties);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Record<string, any>): void {
    if (!this.isInitialized) {
      console.warn('Cannot set user properties: Mixpanel not initialized');
      return;
    }

    if (!properties || Object.keys(properties).length === 0) {
      console.warn('Cannot set user properties: No properties provided');
      return;
    }

    try {
      mixpanel.set(properties);
    } catch (error) {
      console.error('Failed to set user properties:', error);
    }
  }

  /**
   * Set user properties once (won't overwrite existing values)
   */
  setUserPropertiesOnce(properties: Record<string, any>): void {
    if (!this.isInitialized) {
      console.warn('Cannot set user properties once: Mixpanel not initialized');
      return;
    }

    if (!properties || Object.keys(properties).length === 0) {
      console.warn('Cannot set user properties once: No properties provided');
      return;
    }

    try {
      mixpanel.set_once(properties);
    } catch (error) {
      console.error('Failed to set user properties once:', error);
    }
  }

  /**
   * Update voice mode status
   */
  updateVoiceModeStatus(enabled: boolean): void {
    this.isVoiceModeEnabled = enabled;
    
    if (this.isInitialized && this.currentSessionId) {
      this.track('Voice Mode Status Changed', {
        voice_mode_enabled: enabled,
        session_id: this.currentSessionId
      });
    }
  }

  /**
   * Get current session information
   */
  getCurrentSession(): { sessionId: string | null; startTime: number | null; duration: number | null } {
    if (!this.currentSessionId || !this.sessionStartTime) {
      return { sessionId: null, startTime: null, duration: null };
    }

    return {
      sessionId: this.currentSessionId,
      startTime: this.sessionStartTime,
      duration: Date.now() - this.sessionStartTime
    };
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Detect device type
   */
  private getDeviceType(): string {
    const userAgent = navigator.userAgent;
    
    if (/Android/i.test(userAgent)) return 'mobile';
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'mobile';
    if (/Windows/i.test(userAgent)) return 'desktop';
    if (/Mac/i.test(userAgent)) return 'desktop';
    if (/Linux/i.test(userAgent)) return 'desktop';
    
    return 'unknown';
  }

  /**
   * Detect platform
   */
  private getPlatform(): string {
    if (navigator.userAgent.includes('Mobile')) return 'mobile';
    return 'web';
  }

  /**
   * Check if Mixpanel is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current token (for debugging)
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Reset the service (useful for testing)
   */
  reset(): void {
    this.isInitialized = false;
    this.currentSessionId = null;
    this.sessionStartTime = null;
    this.isVoiceModeEnabled = false;
    this.currentToken = null;
  }
}

// Export a singleton instance
export const mixpanelService = new MixpanelService();

// Export the class for testing purposes
export default MixpanelService;
