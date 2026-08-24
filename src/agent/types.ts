import { CartSummary } from '../cart/types.js';

export interface AgentToolParamProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, AgentToolParamProperty>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: any;
  isError?: boolean;
}

export interface AgentThoughtStep {
  stepIndex: number;
  thought: string;
  action?: {
    tool: string;
    args: Record<string, any>;
  };
  observation?: any;
}

export interface AgentResponse {
  sessionId: string;
  turnIndex: number;
  userMessage: string;
  assistantReply: string;
  thoughtProcess: AgentThoughtStep[];
  cartSummary: CartSummary;
  paymentOrder?: {
    orderId: string;
    razorpayOrderId?: string;
    amountInRupees: number;
    amountInPaise: number;
  };
}
