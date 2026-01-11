import { NextRequest, NextResponse } from 'next/server';
import { NegotiatorAgent } from '@/lib/agents/negotiator';

/**
 * POST /api/agents/negotiator
 * Trigger Negotiator agent to process FOUND requests
 */
export async function POST(request: NextRequest) {
  try {
    const negotiator = new NegotiatorAgent();

    // Process pending requests
    await negotiator.pollAndProcess();

    return NextResponse.json({
      success: true,
      message: 'Negotiator agent processed requests',
    });
  } catch (error: any) {
    console.error('Negotiator agent error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process negotiator requests',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/negotiator
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    agent: 'negotiator',
    status: 'ready',
    description: 'Negotiator agent for AI-powered negotiation with 3-round limit',
  });
}
