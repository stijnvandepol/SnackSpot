# Production readiness checklist

## Security
- [ ] Argon2id password hashing verified
- [ ] Access/refresh token TTL and rotation validated
- [ ] CSRF strategy active for cookie-based flows
- [ ] CORS restricted to approved domains
- [ ] Rate limits enforced and monitored
- [ ] Security headers enabled (CSP, HSTS, nosniff)

## Data and storage
- [ ] Postgres backups daily with restore tests
- [ ] MinIO/S3 lifecycle and retention policies set
- [ ] Soft delete behavior validated for reviews/photos
- [ ] Migration process tested on staging

## Reliability
- [ ] Health checks for web/api/worker
- [ ] Queue backlog alerts configured
- [ ] Error tracking enabled
- [ ] Structured logs centralized

## Performance
- [ ] Geo indexes active and query plans reviewed
- [ ] Cursor pagination used on high-volume endpoints
- [ ] CDN caching strategy tested for image variants

## Privacy and compliance
- [ ] Data export endpoint returns complete JSON
- [ ] Account deletion/anonymization workflow tested
- [ ] Location consent UX and privacy copy present
