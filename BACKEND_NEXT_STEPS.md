# Backend Next Steps (No Frontend)

## 🎯 Priority Order

### Phase 1: Infrastructure & Setup (Critical)

#### 1.1 MongoDB Atlas Configuration
**Status:** ⚠️ Required before testing
- [ ] Create MongoDB Atlas cluster (if not exists)
- [ ] Create database: `snatch`
- [ ] Create collections:
  - `snatch_requests` (for Request model)
  - `inventory` (for Inventory model)
- [ ] **Create Vector Search Index** on `inventory` collection:
  - Index Name: `inventory_embedding_index`
  - Type: Vector Search
  - Field: `embedding`
  - Dimensions: `1024` (for Voyage Multimodal-3)
  - Similarity: `cosine`
  - Create via Atlas UI or MongoDB CLI

#### 1.2 Environment Variables Setup
**File:** `web/.env.local` (create this file)
```bash
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/snatch?retryWrites=true&w=majority

# Voyage AI (for embeddings)
VOYAGE_API_KEY=your_voyage_api_key_here

# Fireworks AI (for Negotiator Agent)
FIREWORKS_API_KEY=your_fireworks_api_key_here
FIREWORKS_API_BASE_URL=https://api.fireworks.ai/inference/v1

# Coinbase CDP (for x402 payments)
COINBASE_API_KEY=your_coinbase_api_key
COINBASE_API_SECRET=your_coinbase_api_secret
COINBASE_NETWORK=base-sepolia

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 1.3 Install Dependencies
```bash
cd web
npm install
```

---

### Phase 2: Inventory Seeding (Required for Testing)

#### 2.1 Create Inventory Seeding Script
**File:** `web/scripts/seed-inventory.ts` or `web/lib/scripts/seed-inventory.ts`

**Purpose:** Populate inventory collection with items and their embeddings

**Requirements:**
- [ ] Create script that:
  1. Connects to MongoDB
  2. Takes items (with images) and generates Voyage embeddings
  3. Inserts items into `inventory` collection with:
     - `item_id` (unique)
     - `name`, `description`
     - `selling_price`, `minimum_price`
     - `seller` (person/entity name)
     - `seller_wallet` (wallet address)
     - `image_url`
     - `embedding` (1024-dim from Voyage)
     - `metadata` (optional)

**Example Structure:**
```typescript
const items = [
  {
    item_id: 'item_001',
    name: 'Vintage Leather Jacket',
    description: 'Brown leather jacket, size M',
    selling_price: 150,
    minimum_price: 120,
    seller: 'FashionStore',
    seller_wallet: '0x...',
    image_url: 'https://...',
    // embedding will be generated
  },
  // ... more items
];
```

#### 2.2 Run Inventory Seeding
```bash
# Create a script command in package.json or run directly
npm run seed:inventory
# OR
tsx web/scripts/seed-inventory.ts
```

---

### Phase 3: Agent Orchestration (Automation)

#### 3.1 Option A: Vercel Cron Jobs (Recommended for Production)
**File:** `vercel.json` (create in root)

```json
{
  "crons": [
    {
      "path": "/api/agents/scout",
      "schedule": "*/1 * * * *"
    },
    {
      "path": "/api/agents/negotiator",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

**Note:** Requires Vercel deployment. For local dev, use Option B.

#### 3.2 Option B: Local Polling Script
**File:** `web/scripts/poll-agents.ts`

**Purpose:** Continuously poll agent endpoints in development

```typescript
// Simple polling script that calls agent endpoints every 5 seconds
setInterval(async () => {
  await fetch('http://localhost:3000/api/agents/scout', { method: 'POST' });
  await fetch('http://localhost:3000/api/agents/negotiator', { method: 'POST' });
}, 5000);
```

#### 3.3 Option C: Manual Trigger (Current State)
- Agents are triggered via POST requests
- Good for testing, not for production

**Recommendation:** Implement Option A (Vercel Cron) for production, Option B for local dev.

---

### Phase 4: Coinbase CDP Integration (Payment)

#### 4.1 Install Coinbase CDP SDK
**Check:** What SDK does Coinbase x402 use?
- [ ] Research Coinbase CDP SDK for x402 protocol
- [ ] Install SDK: `npm install @coinbase/cdp-sdk` (or appropriate package)
- [ ] Add types if needed

#### 4.2 Implement Payment Logic
**File:** `web/app/api/quick-pay/route.ts`

**Current:** Placeholder implementation
**Required:**
- [ ] Replace placeholder with actual Coinbase CDP SDK calls
- [ ] Implement x402 protocol:
  1. Create payment request
  2. Execute transfer
  3. Get transaction hash
  4. Verify payment
- [ ] Handle errors (insufficient balance, network issues, etc.)
- [ ] Update request with actual `tx_hash`

**Reference:** Check `x402/` directory for existing Python implementation patterns

---

### Phase 5: Request Model Enhancements

#### 5.1 Buyer Wallet Handling
**Current:** `buyer_wallet` is optional, defaults to `0x0000...`

**Required:**
- [ ] Update `/api/requests` POST endpoint to accept `buyer_wallet` in request
- [ ] Validate wallet address format
- [ ] Store in Request model
- [ ] Use in payment processing

**File:** `web/app/api/requests/route.ts`
```typescript
const buyer_wallet = formData.get('buyer_wallet') as string;
// Validate and store
```

---

### Phase 6: Error Handling & Logging

#### 6.1 Enhanced Error Handling
- [ ] Add try-catch blocks where missing
- [ ] Create error types/classes for different error scenarios
- [ ] Return proper HTTP status codes
- [ ] Add error logging (consider using a logging service)

#### 6.2 Request Status Validation
- [ ] Add state machine validation:
  - Prevent invalid status transitions
  - Validate status before agent processing
  - Handle edge cases (e.g., request deleted mid-process)

#### 6.3 Logging Improvements
- [ ] Add structured logging (JSON format)
- [ ] Log agent actions with request IDs
- [ ] Log negotiation rounds, offers, responses
- [ ] Consider adding request tracing IDs

---

### Phase 7: Testing & Validation

#### 7.1 Unit Tests
- [ ] Test Scout Agent:
  - Embedding generation
  - Vector search
  - Alternative sorting
  - Status transitions
- [ ] Test Negotiator Agent:
  - Tool execution
  - Round tracking
  - Status transitions
- [ ] Test Seller Agent:
  - Randomizer logic
  - Validation logic
  - Response format

#### 7.2 Integration Tests
- [ ] End-to-end flow:
  1. Create request (NEW)
  2. Trigger Scout → FOUND
  3. Trigger Negotiator → NEGOTIATING → AGREED → PAID
- [ ] Test retry flow:
  1. NEW → FOUND → NEGOTIATING → RETRY_SEARCH → FOUND → ...
- [ ] Test error scenarios:
  - No items found
  - Negotiation fails after 3 rounds
  - Payment fails

#### 7.3 Manual Testing Scripts
**File:** `web/scripts/test-flow.sh`
```bash
#!/bin/bash
# Create request
REQUEST_ID=$(curl -X POST http://localhost:3000/api/requests \
  -F "image=@test-image.jpg" \
  -F "budget=100" \
  -F "buyer_wallet=0x..." | jq -r '.request.id')

# Trigger Scout
curl -X POST http://localhost:3000/api/agents/scout

# Trigger Negotiator
curl -X POST http://localhost:3000/api/agents/negotiator

# Check status
curl http://localhost:3000/api/requests?id=$REQUEST_ID
```

---

### Phase 8: Performance & Optimization

#### 8.1 Database Indexing
- [ ] Add indexes on frequently queried fields:
  - `status` (already indexed)
  - `createdAt` (for sorting)
  - `offer_id` (for payment lookup)

#### 8.2 Agent Concurrency
- [ ] Consider processing multiple requests in parallel
- [ ] Add rate limiting for agent endpoints
- [ ] Prevent duplicate processing (add `processing` flag?)

#### 8.3 Vector Search Optimization
- [ ] Tune `numCandidates` in vector search
- [ ] Consider caching embeddings for similar images
- [ ] Monitor search performance

---

## 📋 Quick Start Checklist

For immediate testing:

1. ✅ **Set up MongoDB Atlas**
   - Create cluster
   - Create vector search index
   - Get connection string

2. ✅ **Set environment variables**
   - Create `web/.env.local`
   - Add all required keys

3. ✅ **Install dependencies**
   ```bash
   cd web && npm install
   ```

4. ✅ **Seed inventory**
   - Create seeding script
   - Add at least 5-10 items with images
   - Generate embeddings

5. ✅ **Test manually**
   ```bash
   # Start server
   npm run dev
   
   # In another terminal, create request
   curl -X POST http://localhost:3000/api/requests \
     -F "image=@test.jpg" \
     -F "budget=100" \
     -F "buyer_wallet=0xYourWallet"
   
   # Trigger agents
   curl -X POST http://localhost:3000/api/agents/scout
   curl -X POST http://localhost:3000/api/agents/negotiator
   ```

---

## 🔧 Technical Debt & Future Improvements

1. **Agent Orchestration:** Implement Vercel Cron or background worker
2. **Payment Integration:** Complete Coinbase CDP SDK integration
3. **Error Recovery:** Add retry logic for failed operations
4. **Monitoring:** Add metrics/observability (e.g., request processing time, success rates)
5. **Rate Limiting:** Add rate limits to prevent abuse
6. **Request Validation:** Validate image formats, budget ranges, wallet addresses
7. **Documentation:** API documentation (OpenAPI/Swagger)

---

## 🎯 Immediate Action Items (This Week)

1. **MongoDB Atlas Setup** (30 min)
   - Create cluster and vector index

2. **Environment Variables** (10 min)
   - Create `.env.local` with all keys

3. **Inventory Seeding** (2-3 hours)
   - Create script
   - Add sample items
   - Generate embeddings

4. **Buyer Wallet Support** (30 min)
   - Update request endpoint
   - Validate wallet addresses

5. **Manual Testing** (1 hour)
   - Test complete flow end-to-end
   - Fix any issues found

---

## 📝 Notes

- **No Frontend Required:** All testing can be done via API endpoints
- **Agent Triggering:** Currently manual via POST requests (automate later)
- **Payment:** Placeholder implementation (integrate Coinbase CDP SDK)
- **Inventory:** Must be seeded before testing (no items = no search results)
