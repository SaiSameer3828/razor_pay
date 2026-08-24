export interface CreateOrderParams {
  amountInPaise: number;
  currency?: string; // Default: 'INR'
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string; // e.g. 'order_DBJOWzybf0sJbb'
  entity: string; // 'order'
  amount: number; // in paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  notes?: Record<string, string>;
  created_at: number;
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}

export interface VerificationResult {
  isValid: boolean;
  orderId: string;
  paymentId: string;
  verifiedAt: string;
  error?: string;
}
