import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInventoryItem extends Document {
  id: string; // Unique item ID
  size: string; // Item size
  price: number; // Selling price
  image: string; // Image URL
  SELLER_WALLET_ADDRESS: string; // Seller's wallet address
  metadata: Record<string, any>; // Item metadata
  metadata_embedding: number[]; // 2048-dim metadata embedding
  image_embedding: number[]; // 2048-dim image embedding
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema: Schema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    size: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      required: true,
    },
    SELLER_WALLET_ADDRESS: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata_embedding: {
      type: [Number],
      default: [],
    },
    image_embedding: {
      type: [Number],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'inventory',
  }
);

// Indexes for vector search (MongoDB Atlas will create vector search indexes separately)
// Create two vector indexes: one for image_embedding, one for metadata_embedding
InventoryItemSchema.index({ image_embedding: '2dsphere' });
InventoryItemSchema.index({ metadata_embedding: '2dsphere' });

export const InventoryItem: Model<IInventoryItem> =
  mongoose.models.InventoryItem ||
  mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);
