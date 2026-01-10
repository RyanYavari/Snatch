import os
import logging
import base64
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorCollection
from voyageai import Voyage
from models import RequestStatus

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class ScoutAgent:
    def __init__(self):
        self.voyage_api_key = os.getenv("VOYAGE_API_KEY")
        if not self.voyage_api_key:
            raise ValueError("VOYAGE_API_KEY environment variable is required")
        
        self.voyage_client = Voyage(api_key=self.voyage_api_key)
        self.model = "voyage-3"  # Using voyage-3 for multimodal embeddings

    async def generate_embedding(self, image_url: str) -> list[float]:
        """Generate embedding for target image using Voyage AI"""
        try:
            logger.info(f"Generating embedding for image: {image_url}")
            
            # Voyage AI multimodal embedding
            result = self.voyage_client.embed(
                texts=[],  # Empty for image-only embedding
                images=[image_url],
                model=self.model,
            )
            
            if result.embeddings and len(result.embeddings) > 0:
                embedding = result.embeddings[0]
                logger.info(f"Generated embedding of dimension: {len(embedding)}")
                return embedding
            else:
                raise ValueError("No embedding returned from Voyage AI")
                
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            raise

    async def vector_search(self, collection: AsyncIOMotorCollection, embedding: list[float], limit: int = 5) -> list[Dict[str, Any]]:
        """Perform vector search in MongoDB using $vectorSearch"""
        try:
            logger.info("Performing vector search...")
            
            # MongoDB $vectorSearch aggregation pipeline
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "voyage_embedding_index",  # Index name in MongoDB Atlas
                        "path": "voyage_embedding",
                        "queryVector": embedding,
                        "numCandidates": limit * 10,  # Number of candidates to consider
                        "limit": limit,
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "name": 1,
                        "url": 1,
                        "price": 1,
                        "description": 1,
                        "score": {"$meta": "vectorSearchScore"},
                    }
                },
            ]
            
            results = []
            async for doc in collection.aggregate(pipeline):
                results.append(doc)
            
            logger.info(f"Found {len(results)} matching items")
            return results
            
        except Exception as e:
            logger.error(f"Error in vector search: {e}")
            # If vector search fails, return empty results
            return []

    async def process_request(self, collection: AsyncIOMotorCollection, request_doc: Dict[str, Any]):
        """Process a NEW request: generate embedding, search, update status"""
        request_id = request_doc.get("_id")
        
        try:
            # Check if embedding already exists
            if not request_doc.get("voyage_embedding"):
                # Generate embedding
                image_url = request_doc.get("target_image_url")
                if not image_url:
                    raise ValueError("target_image_url is required")
                
                embedding = await self.generate_embedding(image_url)
                
                # Update request with embedding
                await collection.update_one(
                    {"_id": request_id},
                    {"$set": {"voyage_embedding": embedding}}
                )
                logger.info(f"Updated request {request_id} with embedding")
            
            # Perform vector search
            embedding = request_doc.get("voyage_embedding", [])
            if not embedding:
                embedding = await self.generate_embedding(request_doc.get("target_image_url"))
            
            search_results = await self.vector_search(collection, embedding, limit=5)
            
            if search_results:
                # Find the best match (first result)
                best_match = search_results[0]
                
                # Update request with found item and change status to FOUND
                await collection.update_one(
                    {"_id": request_id},
                    {
                        "$set": {
                            "status": RequestStatus.FOUND.value,
                            "found_item": {
                                "name": best_match.get("name"),
                                "url": best_match.get("url"),
                                "price": best_match.get("price"),
                                "description": best_match.get("description"),
                                "score": best_match.get("score"),
                            }
                        }
                    }
                )
                logger.info(f"Request {request_id} updated to FOUND with item: {best_match.get('name')}")
            else:
                # No results found, mark as RETRY_SEARCH
                await collection.update_one(
                    {"_id": request_id},
                    {"$set": {"status": RequestStatus.RETRY_SEARCH.value}}
                )
                logger.warning(f"No items found for request {request_id}, marked as RETRY_SEARCH")
                
        except Exception as e:
            logger.error(f"Error processing request {request_id}: {e}")
            # Update status to RETRY_SEARCH on error
            await collection.update_one(
                {"_id": request_id},
                {"$set": {"status": RequestStatus.RETRY_SEARCH.value}}
            )
            raise
