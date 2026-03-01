"""Shop and Printify API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from zodiac_art.api.deps import require_user
from zodiac_art.api.auth import AuthUser
from zodiac_art.api.printify_client import (
    PrintifyClientError,
    get_blueprints,
    get_print_providers,
    get_variants,
)
from zodiac_art.api.stripe_client import create_checkout_session
from zodiac_art.config import get_stripe_webhook_secret

router = APIRouter(prefix="/shop", tags=["shop"])
logger = logging.getLogger(__name__)


class MockupRequest(BaseModel):
    chart_id: str
    blueprint_id: int
    print_provider_id: int
    variant_ids: list[int]


class CheckoutRequest(BaseModel):
    product_name: str
    amount_cents: int
    success_url: str
    cancel_url: str
    metadata: dict[str, str]


@router.get("/blueprints")
async def fetch_blueprints():
    """Fetch available Printify products."""
    try:
        data = await get_blueprints()
        return data
    except PrintifyClientError as e:
        logger.error(f"Printify error fetching blueprints: {e}")
        raise HTTPException(status_code=502, detail="Failed to communicate with Printify")


@router.get("/blueprints/{blueprint_id}/providers")
async def fetch_print_providers(blueprint_id: int):
    """Fetch print providers for a given blueprint."""
    try:
        data = await get_print_providers(blueprint_id)
        return data
    except PrintifyClientError as e:
        logger.error(f"Printify error fetching providers: {e}")
        raise HTTPException(status_code=502, detail="Failed to communicate with Printify")


@router.get("/blueprints/{blueprint_id}/providers/{print_provider_id}/variants")
async def fetch_variants(blueprint_id: int, print_provider_id: int):
    """Fetch variants for a given blueprint and print provider."""
    try:
        data = await get_variants(blueprint_id, print_provider_id)
        return data
    except PrintifyClientError as e:
        logger.error(f"Printify error fetching variants: {e}")
        raise HTTPException(status_code=502, detail="Failed to communicate with Printify")


@router.post("/mockup")
async def generate_mockup(
    request: MockupRequest,
    current_user: AuthUser = Depends(require_user),
    # In a full implementation, you would depend on the database/storage to fetch the chart by ID,
    # render it to a high-res PNG, and then pass that PNG path to the Printify upload function.
    # For now, this is a conceptual stub waiting for the render pipeline logic.
):
    """Generate a Printify product mockup from a user's chart."""
    raise HTTPException(
        status_code=501, 
        detail="High-res backend rendering to Printify pipeline is stubbed."
    )


@router.post("/checkout")
async def create_checkout(request: CheckoutRequest):
    """Create a Stripe Checkout Session."""
    try:
        url = create_checkout_session(
            product_name=request.product_name,
            amount_cents=request.amount_cents,
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata=request.metadata,
        )
        return {"checkout_url": url}
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize checkout")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Listen for Stripe events (e.g. checkout.session.completed)."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = get_stripe_webhook_secret()
    
    if not webhook_secret or not sig_header:
        raise HTTPException(status_code=400, detail="Missing signature or secret")

    try:
        import stripe
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except Exception as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        # Fulfill the order using Printify based on session.metadata
        # Examples: Printify Product ID attached to metadata
        
        # printify_client.create_order(...)
        
        logger.info(f"Fulfillment triggered for session {session.get('id')}")

    return {"status": "success"}

