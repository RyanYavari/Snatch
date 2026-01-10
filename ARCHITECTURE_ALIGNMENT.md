# Architecture Alignment Analysis

## ✅ What's Already Aligned

### 1. Scout Agent Flow ✅
- ✅ Processes `NEW` status requests
- ✅ Generates Voyage AI Multimodal-3 embeddings
- ✅ Performs MongoDB Atlas `$vectorSearch`
- ✅ Stores top 5 matches in `alternatives` array
- ✅ Sorts by price and sets cheapest as `found_item`
- ✅ Updates status to `FOUND`
- ✅ Processes `RETRY_SEARCH` by popping from alternatives
- ✅ Handles retry feedback

### 2. Database Schema (Mostly Aligned) ✅
- ✅ `Request` model has `target_item` with `image_url` and `embedding`
- ✅ `Request` model has `found_item` with `item_id`, `name`, `price`, `minimum_price`, `seller_wallet`
- ✅ `Request` model has `alternatives` array
- ✅ `Request` model has `negotiation_history` with `role`, `content`, `offer`, `timestamp`
- ✅ `Inventory` model has `item_id`, `name`, `price`, `minimum_price`, `seller_wallet`, `embedding`
- ✅ Both models support embeddings for vector search

## ❌ Gaps & Required Changes

### 1. Inventory Model Schema Mismatch ❌
**Current:**
```typescript
price: number;  // Should be "selling_price"
```

**Required:**
- Add `seller` field (string) - Person selling the item (same as seller_wallet owner)
- Rename `price` → `selling_price` for clarity
- Keep `minimum_price` ✅

### 2. Missing Seller Agent API Route ❌
**Required:** `/api/seller` endpoint
- Input: `{ item_id: string, offer_amount: number }`
- Logic: 50/50 randomizer + verify `offer_amount >= item.minimum_price`
- Output (accept): `{ accepted: true, offer_id: string, seller_wallet: string, ... }`
- Output (decline): `{ accepted: false, message: string }`

### 3. Missing Negotiator Agent ❌
**Required Implementation:**
- Uses Vercel AI SDK `ToolLoopAgent` with Fireworks AI
- Polls for `FOUND` status requests
- Has tools:
  - `sendOfferToSeller(item_id, offer_amount)` → calls `/api/seller`
  - `processPayment(offer_id, amount_usdc, buyer_wallet, seller_wallet)` → calls `/api/quick-pay`
  - `setRetryStatus(feedback)` → updates request to `RETRY_SEARCH`
- Tracks negotiation rounds (max 3)
- System prompt: "You have 3 rounds to negotiate. If rejected 3 times, call setRetryStatus()."
- Updates `negotiation_history` with each round (role: 'negotiator' or 'seller')
- On success (within 3 rounds): → `AGREED` → calls `processPayment` → `PAID`
- On failure (after 3 rounds): → `RETRY_SEARCH` with feedback

### 4. Missing Payment Endpoint ❌
**Required:** `/api/quick-pay` endpoint
- Input: `{ amount_usdc: number, offer_id: string, buyer_wallet: string, seller_wallet: string }`
- Uses Coinbase x402 protocol
- Updates request status to `PAID`
- Stores `tx_hash` in request

### 5. Request Model Missing Fields ❌
**Required Additions:**
- `offer_id?: string` - Track accepted offer ID
- `buyer_wallet?: string` - Buyer's wallet address
- `negotiation_rounds?: number` - Track current round (0-3)

### 6. Agent Flow State Machine ❌
**Current Flow:**
```
NEW → FOUND → (missing NEGOTIATING) → AGREED → PAID
     ↓
RETRY_SEARCH → FOUND → (repeat)
```

**Required Flow:**
```
NEW → FOUND → NEGOTIATING → (3 rounds max)
                    ↓
              AGREED → PAID (success)
                    ↓
              RETRY_SEARCH → FOUND → NEGOTIATING (retry with next item)
```

## 📋 Implementation Checklist

### Phase 1: Schema Updates
- [ ] Update `Inventory` model: Add `seller` field, rename `price` → `selling_price`
- [ ] Update `Request` model: Add `offer_id`, `buyer_wallet`, `negotiation_rounds`

### Phase 2: Seller Agent
- [ ] Create `/api/seller` route
- [ ] Implement 50/50 randomizer logic
- [ ] Verify `offer_amount >= minimum_price`
- [ ] Generate `offer_id` (UUID) on acceptance
- [ ] Return proper accept/decline responses

### Phase 3: Negotiator Agent
- [ ] Create `web/lib/agents/negotiator.ts`
- [ ] Implement `ToolLoopAgent` with Fireworks AI
- [ ] Create tools: `sendOfferToSeller`, `processPayment`, `setRetryStatus`
- [ ] Implement 3-round limit logic
- [ ] Poll for `FOUND` status requests
- [ ] Update `negotiation_history` with each round
- [ ] Handle success → `AGREED` → payment flow
- [ ] Handle failure → `RETRY_SEARCH` → Scout retry

### Phase 4: Payment Integration
- [ ] Create `/api/quick-pay` route
- [ ] Integrate Coinbase x402 SDK
- [ ] Update request with `tx_hash` on success
- [ ] Set status to `PAID`

### Phase 5: Agent Orchestration
- [ ] Create `/api/agents/negotiator` route for polling
- [ ] Set up background polling or Vercel cron jobs
- [ ] Ensure proper error handling and logging

## 🔄 Complete Flow Diagram

```
User Input (image + budget)
    ↓
POST /api/requests → Status: NEW
    ↓
Scout Agent (POST /api/agents/scout)
    ↓
Vector Search → Top 5 items → Sort by price
    ↓
Set cheapest as found_item, store alternatives
    ↓
Status: FOUND
    ↓
Negotiator Agent (POST /api/agents/negotiator)
    ↓
Round 1: sendOfferToSeller(item_id, offer_1)
    ↓
POST /api/seller → { accepted: false } → Round 2
    ↓
Round 2: sendOfferToSeller(item_id, offer_2)
    ↓
POST /api/seller → { accepted: false } → Round 3
    ↓
Round 3: sendOfferToSeller(item_id, offer_3)
    ↓
POST /api/seller → { accepted: false }
    ↓
setRetryStatus() → Status: RETRY_SEARCH
    ↓
Scout Agent pops next alternative → Status: FOUND
    ↓
Negotiator Agent retries (new item, reset rounds)
    ↓
... (repeat until success or no alternatives)
    ↓
POST /api/seller → { accepted: true, offer_id, seller_wallet }
    ↓
processPayment(offer_id, amount, buyer_wallet, seller_wallet)
    ↓
POST /api/quick-pay → Status: PAID
    ↓
DONE ✅
```
