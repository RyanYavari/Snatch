# SNATCH Swarm Architecture (JS/TS)
A multi-agent system built on Next.js 15+ and the Vercel AI SDK.

## 🛠 Tech Stack
- **Framework**: Next.js 15 (App Router).
- **Agent SDK**: Vercel AI SDK Core (`ToolLoopAgent` / `generateText`).
- **Reasoning**: Fireworks AI (`firefunction-v1`) via OpenAI-compatible provider.
- **Perception**: Voyage AI `voyage-multimodal-3` (1024-dim vision embeddings).
- **Blackboard**: MongoDB Atlas (Shared Memory).
- **Payments**: x402 Protocol on Base Sepolia.

## 🧠 The Blackboard Pattern (JS Logic)
Instead of polling scripts, use **Vercel Background Functions** or API polling:
1. **Scout (Agent)**: Wakes up on `NEW`. Uses Voyage SDK to find items in Atlas. Updates doc -> `FOUND`.
2. **Negotiator (Agent)**: Wakes up on `FOUND`. Uses `ToolLoopAgent` to call the `/api/seller` endpoint. 
   - Success -> `AGREED`. 
   - Fail (3 rounds) -> `RETRY_SEARCH` + Feedback.
3. **Seller (Mock API)**: An API route `/api/seller` with a 50/50 Randomizer.
4. **Closer (Action)**: Triggers on `AGREED`. Executes Coinbase x402 payment logic.