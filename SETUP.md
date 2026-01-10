# Quick Setup Guide

## 1. Initialize Git Repository

```bash
cd /Users/Ryan/snatch
git init
git add .
git commit -m "Initial commit: Snatch multi-agent swarm"
```

## 2. Set Up Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your actual API keys
# You'll need to add:
# - MONGODB_URI (from MongoDB Atlas)
# - FIREWORKS_API_KEY (from Fireworks AI)
# - VOYAGE_API_KEY (from Voyage AI)
```

For the web app:
```bash
cd web
cp .env.local.example .env.local
# Edit .env.local and add your MONGODB_URI
cd ..
```

## 3. Set Up Python Agent Swarm

```bash
# Create virtual environment (Python 3.12)
python3.12 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# OR on Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

## 4. Set Up Next.js Frontend

```bash
cd web
npm install
cd ..
```

## 5. Run the Applications

### Terminal 1 - Start Next.js Frontend:
```bash
cd web
npm run dev
```
Frontend will be available at: http://localhost:3000

### Terminal 2 - Start Python Agent Swarm:
```bash
cd agents
source ../venv/bin/activate  # Activate venv if not already active
python main.py
```

## 6. MongoDB Atlas Vector Search Setup

Before running, you need to create a vector search index in MongoDB Atlas:

1. Go to MongoDB Atlas → Your Cluster → Atlas Search
2. Create a Search Index with:
   - **Index Name**: `voyage_embedding_index`
   - **Database**: Your database name
   - **Collection**: `snatch_requests`
   - **Type**: Vector Search
   - **Field**: `voyage_embedding`
   - **Dimensions**: `1024` (for voyage-3 model)
   - **Similarity**: `cosine`

## Troubleshooting

If you get import errors in Python:
```bash
cd agents
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python main.py
```

Or add to your shell profile:
```bash
echo 'export PYTHONPATH="${PYTHONPATH}:/Users/Ryan/snatch/agents"' >> ~/.zshrc
source ~/.zshrc
```
