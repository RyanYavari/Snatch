import { generateText, tool } from 'ai';
import connectDB from '@/lib/mongodb';
import { Request, RequestStatus } from '@/lib/models/Request';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const FIREWORKS_API_BASE_URL = process.env.FIREWORKS_API_BASE_URL || 'https://api.fireworks.ai/inference/v1';

if (!FIREWORKS_API_KEY) {
  throw new Error('FIREWORKS_API_KEY environment variable is required');
}

export class NegotiatorAgent {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = FIREWORKS_API_KEY;
    this.baseUrl = FIREWORKS_API_BASE_URL;
  }

  /**
   * Process a FOUND request: negotiate with seller
   */
  async processFoundRequest(requestId: string): Promise<void> {
    await connectDB();

    const request = await Request.findById(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    if (request.status !== RequestStatus.FOUND) {
      console.log(`Request ${requestId} is not FOUND, skipping`);
      return;
    }

    if (!request.found_item) {
      throw new Error(`Request ${requestId} has no found_item`);
    }

    try {
      console.log(`Negotiator: Processing FOUND request ${requestId}`);

      // Update status to NEGOTIATING
      request.status = RequestStatus.NEGOTIATING;
      request.negotiation_rounds = 0;
      await request.save();

      const foundItem = request.found_item;
      const budget = request.budget;
      // New schema: use price field, minimum acceptable is 80% of price
      const listedPrice = foundItem.price || 0;
      const minimumPrice = listedPrice * 0.8;

      // Create tools
      const sendOfferToSeller = tool({
        description: 'Send an offer to the seller agent. Returns accept/decline response.',
        parameters: {
          type: 'object',
          properties: {
            item_id: {
              type: 'string',
              description: 'The item ID to make an offer for',
            },
            offer_amount: {
              type: 'number',
              description: 'The offer amount in USDC',
            },
          },
          required: ['item_id', 'offer_amount'],
        },
        execute: async ({ item_id, offer_amount }) => {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const response = await fetch(`${baseUrl}/api/seller`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ item_id, offer_amount }),
            });

            const result = await response.json();
            
            // Log to negotiation_history
            request.negotiation_history.push({
              role: 'negotiator',
              content: `Offered $${offer_amount} for item ${item_id}`,
              offer: offer_amount,
              timestamp: new Date(),
            });

            if (result.accepted) {
              request.negotiation_history.push({
                role: 'seller',
                content: result.message,
                offer: result.accepted_amount,
                timestamp: new Date(),
              });
            } else {
              request.negotiation_history.push({
                role: 'seller',
                content: result.message,
                offer: null,
                timestamp: new Date(),
              });
            }

            await request.save();
            return result;
          } catch (error: any) {
            return {
              accepted: false,
              message: `Error calling seller API: ${error.message}`,
            };
          }
        },
      });

      const processPayment = tool({
        description: 'Process payment using x402 protocol. Call this when seller accepts an offer.',
        parameters: {
          type: 'object',
          properties: {
            offer_id: {
              type: 'string',
              description: 'The offer ID from accepted seller response',
            },
            amount_usdc: {
              type: 'number',
              description: 'The payment amount in USDC',
            },
            buyer_wallet: {
              type: 'string',
              description: 'The buyer wallet address',
            },
            seller_wallet: {
              type: 'string',
              description: 'The seller wallet address from accepted offer',
            },
          },
          required: ['offer_id', 'amount_usdc', 'buyer_wallet', 'seller_wallet'],
        },
        execute: async ({ offer_id, amount_usdc, buyer_wallet, seller_wallet }) => {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const response = await fetch(`${baseUrl}/api/quick-pay`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                offer_id,
                amount_usdc,
                buyer_wallet,
                seller_wallet,
              }),
            });

            const result = await response.json();
            
            if (result.success) {
              request.status = RequestStatus.PAID;
              request.tx_hash = result.tx_hash;
              await request.save();
            }
            
            return result;
          } catch (error: any) {
            return {
              success: false,
              message: `Error processing payment: ${error.message}`,
            };
          }
        },
      });

      const setRetryStatus = tool({
        description: 'Set request status to RETRY_SEARCH when seller rejects after 3 rounds. Call this when you have exhausted all 3 negotiation rounds.',
        parameters: {
          type: 'object',
          properties: {
            feedback: {
              type: 'string',
              description: 'Feedback message explaining why negotiation failed',
            },
          },
          required: ['feedback'],
        },
        execute: async ({ feedback }) => {
          try {
            request.status = RequestStatus.RETRY_SEARCH;
            request.retry_feedback = feedback;
            request.negotiation_rounds = 0; // Reset for next attempt
            await request.save();

            return {
              success: true,
              message: `Request set to RETRY_SEARCH. Scout will find next alternative item.`,
            };
          } catch (error: any) {
            return {
              success: false,
              message: `Error setting retry status: ${error.message}`,
            };
          }
        },
      });

      // System prompt for negotiation agent
      const systemPrompt = `You are a negotiation agent. You have exactly 3 rounds to negotiate with the seller.
Your goal is to get the seller to accept an offer within the buyer's budget of $${budget}.

Item Details:
- Item ID: ${foundItem.id}
- Size: ${foundItem.size}
- Listed Price: $${listedPrice}
- Minimum Acceptable Price: $${minimumPrice.toFixed(2)}
- Seller Wallet: ${foundItem.seller_wallet}

Rules:
- You can make strategic offers based on the minimum price ($${minimumPrice.toFixed(2)}) and buyer's budget ($${budget})
- Track your negotiation rounds (you have 3 total)
- If seller rejects after 3 rounds, call setRetryStatus() with feedback explaining why negotiation failed
- If seller accepts, call processPayment() immediately with the offer_id and seller_wallet from the response
- Log all interactions to negotiation_history
- Be strategic: start with a reasonable offer, adjust based on seller responses
- Remember: offer_amount must be >= minimum_price ($${minimumPrice})`;

      // Run negotiation loop (max 3 rounds)
      const maxRounds = 3;
      let negotiationRound = 0;
      let messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        {
          role: 'user',
          content: `Start negotiating for item ${foundItem.id}. Budget: $${budget}, Minimum: $${minimumPrice.toFixed(2)}. You have ${maxRounds} rounds.`,
        },
      ];

      while (negotiationRound < maxRounds) {
        negotiationRound++;
        request.negotiation_rounds = negotiationRound;
        await request.save();

        console.log(`Negotiator: Round ${negotiationRound}/${maxRounds} for request ${requestId}`);

        try {
          const result = await generateText({
            model: {
              provider: 'openai',
              modelId: 'firefunction-v1',
              apiKey: this.apiKey,
              baseURL: this.baseUrl,
            } as any, // Fireworks AI uses OpenAI-compatible API
            tools: {
              sendOfferToSeller,
              processPayment,
              setRetryStatus,
            },
            system: systemPrompt,
            messages,
            maxSteps: 5, // Allow multiple tool calls per round
          });

          // Add assistant response to messages
          messages.push({
            role: 'assistant',
            content: result.text,
          });

          // Check if payment was processed (success)
          if (request.status === RequestStatus.PAID) {
            console.log(`Negotiator: Payment processed successfully for request ${requestId}`);
            return;
          }

          // Check if retry status was set (failure after 3 rounds)
          if (request.status === RequestStatus.RETRY_SEARCH) {
            console.log(`Negotiator: Set retry status for request ${requestId}`);
            return;
          }

          // Check if seller accepted (status should be AGREED)
          if (request.status === RequestStatus.AGREED) {
            // Process payment
            const offerId = request.offer_id;
            if (offerId && foundItem.seller_wallet) {
              const paymentResult = await processPayment.execute({
                offer_id: offerId,
                amount_usdc: request.negotiation_history[request.negotiation_history.length - 1].offer || minimumPrice,
                buyer_wallet: request.buyer_wallet || '0x0000000000000000000000000000000000000000',
                seller_wallet: foundItem.seller_wallet,
              });

              if (paymentResult.success) {
                console.log(`Negotiator: Payment processed successfully!`);
                return;
              }
            }
          }

          // If we're at max rounds and haven't succeeded, set retry status
          if (negotiationRound >= maxRounds && request.status === RequestStatus.NEGOTIATING) {
            await setRetryStatus.execute({
              feedback: `Negotiation failed after ${maxRounds} rounds. Seller rejected all offers.`,
            });
            return;
          }

          // Add user message for next round
          if (negotiationRound < maxRounds) {
            messages.push({
              role: 'user',
              content: `Continue negotiating. Round ${negotiationRound + 1} of ${maxRounds}.`,
            });
          }
        } catch (error: any) {
          console.error(`Error in negotiation round ${negotiationRound}:`, error);
          // Continue to next round or set retry status
          if (negotiationRound >= maxRounds) {
            await setRetryStatus.execute({
              feedback: `Negotiation error: ${error.message}`,
            });
            return;
          }
        }
      }
    } catch (error) {
      console.error(`Error processing FOUND request ${requestId}:`, error);
      request.status = RequestStatus.FAILED;
      request.retry_feedback = `Negotiator error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await request.save();
      throw error;
    }
  }

  /**
   * Poll for FOUND status requests and process them
   */
  async pollAndProcess(): Promise<void> {
    await connectDB();

    try {
      // Find requests with FOUND status
      const requests = await Request.find({
        status: RequestStatus.FOUND,
      }).limit(5); // Process up to 5 at a time

      console.log(`Negotiator: Found ${requests.length} requests to process`);

      for (const request of requests) {
        try {
          await this.processFoundRequest(request._id.toString());
        } catch (error) {
          console.error(`Error processing request ${request._id}:`, error);
          // Continue processing other requests
        }
      }
    } catch (error) {
      console.error('Error in pollAndProcess:', error);
      throw error;
    }
  }
}
