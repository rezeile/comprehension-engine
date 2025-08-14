import { mixpanelService } from './MixpanelService';

describe('MixpanelService', () => {
  beforeEach(() => {
    // Reset the service before each test
    mixpanelService.reset();
  });

  test('should initialize with placeholder token', () => {
    expect(mixpanelService.isReady()).toBe(false);
  });

  test('should handle token updates', () => {
    const testToken = 'test_token_123';
    mixpanelService.updateToken(testToken);
    
    // In a real environment, this would initialize Mixpanel
    // For now, we just test that the method doesn't throw
    expect(() => mixpanelService.updateToken(testToken)).not.toThrow();
  });

  test('should handle session management gracefully when not initialized', () => {
    // These should not throw errors when Mixpanel is not initialized
    expect(() => mixpanelService.startSession()).not.toThrow();
    expect(() => mixpanelService.endSession()).not.toThrow();
    expect(() => mixpanelService.track('test_event')).not.toThrow();
  });

  test('should handle user identification gracefully when not initialized', () => {
    expect(() => mixpanelService.identify('test_user')).not.toThrow();
  });

  test('should handle property setting gracefully when not initialized', () => {
    const testProperties = { test: 'value' };
    expect(() => mixpanelService.setUserProperties(testProperties)).not.toThrow();
    expect(() => mixpanelService.setUserPropertiesOnce(testProperties)).not.toThrow();
  });

  test('should generate session IDs when initialized', () => {
    // First initialize with a valid token
    const testToken = 'test_token_123';
    mixpanelService.updateToken(testToken);
    
    // Now start a session
    mixpanelService.startSession();
    const session = mixpanelService.getCurrentSession();
    expect(session.sessionId).toBeTruthy();
    expect(session.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
  });

  test('should not generate session IDs when not initialized', () => {
    // Try to start a session without initialization
    mixpanelService.startSession();
    const session = mixpanelService.getCurrentSession();
    expect(session.sessionId).toBeNull();
    expect(session.startTime).toBeNull();
  });

  test('should detect device type and platform', () => {
    // These methods should return valid strings
    const deviceType = (mixpanelService as any).getDeviceType();
    const platform = (mixpanelService as any).getPlatform();
    
    expect(typeof deviceType).toBe('string');
    expect(typeof platform).toBe('string');
    expect(deviceType).toMatch(/^(mobile|desktop|unknown)$/);
    expect(platform).toMatch(/^(mobile|web)$/);
  });

  test('should handle voice mode updates', () => {
    expect(() => mixpanelService.updateVoiceModeStatus(true)).not.toThrow();
    expect(() => mixpanelService.updateVoiceModeStatus(false)).not.toThrow();
  });

  test('should provide session information', () => {
    const session = mixpanelService.getCurrentSession();
    expect(session).toEqual({
      sessionId: null,
      startTime: null,
      duration: null
    });
  });

  test('should reset correctly', () => {
    // Initialize and start a session
    mixpanelService.updateToken('test_token');
    mixpanelService.startSession();
    
    // Verify session was created
    let session = mixpanelService.getCurrentSession();
    expect(session.sessionId).toBeTruthy();
    
    // Reset
    mixpanelService.reset();
    
    // Verify reset worked
    session = mixpanelService.getCurrentSession();
    expect(session.sessionId).toBeNull();
    expect(session.startTime).toBeNull();
    expect(session.duration).toBeNull();
  });

  test('should handle multiple token updates', () => {
    const token1 = 'token_1';
    const token2 = 'token_2';
    
    mixpanelService.updateToken(token1);
    expect(mixpanelService.getCurrentToken()).toBe(token1);
    
    mixpanelService.updateToken(token2);
    expect(mixpanelService.getCurrentToken()).toBe(token2);
  });
});
