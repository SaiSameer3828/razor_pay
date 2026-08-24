import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRazorpayOrder } from './razorpay/orderService.js';
import { verifyRazorpaySignature, generateTestSignature } from './razorpay/verifyPayment.js';
import { RAZORPAY_KEY_ID, isUsingMockKeys } from './razorpay/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'conversational-razorpay-shopping-assistant',
      isUsingMockKeys,
      timestamp: new Date().toISOString()
    });
  });

  // Public Configuration (Provides Razorpay key_id to client SDK)
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({
      razorpayKeyId: RAZORPAY_KEY_ID,
      isUsingMockKeys
    });
  });

  // 1. Isolated Order Creation Endpoint
  app.post('/api/payment/create-order', async (req: Request, res: Response): Promise<void> => {
    try {
      const { amountInRupees, amountInPaise, description } = req.body;

      // Ensure amount is integer paise
      const finalAmountInPaise = amountInPaise || (amountInRupees ? Math.round(amountInRupees * 100) : 50000); // default ₹500
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
      res.status(400).json({
        success: false,
        error: (err as Error).message
      });
    }
  });

  // 2. Isolated Payment Signature Verification Endpoint
  app.post('/api/payment/verify', (req: Request, res: Response): Promise<void> => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      const verification = verifyRazorpaySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      });

      if (verification.isValid) {
        res.status(200).json({
          success: true,
          message: 'Payment verified successfully by server-side HMAC-SHA256 signature.',
          data: verification
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Payment signature verification failed.',
          error: verification.error
        });
      }
    } catch (err) {
      res.status(500).json({
        success: false,
        error: (err as Error).message
      });
    }
  });

  // 3. Helper for local testing: generate simulated successful payment payload
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
    console.log(`\n🚀 Razorpay Isolated Test Server running on http://localhost:${PORT}`);
    console.log(`💳 Open http://localhost:${PORT}/checkout-demo.html to test payment modal.\n`);
  });
}
