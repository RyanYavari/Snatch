import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { InventoryItem } from '@/lib/models/Inventory';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/seller
 * Seller Agent API Route - Simulates seller decision-making with 50/50 randomizer
 * 
 * Input: { item_id: string, offer_amount: number }
 * Output: { accepted: boolean, offer_id?: string, seller_wallet?: string, ... }
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { item_id, offer_amount } = body;

    // Validate input
    if (!item_id || typeof offer_amount !== 'number') {
      return NextResponse.json(
        {
          accepted: false,
          offer_id: null,
          item: item_id || 'unknown',
          offered_amount: offer_amount,
          accepted_amount: null,
          counter_offer: null,
          message: 'Invalid request: item_id and offer_amount are required',
        },
        { status: 400 }
      );
    }

    // Fetch item from inventory using 'id' field (new schema)
    const item = await InventoryItem.findOne({ id: item_id });
    if (!item) {
      return NextResponse.json(
        {
          accepted: false,
          offer_id: null,
          item: item_id,
          offered_amount: offer_amount,
          accepted_amount: null,
          counter_offer: null,
          message: `Item ${item_id} not found in inventory`,
        },
        { status: 404 }
      );
    }

    // Calculate minimum acceptable price (80% of listed price)
    const minimum_price = item.price * 0.8;

    // Verify offer_amount >= minimum_price
    if (offer_amount < minimum_price) {
      return NextResponse.json(
        {
          accepted: false,
          offer_id: null,
          item: item_id,
          offered_amount: offer_amount,
          accepted_amount: null,
          counter_offer: minimum_price,
          message: `Offer $${offer_amount} is below minimum acceptable price $${minimum_price.toFixed(2)}. Try again!`,
        },
        { status: 400 }
      );
    }

    // 50/50 randomizer
    const accepted = Math.random() > 0.5;

    if (accepted) {
      // Generate offer_id (UUID)
      const offer_id = uuidv4();

      return NextResponse.json({
        accepted: true,
        offer_id,
        item: item_id,
        offered_amount: offer_amount,
        accepted_amount: offer_amount,
        seller_wallet: item.SELLER_WALLET_ADDRESS,
        counter_offer: null,
        message: `Offer accepted! Use offer_id '${offer_id}' with seller_wallet '${item.SELLER_WALLET_ADDRESS}' to complete payment.`,
      });
    } else {
      return NextResponse.json({
        accepted: false,
        offer_id: null,
        item: item_id,
        offered_amount: offer_amount,
        accepted_amount: null,
        counter_offer: null,
        message: 'Offer declined. Try again!',
      });
    }
  } catch (error: any) {
    console.error('Seller agent error:', error);
    return NextResponse.json(
      {
        accepted: false,
        offer_id: null,
        item: 'unknown',
        offered_amount: 0,
        accepted_amount: null,
        counter_offer: null,
        message: `Error processing offer: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seller
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    agent: 'seller',
    status: 'ready',
    description: 'Seller agent with 50/50 randomizer for offer acceptance',
  });
}
