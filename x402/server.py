"""
x402 Payment Server - Base Sepolia
===================================

A FastAPI server to receive and send USDC payments between wallets.

Usage:
    python x402/server.py

Endpoints:
    POST /pay       - Send USDC from buyer to seller
    POST /quick-pay - Send USDC using demo wallets (with offer validation)
    POST /seller    - Negotiate an offer (accept/decline)
    POST /balance   - Check wallet USDC balance
    GET  /health    - Health check
"""

import json
import os
import uuid
import random
from pathlib import Path
from typing import Optional, Dict
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Load environment variables
load_dotenv()

# =============================================================================
# Configuration
# =============================================================================

USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
CHAIN_ID = 84532

BASE_SEPOLIA_RPCS = [
    "https://sepolia.base.org",
    "https://base-sepolia.blockpi.network/v1/rpc/public",
    "https://base-sepolia-rpc.publicnode.com",
    "https://rpc.notadegen.com/base/sepolia",
    "https://base-sepolia.drpc.org",
]

ERC20_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
]

# =============================================================================
# Accepted Offers Storage (JSON file)
# =============================================================================

OFFERS_FILE = Path(__file__).parent.parent / "accepted_offers.json"


def load_offers() -> Dict[str, dict]:
    """Load accepted offers from JSON file."""
    if OFFERS_FILE.exists():
        try:
            with open(OFFERS_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_offers(offers: Dict[str, dict]) -> None:
    """Save accepted offers to JSON file."""
    with open(OFFERS_FILE, 'w') as f:
        json.dump(offers, f, indent=2)


def get_offer(offer_id: str) -> Optional[dict]:
    """Get a specific offer by ID."""
    offers = load_offers()
    return offers.get(offer_id)


def add_offer(offer_id: str, offer_data: dict) -> None:
    """Add a new offer to storage."""
    offers = load_offers()
    offers[offer_id] = offer_data
    save_offers(offers)


def update_offer(offer_id: str, updates: dict) -> None:
    """Update an existing offer."""
    offers = load_offers()
    if offer_id in offers:
        offers[offer_id].update(updates)
        save_offers(offers)


def remove_offer(offer_id: str) -> Optional[dict]:
    """Remove an offer and return it."""
    offers = load_offers()
    if offer_id in offers:
        removed = offers.pop(offer_id)
        save_offers(offers)
        return removed
    return None

# =============================================================================
# Pydantic Models
# =============================================================================

class PaymentRequest(BaseModel):
    """Request body for sending a payment."""
    buyer_address: str = Field(..., description="Buyer wallet address (sender)")
    buyer_private_key: str = Field(..., description="Buyer private key for signing")
    seller_address: str = Field(..., description="Seller wallet address (receiver)")
    amount_usdc: float = Field(..., gt=0, description="Amount of USDC to send")


class PaymentResponse(BaseModel):
    """Response after sending a payment."""
    success: bool
    tx_hash: Optional[str] = None
    explorer_url: Optional[str] = None
    amount_usdc: float
    buyer_address: str
    seller_address: str
    buyer_balance_after: Optional[float] = None
    seller_balance_after: Optional[float] = None
    error: Optional[str] = None


class BalanceRequest(BaseModel):
    """Request body for checking balance."""
    address: str = Field(..., description="Wallet address to check")


class BalanceResponse(BaseModel):
    """Response with wallet balance."""
    address: str
    usdc_balance: float
    eth_balance: float


class QuickPaymentRequest(BaseModel):
    """Simplified payment request using stored wallet credentials."""
    amount_usdc: float = Field(..., gt=0, description="Amount of USDC to send")
    offer_id: Optional[str] = Field(None, description="Offer ID from negotiation (required for validated payments)")
    buyer_wallet: Optional[str] = Field(None, description="Buyer wallet address (validated against offer)")
    seller_wallet: Optional[str] = Field(None, description="Seller wallet address (validated against offer)")
    use_demo_wallets: bool = Field(True, description="Use demo wallets from .env/json if wallets not provided")


class OfferRequest(BaseModel):
    """Request body for making an offer to the seller."""
    item: str = Field(..., description="Item or service being purchased")
    offer_amount: float = Field(..., gt=0, description="Offered amount in USDC")
    buyer_address: Optional[str] = Field(None, description="Buyer wallet address")
    seller_address: Optional[str] = Field(None, description="Seller wallet address")


class OfferResponse(BaseModel):
    """Response from the seller after negotiation."""
    accepted: bool
    offer_id: Optional[str] = None
    item: str
    offered_amount: float
    accepted_amount: Optional[float] = None
    seller_wallet: Optional[str] = None
    counter_offer: Optional[float] = None
    message: str


class PendingOffersResponse(BaseModel):
    """Response with all pending/accepted offers."""
    offers: Dict[str, dict]
    count: int


# =============================================================================
# Web3 Utilities
# =============================================================================

def get_web3_connection():
    """Try multiple RPC endpoints until one works."""
    from web3 import Web3
    
    custom_rpc = os.getenv("NETWORK_RPC_URL")
    rpcs = [custom_rpc] + BASE_SEPOLIA_RPCS if custom_rpc else BASE_SEPOLIA_RPCS
    
    for rpc_url in rpcs:
        try:
            w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 15}))
            if w3.is_connected():
                return w3
        except Exception:
            continue
    
    return None


def get_usdc_balance(w3, address: str) -> float:
    """Get USDC balance for an address."""
    from web3 import Web3
    
    usdc_contract = w3.eth.contract(
        address=Web3.to_checksum_address(USDC_ADDRESS),
        abi=ERC20_ABI
    )
    balance = usdc_contract.functions.balanceOf(
        Web3.to_checksum_address(address)
    ).call()
    return balance / 1_000_000  # USDC has 6 decimals


def get_eth_balance(w3, address: str) -> float:
    """Get ETH balance for an address."""
    from web3 import Web3
    balance = w3.eth.get_balance(Web3.to_checksum_address(address))
    return float(w3.from_wei(balance, 'ether'))


def load_demo_wallets():
    """Load demo wallet credentials."""
    buyer_addr = os.getenv("BUYER_WALLET_ADDRESS")
    buyer_key = os.getenv("BUYER_PRIVATE_KEY")
    seller_addr = os.getenv("SELLER_WALLET_ADDRESS")
    
    if not all([buyer_addr, buyer_key, seller_addr]):
        project_root = Path(__file__).parent.parent
        json_file = project_root / "demo_wallets.json"
        
        if json_file.exists():
            with open(json_file, 'r') as f:
                wallets = json.load(f)
            buyer_addr = wallets['buyer']['address']
            buyer_key = wallets['buyer']['private_key']
            seller_addr = wallets['seller']['address']
    
    return buyer_addr, buyer_key, seller_addr


def send_usdc(
    w3,
    buyer_address: str,
    buyer_private_key: str,
    seller_address: str,
    amount_usdc: float
) -> dict:
    """Send USDC from buyer to seller."""
    from web3 import Web3
    
    # Ensure private key has 0x prefix
    if not buyer_private_key.startswith("0x"):
        buyer_private_key = "0x" + buyer_private_key
    
    buyer_checksum = Web3.to_checksum_address(buyer_address)
    seller_checksum = Web3.to_checksum_address(seller_address)
    
    # Setup USDC contract
    usdc_contract = w3.eth.contract(
        address=Web3.to_checksum_address(USDC_ADDRESS),
        abi=ERC20_ABI
    )
    
    # Check ETH balance for gas (need ~0.00005 ETH for ERC20 transfer)
    eth_balance = get_eth_balance(w3, buyer_address)
    if eth_balance < 0.00005:
        raise ValueError(f"Insufficient ETH for gas. Balance: {eth_balance} ETH. Get more from: node x402/request_faucet.js")
    
    # Check USDC balance
    usdc_balance = get_usdc_balance(w3, buyer_address)
    if usdc_balance < amount_usdc:
        raise ValueError(f"Insufficient USDC. Balance: {usdc_balance}, Need: {amount_usdc}")
    
    # Convert amount to smallest unit (6 decimals for USDC)
    amount_raw = int(amount_usdc * 1_000_000)
    
    # Get nonce and gas price
    nonce = w3.eth.get_transaction_count(buyer_checksum)
    gas_price = w3.eth.gas_price
    
    # Build transaction
    tx = usdc_contract.functions.transfer(
        seller_checksum,
        amount_raw
    ).build_transaction({
        'chainId': CHAIN_ID,
        'gas': 100000,
        'gasPrice': gas_price,
        'nonce': nonce,
    })
    
    # Sign and send
    signed_tx = w3.eth.account.sign_transaction(tx, buyer_private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    
    # Wait for confirmation
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    
    return {
        "tx_hash": tx_hash.hex(),
        "success": receipt.status == 1,
        "block": receipt.blockNumber,
        "gas_used": receipt.gasUsed
    }


# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title="x402 Payment Server",
    description="Send and receive USDC payments on Base Sepolia",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "x402 Payment Server",
        "network": "Base Sepolia",
        "usdc_contract": USDC_ADDRESS,
        "pending_offers": len(load_offers()),
        "endpoints": {
            "POST /seller": "Negotiate an offer (returns offer_id if accepted)",
            "POST /quick-pay": "Send USDC using demo wallets (validates offer_id)",
            "POST /pay": "Send USDC payment with full credentials",
            "POST /balance": "Check wallet USDC balance",
            "GET /offers": "View all pending offers",
            "GET /health": "Health check"
        }
    }


@app.get("/health")
async def health_check():
    """Check if the server and blockchain connection are healthy."""
    w3 = get_web3_connection()
    
    if w3 is None:
        raise HTTPException(status_code=503, detail="Cannot connect to Base Sepolia RPC")
    
    return {
        "status": "healthy",
        "network": "base-sepolia",
        "chain_id": CHAIN_ID,
        "connected": True,
        "pending_offers": len(load_offers())
    }


@app.post("/seller", response_model=OfferResponse)
async def negotiate_offer(request: OfferRequest):
    """
    Seller negotiation endpoint.
    
    Simulates a negotiation where the seller has a 50/50 chance
    of accepting or declining any offer.
    If accepted, generates an offer_id and stores the accepted amount along with wallet addresses.
    """
    # Get seller address from request or use demo wallet
    seller_address = request.seller_address
    if not seller_address:
        _, _, seller_address = load_demo_wallets()
    
    # Get buyer address from request or use demo wallet
    buyer_address = request.buyer_address
    if not buyer_address:
        buyer_address, _, _ = load_demo_wallets()
    
    # 50/50 chance of acceptance
    if random.random() >= 0.5:
        # Accept the offer
        offer_id = str(uuid.uuid4())
        
        # Store in JSON file with wallet addresses
        add_offer(offer_id, {
            "amount_usdc": request.offer_amount,
            "item": request.item,
            "status": "accepted",
            "buyer_address": buyer_address,
            "seller_address": seller_address
        })
        
        return OfferResponse(
            accepted=True,
            offer_id=offer_id,
            item=request.item,
            offered_amount=request.offer_amount,
            accepted_amount=request.offer_amount,
            seller_wallet=seller_address,
            message=f"Offer accepted! Use offer_id '{offer_id}' with seller_wallet '{seller_address}' to complete payment."
        )
    else:
        # Decline
        return OfferResponse(
            accepted=False,
            item=request.item,
            offered_amount=request.offer_amount,
            message="Offer declined. Try again!"
        )


@app.get("/offers", response_model=PendingOffersResponse)
async def get_pending_offers():
    """View all pending/accepted offers in the system."""
    offers = load_offers()
    return PendingOffersResponse(
        offers=offers,
        count=len(offers)
    )


@app.delete("/offers/{offer_id}")
async def cancel_offer(offer_id: str):
    """Cancel/remove an offer from the system."""
    removed = remove_offer(offer_id)
    
    if removed is None:
        raise HTTPException(status_code=404, detail=f"Offer {offer_id} not found")
    
    return {"message": f"Offer {offer_id} cancelled", "offer": removed}


@app.post("/balance", response_model=BalanceResponse)
async def check_balance(request: BalanceRequest):
    """Check USDC and ETH balance for a wallet address."""
    w3 = get_web3_connection()
    
    if w3 is None:
        raise HTTPException(status_code=503, detail="Cannot connect to Base Sepolia RPC")
    
    try:
        usdc_balance = get_usdc_balance(w3, request.address)
        eth_balance = get_eth_balance(w3, request.address)
        
        return BalanceResponse(
            address=request.address,
            usdc_balance=usdc_balance,
            eth_balance=eth_balance
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/pay", response_model=PaymentResponse)
async def send_payment(request: PaymentRequest):
    """
    Send USDC from buyer to seller.
    
    Requires full wallet credentials in the request body.
    """
    w3 = get_web3_connection()
    
    if w3 is None:
        raise HTTPException(status_code=503, detail="Cannot connect to Base Sepolia RPC")
    
    try:
        result = send_usdc(
            w3=w3,
            buyer_address=request.buyer_address,
            buyer_private_key=request.buyer_private_key,
            seller_address=request.seller_address,
            amount_usdc=request.amount_usdc
        )
        
        # Get updated balances
        buyer_balance = get_usdc_balance(w3, request.buyer_address)
        seller_balance = get_usdc_balance(w3, request.seller_address)
        
        return PaymentResponse(
            success=result["success"],
            tx_hash=result["tx_hash"],
            explorer_url=f"https://sepolia.basescan.org/tx/{result['tx_hash']}",
            amount_usdc=request.amount_usdc,
            buyer_address=request.buyer_address,
            seller_address=request.seller_address,
            buyer_balance_after=buyer_balance,
            seller_balance_after=seller_balance
        )
        
    except ValueError as e:
        return PaymentResponse(
            success=False,
            amount_usdc=request.amount_usdc,
            buyer_address=request.buyer_address,
            seller_address=request.seller_address,
            error=str(e)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quick-pay", response_model=PaymentResponse)
async def quick_payment(request: QuickPaymentRequest):
    """
    Send USDC payment with offer validation.
    
    If offer_id is provided, validates that:
    1. The offer exists in the accepted offers
    2. The payment amount matches the accepted amount
    3. The buyer_wallet matches the offer's buyer_address
    4. The seller_wallet matches the offer's seller_address
    
    If validation fails, returns an error.
    """
    # Load demo wallets as fallback
    demo_buyer_addr, buyer_key, demo_seller_addr = load_demo_wallets()
    
    # Use provided wallets or fall back to demo wallets
    buyer_addr = request.buyer_wallet or demo_buyer_addr
    seller_addr = request.seller_wallet or demo_seller_addr
    
    if not all([buyer_addr, buyer_key, seller_addr]):
        raise HTTPException(
            status_code=400,
            detail="Wallets not configured. Provide buyer_wallet and seller_wallet, or run demo_wallets.py first."
        )
    
    # Validate offer_id if provided
    if request.offer_id:
        offer = get_offer(request.offer_id)
        
        if offer is None:
            raise HTTPException(
                status_code=404,
                detail=f"Offer ID '{request.offer_id}' not found. Negotiate first via POST /seller"
            )
        
        expected_amount = offer["amount_usdc"]
        expected_seller = offer.get("seller_address", "").lower()
        expected_buyer = offer.get("buyer_address", "").lower()
        
        # Check if amounts match (with small tolerance for floating point)
        if abs(request.amount_usdc - expected_amount) > 0.000001:
            raise HTTPException(
                status_code=400,
                detail=f"Amount mismatch! Offer requires {expected_amount} USDC, but {request.amount_usdc} USDC was sent."
            )
        
        # Check if seller_wallet matches
        if expected_seller and seller_addr.lower() != expected_seller:
            raise HTTPException(
                status_code=400,
                detail=f"Seller wallet mismatch! Offer requires seller '{expected_seller}', but '{seller_addr}' was provided."
            )
        
        # Check if buyer_wallet matches
        if expected_buyer and buyer_addr.lower() != expected_buyer:
            raise HTTPException(
                status_code=400,
                detail=f"Buyer wallet mismatch! Offer requires buyer '{expected_buyer}', but '{buyer_addr}' was provided."
            )
        
        # Check if already paid
        if offer.get("status") == "paid":
            raise HTTPException(
                status_code=400,
                detail=f"Offer '{request.offer_id}' has already been paid."
            )
    
    w3 = get_web3_connection()
    
    if w3 is None:
        raise HTTPException(status_code=503, detail="Cannot connect to Base Sepolia RPC")
    
    try:
        result = send_usdc(
            w3=w3,
            buyer_address=buyer_addr,
            buyer_private_key=buyer_key,
            seller_address=seller_addr,
            amount_usdc=request.amount_usdc
        )
        
        # Mark offer as paid if offer_id was provided
        if request.offer_id and result["success"]:
            update_offer(request.offer_id, {
                "status": "paid",
                "tx_hash": result["tx_hash"]
            })
        
        # Get updated balances
        buyer_balance = get_usdc_balance(w3, buyer_addr)
        seller_balance = get_usdc_balance(w3, seller_addr)
        
        return PaymentResponse(
            success=result["success"],
            tx_hash=result["tx_hash"],
            explorer_url=f"https://sepolia.basescan.org/tx/{result['tx_hash']}",
            amount_usdc=request.amount_usdc,
            buyer_address=buyer_addr,
            seller_address=seller_addr,
            buyer_balance_after=buyer_balance,
            seller_balance_after=seller_balance
        )
        
    except ValueError as e:
        return PaymentResponse(
            success=False,
            amount_usdc=request.amount_usdc,
            buyer_address=buyer_addr,
            seller_address=seller_addr,
            error=str(e)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 x402 Payment Server")
    print("=" * 60)
    print(f"\nNetwork: Base Sepolia (Chain ID: {CHAIN_ID})")
    print(f"USDC Contract: {USDC_ADDRESS}")
    print("\nStarting server at http://localhost:8000")
    print("\nAPI Docs: http://localhost:8000/docs")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)

