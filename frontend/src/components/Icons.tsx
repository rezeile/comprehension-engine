import React from 'react';

interface IconProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  fill?: string;
  stroke?: string;
}

// Microphone icon used in VoiceRecognition
export const MicrophoneIcon: React.FC<IconProps> = ({ 
  width = 20, 
  height = 20, 
  className = '',
  fill = 'currentColor',
  stroke = 'currentColor'
}) => (
  <svg 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M12 2A3 3 0 0 0 9 5V11A3 3 0 0 0 15 11V5A3 3 0 0 0 12 2Z" fill={fill}/>
    <path d="M19 10V11A7 7 0 0 1 5 11V10" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 18.5V22" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 22H16" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Speaker/Volume icon used in VoiceSynthesis and ChatInterface
export const SpeakerIcon: React.FC<IconProps> = ({ 
  width = 20, 
  height = 20, 
  className = '',
  fill = 'currentColor',
  stroke = 'currentColor'
}) => (
  <svg 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M12 2L8 6H4V18H8L12 22V2Z" fill={fill}/>
    <path d="M16 9C16 9 18 11 18 12C18 13 16 15 16 15" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    <path d="M20 5C20 5 22 7 22 12C22 17 20 19 20 19" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Stop icon used in VoiceSynthesis
export const StopIcon: React.FC<IconProps> = ({ 
  width = 20, 
  height = 20, 
  className = '',
  fill = 'currentColor'
}) => (
  <svg 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="6" y="6" width="12" height="12" fill={fill}/>
  </svg>
);

// Close/X icon used in VoiceMode
export const CloseIcon: React.FC<IconProps> = ({ 
  width = 24, 
  height = 24, 
  className = '',
  stroke = 'currentColor'
}) => (
  <svg 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M18 6L6 18" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 6L18 18" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Send/Paper plane icon used in VoiceMode
export const SendIcon: React.FC<IconProps> = ({ 
  width = 24, 
  height = 24, 
  className = '',
  stroke = 'currentColor'
}) => (
  <svg 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M22 2L11 13" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Settings gear icon used in ChatInterface
export const SettingsIcon: React.FC<IconProps> = ({ 
  width = 20, 
  height = 20, 
  className = '',
  stroke = 'currentColor'
}) => (
  <svg 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 10.9609 22.7893 10.6658 22.4142C10.3707 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.257 9.77251 19.9887C9.5799 19.7204 9.31074 19.5206 9 19.41C8.69838 19.2769 8.36381 19.2372 8.03941 19.296C7.71502 19.3548 7.41568 19.5095 7.18 19.74L7.12 19.8C6.93425 19.986 6.71368 20.1335 6.47088 20.2341C6.22808 20.3348 5.96783 20.3866 5.705 20.3866C5.44217 20.3866 5.18192 20.2448 5.93912 20.1441C4.69632 20.0435 4.47575 19.896 4.29 19.71C4.10405 19.5243 3.95653 19.3037 3.85588 19.0609C3.75523 18.8181 3.70343 18.5578 3.70343 18.295C3.70343 18.0322 3.75523 17.7719 3.85588 17.5291C3.95653 17.2863 4.10405 17.0657 4.29 16.88L4.35 16.82C4.58054 16.5843 4.73519 16.285 4.794 15.9606C4.85282 15.6362 4.81312 15.3016 4.68 15C4.55324 14.7042 4.34276 14.452 4.07447 14.2743C3.80618 14.0966 3.49179 14.0013 3.17 14H3C2.46957 14 1.96086 13.7893 1.58579 13.4142C1.21071 13.0391 1 12.5304 1 12C1 11.4696 1.21071 10.9609 1.58579 10.5858C1.96086 10.2107 2.46957 10 3 10H3.09C3.41179 9.99869 3.72618 9.90339 3.99447 9.72569C4.26276 9.54799 4.47324 9.29578 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29578 4.55324 9.548 4.34276 9.72569 4.07447C9.90339 3.80618 9.99869 3.49179 10.08 3.17V3C10.08 2.46957 10.2907 1.96086 10.6658 1.58579C11.0409 1.21071 11.5496 1 12.08 1C12.6104 1 13.1191 1.21071 13.4942 1.58579C13.8693 1.96086 14.08 2.46957 14.08 3V3.09C14.1613 3.41179 14.2566 3.72618 14.4343 3.99447C14.612 4.26276 14.8642 4.47324 15.16 4.6C15.4616 4.73312 15.7962 4.77282 16.1206 4.714C16.445 4.65519 16.7443 4.50054 16.98 4.27L17.04 4.21C17.2257 4.02405 17.4463 3.87653 17.6891 3.77588C17.9319 3.67523 18.1922 3.62343 18.455 3.62343C18.7178 3.62343 18.9781 3.67523 19.2209 3.77588C19.4637 3.87653 19.6843 4.02405 19.87 4.21C20.056 4.39575 20.2035 4.61632 20.3041 4.85912C20.4048 5.10192 20.4566 5.36217 20.4566 5.625C20.4566 5.88783 20.4048 6.14808 20.3041 6.39088C20.2035 6.63368 20.056 6.85425 19.87 7.04L19.81 7.1C19.5795 7.33568 19.4248 7.63502 19.366 7.95941C19.3072 8.28381 19.3469 8.61838 19.48 8.92V9C19.6068 9.29578 19.8172 9.548 20.0855 9.72569C20.3538 9.90339 20.6682 9.99869 20.99 10.08H21C21.5304 10.08 22.0391 10.2907 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Export all icons as a default object for convenience
export const Icons = {
  Microphone: MicrophoneIcon,
  Speaker: SpeakerIcon,
  Stop: StopIcon,
  Close: CloseIcon,
  Send: SendIcon,
  Settings: SettingsIcon,
};

export default Icons;
