"""
Demo Wallet Generator for x402 Hackathon
==========================================

Quickly generate test wallets for buyer and seller on Base Sepolia testnet.
"""

import os
import json
from pathlib import Path
from eth_account import Account

# Enable unaudited HD wallet features for mnemonic generation
Account.enable_unaudited_hdwallet_features()


def generate_wallet():
    """
    Generate a new Ethereum wallet with private key and address.
    
    Returns:
        dict: Wallet info with address, private_key, and mnemonic
    """
    # Generate account with mnemonic for backup
    account, mnemonic = Account.create_with_mnemonic()
    
    return {
        "address": account.address,
        "private_key": account.key.hex(),
        "mnemonic": mnemonic
    }


def generate_demo_wallets():
    """
    Generate a pair of demo wallets for buyer and seller.
    
    Returns:
        dict: Contains buyer and seller wallet information
    """
    print("🔐 Generating Demo Wallets for x402 Hackathon...")
    print("=" * 60)
    
    buyer_wallet = generate_wallet()
    seller_wallet = generate_wallet()
    
    wallets = {
        "buyer": buyer_wallet,
        "seller": seller_wallet,
        "network": {
            "name": "Base Sepolia (Testnet)",
            "chain_id": 84532,
            "rpc_url": "https://sepolia.base.org",
            "explorer": "https://sepolia.basescan.org"
        }
    }
    
    print("\n💰 BUYER WALLET (pays for resources)")
    print("-" * 40)
    print(f"   Address: {buyer_wallet['address']}")
    print(f"   Private Key: {buyer_wallet['private_key']}")
    print(f"   Mnemonic: {buyer_wallet['mnemonic']}")
    
    print("\n🏪 SELLER WALLET (receives payments)")
    print("-" * 40)
    print(f"   Address: {seller_wallet['address']}")
    print(f"   Private Key: {seller_wallet['private_key']}")
    print(f"   Mnemonic: {seller_wallet['mnemonic']}")
    
    return wallets


def save_wallets_to_env(wallets: dict, env_path: str = ".env"):
    """
    Save wallet credentials to .env file.
    
    Args:
        wallets: Wallet dictionary from generate_demo_wallets()
        env_path: Path to .env file
    """
    env_content = f"""# x402 Demo Wallets - Base Sepolia Testnet
# Generated for hackathon demo - DO NOT use in production!

# Buyer wallet - makes payments
BUYER_WALLET_ADDRESS={wallets['buyer']['address']}
BUYER_PRIVATE_KEY={wallets['buyer']['private_key']}

# Seller wallet - receives payments
SELLER_WALLET_ADDRESS={wallets['seller']['address']}
SELLER_PRIVATE_KEY={wallets['seller']['private_key']}

# Network configuration
NETWORK_RPC_URL=https://sepolia.base.org
CHAIN_ID=84532

# x402 Facilitator
FACILITATOR_URL=https://x402.org/facilitator
"""
    
    # Get the project root (parent of x402 folder)
    project_root = Path(__file__).parent.parent
    env_file = project_root / env_path
    
    # Check if .env already exists
    if env_file.exists():
        print(f"\n⚠️  {env_path} already exists!")
        response = input("   Overwrite? (y/N): ").strip().lower()
        if response != 'y':
            print("   Skipping .env file creation.")
            return
    
    with open(env_file, 'w') as f:
        f.write(env_content)
    
    print(f"\n✅ Saved to {env_file}")


def save_wallets_to_json(wallets: dict, json_path: str = "demo_wallets.json"):
    """
    Save wallet info to JSON file for reference.
    
    Args:
        wallets: Wallet dictionary from generate_demo_wallets()
        json_path: Path to JSON file
    """
    project_root = Path(__file__).parent.parent
    json_file = project_root / json_path
    
    with open(json_file, 'w') as f:
        json.dump(wallets, f, indent=2)
    
    print(f"✅ Saved wallet backup to {json_file}")


def print_funding_instructions(wallets: dict):
    """
    Print instructions for funding the demo wallets with testnet tokens.
    """
    buyer_addr = wallets['buyer']['address']
    seller_addr = wallets['seller']['address']
    
    print("\n" + "=" * 60)
    print("🚰 FUNDING YOUR DEMO WALLETS")
    print("=" * 60)
    
    print("\n📍 Step 1: Get Base Sepolia USDC (for payments)")
    print("-" * 40)
    print("   The x402 protocol uses USDC for payments.")
    print("   USDC Contract on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e")
    print("\n   Get testnet USDC from Circle Faucet:")
    print("   • https://faucet.circle.com/")
    print("     (Select 'Base Sepolia' network)")
    print(f"\n   Fund BUYER wallet with USDC: {buyer_addr}")
    
    print("\n📍 Step 2: Verify balances")
    print("-" * 40)
    print("   Check your wallets on Base Sepolia Explorer:")
    print(f"   • Buyer:  https://sepolia.basescan.org/address/{buyer_addr}")
    print(f"   • Seller: https://sepolia.basescan.org/address/{seller_addr}")
    
    print("\n💡 TIP: You only need to fund the BUYER wallet with USDC")
    print("   The SELLER wallet just receives payments.")


def check_usdc_balance(address: str):
    """
    Check the USDC balance of a wallet on Base Sepolia.
    
    Args:
        address: Wallet address to check
        
    Returns:
        float: Balance in USDC
    """
    try:
        from web3 import Web3
        
        w3 = Web3(Web3.HTTPProvider("https://sepolia.base.org"))
        
        # USDC contract on Base Sepolia
        usdc_address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
        
        # Minimal ERC20 ABI for balanceOf
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
        
        balance = usdc_contract.functions.balanceOf(
            Web3.to_checksum_address(address)
        ).call()
        
        # USDC has 6 decimals
        return balance / 1_000_000
        
    except Exception as e:
        print(f"   Error checking USDC balance: {e}")
        return 0.0


def check_all_balances(wallets: dict):
    """
    Check and display USDC balances for both wallets.
    """
    print("\n" + "=" * 60)
    print("💰 USDC BALANCES")
    print("=" * 60)
    
    for role in ['buyer', 'seller']:
        addr = wallets[role]['address']
        usdc_balance = check_usdc_balance(addr)
        
        status_usdc = "✅" if usdc_balance > 0 else "❌"
        
        print(f"\n{role.upper()} ({addr[:10]}...{addr[-6:]})")
        print(f"   {status_usdc} USDC: {usdc_balance:.2f}")


# =============================================================================
# MAIN - Interactive Wallet Setup
# =============================================================================

if __name__ == "__main__":
    print("\n" + "🎯 " * 20)
    print("\n   x402 HACKATHON DEMO WALLET GENERATOR")
    print("   Base Sepolia Testnet")
    print("\n" + "🎯 " * 20)
    
    # Generate wallets
    wallets = generate_demo_wallets()
    
    # Ask to save
    print("\n" + "=" * 60)
    print("💾 SAVE OPTIONS")
    print("=" * 60)
    
    save_env = input("\nSave to .env file? (Y/n): ").strip().lower()
    if save_env != 'n':
        save_wallets_to_env(wallets)
    
    save_json = input("Save backup to JSON? (Y/n): ").strip().lower()
    if save_json != 'n':
        save_wallets_to_json(wallets)
    
    # Print funding instructions
    print_funding_instructions(wallets)
    
    # Check balances (requires web3)
    check_balances = input("\nCheck current balances? (y/N): ").strip().lower()
    if check_balances == 'y':
        check_all_balances(wallets)
    
    print("\n" + "=" * 60)
    print("🚀 You're ready to build with x402!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Fund your wallets using the faucets above")
    print("2. Run your x402 payment server")
    print("3. Test payments between buyer and seller")
    print("\nHappy hacking! 🎉\n")

