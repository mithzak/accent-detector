
export interface Analysis {
  name: string;
  confidence: number;
}

export interface AnalysisResult {
  language: Analysis;
  accent: Analysis;
}

export type RecordingState = 'idle' | 'recording' | 'processing' | 'result' | 'error';
