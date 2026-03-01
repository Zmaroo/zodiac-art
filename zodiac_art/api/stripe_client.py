"""Stripe API client wrapper."""

import stripe

from zodiac_art.config import get_stripe_secret_key


def _init_stripe():
    secret_key = get_stripe_secret_key()
    if not secret_key:
        raise ValueError("STRIPE_SECRET_KEY is not configured.")
    stripe.api_key = secret_key


def create_checkout_session(
    product_name: str,
    amount_cents: int,
    success_url: str,
    cancel_url: str,
    metadata: dict[str, str],
) -> str:
    """
    Create a Stripe Checkout Session and return the URL.
    
    Args:
        product_name: The name displayed on the checkout page.
        amount_cents: The price in USD cents (e.g., 2500 = $25.00).
        success_url: The URL to redirect to upon successful payment.
        cancel_url: The URL to redirect to if the user cancels.
        metadata: Dictionary containing order info (e.g., printify_product_id).
    
    Returns:
        The Stripe Checkout Session URL.
    """
    _init_stripe()

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": product_name,
                    },
                    "unit_amount": amount_cents,
                },
                "quantity": 1,
            }
        ],
        metadata=metadata,
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        billing_address_collection="required",
        shipping_address_collection={
            "allowed_countries": ["US"],  # Expand this list based on Printify constraints
        },
    )
    
    return session.url
