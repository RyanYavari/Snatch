import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Request, RequestStatus } from '@/lib/models/Request';

/**
 * POST /api/quick-pay
 * Payment endpoint using x402 protocol (Coinbase CDP integration)
 * 
 * Input: { amount_usdc: number, offer_id: string, buyer_wallet: string, seller_wallet: string }
 * Output: { success: boolean, tx_hash?: string, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { amount_usdc, offer_id, buyer_wallet, seller_wallet } = body;

    // Validate input
    if (!amount_usdc || !offer_id || !buyer_wallet || !seller_wallet) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: amount_usdc, offer_id, buyer_wallet, seller_wallet',
        },
        { status: 400 }
      );
    }

    // Find request by offer_id (stored in negotiation_history or offer_id field)
    const requestDoc = await Request.findOne({
      $or: [
        { offer_id },
        { 'negotiation_history.offer_id': offer_id },
      ],
    });

    if (!requestDoc) {
      return NextResponse.json(
        {
          success: false,
          message: `Request with offer_id ${offer_id} not found`,
        },
        { status: 404 }
      );
    }

    // Verify request is in AGREED status
    if (requestDoc.status !== RequestStatus.AGREED) {
      return NextResponse.json(
        {
          success: false,
          message: `Request is not in AGREED status. Current status: ${requestDoc.status}`,
        },
        { status: 400 }
      );
    }

    // TODO: Integrate Coinbase CDP SDK for x402 protocol
    // For now, simulate payment processing
    // In production, this would:
    // 1. Use Coinbase CDP SDK to create payment
    // 2. Execute x402 protocol transfer
    // 3. Get transaction hash from blockchain
    
    // Simulated transaction hash (replace with actual x402 implementation)
    const tx_hash = `0x${Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    // Update request with payment details
    requestDoc.status = RequestStatus.PAID;
    requestDoc.tx_hash = tx_hash;
    requestDoc.offer_id = offer_id;
    requestDoc.buyer_wallet = buyer_wallet;
    await requestDoc.save();

    return NextResponse.json({
      success: true,
      tx_hash,
      message: `Payment processed successfully. Transaction: ${tx_hash}`,
    });
  } catch (error: any) {
    console.error('Payment processing error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error processing payment: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quick-pay
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'quick-pay',
    status: 'ready',
    description: 'x402 payment processing endpoint',
    note: 'Coinbase CDP SDK integration pending',
  });
}
