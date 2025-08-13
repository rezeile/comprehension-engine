export interface Voice {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface VoicesResponse {
  voices: Voice[];
}

export class VoiceService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
  }
  
  /**
   * Convert text to speech using ElevenLabs
   */
  async textToSpeech(text: string, voiceId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: voiceId })
    });
    
    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
    }
    
    return response.blob();
  }
  
  /**
   * Get list of available voices
   */
  async getAvailableVoices(): Promise<Voice[]> {
    const response = await fetch(`${this.baseUrl}/api/voices`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
    }
    
    const data: VoicesResponse = await response.json();
    return data.voices;
  }
  
  /**
   * Get default voice ID
   */
  getDefaultVoiceId(): string {
    return process.env.REACT_APP_DEFAULT_VOICE_ID || 'ErXwobaYiN019PkySvjV';
  }
  
  /**
   * Check if ElevenLabs is enabled
   */
  isElevenLabsEnabled(): boolean {
    return process.env.REACT_APP_ELEVENLABS_ENABLED === 'true';
  }
}
