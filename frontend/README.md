# Comprehension Engine Frontend

A modern, mobile-friendly chat interface for AI-powered learning assistance with **full voice input and output capabilities**.

## Features

- **Clean Chat Interface**: Modern message bubbles with user/assistant styling
- **Mobile Responsive**: Optimized for both desktop and mobile devices
- **Real-time Updates**: Smooth animations and loading states
- **Auto-scroll**: Automatically scrolls to show latest messages
- **Professional Design**: Beautiful gradient backgrounds and modern UI elements
- **🎤 Voice Input**: Speech-to-text using Web Speech API
- **🔊 Voice Output**: Text-to-speech for AI responses
- **🎯 Voice Controls**: Microphone button, speaker toggle, and keyboard shortcuts

## 🎤 Voice Features

### **Voice Input (Speech-to-Text)**
- **Microphone Button**: Green microphone button next to text input
- **Spacebar Shortcut**: Press Space to start/stop voice recording
- **Real-time Feedback**: Visual indicators when recording (pulsing red mic)
- **Auto-populate**: Transcribed speech automatically fills the text input
- **Permission Handling**: Graceful fallback for microphone access issues

### **Voice Output (Text-to-Speech)**
- **Speaker Toggle**: Header button to enable/disable voice output
- **Auto-speak**: AI responses are automatically read aloud
- **Natural Voice**: Uses high-quality voices when available
- **Speaking Animation**: Animated speaker icon during playback
- **Interruptible**: Click speaker button to stop current speech

### **Voice Controls**
- **Header Speaker Button**: Toggle voice output on/off
- **Microphone Button**: Start/stop voice recording
- **Keyboard Shortcuts**: Spacebar for voice input
- **Visual Feedback**: Clear status indicators for all voice states
- **Mobile Optimized**: Touch-friendly voice controls

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- **Modern browser** with Web Speech API support (Chrome, Edge, Safari)
- **Microphone access** for voice input features

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run eject` - Ejects from Create React App (not recommended)

## Project Structure

```
src/
├── components/
│   ├── ChatInterface.tsx    # Main chat component with voice features
│   └── ChatInterface.css    # Chat styling including voice UI
├── types/
│   └── speech.d.ts         # Web Speech API type definitions
├── App.tsx                  # Main app component
├── App.css                  # App-level styles
└── index.tsx                # Entry point
```

## 🎯 Voice Usage Guide

### **Starting a Voice Conversation**

1. **Enable Voice Output**: Click the speaker button in the header (should be green)
2. **Start Voice Input**: Click the microphone button or press Spacebar
3. **Speak Your Question**: Talk clearly into your microphone
4. **Review & Send**: Check the transcribed text and click send
5. **Listen to Response**: AI response is automatically read aloud

### **Voice Controls**

- **🎤 Microphone Button**: 
  - Green = Ready to record
  - Red pulsing = Currently recording
  - Gray = Disabled (no permission)
- **🔊 Speaker Button**:
  - Green = Voice output enabled
  - Red = Voice output disabled
  - Animated = Currently speaking

### **Keyboard Shortcuts**

- **Spacebar**: Start/stop voice recording
- **Enter**: Send message
- **Shift+Enter**: New line in text input

## Browser Compatibility

### **Full Voice Support**
- ✅ **Chrome/Edge**: Full speech recognition and synthesis
- ✅ **Safari**: Full speech recognition and synthesis
- ✅ **Firefox**: Limited support (may need manual setup)

### **Voice Input Requirements**
- HTTPS connection (required for microphone access)
- Microphone permission granted
- Modern browser with Web Speech API support

### **Fallback Behavior**
- Voice input disabled if not supported
- Text input remains fully functional
- Clear warnings for unsupported features

## Current Status

The frontend now includes:
- ✅ **Complete voice integration** with Web Speech API
- ✅ **Real-time speech recognition** with visual feedback
- ✅ **Natural text-to-speech** for AI responses
- ✅ **Mobile-optimized voice controls**
- ✅ **Comprehensive error handling** for voice features
- ✅ **Backend integration** ready for Claude API

## Features to Add

- [ ] Voice command shortcuts ("Hey AI, explain...")
- [ ] Voice response customization (speed, pitch, voice selection)
- [ ] Offline voice processing
- [ ] Multi-language voice support
- [ ] Voice activity detection
- [ ] Background noise filtering

## Styling

The interface uses:
- CSS Grid and Flexbox for responsive layouts
- CSS custom properties for consistent theming
- Smooth animations and transitions
- Mobile-first responsive design
- Modern glassmorphism effects
- **Voice-specific animations** (pulsing mic, speaking waves)

## Troubleshooting Voice Issues

### **Microphone Not Working**
1. Check browser permissions (🔒 icon in address bar)
2. Ensure HTTPS connection
3. Try refreshing the page
4. Check browser console for errors

### **Voice Output Not Working**
1. Click speaker button to enable (should turn green)
2. Check browser volume settings
3. Ensure browser supports speech synthesis
4. Try different browser (Chrome recommended)

### **Poor Speech Recognition**
1. Speak clearly and at normal pace
2. Reduce background noise
3. Check microphone quality
4. Ensure good internet connection

## Development Notes

### **Web Speech API**
- Uses `webkitSpeechRecognition` for Chrome compatibility
- Implements proper error handling and fallbacks
- Manages microphone permissions gracefully
- Optimizes voice quality and recognition accuracy

### **Voice State Management**
- Centralized voice state in React hooks
- Proper cleanup of speech recognition/synthesis
- Real-time visual feedback for all voice states
- Mobile-optimized touch interactions
