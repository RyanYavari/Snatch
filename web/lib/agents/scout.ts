import { Voyage } from '@voyageai/voyageai';
import { MongoClient, Db } from 'mongodb';
import { Request, RequestStatus, FoundItem } from '@/lib/models/Request';
import { InventoryItem } from '@/lib/models/Inventory';
import connectDB from '@/lib/mongodb';

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI!;

if (!VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY environment variable is required');
}

export class ScoutAgent {
  private voyageClient: Voyage;
  private mongoClient: MongoClient | null = null;

  constructor() {
    this.voyageClient = new Voyage(VOYAGE_API_KEY);
  }

  /**
   * Generate embedding for an image using Voyage AI Multimodal-3
   */
  async generateEmbedding(imageUrl: string): Promise<number[]> {
    try {
      const response = await this.voyageClient.embed(
        [{ image: imageUrl }],
        { model: 'voyage-multimodal-3' }
      );

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from Voyage AI');
      }

      // Voyage AI returns embeddings in the data array
      const embedding = response.data[0].embedding;
      
      if (!embedding || embedding.length !== 1024) {
        throw new Error(`Invalid embedding dimensions: expected 1024, got ${embedding?.length || 0}`);
      }

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Perform vector search in MongoDB Atlas using $vectorSearch aggregation
   */
  async vectorSearch(
    embedding: number[],
    limit: number = 5
  ): Promise<FoundItem[]> {
    if (!this.mongoClient) {
      this.mongoClient = new MongoClient(MONGODB_URI);
      await this.mongoClient.connect();
    }

    // Extract database name from URI or use default
    const dbName = MONGODB_URI.match(/\/\/(?:[^@]+@)?[^/]+\/([^?]+)/)?.[1] || 'snatch';
    const db = this.mongoClient.db(dbName);
    const collection = db.collection('inventory');

    try {
      // MongoDB Atlas $vectorSearch aggregation pipeline
      const pipeline = [
        {
          $vectorSearch: {
            index: 'inventory_embedding_index', // Atlas vector search index name
            path: 'embedding',
            queryVector: embedding,
            numCandidates: limit * 10, // Search more candidates for better results
            limit: limit,
          },
        },
        {
          $project: {
            item_id: 1,
            name: 1,
            selling_price: 1,
            price: 1, // Legacy field
            minimum_price: 1,
            seller: 1,
            seller_wallet: 1,
            description: 1,
            image_url: 1,
            metadata: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      const results = await collection.aggregate(pipeline).toArray();

      return results.map((item) => ({
        item_id: item.item_id,
        name: item.name,
        selling_price: item.selling_price || item.price, // Support both fields
        price: item.selling_price || item.price, // Legacy compatibility
        minimum_price: item.minimum_price,
        seller: item.seller,
        seller_wallet: item.seller_wallet,
        description: item.description,
        url: item.image_url,
        score: item.score,
      }));
    } catch (error) {
      console.error('Error performing vector search:', error);
      throw error;
    }
  }

  /**
   * Process a NEW request: generate embedding, search, and update status to FOUND
   */
  async processNewRequest(requestId: string): Promise<void> {
    await connectDB();

    const request = await Request.findById(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    if (request.status !== RequestStatus.NEW) {
      console.log(`Request ${requestId} is not NEW, skipping`);
      return;
    }

    try {
      console.log(`Scout: Processing NEW request ${requestId}`);

      // Generate embedding for target image
      const embedding = await this.generateEmbedding(
        request.target_item.image_url
      );

      // Update target_item with embedding
      request.target_item.embedding = embedding;
      await request.save();

      // Perform vector search
      const searchResults = await this.vectorSearch(embedding, 5);

      if (searchResults.length === 0) {
        console.log(`Scout: No items found for request ${requestId}`);
        request.status = RequestStatus.FAILED;
        request.retry_feedback = 'No matching items found in inventory';
        await request.save();
        return;
      }

      // Sort by selling_price (ascending) to find cheapest match
      const sortedResults = searchResults.sort(
        (a, b) => (a.selling_price || a.price || 0) - (b.selling_price || b.price || 0)
      );
      const cheapestItem = sortedResults[0];

      // Update request with found item and alternatives
      request.found_item = cheapestItem;
      request.alternatives = sortedResults.slice(1); // Store remaining alternatives
      request.status = RequestStatus.FOUND;

      await request.save();

      console.log(
        `Scout: Found item ${cheapestItem.item_id} for request ${requestId}. Price: $${cheapestItem.selling_price || cheapestItem.price}`
      );
    } catch (error) {
      console.error(`Error processing NEW request ${requestId}:`, error);
      request.status = RequestStatus.FAILED;
      request.retry_feedback = `Scout error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await request.save();
      throw error;
    }
  }

  /**
   * Process a RETRY_SEARCH request: pop next cheapest alternative
   */
  async processRetrySearch(requestId: string): Promise<void> {
    await connectDB();

    const request = await Request.findById(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    if (request.status !== RequestStatus.RETRY_SEARCH) {
      console.log(`Request ${requestId} is not RETRY_SEARCH, skipping`);
      return;
    }

    try {
      console.log(`Scout: Processing RETRY_SEARCH request ${requestId}`);

      if (!request.alternatives || request.alternatives.length === 0) {
        console.log(`Scout: No alternatives left for request ${requestId}`);
        request.status = RequestStatus.FAILED;
        request.retry_feedback = 'No more alternatives available';
        await request.save();
        return;
      }

      // Sort alternatives by selling_price and pop the cheapest
      const sortedAlternatives = request.alternatives.sort(
        (a, b) => (a.selling_price || a.price || 0) - (b.selling_price || b.price || 0)
      );
      const nextItem = sortedAlternatives[0];
      const remainingAlternatives = sortedAlternatives.slice(1);

      // Update found_item and alternatives
      request.found_item = nextItem;
      request.alternatives = remainingAlternatives;
      request.status = RequestStatus.FOUND;

      await request.save();

      console.log(
        `Scout: Retrying with item ${nextItem.item_id} for request ${requestId}. Price: $${nextItem.selling_price || nextItem.price}`
      );
    } catch (error) {
      console.error(`Error processing RETRY_SEARCH request ${requestId}:`, error);
      request.status = RequestStatus.FAILED;
      request.retry_feedback = `Scout retry error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await request.save();
      throw error;
    }
  }

  /**
   * Poll for NEW or RETRY_SEARCH requests and process them
   */
  async pollAndProcess(): Promise<void> {
    await connectDB();

    try {
      // Find requests with NEW or RETRY_SEARCH status
      const requests = await Request.find({
        status: { $in: [RequestStatus.NEW, RequestStatus.RETRY_SEARCH] },
      }).limit(10); // Process up to 10 at a time

      console.log(`Scout: Found ${requests.length} requests to process`);

      for (const request of requests) {
        try {
          if (request.status === RequestStatus.NEW) {
            await this.processNewRequest(request._id.toString());
          } else if (request.status === RequestStatus.RETRY_SEARCH) {
            await this.processRetrySearch(request._id.toString());
          }
        } catch (error) {
          console.error(
            `Error processing request ${request._id}:`,
            error
          );
          // Continue processing other requests
        }
      }
    } catch (error) {
      console.error('Error in pollAndProcess:', error);
      throw error;
    }
  }

  /**
   * Cleanup MongoDB connection
   */
  async disconnect(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = null;
    }
  }
}
