import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInventoryItem extends Document {
  item_id: string;
  name: string;
  description?: string;
  selling_price: number;
  minimum_price: number;
  seller: string; // Person/entity selling the item
  seller_wallet: string;
  image_url?: string;
  embedding: number[]; // 1024-dim from Voyage Multimodal-3
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema: Schema = new Schema(
  {
    item_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: String,
    selling_price: {
      type: Number,
      required: true,
      min: 0,
    },
    minimum_price: {
      type: Number,
      required: true,
      min: 0,
    },
    seller: {
      type: String,
      required: true,
    },
    seller_wallet: {
      type: String,
      required: true,
    },
    image_url: String,
    embedding: {
      type: [Number],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'inventory',
  }
);

// Index for vector search (MongoDB Atlas will create the vector search index separately)
InventoryItemSchema.index({ embedding: '2dsphere' });

export const InventoryItem: Model<IInventoryItem> =
  mongoose.models.InventoryItem ||
  mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);
