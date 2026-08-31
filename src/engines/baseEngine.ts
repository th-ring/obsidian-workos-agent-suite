export interface EngineResponse {
  content: string;
  success: boolean;
  error?: string;
}

export interface WorkOSEngine {
  name: string;
  runPrompt(prompt: string, systemPrompt?: string): Promise<EngineResponse>;
}
