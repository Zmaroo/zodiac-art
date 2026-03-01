"""Printify API client wrapper."""

import base64
from pathlib import Path

import httpx

from zodiac_art.config import get_printify_api_token, get_printify_shop_id

BASE_URL = "https://api.printify.com/v1"


class PrintifyClientError(Exception):
    """Raised when the Printify API returns an error."""


def _get_headers() -> dict[str, str]:
    token = get_printify_api_token()
    if not token:
        raise ValueError("PRINTIFY_API_TOKEN is not configured.")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _get_shop_id() -> str:
    shop_id = get_printify_shop_id()
    if not shop_id:
        raise ValueError("PRINTIFY_SHOP_ID is not configured.")
    return shop_id


async def get_shop_details() -> dict:
    shop_id = _get_shop_id()
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/shops/{shop_id}.json",
            headers=_get_headers(),
        )
        if response.status_code != 200:
            raise PrintifyClientError(f"Failed to fetch shop: {response.text}")
        return response.json()


async def get_blueprints() -> list[dict]:
    """Fetch available blueprints (product types)."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/catalog/blueprints.json",
            headers=_get_headers(),
        )
        if response.status_code != 200:
            raise PrintifyClientError(f"Failed to fetch blueprints: {response.text}")
        return response.json()


async def get_print_providers(blueprint_id: int) -> list[dict]:
    """Fetch print providers for a given blueprint."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/catalog/blueprints/{blueprint_id}/print_providers.json",
            headers=_get_headers(),
        )
        if response.status_code != 200:
            raise PrintifyClientError(f"Failed to fetch print providers: {response.text}")
        return response.json()


async def get_variants(blueprint_id: int, print_provider_id: int) -> dict:
    """Fetch variants for a given blueprint and print provider."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/catalog/blueprints/{blueprint_id}/print_providers/{print_provider_id}/variants.json",
            headers=_get_headers(),
        )
        if response.status_code != 200:
            raise PrintifyClientError(f"Failed to fetch variants: {response.text}")
        return response.json()


async def upload_artwork(file_path: Path, file_name: str) -> dict:
    """Upload artwork to Printify and return the upload ID."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        with open(file_path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")
        
        payload = {
            "file_name": file_name,
            "contents": b64_data,
        }
        response = await client.post(
            f"{BASE_URL}/uploads/images.json",
            headers=_get_headers(),
            json=payload,
        )
        if response.status_code != 200:
            raise PrintifyClientError(f"Failed to upload artwork: {response.text}")
        return response.json()


async def create_product(
    title: str,
    description: str,
    blueprint_id: int,
    print_provider_id: int,
    variant_ids: list[int],
    upload_id: str,
    scale: float = 1.0,
    x: float = 0.5,
    y: float = 0.5,
) -> dict:
    """Create a new product with the uploaded artwork."""
    shop_id = _get_shop_id()
    payload = {
        "title": title,
        "description": description,
        "blueprint_id": blueprint_id,
        "print_provider_id": print_provider_id,
        "variants": [{"id": vid, "price": 0, "is_enabled": True} for vid in variant_ids],
        "print_areas": [
            {
                "variant_ids": variant_ids,
                "placeholders": [
                    {
                        "position": "front",
                        "images": [
                            {
                                "id": upload_id,
                                "x": x,
                                "y": y,
                                "scale": scale,
                            }
                        ],
                    }
                ],
            }
        ],
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{BASE_URL}/shops/{shop_id}/products.json",
            headers=_get_headers(),
            json=payload,
        )
        if response.status_code != 200:
            raise PrintifyClientError(f"Failed to create product: {response.text}")
        return response.json()


async def create_order(
    external_id: str,
    product_id: str,
    variant_id: int,
    shipping_info: dict,
    quantity: int = 1,
) -> dict:
    """Submit an order to Printify after successful checkout."""
    shop_id = _get_shop_id()
    payload = {
        "external_id": external_id,
        "line_items": [
            {
                "product_id": product_id,
                "variant_id": variant_id,
                "quantity": quantity,
            }
        ],
        "shipping_method": 1,
        "send_shipping_notification": False,
        "address_to": shipping_info,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{BASE_URL}/shops/{shop_id}/orders.json",
            headers=_get_headers(),
            json=payload,
        )
        if response.status_code != 200:
            raise PrintifyClientError(f"Failed to create order: {response.text}")
        return response.json()
