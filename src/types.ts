// Core types for chesshacker pipeline

export interface SquareChange {
  square: string; // e.g., "e2", "e4"
  now: string;    // piece or empty: "wP", "bN", ""
}

export interface VisionResponse {
  changes: SquareChange[];
  confidence?: number;
  timestamp: number;
}

export interface Frame {
  path: string;
  timestamp: number;
  isBlurry: boolean;
  hasHands: boolean;
  boardUnchanged: boolean;
}

export interface Move {
  from: string;
  to: string;
  promotion?: string;
  san: string;      // Standard Algebraic Notation: "Nf3", "e4"
  uci: string;      // Universal Chess Interface: "e2e4"
  fen: string;      // Position after move
}

export interface EngineAnalysis {
  bestMove: string; // UCI format
  evaluation: number; // centipawns
  depth: number;
  time: number;     // milliseconds
}

export interface GameState {
  fen: string;
  pgn: string;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isCheck: boolean;
  turn: 'w' | 'b';
  moveHistory: Move[];
}

export interface Config {
  color: 'white' | 'black';
  maxCost: number;
  visionModel: 'openai' | 'claude';
  stockfishThinkTime: number; // milliseconds
  screenshotInterval: number; // milliseconds
  portNumber: number;
}

export interface KeychainCredentials {
  openaiApiKey?: string;
  claudeApiKey?: string;
  jevKey?: string;
}

export type PipelineStage =
  | 'screenshot'
  | 'jev-gate'
  | 'vision'
  | 'validation'
  | 'game-state'
  | 'engine'
  | 'speech';

export interface PipelineEvent {
  stage: PipelineStage;
  timestamp: number;
  data: unknown;
  error?: Error;
}
