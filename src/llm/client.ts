import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { AgentBrain, LLMMessage, LLMCompletionResult } from './types.js';
import { AgentToolDefinition } from '../agent/types.js';

dotenv.config();

/**
 * Anthropic Claude Brain Implementation
 */
export class AnthropicBrain implements AgentBrain {
  public provider: 'anthropic' = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(apiKey?: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
    this.model = model;
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools: AgentToolDefinition[],
    options?: { systemPrompt?: string }
  ): Promise<LLMCompletionResult> {
    const formattedTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        properties: t.parameters.properties,
        required: t.parameters.required || []
      }
    }));

    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: options?.systemPrompt || 'You are an AI Shopping Assistant with strict catalog grounding and financial safety guardrails.',
      messages: anthropicMessages,
      tools: formattedTools
    });

    let textContent = '';
    const toolCalls: any[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, any>
        });
      }
    }

    return {
      text: textContent || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }
}

/**
 * OpenAI Brain Implementation
 */
export class OpenAIBrain implements AgentBrain {
  public provider: 'openai' = 'openai';
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4o') {
    this.client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
    this.model = model;
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools: AgentToolDefinition[],
    options?: { systemPrompt?: string }
  ): Promise<LLMCompletionResult> {
    const formattedTools = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: t.parameters.properties,
          required: t.parameters.required || []
        }
      }
    }));

    const openAiMessages = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    if (options?.systemPrompt && !openAiMessages.some(m => m.role === 'system')) {
      openAiMessages.unshift({ role: 'system', content: options.systemPrompt });
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openAiMessages as any,
      tools: formattedTools.length > 0 ? formattedTools : undefined
    });

    const choice = response.choices[0]?.message;
    const toolCalls = choice?.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}')
    }));

    return {
      text: choice?.content || undefined,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined
    };
  }
}

/**
 * Mock Brain (Deterministic conversational ReAct model for offline test suites)
 */
export class MockBrain implements AgentBrain {
  public provider: 'mock' = 'mock';

  async generateCompletion(
    messages: LLMMessage[],
    _tools: AgentToolDefinition[],
    _options?: { systemPrompt?: string }
  ): Promise<LLMCompletionResult> {
    const lastMsg = messages[messages.length - 1]?.content.toLowerCase().trim() || '';

    // Handle checkout intent
    if (lastMsg.includes('checkout') || lastMsg.includes('place order')) {
      return {
        thought: 'User wants to checkout. Invoking present_order_summary_for_review.',
        toolCalls: [{ id: 'call_mock_chk', name: 'present_order_summary_for_review', arguments: {} }]
      };
    }

    // Handle explicit confirmation intent
    if (lastMsg === 'yes confirm' || lastMsg === 'confirm' || lastMsg === 'yes, confirm') {
      return {
        thought: 'User provided confirmation. Invoking initiate_payment.',
        toolCalls: [{ id: 'call_mock_pay', name: 'initiate_payment', arguments: { customer_name: 'Customer' } }]
      };
    }

    // Handle view cart
    if (lastMsg.includes('cart') && (lastMsg.includes('show') || lastMsg.includes('view') || lastMsg === 'cart')) {
      return {
        thought: 'User wants to view cart summary. Invoking get_cart_summary.',
        toolCalls: [{ id: 'call_mock_cart', name: 'get_cart_summary', arguments: {} }]
      };
    }

    // Handle coupon
    if (lastMsg.includes('coupon') || lastMsg.includes('welcome10') || lastMsg.includes('flat500')) {
      const code = lastMsg.includes('flat500') ? 'FLAT500' : 'WELCOME10';
      return {
        thought: `User wants to apply coupon ${code}.`,
        toolCalls: [{ id: 'call_mock_cpn', name: 'apply_coupon', arguments: { coupon_code: code } }]
      };
    }

    // Handle item addition
    if (lastMsg.includes('add') || lastMsg.includes('buy')) {
      return {
        thought: 'User wants to add an item. Searching catalog first.',
        toolCalls: [{ id: 'call_mock_srch', name: 'search_catalog', arguments: { query: 'shirt' } }]
      };
    }

    return {
      text: "I am your AI Shopping Assistant. How can I help you find clothes, accessories, or checkout today?"
    };
  }
}

/**
 * Factory to return the active AgentBrain
 */
let activeBrain: AgentBrain | null = null;

export function getAgentBrain(): AgentBrain {
  if (activeBrain) return activeBrain;

  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'placeholder_key') {
    activeBrain = new AnthropicBrain();
  } else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'placeholder_key') {
    activeBrain = new OpenAIBrain();
  } else {
    activeBrain = new MockBrain();
  }

  return activeBrain;
}

export function setAgentBrain(brain: AgentBrain): void {
  activeBrain = brain;
}
