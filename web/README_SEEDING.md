# Inventory Seeding Guide

## Quick Start

1. **Install dependencies** (if not already installed):
   ```bash
   cd web
   npm install
   ```

2. **Ensure environment variables are set** in `Snatch/.env`:
   - `MONGODB_URI` - Your MongoDB Atlas connection string
   - `VOYAGE_API_KEY` - Your Voyage AI API key

3. **Run the seeding script**:
   ```bash
   npm run seed:inventory
   ```

## What the Script Does

1. **Connects to MongoDB** using your `MONGODB_URI`
2. **Clears existing inventory** (optional - can be disabled)
3. **Processes 10 dummy items**:
   - Generates Voyage AI embeddings for each item's image
   - Saves items to the `inventory` collection
   - Includes: item_id, name, description, selling_price, minimum_price, seller, seller_wallet, image_url, embedding, metadata

## Dummy Items Included

- Vintage Leather Jacket ($150)
- Designer Sunglasses ($80)
- Classic White Sneakers ($45)
- Smart Watch ($200)
- Denim Jeans ($55)
- Backpack ($65)
- Baseball Cap ($25)
- Wireless Earbuds ($90)
- Hoodie ($40)
- Running Shoes ($75)

Each item includes:
- Unique `item_id`
- `selling_price` and `minimum_price`
- `seller` name and `seller_wallet` address
- Image URL (using Unsplash placeholder images)
- 1024-dimensional embedding from Voyage AI Multimodal-3

## Troubleshooting

### Error: "MONGODB_URI environment variable is required"
- Make sure `Snatch/.env` file exists and contains `MONGODB_URI=...`
- The script loads from the root `.env` file

### Error: "VOYAGE_API_KEY environment variable is required"
- Add `VOYAGE_API_KEY=...` to `Snatch/.env`

### Error: "Cannot find module 'tsx'"
- Run `npm install` to install dev dependencies

### Embedding Generation Fails
- Check your Voyage API key is valid
- Ensure you have API credits/quota
- Check image URLs are accessible (Unsplash images should work)

## After Seeding

Once seeding is complete:
1. Verify items in MongoDB Atlas (should see 10 items in `inventory` collection)
2. Test Scout Agent:
   ```bash
   curl -X POST http://localhost:3000/api/agents/scout
   ```
3. The Scout Agent should be able to find items via vector search

## Customizing Dummy Data

Edit `web/scripts/seed-inventory.ts` to:
- Add more items to the `dummyItems` array
- Change prices, sellers, descriptions
- Use different image URLs
- Modify metadata

## Notes

- The script uses publicly available Unsplash images for dummy data
- Each item's embedding is generated fresh (takes a few seconds per item)
- Total seeding time: ~30-60 seconds for 10 items
- The script clears existing inventory by default (comment out the delete section if you want to keep existing items)
