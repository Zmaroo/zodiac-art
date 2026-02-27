# Printify API – Developer Reference (Agent-Friendly)

Official documentation:
https://developers.printify.com/

Base API URL:
https://api.printify.com/v1/

---

## Authentication

All requests require a Personal Access Token.

Generate a token in:
Printify Dashboard → Connections → Generate API Token

Tokens expire after 1 year.

### Required Headers

Authorization uses Bearer token:

Authorization: Bearer YOUR_PRINTIFY_API_TOKEN
Content-Type: application/json

Example:

curl -X GET https://api.printify.com/v1/shops.json \
  -H "Authorization: Bearer YOUR_TOKEN"

---

## Rate Limits

Global:
- 600 requests per minute

Catalog endpoints:
- 100 requests per minute

HTTP 429 returned if exceeded.

---

## Typical Automation Workflow

1. Get shop ID
2. Upload artwork
3. Create product
4. Enable variants
5. Publish product
6. Accept orders

---

## Shops

### List Shops

GET /v1/shops.json

Returns shop IDs required for product operations.

---

## Uploads (Artwork)

Upload artwork before creating products.

### Upload Image

POST /v1/uploads/images.json

Request body:

{
  "file_name": "design.png",
  "contents": "BASE64_IMAGE_DATA"
}

Response:

{
  "id": "UPLOAD_ID",
  "file_name": "design.png",
  "preview_url": "https://..."
}

Use returned id in product creation.

---

## Catalog

### List Blueprints

GET /v1/catalog/blueprints.json

Blueprint = product type (shirt, poster, mug).

### List Print Providers

GET /v1/catalog/blueprints/{blueprint_id}/print_providers.json

---

## Products

Products belong to a shop.

### List Products

GET /v1/shops/{shop_id}/products.json

---

### Create Product

POST /v1/shops/{shop_id}/products.json

Example request:

{
  "title": "Zodiac Poster",
  "description": "Generated astrology artwork",
  "blueprint_id": 5,
  "print_provider_id": 1,
  "variants": [
    {
      "id": 12345,
      "price": 2500,
      "is_enabled": true
    }
  ],
  "print_areas": [
    {
      "variant_ids": [12345],
      "placeholders": [
        {
          "position": "front",
          "images": [
            {
              "id": "UPLOAD_ID",
              "x": 0.5,
              "y": 0.5,
              "scale": 1
            }
          ]
        }
      ]
    }
  ]
}

---

### Update Product

PUT /v1/shops/{shop_id}/products/{product_id}.json

---

### Publish Product

POST /v1/shops/{shop_id}/products/{product_id}/publish.json

Options:

{
  "title": true,
  "description": true,
  "images": true,
  "variants": true
}

---

## Orders

### Create Order

POST /v1/shops/{shop_id}/orders.json

Example:

{
  "external_id": "order-001",
  "line_items": [
    {
      "product_id": "PRODUCT_ID",
      "variant_id": 12345,
      "quantity": 1
    }
  ],
  "shipping_method": 1,
  "address_to": {
    "first_name": "John",
    "last_name": "Doe",
    "country": "US",
    "city": "Miami",
    "zip": "33101",
    "address1": "Example Street 1"
  }
}

---

## Common HTTP Status Codes

200 – Success  
401 – Unauthorized  
403 – Forbidden  
404 – Not Found  
429 – Rate limit exceeded  
500 – Server error  

---

## Best Practices

- Always upload artwork before creating products.
- Blueprint and print_provider IDs must match.
- Validate variant IDs before enabling them.
- Retry transient 5xx errors.
- Cache catalog responses to reduce rate usage.

---

## Automation Notes for Agents

- Never invent endpoints.
- Always include Authorization header.
- Respect rate limits.
- Products require valid upload IDs.
- Validate responses before proceeding to next step.