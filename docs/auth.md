# Auth (V3.0)

This API uses JWT (HS256) with email/password.

## Environment

```bash
export JWT_SECRET=change-me
export JWT_EXPIRES_SECONDS=604800
export DEV_MODE=false
```

If `DEV_MODE=true` and `JWT_SECRET` is missing, the server will generate a
temporary secret and warn on startup.

## Register

```bash
curl -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"secret"}'
```

## Login

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"secret"}'
```

## Me

```bash
curl http://127.0.0.1:8000/api/auth/me \
  -H "Authorization: Bearer <token>"
```
