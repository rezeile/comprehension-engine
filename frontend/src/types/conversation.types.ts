export interface ConversationSummary {
  id: string;
  title?: string | null;
  topic?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_active: boolean;
  last_turn_at?: string | null;
  turn_count: number;
}

export interface ConversationTurn {
  id: string;
  turn_number: number;
  user_input: string;
  ai_response: string;
  timestamp?: string | null;
  comprehension_score?: number | null;
  comprehension_notes?: string | null;
  attachments?: any;
}


