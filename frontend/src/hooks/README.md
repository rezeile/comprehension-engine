# Custom Hooks Documentation

This directory contains custom React hooks that were extracted from the bloated `ChatInterface.tsx` component to improve maintainability and reusability.

## Available Hooks

### `useVoiceRecognition`

Handles speech recognition functionality including starting/stopping recording, managing state, and handling errors.

**Usage:**
```typescript
import { useVoiceRecognition } from '../hooks';

const MyComponent = () => {
  const {
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
    isSupported
  } = useVoiceRecognition({
    language: 'en-US',
    onTranscript: (text, isFinal) => console.log(text, isFinal),
    onError: (error) => console.error(error)
  });

  return (
    <div>
      <button onClick={startRecording} disabled={!isSupported}>
        Start Recording
      </button>
      <button onClick={stopRecording} disabled={!isRecording}>
        Stop Recording
      </button>
      <p>Transcript: {transcript}</p>
      {error && <p>Error: {error}</p>}
    </div>
  );
};
```

**Options:**
- `language`: Speech recognition language (default: 'en-US')
- `continuous`: Whether to continue recording (default: true)
- `interimResults`: Whether to return interim results (default: true)
- `maxAlternatives`: Maximum number of alternatives (default: 1)
- `onTranscript`: Callback for transcript updates
- `onError`: Callback for error handling
- `onStart`: Callback when recording starts
- `onEnd`: Callback when recording ends

### `useVoiceSynthesis`

Handles text-to-speech functionality with support for both Web Speech API and ElevenLabs.

**Usage:**
```typescript
import { useVoiceSynthesis } from '../hooks';

const MyComponent = () => {
  const {
    isSpeaking,
    speak,
    stop,
    pause,
    resume,
    isSupported,
    isElevenLabsEnabled
  } = useVoiceSynthesis({
    rate: 0.9,
    pitch: 1.0,
    volume: 1.0,
    onStart: () => console.log('Started speaking'),
    onEnd: () => console.log('Finished speaking')
  });

  const handleSpeak = () => {
    speak('Hello, world!', 'voice-id', true); // Use ElevenLabs
    // or
    speak('Hello, world!'); // Use Web Speech API
  };

  return (
    <div>
      <button onClick={handleSpeak} disabled={isSpeaking}>
        Speak
      </button>
      <button onClick={stop} disabled={!isSpeaking}>
        Stop
      </button>
      {isSpeaking && <p>Speaking...</p>}
    </div>
  );
};
```

**Options:**
- `voice`: Speech synthesis voice
- `rate`: Speech rate (default: 0.9)
- `pitch`: Speech pitch (default: 1.0)
- `volume`: Speech volume (default: 1.0)
- `onStart`: Callback when speech starts
- `onEnd`: Callback when speech ends
- `onError`: Callback for error handling

### `useVoiceMode`

Manages voice mode state including transcription, audio settling, and cooldown periods.

**Usage:**
```typescript
import { useVoiceMode } from '../hooks';

const MyComponent = () => {
  const {
    isVoiceMode,
    transcriptionText,
    isAudioSettling,
    isInCooldown,
    enterVoiceMode,
    exitVoiceMode,
    updateTranscription,
    forceMicrophoneActivation
  } = useVoiceMode({
    onEnter: () => console.log('Entered voice mode'),
    onExit: () => console.log('Exited voice mode'),
    onTranscriptionChange: (text) => console.log('Transcription:', text)
  });

  return (
    <div>
      {isVoiceMode ? (
        <div>
          <p>Voice Mode Active</p>
          <p>Transcription: {transcriptionText}</p>
          <button onClick={exitVoiceMode}>Exit Voice Mode</button>
          {isInCooldown && (
            <button onClick={forceMicrophoneActivation}>
              Force Activate Microphone
            </button>
          )}
        </div>
      ) : (
        <button onClick={enterVoiceMode}>Enter Voice Mode</button>
      )}
    </div>
  );
};
```

**Options:**
- `onEnter`: Callback when entering voice mode
- `onExit`: Callback when exiting voice mode
- `onTranscriptionChange`: Callback for transcription updates

### `useChat`

Manages chat functionality including messages, loading states, and API communication.

**Usage:**
```typescript
import { useChat } from '../hooks';

const MyComponent = () => {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    scrollToBottom
  } = useChat({
    backendUrl: 'http://localhost:8000',
    onMessageSent: (message) => console.log('Sent:', message),
    onMessageReceived: (message) => console.log('Received:', message),
    onError: (error) => console.error('Chat error:', error)
  });

  const handleSend = async () => {
    await sendMessage('Hello, AI!');
  };

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          <strong>{message.sender}:</strong> {message.content}
        </div>
      ))}
      <button onClick={handleSend} disabled={isLoading}>
        Send Message
      </button>
      <button onClick={clearMessages}>Clear Chat</button>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
    </div>
  );
};
```

**Options:**
- `backendUrl`: Backend API URL
- `onMessageSent`: Callback when message is sent
- `onMessageReceived`: Callback when message is received
- `onError`: Callback for error handling

### `useAudioState`

Manages overall audio state and coordinates between voice recognition and synthesis.

**Usage:**
```typescript
import { useAudioState } from '../hooks';

const MyComponent = () => {
  const {
    voiceState,
    audioState,
    toggleVoiceOutput,
    markMessageAsSpoken,
    isAudioActive,
    canActivateMicrophone
  } = useAudioState();

  return (
    <div>
      <button onClick={toggleVoiceOutput}>
        {voiceState.voiceEnabled ? 'Disable' : 'Enable'} Voice
      </button>
      <p>Voice Enabled: {voiceState.voiceEnabled ? 'Yes' : 'No'}</p>
      <p>Audio Active: {isAudioActive() ? 'Yes' : 'No'}</p>
      <p>Can Activate Microphone: {canActivateMicrophone() ? 'Yes' : 'No'}</p>
    </div>
  );
};
```

## Benefits of Using These Hooks

1. **Separation of Concerns**: Each hook handles a specific aspect of the voice/chat system
2. **Reusability**: Hooks can be used in other components
3. **Testability**: Each hook can be tested independently
4. **Maintainability**: Logic is organized and easier to debug
5. **Performance**: Hooks can be optimized individually

## Testing

Run the test suite to ensure hooks are working correctly:

```bash
npm test -- --testPathPattern=hooks
```

## Migration from ChatInterface

These hooks were extracted from the original `ChatInterface.tsx` component. To use them:

1. Import the hooks you need
2. Replace the inline logic with hook calls
3. Use the returned state and functions
4. Remove duplicate state management code

## Future Improvements

- Add more configuration options
- Implement caching for better performance
- Add error recovery mechanisms
- Support for more voice providers
- Better TypeScript types and validation
