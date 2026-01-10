/**
 * Request ETH from Coinbase CDP Faucet - Base Sepolia
 * 
 * Usage: node x402/request_faucet.js
 * 
 * Requires:
 *   - npm install @coinbase/cdp-sdk dotenv
 *   - CDP API credentials in .env file
 */

import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Load environment variables
dotenv.config({ path: join(projectRoot, ".env") });

async function requestFaucet() {
  console.log("=".repeat(60));
  console.log("🚰 CDP FAUCET REQUEST - Base Sepolia");
  console.log("=".repeat(60));

  // Check for CDP credentials
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  const apiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;

  if (!apiKeyId || (!apiKeySecret && !apiKeyPrivateKey)) {
    console.log("\n❌ Missing CDP API credentials!");
    console.log("\nTo get CDP API keys:");
    console.log("   1. Go to: https://portal.cdp.coinbase.com/");
    console.log("   2. Create a new API key");
    console.log("   3. Download the JSON key file");
    console.log("   4. Add to your .env file:");
    console.log("");
    console.log("      CDP_API_KEY_ID=your-api-key-id");
    console.log("      CDP_API_KEY_PRIVATE_KEY=\"-----BEGIN EC PRIVATE KEY-----\\n...\\n-----END EC PRIVATE KEY-----\"");
    console.log("");
    console.log("   Or create a cdp_api_key.json file in the project root with the downloaded key.");
    process.exit(1);
  }

  // Initialize CDP client with proper configuration
  let cdpConfig = {};
  
  // Try to load from JSON key file first
  const keyFilePath = join(projectRoot, "cdp_api_key.json");
  if (existsSync(keyFilePath)) {
    console.log("\n📁 Loading credentials from cdp_api_key.json...");
    const keyData = JSON.parse(readFileSync(keyFilePath, "utf8"));
    cdpConfig = {
      apiKeyId: keyData.id || keyData.name || keyData.apiKeyId,
      apiKeySecret: keyData.privateKey || keyData.apiKeySecret,
    };
  } else if (apiKeyPrivateKey) {
    // Use private key from env (handle escaped newlines)
    const privateKey = apiKeyPrivateKey.replace(/\\n/g, "\n");
    cdpConfig = {
      apiKeyId: apiKeyId,
      apiKeySecret: privateKey,
    };
  } else if (apiKeySecret) {
    cdpConfig = {
      apiKeyId: apiKeyId,
      apiKeySecret: apiKeySecret,
    };
  }

  console.log(`\n🔑 Using API Key: ${cdpConfig.apiKeyId?.substring(0, 20)}...`);
  
  const cdp = new CdpClient(cdpConfig);

  // Load wallet addresses
  let buyerAddress = process.env.BUYER_WALLET_ADDRESS;
  let sellerAddress = process.env.SELLER_WALLET_ADDRESS;

  // Fallback to demo_wallets.json
  if (!buyerAddress || !sellerAddress) {
    const walletsPath = join(projectRoot, "demo_wallets.json");
    if (existsSync(walletsPath)) {
      const wallets = JSON.parse(readFileSync(walletsPath, "utf8"));
      buyerAddress = wallets.buyer.address;
      sellerAddress = wallets.seller.address;
    } else {
      console.log("\n❌ No wallet addresses found!");
      console.log("   Run: python x402/demo_wallets.py");
      process.exit(1);
    }
  }

  console.log(`\n📤 Buyer:  ${buyerAddress}`);
  console.log(`📥 Seller: ${sellerAddress}`);

  // Request ETH for buyer
  console.log("\n🔄 Requesting ETH for Buyer wallet...");
  try {
    const buyerFaucet = await cdp.evm.requestFaucet({
      address: buyerAddress,
      network: "base-sepolia",
      token: "eth",
    });
    console.log(`   ✅ Success!`);
    console.log(`   TX: https://sepolia.basescan.org/tx/${buyerFaucet.transactionHash}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Request ETH for seller
  console.log("\n🔄 Requesting ETH for Seller wallet...");
  try {
    const sellerFaucet = await cdp.evm.requestFaucet({
      address: sellerAddress,
      network: "base-sepolia",
      token: "eth",
    });
    console.log(`   ✅ Success!`);
    console.log(`   TX: https://sepolia.basescan.org/tx/${sellerFaucet.transactionHash}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Request USDC for buyer (for payments)
  console.log("\n🔄 Requesting USDC for Buyer wallet...");
  try {
    const usdcFaucet = await cdp.evm.requestFaucet({
      address: buyerAddress,
      network: "base-sepolia",
      token: "usdc",
    });
    console.log(`   ✅ Success!`);
    console.log(`   TX: https://sepolia.basescan.org/tx/${usdcFaucet.transactionHash}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Faucet requests complete!");
  console.log("=".repeat(60));
  console.log("\n💡 Wait ~30 seconds for transactions to confirm, then run:");
  console.log("   python x402/check_balances.py");
  console.log("");
}

requestFaucet().catch(console.error);

