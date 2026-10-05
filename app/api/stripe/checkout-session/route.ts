export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response';
const logger = require("@/lib/logger-winston");

const env = (typeof globalThis !== "undefined" && (globalThis as any).process && (globalThis as any).process.env)
  ? (globalThis as any).process.env
  : ({} as Record<string, string | undefined>);

// As chaves são validadas e usadas dentro do handler (evita erro no momento de build do Next.js)

export async function POST(req: NextRequest) {
  try {
    if (!env.STRIPE_SECRET_KEY && !env.SECRET_STRIPE_KEY) {
      logger.error("Stripe not configured - missing secret key");
      return errorResponse('Stripe not configured', 501);
    }

    // Receber dados do produto via body
    const stripe = new Stripe(env.STRIPE_SECRET_KEY || env.SECRET_STRIPE_KEY || '');
    const body = await req.json().catch(() => ({}));
    const { productName, amount } = body;

    logger.info("Stripe checkout session request", { productName, amount });

    // Validação de amount se fornecido
    if (amount !== undefined) {
      const amountNum = Number(amount);
      if (isNaN(amountNum) || amountNum < 0) {
        logger.warn("Invalid amount provided", { amount });
        return validationErrorResponse({
          amount: ['Amount must be a positive number'],
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'BRL',
            product_data: {
              name: productName || 'Valor pagamento',
            },
            unit_amount: amount ? Math.round(amount * 100) : 2000, // Converter para centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${(env.FRONTEND_URL || 'https://bio-dash-front-theta.vercel.app/')}/dashboard`,
      cancel_url: `${env.FRONTEND_URL || 'https://bio-dash-front-theta.vercel.app/'}`,
    });

    if (!session.url) {
      logger.error("Stripe session created but no URL returned");
      return errorResponse('Failed to create checkout session', 500);
    }

    logger.info("Stripe checkout session created successfully", { sessionId: session.id });

    return successResponse({ url: session.url }, 'Checkout session created successfully');
  } catch (error: any) {
    logger.error("Stripe checkout session error", { error: error.message, stack: error.stack });
    console.error('Stripe checkout session error:', error);
    if (error instanceof SyntaxError) {
      return errorResponse('Invalid request body', 400);
    }
    return errorResponse(error.message || 'Failed to process payment', 500);
  }
}


