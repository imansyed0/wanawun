export interface WordEntry {
  id: string;
  kashmiri: string;
  english: string;
  part_of_speech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'conjunction' | 'phrase' | 'other';
  gender?: 'm' | 'f' | null;
  number?: 'sing' | 'plu' | null;
  category: string;
  difficulty: 1 | 2 | 3;
  is_loan_word: boolean;
  is_phrase: boolean;
  audio_url?: string | null;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string;
  elo_rating: number;
  words_learned: number;
  games_played: number;
  created_at: string;
}

export interface SyncGame {
  id: string;
  player_a: string;
  player_b?: string;
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  config: SyncGameConfig;
  rounds: SyncRound[];
  scores: { [playerId: string]: number };
  room_code?: string;
  winner?: string;
  created_at: string;
  completed_at?: string;
}

export interface SyncGameConfig {
  round_count: number;
  difficulty?: 1 | 2 | 3;
  category?: string;
}

export interface SyncRound {
  round_number: number;
  word_id: string;
  kashmiri: string;
  correct_answer: string;
  options: string[];
  player_a_answer?: string;
  player_a_time_ms?: number;
  player_b_answer?: string;
  player_b_time_ms?: number;
  winner?: string;
}

export interface AsyncGame {
  id: string;
  player_a: string;
  player_b: string;
  status: 'active' | 'completed' | 'abandoned';
  current_turn: string;
  turns: MessengerTurn[];
  scores: { [playerId: string]: number };
  created_at: string;
  updated_at: string;
}

export interface SentenceTemplate {
  id: string;
  template: string; // e.g. "___ tsali ___ kh'on"
  english_template: string; // e.g. "[person] went to [place] to eat"
  slots: SentenceSlot[];
  difficulty: 1 | 2 | 3;
}

export interface SentenceSlot {
  position: number;
  type: 'noun' | 'verb' | 'adjective' | 'place' | 'person' | 'food' | 'object';
  category?: string; // maps to word categories
}

export interface MessengerTurn {
  turn_number: number;
  sender_id: string;
  template_id: string;
  filled_sentence: string;
  filled_words: { position: number; word_id: string; kashmiri: string; english: string }[];
  trap_position: number; // which slot has the trap
  trap_word: { word_id: string; kashmiri: string; english: string }; // the fake word
  correct_word: { word_id: string; kashmiri: string; english: string }; // what should be there
  responder_translation?: string;
  responder_trap_guess?: number;
  responder_correct_word?: string;
  points_earned?: number;
}

export interface PlayerWordProgress {
  player_id: string;
  word_id: string;
  times_seen: number;
  times_correct: number;
  last_seen: string;
  mastery_level: number; // 0-5
}
