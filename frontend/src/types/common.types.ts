// Common types and interfaces shared across the application

export interface AudioState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export interface ButtonProps extends ComponentProps {
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  title?: string;
}

export interface IconProps extends ComponentProps {
  size?: number;
  color?: string;
  onClick?: () => void;
}

export interface LoadingProps extends ComponentProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}

// Browser compatibility types
export interface BrowserCapabilities {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  microphonePermission: boolean;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Event types
export interface AppEvent {
  type: string;
  payload?: any;
  timestamp: Date;
}
