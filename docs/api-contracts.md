# SnackSpot API Contracts

## Auth
### POST /api/v1/auth/register
Request:
```json
{
  "email": "user@example.com",
  "username": "stijn",
  "password": "StrongPass!123",
  "display_name": "Stijn"
}
```
Response:
```json
{
  "access_token": "jwt",
  "expires_in": 900,
  "user": { "id": "uuid", "username": "stijn", "role": "user" }
}
```

### POST /api/v1/auth/login
### POST /api/v1/auth/refresh
### POST /api/v1/auth/logout
### GET /api/v1/me

## Places
### GET /api/v1/places/search?q=&lat=&lng=&radius=
Response contains list of place summaries with computed distance in meters.

### GET /api/v1/places/nearby?lat=&lng=&radius_meters=&min_rating=&query=&category=
Response contains places + distance + top review summary.

### GET /api/v1/places/:id
### POST /api/v1/places
### GET /api/v1/places/:id/reviews?sort=new|top&cursor=

## Reviews
### GET /api/v1/feed?cursor=
Cursor token format:
```json
{
  "created_at": "2026-03-03T10:00:00Z",
  "id": "uuid"
}
```
Base64url encoded when sent over query params.

### POST /api/v1/reviews
Request:
```json
{
  "place_id": "uuid",
  "dish_name": "Bami schijf",
  "rating": 4,
  "taste_rating": 4,
  "price_rating": 5,
  "portion_rating": 3,
  "text": "Krokant en lekker, saus had warmer gemogen.",
  "photo_ids": ["uuid1", "uuid2"]
}
```

### GET /api/v1/reviews/:id
### PATCH /api/v1/reviews/:id
### DELETE /api/v1/reviews/:id

## Photos
### POST /api/v1/photos/initiate-upload
### POST /api/v1/photos/confirm-upload
### GET /api/v1/photos/:id

## Reports and moderation
### POST /api/v1/reports
### GET /api/v1/mod/queue
### POST /api/v1/mod/actions

## Common errors
```json
{ "error": "Validation failed", "details": [] }
```
```json
{ "error": "Unauthorized" }
```
```json
{ "error": "Forbidden" }
```
```json
{ "error": "Too many requests" }
```
