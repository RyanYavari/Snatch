import asyncio
import os
import logging
from typing import Optional
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
from models import Request, RequestStatus
from scout import ScoutAgent
from negotiator import NegotiatorAgent

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AgentSwarm:
    def __init__(self):
        self.mongodb_uri = os.getenv("MONGODB_URI")
        if not self.mongodb_uri:
            raise ValueError("MONGODB_URI environment variable is required")
        
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
        self.collection = None
        self.scout = ScoutAgent()
        self.negotiator = NegotiatorAgent()
        self.running = False

    async def connect(self):
        """Connect to MongoDB"""
        try:
            self.client = AsyncIOMotorClient(self.mongodb_uri)
            self.db = self.client.get_database()
            self.collection = self.db.snatch_requests
            # Test connection
            await self.client.admin.command('ping')
            logger.info("Connected to MongoDB")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")

    async def poll_for_new_requests(self):
        """Poll for requests with status NEW"""
        try:
            cursor = self.collection.find(
                {"status": RequestStatus.NEW.value}
            ).sort("createdAt", ASCENDING).limit(10)
            
            requests = await cursor.to_list(length=10)
            return requests
        except Exception as e:
            logger.error(f"Error polling for new requests: {e}")
            return []

    async def poll_for_found_requests(self):
        """Poll for requests with status FOUND"""
        try:
            cursor = self.collection.find(
                {"status": RequestStatus.FOUND.value}
            ).sort("updatedAt", ASCENDING).limit(10)
            
            requests = await cursor.to_list(length=10)
            return requests
        except Exception as e:
            logger.error(f"Error polling for found requests: {e}")
            return []

    async def process_scout_queue(self):
        """Process NEW requests with Scout agent"""
        requests = await self.poll_for_new_requests()
        for req_doc in requests:
            try:
                logger.info(f"Scout processing request: {req_doc.get('_id')}")
                await self.scout.process_request(self.collection, req_doc)
            except Exception as e:
                logger.error(f"Error processing request {req_doc.get('_id')}: {e}")
                # Update status to RETRY_SEARCH on error
                try:
                    await self.collection.update_one(
                        {"_id": req_doc.get("_id")},
                        {"$set": {"status": RequestStatus.RETRY_SEARCH.value}}
                    )
                except Exception as update_error:
                    logger.error(f"Failed to update status: {update_error}")

    async def process_negotiator_queue(self):
        """Process FOUND requests with Negotiator agent"""
        requests = await self.poll_for_found_requests()
        for req_doc in requests:
            try:
                logger.info(f"Negotiator processing request: {req_doc.get('_id')}")
                await self.negotiator.process_request(self.collection, req_doc)
            except Exception as e:
                logger.error(f"Error negotiating request {req_doc.get('_id')}: {e}")

    async def run_loop(self):
        """Main event loop"""
        self.running = True
        logger.info("Starting agent swarm...")
        
        while self.running:
            try:
                # Process scout queue (NEW -> FOUND)
                await self.process_scout_queue()
                
                # Process negotiator queue (FOUND -> NEGOTIATING -> AGREED/PAID)
                await self.process_negotiator_queue()
                
                # Sleep before next poll
                await asyncio.sleep(2)  # Poll every 2 seconds
                
            except KeyboardInterrupt:
                logger.info("Received interrupt signal, shutting down...")
                self.running = False
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                await asyncio.sleep(5)  # Wait longer on error

    async def start(self):
        """Start the agent swarm"""
        await self.connect()
        try:
            await self.run_loop()
        finally:
            await self.disconnect()


async def main():
    """Entry point"""
    swarm = AgentSwarm()
    try:
        await swarm.start()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
