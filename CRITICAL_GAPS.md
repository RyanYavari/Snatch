# Critical Gaps - Redefined with Seller Naming

## ❌ Critical Gaps Requiring Implementation

### 1. Inventory Model Schema Updates ❌
**Current State:**
- Has `price` field (should be `selling_price`)
- Missing `seller` field (person/entity selling the item)

**Required Changes:**
```typescript
// web/lib/models/Inventory.ts
- price: number;  // ❌ Remove
+ selling_price: number;  // ✅ Add
+ seller: string;  // ✅ Add (person/entity name, distinct from seller_wallet)
```

**Rationale:** 
- `selling_price` is clearer than `price` (could be confused with minimum_price)
- `seller` field identifies who is selling (useful for metadata/logging)
- `seller_wallet` remains for payment processing

---

### 2. Missing Seller Agent API Route ❌
**Required:** `/api/seller` endpoint (`web/app/api/seller/route.ts`)

**Purpose:** Simulates seller decision-making with 50/50 randomizer

**Input:**
```typescript
{
  item_id: string;
  offer_amount: number;
}
```

**Logic:**
1. Fetch item from inventory by `item_id`
2. Verify `offer_amount >= item.minimum_price`
3. If invalid: Return decline
4. If valid: Run 50/50 randomizer (`Math.random() > 0.5`)

**Output (Accept):**
```typescript
{
  accepted: true,
  offer_id: string,  // UUID
  item: string,
  offered_amount: number,
  accepted_amount: number,
  seller_wallet: string,
  counter_offer: null,
  message: string
}
```

**Output (Decline):**
```typescript
{
  accepted: false,
  offer_id: null,
  item: string,
  offered_amount: number,
  accepted_amount: null,
  counter_offer: null,
  message: "Offer declined. Try again!"
}
```

---

### 3. Missing Negotiator Agent ❌
**Required:** `web/lib/agents/negotiator.ts` + `web/app/api/agents/negotiator/route.ts`

**Purpose:** AI-powered negotiation agent using Vercel AI SDK ToolLoopAgent

**Key Features:**
- Uses Fireworks AI (`firefunction-v1`) via OpenAI-compatible API
- Polls MongoDB for requests with `FOUND` status
- Implements 3-round negotiation limit
- Uses tools to interact with Seller Agent and Payment system

**Tools Required:**
1. **`sendOfferToSeller(item_id: string, offer_amount: number)`**
   - Calls `/api/seller` endpoint
   - Returns seller response (accept/decline)
   - Logs to `negotiation_history` with role: 'seller'

2. **`processPayment(offer_id: string, amount_usdc: number, buyer_wallet: string, seller_wallet: string)`**
   - Calls `/api/quick-pay` endpoint
   - Executes x402 payment protocol
   - Updates request status to `PAID`
   - Stores `tx_hash` in request

3. **`setRetryStatus(feedback: string)`**
   - Updates request status to `RETRY_SEARCH`
   - Sets `retry_feedback` field
   - Resets `negotiation_rounds` to 0

**System Prompt:**
```
You are a negotiation agent. You have exactly 3 rounds to negotiate with the seller.
Your goal is to get the seller to accept an offer within the buyer's budget.

Rules:
- You can make strategic offers based on the item's minimum_price and buyer's budget
- Track your negotiation rounds (you have 3 total)
- If seller rejects after 3 rounds, call setRetryStatus() with feedback
- If seller accepts, call processPayment() immediately
- Log all interactions to negotiation_history
```

**Flow:**
```
FOUND → NEGOTIATING (Round 1)
    ↓
sendOfferToSeller() → Seller declines
    ↓
NEGOTIATING (Round 2)
    ↓
sendOfferToSeller() → Seller declines
    ↓
NEGOTIATING (Round 3)
    ↓
sendOfferToSeller() → Seller declines
    ↓
setRetryStatus() → RETRY_SEARCH
```

**Success Flow:**
```
FOUND → NEGOTIATING (Round 1/2/3)
    ↓
sendOfferToSeller() → Seller accepts
    ↓
AGREED → processPayment()
    ↓
PAID → DONE
```

---

### 4. Missing Payment Endpoint ❌
**Required:** `/api/quick-pay` endpoint (`web/app/api/quick-pay/route.ts`)

**Purpose:** Execute x402 payment protocol using Coinbase CDP

**Input:**
```typescript
{
  amount_usdc: number;
  offer_id: string;
  buyer_wallet: string;
  seller_wallet: string;
}
```

**Logic:**
1. Validate offer_id exists and is accepted
2. Use Coinbase CDP SDK to create payment
3. Execute x402 protocol transfer
4. Update request:
   - Status: `PAID`
   - `tx_hash`: Transaction hash from blockchain
   - `offer_id`: Store accepted offer ID

**Output:**
```typescript
{
  success: boolean;
  tx_hash?: string;
  message: string;
}
```

---

### 5. Request Model Missing Fields ❌
**Required Additions to `web/lib/models/Request.ts`:**

```typescript
export interface IRequest extends Document {
  // ... existing fields ...
  
  // NEW FIELDS:
  offer_id?: string;  // UUID of accepted offer from Seller Agent
  buyer_wallet?: string;  // Buyer's wallet address for payment
  negotiation_rounds?: number;  // Current round (0-3)
}
```

**Schema Updates:**
```typescript
offer_id: String,
buyer_wallet: String,
negotiation_rounds: { type: Number, default: 0, min: 0, max: 3 },
```

---

### 6. Agent Flow State Machine ❌
**Current State Machine:**
```
NEW → FOUND → (missing NEGOTIATING) → AGREED → PAID
     ↓
RETRY_SEARCH → FOUND → (repeat)
```

**Required State Machine:**
```
NEW → FOUND → NEGOTIATING → (3 rounds max)
                    ↓
              AGREED → PAID (success)
                    ↓
              RETRY_SEARCH → FOUND → NEGOTIATING (retry with next item)
```

**Status Transitions:**
- `NEW` → `FOUND` (Scout Agent)
- `FOUND` → `NEGOTIATING` (Negotiator Agent starts)
- `NEGOTIATING` → `AGREED` (Seller accepts within 3 rounds)
- `NEGOTIATING` → `RETRY_SEARCH` (Seller rejects after 3 rounds)
- `AGREED` → `PAID` (Payment processed)
- `RETRY_SEARCH` → `FOUND` (Scout Agent pops alternative)
- Any status → `FAILED` (Error handling)

---

## 📋 Implementation Priority

1. **High Priority:**
   - Seller Agent API Route (`/api/seller`)
   - Request Model field additions (`offer_id`, `buyer_wallet`, `negotiation_rounds`)
   - Inventory Model updates (`seller` field, `selling_price` rename)

2. **Medium Priority:**
   - Negotiator Agent implementation
   - Payment endpoint (`/api/quick-pay`)

3. **Low Priority:**
   - State machine validation
   - Error handling improvements
   - Logging enhancements

---

## 🔄 Complete Agent Flow (Updated)

```
User Input (image + budget)
    ↓
POST /api/requests → Status: NEW
    ↓
Scout Agent (POST /api/agents/scout)
    ↓
Vector Search → Top 5 items → Sort by selling_price
    ↓
Set cheapest as found_item, store alternatives
    ↓
Status: FOUND
    ↓
Negotiator Agent (POST /api/agents/negotiator)
    ↓
Status: NEGOTIATING (Round 1)
    ↓
sendOfferToSeller(item_id, offer_1)
    ↓
POST /api/seller → { accepted: false }
    ↓
NEGOTIATING (Round 2)
    ↓
sendOfferToSeller(item_id, offer_2)
    ↓
POST /api/seller → { accepted: false }
    ↓
NEGOTIATING (Round 3)
    ↓
sendOfferToSeller(item_id, offer_3)
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
Status: AGREED
    ↓
processPayment(offer_id, amount, buyer_wallet, seller_wallet)
    ↓
POST /api/quick-pay → Status: PAID
    ↓
DONE ✅
```
