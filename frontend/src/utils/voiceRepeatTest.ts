/**
 * Voice Repeat Fix Test Utilities
 * 
 * This file contains helper functions to test the voice repeat fix implementation.
 * Use these functions in the browser console to verify the fix is working.
 */

export interface SpokenMessageTest {
  id: string;
  timestamp: number;
  content: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Test the spoken message persistence
 */
export function testSpokenMessagePersistence(): TestResult {
  try {
    const stored = localStorage.getItem('comprehension-engine-spoken-messages');
    if (!stored) {
      return {
        success: false,
        message: 'No spoken messages found in localStorage'
      };
    }

    const parsed = JSON.parse(stored);
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentMessages = parsed.filter((msg: SpokenMessageTest) => msg.timestamp > oneDayAgo);

    return {
      success: true,
      message: `Found ${recentMessages.length} recent spoken messages`,
      details: {
        total: parsed.length,
        recent: recentMessages.length,
        oldest: new Date(Math.min(...parsed.map((m: SpokenMessageTest) => m.timestamp))).toISOString(),
        newest: new Date(Math.max(...parsed.map((m: SpokenMessageTest) => m.timestamp))).toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing persistence: ${error}`,
      details: error
    };
  }
}

/**
 * Test message freshness logic
 */
export function testMessageFreshness(messageTimestamp: Date, voiceModeTimestamp: number): TestResult {
  try {
    const now = Date.now();
    const messageAge = now - messageTimestamp.getTime();
    const voiceModeAge = now - voiceModeTimestamp;
    
    const isMessageFresh = messageAge < 5 * 60 * 1000; // 5 minutes
    const isVoiceModeFresh = voiceModeAge < 5 * 60 * 1000; // 5 minutes
    
    return {
      success: true,
      message: `Message freshness test completed`,
      details: {
        messageAge: `${Math.round(messageAge / 1000)}s`,
        voiceModeAge: `${Math.round(voiceModeAge / 1000)}s`,
        isMessageFresh,
        isVoiceModeFresh,
        shouldSpeak: isMessageFresh && isVoiceModeFresh,
        thresholds: {
          messageFreshness: '5 minutes',
          voiceModeFreshness: '5 minutes'
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing freshness: ${error}`,
      details: error
    };
  }
}

/**
 * Simulate the voice repeat scenario
 */
export function simulateVoiceRepeatScenario(): TestResult {
  try {
    // Create a mock scenario
    const mockMessage = {
      id: 'test_msg_123',
      timestamp: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      content: 'Test message content'
    };
    
    const mockVoiceModeEntry = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    
    const freshnessTest = testMessageFreshness(mockMessage.timestamp, mockVoiceModeEntry);
    
    return {
      success: true,
      message: 'Voice repeat scenario simulation completed',
      details: {
        scenario: {
          messageAge: '20 minutes ago',
          voiceModeEntry: '10 minutes ago',
          expectedBehavior: 'Message should NOT be spoken (too old)'
        },
        testResult: freshnessTest
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error simulating scenario: ${error}`,
      details: error
    };
  }
}

/**
 * Clear test data
 */
export function clearTestData(): TestResult {
  try {
    localStorage.removeItem('comprehension-engine-spoken-messages');
    return {
      success: true,
      message: 'Test data cleared successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: `Error clearing test data: ${error}`,
      details: error
    };
  }
}

/**
 * Run all tests
 */
export function runAllTests(): TestResult[] {
  const results = [
    testSpokenMessagePersistence(),
    simulateVoiceRepeatScenario()
  ];
  
  console.log('=== Voice Repeat Fix Test Results ===');
  results.forEach((result, index) => {
    console.log(`Test ${index + 1}:`, result.message);
    if (result.details) {
      console.log('Details:', result.details);
    }
    console.log('---');
  });
  
  return results;
}

/**
 * Manual test helper - add a test message to spoken history
 */
export function addTestSpokenMessage(messageId: string, content: string = 'Test message'): TestResult {
  try {
    const stored = localStorage.getItem('comprehension-engine-spoken-messages') || '[]';
    const parsed = JSON.parse(stored);
    const newEntry = { id: messageId, timestamp: Date.now(), content };
    
    parsed.push(newEntry);
    localStorage.setItem('comprehension-engine-spoken-messages', JSON.stringify(parsed));
    
    return {
      success: true,
      message: `Added test message: ${messageId}`,
      details: { messageId, content, timestamp: new Date().toISOString() }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error adding test message: ${error}`,
      details: error
    };
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).VoiceRepeatTest = {
    testSpokenMessagePersistence,
    testMessageFreshness,
    simulateVoiceRepeatScenario,
    clearTestData,
    runAllTests,
    addTestSpokenMessage
  };
}
