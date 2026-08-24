import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createOrderFromCart, getOrderById, updateOrderStatus } from './orders/orderManager.js';
import { runAgentTurn } from './agent/agentLoop.js';
import { createRazorpayOrder } from './razorpay/orderService.js';
import { verifyRazorpaySignature, generateTestSignature } from './razorpay/verifyPayment.js';
import { verifyWebhookSignature, processWebhookEvent, RazorpayWebhookPayload } from './razorpay/webhookService.js';
import { RAZORPAY_KEY_ID, isUsingMockKeys } from './razorpay/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(cors());

  // Webhook route MUST receive exact raw buffer before any JSON parsing
  app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), (req: Request, res: Response): void => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (!signature) {
      res.status(400).json({ success: false, message: 'Missing X-Razorpay-Signature header' });
      return;
    }

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('⚠️ [WEBHOOK REJECTED] Invalid X-Razorpay-Signature received.');
      res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      return;
    }

    try {
      const eventPayload = JSON.parse(rawBody) as RazorpayWebhookPayload;
      const result = processWebhookEvent(eventPayload);

      console.log(`🔔 [WEBHOOK PROCESSED] Event: ${result.event} | Status: ${result.statusUpdatedTo || 'OK'} | Order: ${result.orderId || result.razorpayOrderId}`);
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // Standard JSON body parser for all other application routes
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // ==========================================
  // DAY 4: CONVERSATIONAL AGENT CHAT ENDPOINT
  // ==========================================
  app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
    try {
      const { message, sessionId = 'default_session_user' } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ success: false, error: 'Valid message string is required.' });
        return;
      }

      const response = await runAgentTurn(sessionId, message);
      res.status(200).json({
        success: true,
        ...response
      });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // Mode & Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'conversational-razorpay-shopping-assistant',
      environment: isUsingMockKeys ? 'MOCK_SANDBOX' : 'LIVE_RAZORPAY_TEST_MODE',
      isUsingMockKeys,
      timestamp: new Date().toISOString()
    });
  });

  // Public Configuration
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({
      razorpayKeyId: RAZORPAY_KEY_ID,
      environment: isUsingMockKeys ? 'MOCK_SANDBOX' : 'LIVE_RAZORPAY_TEST_MODE',
      isUsingMockKeys
    });
  });

  // ==========================================
  // DAY 3: CART -> RAZORPAY CHECKOUT ENDPOINT
  // ==========================================
  app.post('/api/cart/checkout', async (req: Request, res: Response): Promise<void> => {
    try {
      const { cartId, userId, customerDetails } = req.body;

      if (!cartId) {
        res.status(400).json({ success: false, error: 'cartId is required' });
        return;
      }

      const checkoutResult = await createOrderFromCart(cartId, { userId, customerDetails });

      if (!checkoutResult.success) {
        res.status(400).json(checkoutResult);
        return;
      }

      res.status(200).json(checkoutResult);
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });



  // Client-Side Payment Verification (Handles immediate UX feedback)
  app.post('/api/payment/verify', (req: Request, res: Response): Promise<void> => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      const verification = verifyRazorpaySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      });

      if (verification.isValid) {
        // Mark internal order as captured
        updateOrderStatus(razorpay_order_id, 'captured', {
          paymentId: razorpay_payment_id,
          signature: razorpay_signature
        });

        res.status(200).json({
          success: true,
          message: 'Payment verified successfully by server-side HMAC-SHA256 signature.',
          data: verification
        });
      } else {
        updateOrderStatus(razorpay_order_id, 'failed', {
          paymentId: razorpay_payment_id,
          failureReason: 'Signature mismatch'
        });

        res.status(400).json({
          success: false,
          message: 'Payment signature verification failed.',
          error: verification.error
        });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // Fetch Order by Internal Order ID
  app.get('/api/orders/:orderId', (req: Request, res: Response): Promise<void> => {
    const order = getOrderById(req.params.orderId);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    res.json({ success: true, order });
  });

  // Isolated Order Creation (For sandbox testing)
  app.post('/api/payment/create-order', async (req: Request, res: Response): Promise<void> => {
    try {
      const { amountInRupees, amountInPaise, description } = req.body;
      const finalAmountInPaise = amountInPaise || (amountInRupees ? Math.round(amountInRupees * 100) : 50000);
      const receipt = `rcpt_${Date.now().toString().slice(-8)}`;

      const order = await createRazorpayOrder({
        amountInPaise: finalAmountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          description: description || 'Isolated Test Payment',
          environment: isUsingMockKeys ? 'sandbox-simulated' : 'razorpay-test-mode'
        }
      });

      res.status(200).json({
        success: true,
        order,
        keyId: RAZORPAY_KEY_ID,
        isUsingMockKeys
      });
    } catch (err) {
      res.status(400).json({ success: false, error: (err as Error).message });
    }
  });

  // Mock Complete (Local testing simulator)
  app.post('/api/payment/mock-complete', (req: Request, res: Response): Promise<void> => {
    const { orderId } = req.body;
    const paymentId = `pay_${Math.random().toString(36).substring(2, 14)}`;
    const signature = generateTestSignature(orderId, paymentId);

    res.json({
      success: true,
      simulatedPayload: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      }
    });
  });

  return app;
}

// Start standalone server when executed directly
if (process.argv[1] && process.argv[1].includes('server')) {
  const PORT = process.env.PORT || 3000;
  const app = createApp();
  app.listen(PORT, () => {
    console.log('='.repeat(70));
    console.log(`🚀 Razorpay Shopping Backend Server running on http://localhost:${PORT}`);
    if (isUsingMockKeys) {
      console.log('⚠️  MODE: LOCAL SANDBOX MOCK (Set RAZORPAY_KEY_ID in .env for Live Test Mode)');
    } else {
      console.log(`✅ MODE: LIVE RAZORPAY TEST MODE (Key: ${RAZORPAY_KEY_ID})`);
    }
    console.log(`💳 Open http://localhost:${PORT}/checkout-demo.html to test payment modal.`);
    console.log('='.repeat(70) + '\n');
  });
}
