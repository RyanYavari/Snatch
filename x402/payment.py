"""
x402 Payment Example - Coinbase x402 Protocol
https://github.com/coinbase/x402

This module demonstrates setting up payments using the x402 protocol
with a seller (resource server) and buyer (client) wallet.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# =============================================================================
# CONFIGURATION
# =============================================================================

# Facilitator URL for payment verification and settlement
# Use testnet facilitator for development
FACILITATOR_URL = "https://x402.org/facilitator"

# Network configuration (Base Sepolia testnet for development)
# Format: eip155:<chain_id>
NETWORK = "eip155:84532"  # Base Sepolia

# USDC token address on Base Sepolia
USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

# =============================================================================
# WALLET CONFIGURATION
# =============================================================================

# Seller wallet - receives payments
# IMPORTANT: Never hardcode private keys in production
# Use environment variables or secure key management
SELLER_WALLET_ADDRESS = os.getenv("SELLER_WALLET_ADDRESS", "0xYourSellerWalletAddress")

# Buyer wallet - makes payments
BUYER_PRIVATE_KEY = os.getenv("BUYER_PRIVATE_KEY")  # Required for signing transactions


# =============================================================================
# PAYMENT REQUIREMENTS
# =============================================================================

def create_payment_requirements(
    pay_to: str,
    amount: str = "1000000",  # Amount in smallest unit (1 USDC = 1000000 for 6 decimals)
    description: str = "API access payment"
) -> dict:
    """
    Create payment requirements for an x402-protected endpoint.
    
    Args:
        pay_to: Wallet address to receive payments
        amount: Amount in smallest token unit (USDC has 6 decimals)
        description: Human-readable description of what the payment is for
        
    Returns:
        Payment requirements dictionary for x402 protocol
    """
    return {
        "accepts": [
            {
                "scheme": "exact",
                "network": NETWORK,
                "maxAmountRequired": amount,
                "resource": description,
                "asset": f"{NETWORK}/erc20:{USDC_ADDRESS}",
                "payTo": pay_to,
                "extra": {
                    "name": "USDC",
                    "decimals": 6
                }
            }
        ],
        "description": description
    }


# =============================================================================
# BUYER CLIENT EXAMPLE
# =============================================================================

class X402BuyerClient:
    """
    Example buyer client that can make payments via x402 protocol.
    
    This client handles:
    1. Detecting 402 Payment Required responses
    2. Creating payment payloads
    3. Signing transactions
    4. Retrying requests with payment
    """
    
    def __init__(self, private_key: str):
        """
        Initialize the buyer client with a wallet.
        
        Args:
            private_key: EVM private key for signing transactions
        """
        self.private_key = private_key
        
    async def make_paid_request(self, url: str, method: str = "GET", **kwargs):
        """
        Make an HTTP request that automatically handles x402 payments.
        
        This is a simplified example. The actual x402 Python SDK provides
        wrapped HTTP clients (httpx, requests) that handle this automatically.
        
        Args:
            url: The endpoint URL
            method: HTTP method
            **kwargs: Additional request parameters
            
        Returns:
            Response from the server after payment (if required)
        """
        import httpx
        
        async with httpx.AsyncClient() as client:
            # First request - may return 402
            response = await client.request(method, url, **kwargs)
            
            if response.status_code == 402:
                # Parse payment requirements from response
                payment_required = response.headers.get("X-Payment-Required")
                
                if payment_required:
                    # Create and sign payment payload
                    payment_payload = await self._create_payment_payload(payment_required)
                    
                    # Retry with payment header
                    headers = kwargs.get("headers", {})
                    headers["X-Payment"] = payment_payload
                    kwargs["headers"] = headers
                    
                    response = await client.request(method, url, **kwargs)
            
            return response
    
    async def _create_payment_payload(self, payment_requirements: str) -> str:
        """
        Create a signed payment payload for the x402 protocol.
        
        In practice, the x402 SDK handles the cryptographic signing
        and payload creation automatically.
        """
        # This is handled by the x402 SDK
        # The SDK signs the payment authorization with your private key
        raise NotImplementedError(
            "Use the x402 SDK's wrap_httpx_client() or wrap_requests_session() "
            "for automatic payment handling"
        )


# =============================================================================
# SELLER SERVER EXAMPLE (FastAPI)
# =============================================================================

def create_fastapi_seller_example():
    """
    Example FastAPI server with x402 payment middleware.
    
    This shows how to protect endpoints with x402 payments.
    """
    example_code = '''
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
import httpx
import base64
import json

app = FastAPI()

FACILITATOR_URL = "https://x402.org/facilitator"
SELLER_WALLET = "0xYourSellerWalletAddress"

# Payment requirements for protected endpoints
PROTECTED_ROUTES = {
    "/api/premium-data": {
        "price": "1000000",  # 1 USDC
        "description": "Premium data access"
    }
}


@app.middleware("http")
async def x402_payment_middleware(request: Request, call_next):
    """
    Middleware that implements x402 payment verification.
    """
    path = request.url.path
    
    # Check if this route requires payment
    if path not in PROTECTED_ROUTES:
        return await call_next(request)
    
    route_config = PROTECTED_ROUTES[path]
    
    # Check for payment header
    payment_header = request.headers.get("X-Payment")
    
    if not payment_header:
        # Return 402 Payment Required with payment requirements
        requirements = create_payment_requirements(
            pay_to=SELLER_WALLET,
            amount=route_config["price"],
            description=route_config["description"]
        )
        
        return JSONResponse(
            status_code=402,
            content={"error": "Payment Required", "requirements": requirements},
            headers={
                "X-Payment-Required": base64.b64encode(
                    json.dumps(requirements).encode()
                ).decode()
            }
        )
    
    # Verify payment with facilitator
    async with httpx.AsyncClient() as client:
        verify_response = await client.post(
            f"{FACILITATOR_URL}/verify",
            json={
                "payment": payment_header,
                "requirements": create_payment_requirements(
                    pay_to=SELLER_WALLET,
                    amount=route_config["price"],
                    description=route_config["description"]
                )
            }
        )
        
        if verify_response.status_code != 200:
            return JSONResponse(
                status_code=402,
                content={"error": "Payment verification failed"}
            )
    
    # Payment verified - process request
    response = await call_next(request)
    
    # Settle payment after successful response
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{FACILITATOR_URL}/settle",
            json={"payment": payment_header}
        )
    
    return response


@app.get("/api/premium-data")
async def get_premium_data():
    """Protected endpoint that requires payment."""
    return {"data": "This is premium content!", "status": "paid"}


@app.get("/api/free-data")
async def get_free_data():
    """Free endpoint - no payment required."""
    return {"data": "This is free content!", "status": "free"}
'''
    return example_code


# =============================================================================
# USAGE WITH x402 SDK
# =============================================================================

def show_sdk_usage():
    """
    Show how to use the actual x402 Python SDK.
    
    The x402 SDK provides convenient wrappers for HTTP clients.
    """
    
    usage = """
# =============================================================================
# BUYER: Using x402 Python SDK with httpx
# =============================================================================

from x402 import wrap_httpx_client
from x402.evm import evm_account_signer
import httpx
import os

# Create a signer from your private key
signer = evm_account_signer(os.getenv("BUYER_PRIVATE_KEY"))

# Wrap httpx client with x402 payment handling
client = wrap_httpx_client(httpx.AsyncClient(), signer)

# Make requests - payments are handled automatically!
response = await client.get("https://api.example.com/paid-endpoint")
print(response.json())


# =============================================================================
# BUYER: Using x402 Python SDK with requests
# =============================================================================

from x402 import wrap_requests_session
from x402.evm import evm_account_signer
import requests
import os

# Create a signer from your private key
signer = evm_account_signer(os.getenv("BUYER_PRIVATE_KEY"))

# Wrap requests session with x402 payment handling
session = wrap_requests_session(requests.Session(), signer)

# Make requests - payments are handled automatically!
response = session.get("https://api.example.com/paid-endpoint")
print(response.json())


# =============================================================================
# SELLER: Using x402 middleware (FastAPI example)
# =============================================================================

from fastapi import FastAPI
from x402.fastapi import x402_middleware

app = FastAPI()

# Add x402 payment middleware
app.add_middleware(
    x402_middleware,
    facilitator_url="https://x402.org/facilitator",
    routes={
        "GET /api/data": {
            "price": "$0.01",  # 1 cent in USDC
            "pay_to": "0xYourWalletAddress"
        }
    }
)

@app.get("/api/data")
async def get_data():
    return {"message": "Paid content!"}
"""
    return usage


# =============================================================================
# MAIN - Example Runner
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("x402 Payment Protocol - Python Example")
    print("https://github.com/coinbase/x402")
    print("=" * 60)
    
    print("\n📦 Installation:")
    print("   pip install x402")
    
    print("\n🔧 Environment Variables Required:")
    print("   SELLER_WALLET_ADDRESS - Your EVM wallet to receive payments")
    print("   BUYER_PRIVATE_KEY - Private key for signing payments")
    
    print("\n📖 SDK Usage Examples:")
    print(show_sdk_usage())
    
    print("\n🖥️  FastAPI Seller Server Example:")
    print(create_fastapi_seller_example())
    
    print("\n✅ Configuration:")
    print(f"   Facilitator: {FACILITATOR_URL}")
    print(f"   Network: {NETWORK}")
    print(f"   USDC: {USDC_ADDRESS}")
    print(f"   Seller Wallet: {SELLER_WALLET_ADDRESS}")

