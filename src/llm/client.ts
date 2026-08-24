import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { AgentBrain, LLMMessage, LLMCompletionResult } from './types.js';
import { AgentToolDefinition } from '../agent/types.js';

dotenv.config();

/**
 * Google Gemini Brain Implementation (Powered by Gemini 2.0 Flash / 1.5 Flash)
 */
export class GeminiBrain implements AgentBrain {
  public provider: 'gemini' = 'gemini';
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey?: string, model: string = 'gemini-1.5-flash') {
    const key = apiKey || process.env.GEMINI_API_KEY || '';
    this.ai = new GoogleGenAI({ apiKey: key });
    this.model = model;
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools: AgentToolDefinition[],
    options?: { systemPrompt?: string }
  ): Promise<LLMCompletionResult> {
    try {
      // Format tools for Gemini functionDeclarations
      const functionDeclarations = tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT' as const,
          properties: t.parameters.properties,
          required: t.parameters.required || []
        }
      }));

      // Format messages into Gemini contents structure
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: contents as any,
        config: {
          systemInstruction: options?.systemPrompt || 'You are an AI Shopping Assistant connected to a Razorpay checkout backend.',
          tools: [{ functionDeclarations: functionDeclarations as any }]
        }
      });

      const functionCalls = response.functionCalls;
      const toolCalls: any[] = [];

      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: fc.name,
            arguments: fc.args || {}
          });
        }
      }

      return {
        text: response.text || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
    } catch (err: any) {
      console.warn(`[GEMINI API NOTICE] ${err.message}. Falling back to deterministic ReAct reasoning.`);
      // Graceful fallback if rate-limited or key invalid
      const fallbackBrain = new MockBrain();
      return fallbackBrain.generateCompletion(messages, tools, options);
    }
  }
}

/**
 * Deterministic Mock Brain (Used for offline CI/CD test suites & instant zero-cost demo)
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

  // In test environments (Vitest), always use MockBrain for fast, deterministic, offline execution
  if (process.env.NODE_ENV !== 'test' && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    activeBrain = new GeminiBrain();
  } else {
    activeBrain = new MockBrain();
  }

  return activeBrain;
}

export function setAgentBrain(brain: AgentBrain): void {
  activeBrain = brain;
}
