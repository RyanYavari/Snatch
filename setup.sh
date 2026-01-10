#!/bin/bash

# Snatch Multi-Agent Swarm Setup Script

set -e  # Exit on error

echo "🚀 Setting up Snatch Multi-Agent Swarm..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Initialize Git Repository
echo -e "\n${GREEN}1. Initializing Git repository...${NC}"
if [ ! -d .git ]; then
    git init
    git add .
    git commit -m "Initial commit: Snatch multi-agent swarm"
    echo "✅ Git repository initialized"
else
    echo "⚠️  Git repository already exists"
fi

# 2. Set up environment variables
echo -e "\n${GREEN}2. Setting up environment variables...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file - Please edit it with your API keys!"
    echo -e "${YELLOW}   Required: MONGODB_URI, FIREWORKS_API_KEY, VOYAGE_API_KEY${NC}"
else
    echo "⚠️  .env file already exists"
fi

if [ ! -f web/.env.local ]; then
    cp web/.env.local.example web/.env.local
    echo "✅ Created web/.env.local file - Please add your MONGODB_URI!"
else
    echo "⚠️  web/.env.local file already exists"
fi

# 3. Set up Python virtual environment
echo -e "\n${GREEN}3. Setting up Python virtual environment...${NC}"
if [ ! -d venv ]; then
    python3.12 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "⚠️  Virtual environment already exists"
fi

echo "📦 Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo "✅ Python dependencies installed"

# 4. Set up Next.js frontend
echo -e "\n${GREEN}4. Setting up Next.js frontend...${NC}"
cd web
if [ ! -d node_modules ]; then
    npm install
    echo "✅ Node.js dependencies installed"
else
    echo "⚠️  Node.js dependencies already installed"
fi
cd ..

# 5. Summary
echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Edit .env and web/.env.local with your API keys"
echo "2. Set up MongoDB Atlas vector search index (see README.md)"
echo "3. Run frontend: cd web && npm run dev"
echo "4. Run agents: cd agents && source ../venv/bin/activate && python main.py"
