import mongoose, { Schema, Document, Model } from 'mongoose';

export enum RequestStatus {
  NEW = 'NEW',
  FOUND = 'FOUND',
  NEGOTIATING = 'NEGOTIATING',
  RETRY_SEARCH = 'RETRY_SEARCH',
  AGREED = 'AGREED',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

export interface NegotiationHistoryEntry {
  role: 'negotiator' | 'seller';
  content: string;
  offer: number;
  timestamp: Date;
}

export interface TargetItem {
  description?: string;
  image_url: string;
  embedding: number[]; // 1024-dim from Voyage
}

export interface FoundItem {
  item_id: string;
  name: string;
  selling_price: number;
  price?: number; // Legacy field, use selling_price
  minimum_price?: number;
  seller?: string;
  seller_wallet: string;
  description?: string;
  url?: string;
  [key: string]: any;
}

export interface IRequest extends Document {
  status: RequestStatus;
  budget: number;
  target_item: TargetItem;
  found_item?: FoundItem;
  alternatives: FoundItem[]; // Top 5 matches from vector search
  negotiation_history: NegotiationHistoryEntry[];
  offer_id?: string; // UUID of accepted offer from Seller Agent
  buyer_wallet?: string; // Buyer's wallet address for payment
  negotiation_rounds?: number; // Current round (0-3)
  retry_feedback?: string;
  tx_hash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RequestSchema: Schema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(RequestStatus),
      default: RequestStatus.NEW,
      required: true,
      index: true,
    },
    budget: {
      type: Number,
      required: true,
      min: 0,
    },
    target_item: {
      description: String,
      image_url: { type: String, required: true },
      embedding: { type: [Number], default: [] }, // 1024-dim from Voyage
    },
    found_item: {
      item_id: String,
      name: String,
      selling_price: Number,
      price: Number, // Legacy field
      minimum_price: Number,
      seller: String,
      seller_wallet: String,
      description: String,
      url: String,
    },
    alternatives: {
      type: [
        {
          item_id: String,
          name: String,
          selling_price: Number,
          price: Number, // Legacy field
          minimum_price: Number,
          seller: String,
          seller_wallet: String,
          description: String,
          url: String,
        },
      ],
      default: [],
    },
    negotiation_history: {
      type: [
        {
          role: { type: String, enum: ['negotiator', 'seller'] },
          content: String,
          offer: Number,
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    offer_id: String,
    buyer_wallet: String,
    negotiation_rounds: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    retry_feedback: String,
    tx_hash: String,
  },
  {
    timestamps: true,
    collection: 'snatch_requests',
  }
);

// Index for vector search (MongoDB Atlas will create the vector search index separately)
RequestSchema.index({ 'target_item.embedding': '2dsphere' });

export const Request: Model<IRequest> =
  mongoose.models.Request || mongoose.model<IRequest>('Request', RequestSchema);
