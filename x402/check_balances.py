"""
Check Wallet Balances - Base Sepolia Testnet
=============================================

Verify ETH and USDC balances for your demo wallets.
"""

import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


# Multiple RPC endpoints for Base Sepolia (fallback list)
BASE_SEPOLIA_RPCS = [
    "https://sepolia.base.org",
    "https://base-sepolia.blockpi.network/v1/rpc/public",
    "https://base-sepolia-rpc.publicnode.com",
    "https://rpc.notadegen.com/base/sepolia",
    "https://base-sepolia.drpc.org",
]


def get_web3_connection():
    """Try multiple RPC endpoints until one works."""
    from web3 import Web3
    
    # Try custom RPC from env first
    custom_rpc = os.getenv("NETWORK_RPC_URL")
    if custom_rpc:
        BASE_SEPOLIA_RPCS.insert(0, custom_rpc)
    
    for rpc_url in BASE_SEPOLIA_RPCS:
        try:
            print(f"   Trying: {rpc_url[:40]}...")
            w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 10}))
            if w3.is_connected():
                print(f"   ✅ Connected!")
                return w3
        except Exception as e:
            continue
    
    return None


def check_balances():
    """Check ETH and USDC balances for buyer and seller wallets."""
    from web3 import Web3
    
    # Get wallet addresses from environment or JSON file
    buyer_addr = os.getenv("BUYER_WALLET_ADDRESS")
    seller_addr = os.getenv("SELLER_WALLET_ADDRESS")
    
    # Fallback to JSON file if env vars not set
    if not buyer_addr or not seller_addr:
        project_root = Path(__file__).parent.parent
        json_file = project_root / "demo_wallets.json"
        
        if json_file.exists():
            with open(json_file, 'r') as f:
                wallets = json.load(f)
            buyer_addr = wallets['buyer']['address']
            seller_addr = wallets['seller']['address']
        else:
            print("❌ No wallet addresses found!")
            print("   Run demo_wallets.py first or set environment variables.")
            return
    
    # Connect to Base Sepolia with fallback RPCs
    print("\n🔌 Connecting to Base Sepolia...")
    w3 = get_web3_connection()
    
    if not w3:
        print("\n❌ Failed to connect to any Base Sepolia RPC")
        print("\nTroubleshooting:")
        print("   1. Check your internet connection")
        print("   2. Try again in a few minutes (RPCs may be rate-limited)")
        print("   3. Set a custom RPC in .env: NETWORK_RPC_URL=https://your-rpc-url")
        print("\nFree RPC providers:")
        print("   • https://www.alchemy.com/chain-connect/chain/base-sepolia")
        print("   • https://www.infura.io/")
        print("   • https://www.quicknode.com/")
        return
    
    # USDC contract on Base Sepolia
    usdc_address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    erc20_abi = [
        {
            "constant": True,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
        }
    ]
    usdc_contract = w3.eth.contract(
        address=Web3.to_checksum_address(usdc_address), 
        abi=erc20_abi
    )
    
    print("=" * 60)
    print("💰 WALLET BALANCES - Base Sepolia Testnet")
    print("=" * 60)
    
    needs_funding = []
    
    for role, addr in [("BUYER", buyer_addr), ("SELLER", seller_addr)]:
        try:
            eth_balance = w3.from_wei(w3.eth.get_balance(addr), 'ether')
            usdc_raw = usdc_contract.functions.balanceOf(
                Web3.to_checksum_address(addr)
            ).call()
            usdc_balance = usdc_raw / 1_000_000  # USDC has 6 decimals
            
            eth_status = "✅" if float(eth_balance) > 0.001 else "❌"
            usdc_status = "✅" if usdc_balance > 0 else "❌"
            
            print(f"\n{role}")
            print(f"  Address: {addr}")
            print(f"  {eth_status} ETH:  {eth_balance:.6f}")
            print(f"  {usdc_status} USDC: {usdc_balance:.2f}")
            
            # Track what needs funding
            if float(eth_balance) < 0.001:
                needs_funding.append((role, "ETH"))
            if role == "BUYER" and usdc_balance == 0:
                needs_funding.append((role, "USDC"))
                
        except Exception as e:
            print(f"\n{role}")
            print(f"  Address: {addr}")
            print(f"  ❌ Error: {e}")
    
    # Print funding instructions if needed
    if needs_funding:
        print("\n" + "=" * 60)
        print("⚠️  FUNDING NEEDED")
        print("=" * 60)
        
        eth_needed = any(f[1] == "ETH" for f in needs_funding)
        usdc_needed = any(f[1] == "USDC" for f in needs_funding)
        
        if eth_needed:
            print("\n📍 Get Base Sepolia ETH (for gas):")
            print("   • https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet")
            print("   • https://faucet.quicknode.com/base/sepolia")
        
        if usdc_needed:
            print("\n📍 Get Base Sepolia USDC (for payments):")
            print("   • https://faucet.circle.com/ (select Base Sepolia)")
            print(f"   • Fund buyer: {buyer_addr}")
    else:
        print("\n" + "=" * 60)
        print("✅ All wallets funded and ready!")
        print("=" * 60)
    
    print("\n📊 View on Explorer:")
    print(f"   Buyer:  https://sepolia.basescan.org/address/{buyer_addr}")
    print(f"   Seller: https://sepolia.basescan.org/address/{seller_addr}")
    print()


if __name__ == "__main__":
    check_balances()

