import os
import logging
import json
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorCollection
from openai import OpenAI
from models import RequestStatus

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class NegotiatorAgent:
    def __init__(self):
        self.fireworks_api_key = os.getenv("FIREWORKS_API_KEY")
        if not self.fireworks_api_key:
            raise ValueError("FIREWORKS_API_KEY environment variable is required")
        
        # Fireworks AI uses OpenAI-compatible API
        self.client = OpenAI(
            api_key=self.fireworks_api_key,
            base_url="https://api.fireworks.ai/inference/v1"
        )
        self.model = "accounts/fireworks/models/llama-v3p1-70b-instruct"

    def get_negotiation_functions(self):
        """Define function calling schema for negotiation"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "make_offer",
                    "description": "Make a price offer during negotiation",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "offer_price": {
                                "type": "number",
                                "description": "The price being offered"
                            },
                            "reasoning": {
                                "type": "string",
                                "description": "Reasoning for this offer"
                            }
                        },
                        "required": ["offer_price", "reasoning"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "accept_offer",
                    "description": "Accept the current offer and finalize the deal",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "final_price": {
                                "type": "number",
                                "description": "The final agreed price"
                            },
                            "reasoning": {
                                "type": "string",
                                "description": "Reason for accepting"
                            }
                        },
                        "required": ["final_price", "reasoning"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "reject_offer",
                    "description": "Reject the offer and end negotiation",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "reasoning": {
                                "type": "string",
                                "description": "Reason for rejection"
                            }
                        },
                        "required": ["reasoning"]
                    }
                }
            }
        ]

    async def negotiate(self, budget: float, found_item: Dict[str, Any], negotiation_log: list) -> Dict[str, Any]:
        """Perform negotiation using Fireworks AI function calling"""
        try:
            item_price = found_item.get("price", 0)
            item_name = found_item.get("name", "item")
            
            # Build conversation history from negotiation log
            messages = [
                {
                    "role": "system",
                    "content": f"""You are a skilled negotiator agent. Your goal is to negotiate the best price for an item.
                    
Item Details:
- Name: {item_name}
- Current Price: ${item_price:.2f}
- Your Budget: ${budget:.2f}

Rules:
1. Try to negotiate the price down to fit within the budget
2. Be strategic and reasonable in your offers
3. If the price is already within budget, you can accept it
4. If negotiation fails after reasonable attempts, reject the offer
5. Always use the function calling tools to make offers, accept, or reject

Previous negotiation history:
{json.dumps(negotiation_log[-5:], indent=2) if negotiation_log else "None"}
"""
                },
                {
                    "role": "user",
                    "content": f"Negotiate the price for {item_name}. Current price is ${item_price:.2f} and your budget is ${budget:.2f}."
                }
            ]
            
            # Call Fireworks AI with function calling
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=self.get_negotiation_functions(),
                tool_choice="auto",
                temperature=0.7,
            )
            
            message = response.choices[0].message
            
            # Handle function calls
            if message.tool_calls:
                tool_call = message.tool_calls[0]
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                
                logger.info(f"Negotiation function call: {function_name} with args: {function_args}")
                
                return {
                    "action": function_name,
                    "arguments": function_args,
                    "message": message.content or f"Calling {function_name}",
                }
            else:
                # No function call, treat as message
                return {
                    "action": "message",
                    "message": message.content or "No response",
                }
                
        except Exception as e:
            logger.error(f"Error in negotiation: {e}")
            raise

    async def process_request(self, collection: AsyncIOMotorCollection, request_doc: Dict[str, Any]):
        """Process a FOUND request: negotiate price, update status"""
        request_id = request_doc.get("_id")
        current_status = request_doc.get("status")
        
        try:
            # Only process FOUND requests
            if current_status != RequestStatus.FOUND.value:
                logger.warning(f"Request {request_id} is not in FOUND status, skipping")
                return
            
            budget = request_doc.get("budget", 0)
            found_item = request_doc.get("found_item", {})
            negotiation_log = request_doc.get("negotiation_log", [])
            
            if not found_item:
                logger.warning(f"Request {request_id} has no found_item, skipping")
                return
            
            # Check if already negotiating
            if current_status == RequestStatus.NEGOTIATING.value:
                # Continue negotiation
                pass
            else:
                # Start negotiation - update status to NEGOTIATING
                await collection.update_one(
                    {"_id": request_id},
                    {"$set": {"status": RequestStatus.NEGOTIATING.value}}
                )
                logger.info(f"Request {request_id} status updated to NEGOTIATING")
            
            # Perform negotiation
            negotiation_result = await self.negotiate(budget, found_item, negotiation_log)
            
            # Log the negotiation step
            from datetime import datetime
            log_entry = {
                "timestamp": datetime.utcnow(),
                "agent": "negotiator",
                "message": negotiation_result.get("message", ""),
                "action": negotiation_result.get("action", ""),
            }
            
            # Update based on negotiation result
            action = negotiation_result.get("action")
            args = negotiation_result.get("arguments", {})
            
            if action == "accept_offer":
                final_price = args.get("final_price", found_item.get("price"))
                log_entry["price"] = final_price
                
                # Update status to AGREED
                await collection.update_one(
                    {"_id": request_id},
                    {
                        "$set": {
                            "status": RequestStatus.AGREED.value,
                            "found_item.price": final_price,
                        },
                        "$push": {"negotiation_log": log_entry}
                    }
                )
                logger.info(f"Request {request_id} negotiation accepted at ${final_price:.2f}")
                
            elif action == "reject_offer":
                log_entry["message"] = args.get("reasoning", "Offer rejected")
                
                # Mark as RETRY_SEARCH to try finding another item
                await collection.update_one(
                    {"_id": request_id},
                    {
                        "$set": {"status": RequestStatus.RETRY_SEARCH.value},
                        "$push": {"negotiation_log": log_entry}
                    }
                )
                logger.info(f"Request {request_id} negotiation rejected, marked for retry")
                
            elif action == "make_offer":
                offer_price = args.get("offer_price", 0)
                log_entry["price"] = offer_price
                log_entry["message"] = args.get("reasoning", f"Offering ${offer_price:.2f}")
                
                # Continue negotiation - update log
                await collection.update_one(
                    {"_id": request_id},
                    {"$push": {"negotiation_log": log_entry}}
                )
                logger.info(f"Request {request_id} made offer: ${offer_price:.2f}")
                
            else:
                # Just log the message
                await collection.update_one(
                    {"_id": request_id},
                    {"$push": {"negotiation_log": log_entry}}
                )
                
        except Exception as e:
            logger.error(f"Error processing request {request_id}: {e}")
            raise
