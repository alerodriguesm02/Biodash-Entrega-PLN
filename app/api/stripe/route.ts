import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  successResponse,
  errorResponse,
} from '@/lib/api-response';

const env = (typeof globalThis !== "undefined" && (globalThis as any).process && (globalThis as any).process.env)
  ? (globalThis as any).process.env
  : ({} as Record<string, string | undefined>);

export async function POST(req: NextRequest) {
  try {
    if (!env.STRIPE_SECRET_KEY && !env.SECRET_STRIPE_KEY) {
      return errorResponse('Stripe not configured', 501);
    }
    
    const stripe = new Stripe(env.STRIPE_SECRET_KEY || env.SECRET_STRIPE_KEY || '');

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'BRL',
            product_data: { name: 'Valor pagamento' },
            unit_amount: 2000,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${env.FRONTEND_URL || 'https://bio-dash-front-theta.vercel.app/'}`,
      cancel_url: `${env.FRONTEND_URL || 'https://bio-dash-front-theta.vercel.app/'}`,
    });

    if (!session.url) {
      return errorResponse('Failed to create checkout session', 500);
    }

    return successResponse({ url: session.url }, 'Checkout session created successfully');
  } catch (error: any) {
    console.error('Stripe error:', error);
    return errorResponse(error.message || 'Failed to process payment', 500);
  }
}


