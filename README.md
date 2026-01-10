# Snatch - Multi-Agent Swarm

A multi-agent swarm system for finding and negotiating items using AI agents. Built with Next.js (Frontend), Python (Agent Swarm), MongoDB Atlas (Blackboard/Vector DB), Voyage AI (Vision Embeddings), and Fireworks AI (LLM).

## Architecture

The system uses a **Blackboard pattern** where agents communicate exclusively through MongoDB document status updates:

```
Frontend → MongoDB (NEW) → Scout Agent → MongoDB (FOUND) → Negotiator Agent → MongoDB (AGREED/PAID)
```

## Project Structure

```
snatch/
├── web/                 # Next.js frontend
│   ├── app/            # Next.js app directory
│   ├── lib/            # Utilities and models
│   └── package.json
├── agents/             # Python agent swarm
│   ├── main.py        # Main orchestration loop
│   ├── scout.py       # Scout agent (Voyage AI + vector search)
│   ├── negotiator.py  # Negotiator agent (Fireworks AI)
│   └── models.py      # Pydantic models
├── .env.example        # Environment variables template
└── requirements.txt    # Python dependencies
```

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Required variables:
- `MONGODB_URI` - MongoDB Atlas connection string
- `FIREWORKS_API_KEY` - Fireworks AI API key
- `VOYAGE_API_KEY` - Voyage AI API key

### 2. MongoDB Atlas Setup

1. Create a MongoDB Atlas cluster
2. Create a database and collection: `snatch_requests`
3. Create a **Vector Search Index** on the `voyage_embedding` field:
   - Index Name: `voyage_embedding_index`
   - Type: Vector Search
   - Field: `voyage_embedding`
   - Dimensions: 1024 (for voyage-3 model)
   - Similarity: cosine

### 3. Frontend Setup

```bash
cd web
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 4. Python Agent Swarm Setup

```bash
# Create virtual environment (recommended)
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the agent swarm
cd agents
python main.py
```

## Usage

1. **Create a Request**: Upload an image and set a budget in the web interface
2. **Scout Agent**: Automatically generates embeddings and searches for matching items
3. **Negotiator Agent**: Negotiates the price to fit within your budget
4. **Monitor Progress**: Check the request status in MongoDB or via the API

## Request Status Flow

- `NEW` → Request created, waiting for scout
- `FOUND` → Scout found matching item
- `NEGOTIATING` → Negotiator is haggling
- `AGREED` → Price agreed upon
- `PAID` → Transaction completed
- `RETRY_SEARCH` → Need to find another item

## API Endpoints

### POST `/api/requests`
Create a new request
- Body: FormData with `image` (file) and `budget` (number)

### GET `/api/requests`
Get all requests or a specific request
- Query params: `id` (optional)

## Notes

- The system uses async polling every 2 seconds
- All agent communication happens through MongoDB (Blackboard pattern)
- Vector search requires proper MongoDB Atlas vector search index setup
- Image uploads are stored as base64 data URLs (consider cloud storage for production)
