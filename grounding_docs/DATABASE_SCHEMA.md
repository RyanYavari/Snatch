# MongoDB "Blackboard" Schema (Mongoose)
// web/lib/models/Request.ts

const RequestSchema = new Schema({
  status: { 
    type: String, 
    enum: ['NEW', 'FOUND', 'NEGOTIATING', 'RETRY_SEARCH', 'AGREED', 'PAID', 'FAILED'],
    default: 'NEW' 
  },
  budget: Number,
  negotiation_history: [{ 
    role: String, // 'negotiator' | 'seller'
    content: String, 
    offer: Number,
    timestamp: Date 
  }],
  target_item: {
    description: String,
    image_url: String,
    embedding: [Number] // 1024-dim from Voyage
  },
  found_item: {
    item_id: String,
    name: String,
    price: Number,
    seller_wallet: String
  },
  retry_feedback: String,
  tx_hash: String
}, { timestamps: true });