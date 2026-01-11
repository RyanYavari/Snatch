/**
 * Inventory Seeding Script
 * 
 * Populates the inventory collection with dummy items and their Voyage AI embeddings.
 * 
 * Usage:
 *   npm run seed:inventory
 *   OR
 *   tsx scripts/seed-inventory.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import mongoose from 'mongoose';
import { Voyage } from '@voyageai/voyageai';
import { InventoryItem } from '../lib/models/Inventory';

// Load environment variables from root .env file
config({ path: resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (!VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY environment variable is required');
}

// Dummy inventory items with image URLs
// Using publicly available placeholder images
const dummyItems = [
  {
    item_id: 'item_001',
    name: 'Vintage Leather Jacket',
    description: 'Brown leather jacket, size M, excellent condition',
    selling_price: 150,
    minimum_price: 120,
    seller: 'FashionStore',
    seller_wallet: '0x33084A8155C172D02A5a02e03b55B04899c474d9',
    image_url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400',
    metadata: { category: 'clothing', condition: 'excellent', size: 'M' },
  },
  {
    item_id: 'item_002',
    name: 'Designer Sunglasses',
    description: 'Black aviator sunglasses, brand new',
    selling_price: 80,
    minimum_price: 60,
    seller: 'AccessoriesHub',
    seller_wallet: '0x44084A8155C172D02A5a02e03b55B04899c474d0',
    image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400',
    metadata: { category: 'accessories', condition: 'new', brand: 'designer' },
  },
  {
    item_id: 'item_003',
    name: 'Classic White Sneakers',
    description: 'White canvas sneakers, size 10, lightly used',
    selling_price: 45,
    minimum_price: 35,
    seller: 'ShoeStore',
    seller_wallet: '0x55084A8155C172D02A5a02e03b55B04899c474d1',
    image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    metadata: { category: 'footwear', condition: 'good', size: '10' },
  },
  {
    item_id: 'item_004',
    name: 'Smart Watch',
    description: 'Black smartwatch with fitness tracking, like new',
    selling_price: 200,
    minimum_price: 170,
    seller: 'TechDeals',
    seller_wallet: '0x66084A8155C172D02A5a02e03b55B04899c474d2',
    image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    metadata: { category: 'electronics', condition: 'like-new', features: ['fitness', 'notifications'] },
  },
  {
    item_id: 'item_005',
    name: 'Denim Jeans',
    description: 'Blue denim jeans, size 32x32, good condition',
    selling_price: 55,
    minimum_price: 40,
    seller: 'FashionStore',
    seller_wallet: '0x33084A8155C172D02A5a02e03b55B04899c474d9',
    image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400',
    metadata: { category: 'clothing', condition: 'good', size: '32x32' },
  },
  {
    item_id: 'item_006',
    name: 'Backpack',
    description: 'Black backpack with laptop compartment, excellent condition',
    selling_price: 65,
    minimum_price: 50,
    seller: 'AccessoriesHub',
    seller_wallet: '0x44084A8155C172D02A5a02e03b55B04899c474d0',
    image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400',
    metadata: { category: 'bags', condition: 'excellent', features: ['laptop-compartment'] },
  },
  {
    item_id: 'item_007',
    name: 'Baseball Cap',
    description: 'Red baseball cap with logo, new',
    selling_price: 25,
    minimum_price: 18,
    seller: 'AccessoriesHub',
    seller_wallet: '0x44084A8155C172D02A5a02e03b55B04899c474d0',
    image_url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400',
    metadata: { category: 'accessories', condition: 'new', color: 'red' },
  },
  {
    item_id: 'item_008',
    name: 'Wireless Earbuds',
    description: 'Black wireless earbuds with charging case, excellent',
    selling_price: 90,
    minimum_price: 70,
    seller: 'TechDeals',
    seller_wallet: '0x66084A8155C172D02A5a02e03b55B04899c474d2',
    image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400',
    metadata: { category: 'electronics', condition: 'excellent', features: ['wireless', 'noise-cancelling'] },
  },
  {
    item_id: 'item_009',
    name: 'Hoodie',
    description: 'Gray hoodie, size L, good condition',
    selling_price: 40,
    minimum_price: 30,
    seller: 'FashionStore',
    seller_wallet: '0x33084A8155C172D02A5a02e03b55B04899c474d9',
    image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400',
    metadata: { category: 'clothing', condition: 'good', size: 'L', color: 'gray' },
  },
  {
    item_id: 'item_010',
    name: 'Running Shoes',
    description: 'Blue running shoes, size 9, excellent condition',
    selling_price: 75,
    minimum_price: 60,
    seller: 'ShoeStore',
    seller_wallet: '0x55084A8155C172D02A5a02e03b55B04899c474d1',
    image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    metadata: { category: 'footwear', condition: 'excellent', size: '9', type: 'running' },
  },
];

async function generateEmbedding(imageUrl: string, voyageClient: Voyage): Promise<number[]> {
  try {
    console.log(`Generating embedding for: ${imageUrl}`);
    const response = await voyageClient.embed(
      [{ image: imageUrl }],
      { model: 'voyage-multimodal-3' }
    );

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data returned from Voyage AI');
    }

    const embedding = response.data[0].embedding;
    
    if (!embedding || embedding.length !== 1024) {
      throw new Error(`Invalid embedding dimensions: expected 1024, got ${embedding?.length || 0}`);
    }

    return embedding;
  } catch (error) {
    console.error(`Error generating embedding for ${imageUrl}:`, error);
    throw error;
  }
}

async function seedInventory() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Initialize Voyage AI client
    const voyageClient = new Voyage(VOYAGE_API_KEY!);
    console.log('Initialized Voyage AI client');

    // Clear existing inventory (optional - comment out if you want to keep existing items)
    const existingCount = await InventoryItem.countDocuments();
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing items. Clearing...`);
      await InventoryItem.deleteMany({});
      console.log('Cleared existing inventory');
    }

    console.log(`\nSeeding ${dummyItems.length} items...\n`);

    // Process items one by one to generate embeddings
    for (let i = 0; i < dummyItems.length; i++) {
      const item = dummyItems[i];
      console.log(`[${i + 1}/${dummyItems.length}] Processing: ${item.name}`);

      try {
        // Generate embedding for the item's image
        const embedding = await generateEmbedding(item.image_url, voyageClient);

        // Create inventory item
        const inventoryItem = new InventoryItem({
          ...item,
          embedding,
        });

        await inventoryItem.save();
        console.log(`  ✅ Saved: ${item.name} (${item.item_id})\n`);
      } catch (error: any) {
        console.error(`  ❌ Error processing ${item.name}:`, error.message);
        // Continue with next item
      }
    }

    // Verify seeding
    const finalCount = await InventoryItem.countDocuments();
    console.log(`\n✅ Seeding complete! Total items in inventory: ${finalCount}`);

    // Display summary
    const items = await InventoryItem.find({}).select('item_id name selling_price seller');
    console.log('\n📦 Inventory Summary:');
    items.forEach((item) => {
      console.log(`  - ${item.item_id}: ${item.name} - $${item.selling_price} (${item.seller})`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
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
