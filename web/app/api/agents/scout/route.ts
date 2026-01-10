import { NextRequest, NextResponse } from 'next/server';
import { ScoutAgent } from '@/lib/agents/scout';

/**
 * POST /api/agents/scout
 * Trigger Scout agent to process NEW or RETRY_SEARCH requests
 */
export async function POST(request: NextRequest) {
  try {
    const scout = new ScoutAgent();

    // Process pending requests
    await scout.pollAndProcess();

    // Cleanup
    await scout.disconnect();

    return NextResponse.json({
      success: true,
      message: 'Scout agent processed requests',
    });
  } catch (error: any) {
    console.error('Scout agent error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process scout requests',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/scout
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    agent: 'scout',
    status: 'ready',
    description: 'Scout agent for vision RAG and vector search',
  });
}
