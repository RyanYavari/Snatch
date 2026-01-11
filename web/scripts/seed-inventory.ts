/**
 * Inventory Seeding Script
 * 
 * Populates the inventory collection with dummy items and mock embeddings.
 * Uses dummy 2048-dim embeddings for testing (no Voyage API required).
 * 
 * Usage:
 *   npm run seed:inventory
 *   OR
 *   tsx scripts/seed-inventory.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import mongoose from 'mongoose';
import { InventoryItem } from '../lib/models/Inventory';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

// Single seller wallet for all items
const SELLER_WALLET = '0x33084A8155C172D02A5a02e03b55B04899c474d9';


/**
 * Generate a random 2048-dim embedding for testing
 * In production, these would come from Voyage AI
 */
function generateDummyEmbedding(seed: number = 0): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < 2048; i++) {
    // Generate pseudo-random values based on seed for consistency
    embedding.push(Math.sin(seed * 1000 + i) * 0.5 + 0.5);
  }
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

// Dummy inventory items matching the schema:
// {id, size, price, image, SELLER_WALLET_ADDRESS, metadata, metadata_embedding, image_embedding}
const dummyItems = [
  {
    id: 'item_001',
    size: 'M',
    price: 150,
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Vintage Leather Jacket',
      description: 'Brown leather jacket, excellent condition',
      category: 'clothing', 
      condition: 'excellent',
      color: 'brown'
    },
  },
  {
    id: 'item_002',
    size: 'One Size',
    price: 80,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Designer Sunglasses',
      description: 'Black aviator sunglasses, brand new',
      category: 'accessories', 
      condition: 'new',
      brand: 'designer'
    },
  },
  {
    id: 'item_003',
    size: '10',
    price: 45,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Classic White Sneakers',
      description: 'White canvas sneakers, lightly used',
      category: 'footwear', 
      condition: 'good'
    },
  },
  {
    id: 'item_004',
    size: 'One Size',
    price: 200,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Smart Watch',
      description: 'Black smartwatch with fitness tracking, like new',
      category: 'electronics', 
      condition: 'like-new',
      features: ['fitness', 'notifications']
    },
  },
  {
    id: 'item_005',
    size: '32x32',
    price: 55,
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Denim Jeans',
      description: 'Blue denim jeans, good condition',
      category: 'clothing', 
      condition: 'good',
      color: 'blue'
    },
  },
  {
    id: 'item_006',
    size: 'One Size',
    price: 65,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Backpack',
      description: 'Black backpack with laptop compartment, excellent condition',
      category: 'bags', 
      condition: 'excellent',
      features: ['laptop-compartment']
    },
  },
  {
    id: 'item_007',
    size: 'One Size',
    price: 25,
    image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Baseball Cap',
      description: 'Red baseball cap with logo, new',
      category: 'accessories', 
      condition: 'new',
      color: 'red'
    },
  },
  {
    id: 'item_008',
    size: 'One Size',
    price: 90,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Wireless Earbuds',
      description: 'Black wireless earbuds with charging case, excellent',
      category: 'electronics', 
      condition: 'excellent',
      features: ['wireless', 'noise-cancelling']
    },
  },
  {
    id: 'item_009',
    size: 'L',
    price: 40,
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Hoodie',
      description: 'Gray hoodie, good condition',
      category: 'clothing', 
      condition: 'good',
      color: 'gray'
    },
  },
  {
    id: 'item_010',
    size: '9',
    price: 75,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    SELLER_WALLET_ADDRESS: SELLER_WALLET,
    metadata: { 
      name: 'Running Shoes',
      description: 'Blue running shoes, excellent condition',
      category: 'footwear', 
      condition: 'excellent',
      type: 'running'
    },
  },
];

async function seedInventory() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Clear existing inventory (optional - comment out if you want to keep existing items)
    const existingCount = await InventoryItem.countDocuments();
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing items. Clearing...`);
      await InventoryItem.deleteMany({});
      console.log('Cleared existing inventory');
    }

    console.log(`\nSeeding ${dummyItems.length} items with dummy 2048-dim embeddings...`);
    console.log(`All items using seller wallet: ${SELLER_WALLET}\n`);

    // Process items one by one
    for (let i = 0; i < dummyItems.length; i++) {
      const item = dummyItems[i];
      console.log(`[${i + 1}/${dummyItems.length}] Processing: ${item.metadata.name}`);

      try {
        // Generate dummy embeddings (2048 dimensions each)
        const image_embedding = generateDummyEmbedding(i);
        const metadata_embedding = generateDummyEmbedding(i + 100);

        // Create inventory item
        const inventoryItem = new InventoryItem({
          ...item,
          image_embedding,
          metadata_embedding,
        });

        await inventoryItem.save();
        console.log(`  ✅ Saved: ${item.metadata.name} (${item.id}) - $${item.price}\n`);
      } catch (error: any) {
        console.error(`  ❌ Error processing ${item.metadata.name}:`, error.message);
        // Continue with next item
      }
    }

    // Verify seeding
    const finalCount = await InventoryItem.countDocuments();
    console.log(`\n✅ Seeding complete! Total items in inventory: ${finalCount}`);

    // Display summary
    const items = await InventoryItem.find({}).select('id size price SELLER_WALLET_ADDRESS metadata');
    console.log('\n📦 Inventory Summary:');
    console.log(`   Seller Wallet: ${SELLER_WALLET}`);
    console.log('   Items:');
    items.forEach((item) => {
      console.log(`     - ${item.id}: ${item.metadata?.name || 'Unknown'} - Size: ${item.size} - $${item.price}`);
    });

    console.log('\n⚠️  Note: Using dummy 2048-dim embeddings for testing.');
    console.log('    For production, embeddings should come from Voyage AI.\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding inventory:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the seeding script
if (require.main === module) {
  seedInventory();
}

export default seedInventory;
