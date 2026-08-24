import { AgentToolDefinition } from '../agent/types.js';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LLMCompletionResult {
  text?: string;
  thought?: string;
  toolCalls?: LLMToolCall[];
}

export interface AgentBrain {
  provider: 'anthropic' | 'openai' | 'mock';
  generateCompletion(
    messages: LLMMessage[],
    tools: AgentToolDefinition[],
    options?: { systemPrompt?: string }
  ): Promise<LLMCompletionResult>;
}
