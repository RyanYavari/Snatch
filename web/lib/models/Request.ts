import mongoose, { Schema, Document, Model } from 'mongoose';

export enum RequestStatus {
  NEW = 'NEW',
  FOUND = 'FOUND',
  NEGOTIATING = 'NEGOTIATING',
  AGREED = 'AGREED',
  PAID = 'PAID',
  RETRY_SEARCH = 'RETRY_SEARCH',
}

export interface IRequest extends Document {
  status: RequestStatus;
  budget: number;
  target_image_url: string;
  voyage_embedding: number[];
  found_item?: {
    name?: string;
    url?: string;
    price?: number;
    description?: string;
    [key: string]: any;
  };
  negotiation_log: Array<{
    timestamp: Date;
    agent: string;
    message: string;
    price?: number;
    [key: string]: any;
  }>;
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
    target_image_url: {
      type: String,
      required: true,
    },
    voyage_embedding: {
      type: [Number],
      default: [],
    },
    found_item: {
      type: Schema.Types.Mixed,
      default: null,
    },
    negotiation_log: {
      type: [
        {
          timestamp: { type: Date, default: Date.now },
          agent: String,
          message: String,
          price: Number,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'snatch_requests',
  }
);

// Index for vector search (MongoDB Atlas will create the vector search index separately)
RequestSchema.index({ voyage_embedding: '2dsphere' });

export const Request: Model<IRequest> =
  mongoose.models.Request || mongoose.model<IRequest>('Request', RequestSchema);
