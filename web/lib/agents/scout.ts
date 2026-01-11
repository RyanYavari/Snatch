import { MongoClient } from 'mongodb';
import { Request, RequestStatus, FoundItem } from '@/lib/models/Request';
import connectDB from '@/lib/mongodb';

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI!;

if (!VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY environment variable is required');
}

// VoyageAI REST API client (replacing @voyageai/voyageai package which doesn't exist on npm)
class VoyageClient {
  private apiKey: string;
  private baseUrl = 'https://api.voyageai.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(
    inputs: Array<string | { image: string }>,
    options: { model: string }
  ): Promise<{ data: Array<{ embedding: number[] }> }> {
    // Format inputs for multimodal API
    const formattedInputs = inputs.map((input) => {
      if (typeof input === 'string') {
        return [{ content: input, type: 'text' as const }];
      }
      return [{ content: input.image, type: 'image_url' as const }];
    });

    const response = await fetch(`${this.baseUrl}/multimodalembeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        inputs: formattedInputs,
        model: options.model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VoyageAI API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

export class ScoutAgent {
  private voyageClient: VoyageClient;
  private mongoClient: MongoClient | null = null;

  constructor() {
    this.voyageClient = new VoyageClient(VOYAGE_API_KEY!);
  }

  /**
   * Generate image embedding using Voyage AI Multimodal-3
   * Returns 2048-dim embedding
   */
  async generateImageEmbedding(imageUrl: string): Promise<number[]> {
    try {
      const response = await this.voyageClient.embed(
        [{ image: imageUrl }],
        { model: 'voyage-multimodal-3' }
      );

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from Voyage AI');
      }

      const embedding = response.data[0].embedding;
      
      // Note: Voyage multimodal-3 returns embeddings
      // The developer's schema uses 2048 dimensions
      console.log(`Generated embedding with ${embedding?.length || 0} dimensions`);

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Perform vector search in MongoDB Atlas using $vectorSearch aggregation
   * Uses image_embedding field (2048 dimensions)
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
      // Using image_embedding field (2048 dimensions)
      const pipeline = [
        {
          $vectorSearch: {
            index: 'image_embedding_index', // Atlas vector search index name for image_embedding
            path: 'image_embedding',
            queryVector: embedding,
            numCandidates: limit * 10, // Search more candidates for better results
            limit: limit,
          },
        },
        {
          $project: {
            id: 1,
            size: 1,
            price: 1,
            image: 1,
            SELLER_WALLET_ADDRESS: 1,
            metadata: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      const results = await collection.aggregate(pipeline).toArray();

      return results.map((item) => ({
        id: item.id,
        size: item.size,
        price: item.price,
        image: item.image,
        seller_wallet: item.SELLER_WALLET_ADDRESS,
        metadata: item.metadata,
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
      const imageEmbedding = await this.generateImageEmbedding(
        request.target_item.image_url
      );

      // Update target_item with embedding
      request.target_item.image_embedding = imageEmbedding;
      await request.save();

      // Perform vector search
      const searchResults = await this.vectorSearch(imageEmbedding, 5);

      if (searchResults.length === 0) {
        console.log(`Scout: No items found for request ${requestId}`);
        request.status = RequestStatus.FAILED;
        request.retry_feedback = 'No matching items found in inventory';
        await request.save();
        return;
      }

      // Sort by price (ascending) to find cheapest match
      const sortedResults = searchResults.sort((a, b) => a.price - b.price);
      const cheapestItem = sortedResults[0];

      // Update request with found item and alternatives
      request.found_item = cheapestItem;
      request.alternatives = sortedResults.slice(1); // Store remaining alternatives
      request.status = RequestStatus.FOUND;

      await request.save();

      console.log(
        `Scout: Found item ${cheapestItem.id} for request ${requestId}. Price: $${cheapestItem.price}`
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

      // Sort alternatives by price and pop the cheapest
      const sortedAlternatives = request.alternatives.sort(
        (a, b) => a.price - b.price
      );
      const nextItem = sortedAlternatives[0];
      const remainingAlternatives = sortedAlternatives.slice(1);

      // Update found_item and alternatives
      request.found_item = nextItem;
      request.alternatives = remainingAlternatives;
      request.status = RequestStatus.FOUND;

      await request.save();

      console.log(
        `Scout: Retrying with item ${nextItem.id} for request ${requestId}. Price: $${nextItem.price}`
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
