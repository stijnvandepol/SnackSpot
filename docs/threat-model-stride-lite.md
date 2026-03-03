# Threat model (STRIDE light)

## Spoofing
Threat: account takeover via credential stuffing.
Controls: Argon2id, generic auth errors, rate limiting, refresh token rotation and revocation list.

## Tampering
Threat: manipulated uploads and object key forgery.
Controls: presigned upload intent, allowlisted MIME types, size limits, server-side re-encode.

## Repudiation
Threat: moderator denies an action.
Controls: immutable moderation action log with actor, reason, timestamp.

## Information disclosure
Threat: EXIF GPS leaks and broad CORS.
Controls: EXIF stripping in pipeline, strict CORS, secure cookie settings.

## Denial of service
Threat: abuse of login, review creation, and geo queries.
Controls: endpoint rate limits, max radius cap, indexed geospatial queries.

## Elevation of privilege
Threat: user hits moderator endpoints.
Controls: RBAC middleware and object-level permission checks.
