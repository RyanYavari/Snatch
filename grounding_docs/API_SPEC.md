# 🔌 API Contracts (JS)

## 1. Seller Logic (/api/seller)
- Logic: `Math.random() > 0.5` to simulate acceptance.
- Verify: `offer_amount >= item.minimum_price`.

## 2. Scout Tool (Voyage + Atlas)
- Client: `@voyageai/voyageai`
- MongoDB: `mongodb` driver with `$vectorSearch`.

## 3. Negotiator Tool Loop
- Agent: `ToolLoopAgent` from `ai` package.
- Instructions: "You have 3 rounds to negotiate. If rejected 3 times, call setRetryStatus()."

## 4. Payment (x402)
- Header: `X-Payment-Required` triggers the Closer logic.
- Settlement: Coinbase CDP SDK `Wallet.create()` and `transfer()`.