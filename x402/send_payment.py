"""
Send USDC Payment - Base Sepolia Testnet
=========================================

Send a test USDC payment from buyer to seller wallet.
"""

import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base Sepolia configuration
USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
CHAIN_ID = 84532

# Multiple RPC endpoints for Base Sepolia (fallback list)
BASE_SEPOLIA_RPCS = [
    "https://sepolia.base.org",
    "https://base-sepolia.blockpi.network/v1/rpc/public",
    "https://base-sepolia-rpc.publicnode.com",
    "https://rpc.notadegen.com/base/sepolia",
    "https://base-sepolia.drpc.org",
]

# ERC20 ABI for transfer and balanceOf
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
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
]


def get_web3_connection():
    """Try multiple RPC endpoints until one works."""
    from web3 import Web3
    
    custom_rpc = os.getenv("NETWORK_RPC_URL")
    rpcs = [custom_rpc] + BASE_SEPOLIA_RPCS if custom_rpc else BASE_SEPOLIA_RPCS
    
    for rpc_url in rpcs:
        try:
            print(f"   Trying: {rpc_url[:40]}...")
            w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 15}))
            if w3.is_connected():
                print(f"   ✅ Connected!")
                return w3
        except Exception:
            continue
    
    return None


def get_usdc_balance(w3, usdc_contract, address: str) -> float:
    """Get USDC balance for an address."""
    from web3 import Web3
    balance = usdc_contract.functions.balanceOf(
        Web3.to_checksum_address(address)
    ).call()
    return balance / 1_000_000  # USDC has 6 decimals


def send_usdc_payment(amount_usdc: float = 0.0001):
    """
    Send USDC from buyer to seller wallet.
    
    Args:
        amount_usdc: Amount of USDC to send (default: 0.0001)
    """
    from web3 import Web3
    from eth_account import Account
    
    print("\n" + "=" * 60)
    print("💸 USDC PAYMENT - Base Sepolia Testnet")
    print("=" * 60)
    
    # Load wallet credentials
    buyer_addr = os.getenv("BUYER_WALLET_ADDRESS")
    buyer_private_key = os.getenv("BUYER_PRIVATE_KEY")
    seller_addr = os.getenv("SELLER_WALLET_ADDRESS")
    
    # Fallback to JSON file
    if not all([buyer_addr, buyer_private_key, seller_addr]):
        project_root = Path(__file__).parent.parent
        json_file = project_root / "demo_wallets.json"
        
        if json_file.exists():
            with open(json_file, 'r') as f:
                wallets = json.load(f)
            buyer_addr = wallets['buyer']['address']
            buyer_private_key = wallets['buyer']['private_key']
            seller_addr = wallets['seller']['address']
        else:
            print("❌ No wallet credentials found!")
            print("   Run demo_wallets.py first or set environment variables.")
            return False
    
    # Ensure private key has 0x prefix
    if not buyer_private_key.startswith("0x"):
        buyer_private_key = "0x" + buyer_private_key
    
    print(f"\n📤 Sender (Buyer):   {buyer_addr}")
    print(f"📥 Receiver (Seller): {seller_addr}")
    print(f"💰 Amount: {amount_usdc} USDC")
    
    # Connect to Base Sepolia
    print("\n🔌 Connecting to Base Sepolia...")
    w3 = get_web3_connection()
    
    if not w3:
        print("\n❌ Failed to connect to Base Sepolia RPC")
        return False
    
    # Setup USDC contract
    usdc_contract = w3.eth.contract(
        address=Web3.to_checksum_address(USDC_ADDRESS),
        abi=ERC20_ABI
    )
    
    # Check ETH balance for gas
    buyer_checksum = Web3.to_checksum_address(buyer_addr)
    eth_balance = w3.from_wei(w3.eth.get_balance(buyer_checksum), 'ether')
    
    print(f"\n⛽ Gas Balance: {float(eth_balance):.6f} ETH")
    
    if float(eth_balance) < 0.00005:
        print("\n❌ Insufficient ETH for gas fees!")
        print("\n📍 Get more ETH by running:")
        print("   node x402/request_faucet.js")
        print(f"\n   Wallet: {buyer_addr}")
        return False
    
    # Check balances before
    print("\n📊 USDC Balances BEFORE:")
    buyer_balance_before = get_usdc_balance(w3, usdc_contract, buyer_addr)
    seller_balance_before = get_usdc_balance(w3, usdc_contract, seller_addr)
    print(f"   Buyer:  {buyer_balance_before:.6f} USDC")
    print(f"   Seller: {seller_balance_before:.6f} USDC")
    
    # Check if buyer has enough USDC balance
    if buyer_balance_before < amount_usdc:
        print(f"\n❌ Insufficient USDC! Buyer has {buyer_balance_before} USDC, needs {amount_usdc} USDC")
        print("\n📍 Get testnet USDC from: https://faucet.circle.com/")
        return False
    
    # Convert amount to smallest unit (6 decimals for USDC)
    amount_raw = int(amount_usdc * 1_000_000)
    
    # Build transaction
    print("\n🔨 Building transaction...")
    
    seller_checksum = Web3.to_checksum_address(seller_addr)
    
    # Get nonce
    nonce = w3.eth.get_transaction_count(buyer_checksum)
    
    # Get gas price
    gas_price = w3.eth.gas_price
    
    # Build the transfer transaction
    tx = usdc_contract.functions.transfer(
        seller_checksum,
        amount_raw
    ).build_transaction({
        'chainId': CHAIN_ID,
        'gas': 100000,  # Estimate for ERC20 transfer
        'gasPrice': gas_price,
        'nonce': nonce,
    })
    
    # Sign transaction
    print("✍️  Signing transaction...")
    signed_tx = w3.eth.account.sign_transaction(tx, buyer_private_key)
    
    # Send transaction
    print("📡 Sending transaction...")
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    tx_hash_hex = tx_hash.hex()
    print(f"   TX Hash: {tx_hash_hex}")
    print(f"   Explorer: https://sepolia.basescan.org/tx/{tx_hash_hex}")
    
    # Wait for confirmation
    print("\n⏳ Waiting for confirmation...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    
    if receipt.status == 1:
        print("✅ Transaction confirmed!")
        print(f"   Block: {receipt.blockNumber}")
        print(f"   Gas Used: {receipt.gasUsed}")
    else:
        print("❌ Transaction failed!")
        return False
    
    # Check balances after
    print("\n📊 Balances AFTER:")
    buyer_balance_after = get_usdc_balance(w3, usdc_contract, buyer_addr)
    seller_balance_after = get_usdc_balance(w3, usdc_contract, seller_addr)
    print(f"   Buyer:  {buyer_balance_after:.6f} USDC (change: {buyer_balance_after - buyer_balance_before:+.6f})")
    print(f"   Seller: {seller_balance_after:.6f} USDC (change: {seller_balance_after - seller_balance_before:+.6f})")
    
    print("\n" + "=" * 60)
    print("✅ Payment completed successfully!")
    print("=" * 60)
    
    return True


if __name__ == "__main__":
    import sys
    
    # Allow custom amount via command line
    amount = 0.0001
    if len(sys.argv) > 1:
        try:
            amount = float(sys.argv[1])
        except ValueError:
            print(f"Invalid amount: {sys.argv[1]}")
            sys.exit(1)
    
    success = send_usdc_payment(amount)
    sys.exit(0 if success else 1)

