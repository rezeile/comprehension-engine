# Services Directory

This directory contains service classes that provide functionality across the application.

## MixpanelService

The `MixpanelService` provides analytics tracking capabilities using Mixpanel. It handles user identification, session management, event tracking, and user properties.

### Features

- **User Identification**: Track individual users and their properties
- **Session Management**: Monitor user sessions with start/end tracking
- **Event Tracking**: Log custom events with properties
- **User Properties**: Set and update user attributes
- **Voice Mode Tracking**: Special tracking for voice-enabled features
- **Error Handling**: Graceful degradation when Mixpanel is unavailable
- **Environment Configuration**: Easy setup via environment variables

### Setup

1. **Environment Variables**: Add your Mixpanel token to `.env`:
   ```bash
   REACT_APP_MIXPANEL_TOKEN=your_mixpanel_project_token_here
   REACT_APP_MIXPANEL_ENABLED=true
   ```

2. **Import and Use**:
   ```typescript
   import { mixpanelService } from './services/MixpanelService';
   
   // Initialize with token
   mixpanelService.updateToken(process.env.REACT_APP_MIXPANEL_TOKEN);
   
   // Start tracking
   mixpanelService.startSession();
   mixpanelService.identify('user123', { first_name: 'John' });
   mixpanelService.track('Button Clicked', { button: 'submit' });
   ```

### API Reference

#### Core Methods

- `init(token: string)`: Initialize Mixpanel with token
- `updateToken(token: string)`: Update the Mixpanel token
- `startSession(voiceModeEnabled?: boolean)`: Start a new session
- `endSession()`: End the current session
- `identify(userId: string, properties?: UserProperties)`: Identify a user
- `track(event: string, properties?: Record<string, any>)`: Track an event

#### User Properties

- `setUserProperties(properties: Record<string, any>)`: Set user properties
- `setUserPropertiesOnce(properties: Record<string, any>)`: Set properties once

#### Session Management

- `getCurrentSession()`: Get current session information
- `updateVoiceModeStatus(enabled: boolean)`: Update voice mode status

#### Utility Methods

- `isReady()`: Check if Mixpanel is initialized
- `getCurrentToken()`: Get the current token
- `reset()`: Reset the service (useful for testing)

### Usage Examples

See `MixpanelService.example.ts` for comprehensive usage examples including:

- Basic initialization
- User identification
- Session management
- Event tracking
- Error tracking
- Performance monitoring
- Feature usage tracking

### Error Handling

The service gracefully handles errors and provides helpful console warnings:

- When Mixpanel is not initialized
- When required parameters are missing
- When operations fail

### Testing

Run the test suite to verify functionality:

```bash
npm test -- --testPathPattern=MixpanelService.test.ts
```

### Best Practices

1. **Initialize Early**: Set up Mixpanel as early as possible in your app
2. **Use Environment Variables**: Don't hardcode tokens
3. **Handle Errors Gracefully**: Always check if the service is ready
4. **Track Meaningful Events**: Focus on user actions and business metrics
5. **Use Consistent Naming**: Follow a consistent event naming convention
6. **Include Context**: Add relevant properties to events for better insights

### Troubleshooting

**Common Issues:**

1. **"Mixpanel token not provided"**: Check your `.env` file and `REACT_APP_MIXPANEL_TOKEN`
2. **"Cannot track event: Mixpanel not initialized"**: Ensure you've called `updateToken()` first
3. **Events not appearing in Mixpanel**: Verify your token is correct and has proper permissions

**Debug Mode:**

Enable debug mode by setting `debug: true` in the Mixpanel initialization options (automatically enabled in development).

### Dependencies

- `mixpanel-browser`: Core Mixpanel library
- `@types/mixpanel-browser`: TypeScript type definitions

### Future Enhancements

- A/B testing support
- Offline event queuing
- Custom event validation
- Performance monitoring
- User segmentation
