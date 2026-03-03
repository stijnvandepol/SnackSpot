import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import {
  placeSearchSchema,
  reportCreateSchema,
  reviewCreateSchema,
  uploadInitiateSchema
} from '@snackspot/shared';
import {
  createCsrfToken,
  hashPassword,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken
} from './auth.js';
import { pool, query } from './db.js';
import { env } from './env.js';
import { checkRateLimit } from './rate-limit.js';
import Redis from 'ioredis';

type UserRole = 'user' | 'mod' | 'admin';

type AuthContext = {
  userId: string;
  role: UserRole;
};

const app = Fastify({ logger: true });
const redis = new Redis(env.redisUrl);

await app.register(cookie);
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
});
await app.register(cors, {
  origin: env.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
});

const s3 = new S3Client({
  region: env.s3Region,
  endpoint: env.s3Endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.s3AccessKey,
    secretAccessKey: env.s3SecretKey
  }
});

function parseCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as { created_at: string; id: string };
    return parsed;
  } catch {
    return null;
  }
}

function buildCursor(createdAt: string, id: string) {
  return Buffer.from(JSON.stringify({ created_at: createdAt, id }), 'utf8').toString('base64url');
}

function getAuth(req: { headers: Record<string, string | string[] | undefined> }): AuthContext | null {
  const authorization = req.headers.authorization;
  if (!authorization || Array.isArray(authorization)) return null;
  const token = authorization.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

function requireAuth(req: { headers: Record<string, string | string[] | undefined> }) {
  const auth = getAuth(req);
  if (!auth) throw new Error('UNAUTHORIZED');
  return auth;
}

function requireRole(auth: AuthContext, roles: UserRole[]) {
  if (!roles.includes(auth.role)) {
    throw new Error('FORBIDDEN');
  }
}

app.get('/health', async () => ({ ok: true }));

app.get('/api/v1/csrf-token', async (_req, reply) => {
  const sid = randomUUID();
  const csrf = createCsrfToken(sid);
  reply.setCookie('csrf_sid', sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/'
  });
  return { csrf_token: csrf };
});

app.post('/api/v1/auth/register', async (req, reply) => {
  const allowed = checkRateLimit(`register:${req.ip}`, 5, 60);
  if (!allowed) return reply.code(429).send({ error: 'Too many requests' });

  const schema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
    password: z.string().min(12).max(128),
    display_name: z.string().min(2).max(60)
  });
  const body = schema.parse(req.body);

  const passwordHash = await hashPassword(body.password);
  const rows = await query<{ id: string; role: UserRole; username: string }>(
    `INSERT INTO users(email, username, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, role, username`,
    [body.email.toLowerCase(), body.username.toLowerCase(), passwordHash, body.display_name]
  );

  const user = rows[0];
  if (!user) return reply.code(500).send({ error: 'User creation failed' });
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
  const refreshHash = hashToken(refreshToken);

  await query(
    `INSERT INTO refresh_tokens(user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5::text || ' seconds')::interval)`,
    [user.id, refreshHash, req.headers['user-agent'] ?? null, req.ip, String(env.refreshTtl)]
  );

  reply.setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth'
  });

  return { access_token: accessToken, expires_in: env.accessTtl, user };
});

app.post('/api/v1/auth/login', async (req, reply) => {
  const allowed = checkRateLimit(`login:${req.ip}`, 10, 60);
  if (!allowed) return reply.code(429).send({ error: 'Too many requests' });

  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const users = await query<{ id: string; password_hash: string; role: UserRole; username: string }>(
    'SELECT id, password_hash, role, username FROM users WHERE email = $1 AND deleted_at IS NULL',
    [body.email.toLowerCase()]
  );

  const user = users[0];
  if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

  const isValid = await verifyPassword(user.password_hash, body.password);
  if (!isValid) return reply.code(401).send({ error: 'Invalid credentials' });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });

  await query(
    `INSERT INTO refresh_tokens(user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5::text || ' seconds')::interval)`,
    [user.id, hashToken(refreshToken), req.headers['user-agent'] ?? null, req.ip, String(env.refreshTtl)]
  );

  reply.setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth'
  });

  return {
    access_token: accessToken,
    expires_in: env.accessTtl,
    user: { id: user.id, username: user.username, role: user.role }
  };
});

app.post('/api/v1/auth/refresh', async (req, reply) => {
  const refreshToken = req.cookies.refresh_token;
  if (!refreshToken) return reply.code(401).send({ error: 'No refresh token' });

  let payload: { sub: string; role: UserRole };
  try {
    payload = verifyRefreshToken(refreshToken) as { sub: string; role: UserRole };
  } catch {
    return reply.code(401).send({ error: 'Invalid refresh token' });
  }

  const tokens = await query<{ id: string }>(
    'SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > now()',
    [payload.sub, hashToken(refreshToken)]
  );

  if (!tokens[0]) return reply.code(401).send({ error: 'Refresh token revoked' });
  const currentToken = tokens[0];

  const accessToken = signAccessToken({ sub: payload.sub, role: payload.role });
  const newRefreshToken = signRefreshToken({ sub: payload.sub, role: payload.role });

  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [currentToken.id]);
  await query(
    `INSERT INTO refresh_tokens(user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5::text || ' seconds')::interval)`,
    [payload.sub, hashToken(newRefreshToken), req.headers['user-agent'] ?? null, req.ip, String(env.refreshTtl)]
  );

  reply.setCookie('refresh_token', newRefreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth'
  });

  return { access_token: accessToken, expires_in: env.accessTtl };
});

app.post('/api/v1/auth/logout', async (req, reply) => {
  const refreshToken = req.cookies.refresh_token;
  if (refreshToken) {
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [hashToken(refreshToken)]);
  }
  reply.clearCookie('refresh_token', { path: '/api/v1/auth' });
  return { ok: true };
});

app.get('/api/v1/me', async (req, reply) => {
  try {
    const auth = requireAuth(req);
    const users = await query<{ id: string; username: string; role: UserRole; display_name: string }>(
      'SELECT id, username, role, display_name FROM users WHERE id = $1',
      [auth.userId]
    );
    return { user: users[0] ?? null };
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
});

app.get('/api/v1/places/search', async (req, reply) => {
  const parsed = placeSearchSchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const radius = Math.min(parsed.data.radius, env.maxRadiusMeters);

  const rows = await query<{
    id: string;
    name: string;
    city: string | null;
    distance_meters: number;
  }>(
    `SELECT p.id, p.name, p.city,
      ST_Distance(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_meters
     FROM places p
     WHERE p.deleted_at IS NULL
       AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
       AND ($4::text IS NULL OR p.name ILIKE '%' || $4 || '%')
     ORDER BY distance_meters ASC
     LIMIT 50`,
    [parsed.data.lat, parsed.data.lng, radius, parsed.data.q ?? null]
  );

  return { items: rows, radius_meters: radius };
});

app.get('/api/v1/places/nearby', async (req, reply) => {
  const parsed = z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      radius_meters: z.coerce.number().int().min(100).default(env.defaultRadiusMeters),
      min_rating: z.coerce.number().min(1).max(5).optional(),
      query: z.string().max(120).optional(),
      category: z.string().max(80).optional()
    })
    .safeParse(req.query);

  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }

  const radius = Math.min(parsed.data.radius_meters, env.maxRadiusMeters);
  const rows = await query<{
    id: string;
    name: string;
    city: string | null;
    distance_meters: number;
    avg_rating: number | null;
    review_count: number;
    top_dish_name: string | null;
    top_rating: number | null;
  }>(
    `SELECT p.id,
            p.name,
            p.city,
            ST_Distance(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_meters,
            AVG(r.rating)::float AS avg_rating,
            COUNT(r.id)::int AS review_count,
            (ARRAY_AGG(r.dish_name ORDER BY r.rating DESC, r.created_at DESC))[1] AS top_dish_name,
            (ARRAY_AGG(r.rating ORDER BY r.rating DESC, r.created_at DESC))[1] AS top_rating
     FROM places p
     LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'active'
     WHERE p.deleted_at IS NULL
       AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
       AND ($4::text IS NULL OR p.name ILIKE '%' || $4 || '%')
     GROUP BY p.id
     HAVING ($5::float IS NULL OR AVG(r.rating) >= $5)
     ORDER BY distance_meters ASC
     LIMIT 50`,
    [parsed.data.lat, parsed.data.lng, radius, parsed.data.query ?? null, parsed.data.min_rating ?? null]
  );

  return { items: rows, radius_meters: radius, filters: parsed.data };
});

app.get('/api/v1/places/:id', async (req, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const rows = await query(
    `SELECT id, name, street, house_number, postal_code, city, country_code,
      ST_X(location::geometry) AS lng,
      ST_Y(location::geometry) AS lat,
      created_at
     FROM places
     WHERE id = $1 AND deleted_at IS NULL`,
    [params.id]
  );

  if (!rows[0]) return reply.code(404).send({ error: 'Place not found' });
  const place = rows[0];
  return place;
});

app.post('/api/v1/places', async (req, reply) => {
  try {
    const auth = requireAuth(req);
    const body = z
      .object({
        name: z.string().min(2).max(120),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        city: z.string().max(120).optional(),
        street: z.string().max(120).optional(),
        house_number: z.string().max(20).optional(),
        postal_code: z.string().max(20).optional(),
        country_code: z.string().length(2).optional()
      })
      .parse(req.body);

    const dedupe = await query<{ id: string; name: string; distance_meters: number; similarity: number }>(
      `SELECT p.id, p.name,
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_meters,
        similarity(p.name, $3) AS similarity
      FROM places p
      WHERE p.deleted_at IS NULL
        AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, 100)
      ORDER BY similarity DESC, distance_meters ASC
      LIMIT 1`,
      [body.lat, body.lng, body.name]
    );

    if (dedupe[0] && dedupe[0].similarity > 0.65) {
      return { deduped: true, place: dedupe[0] };
    }

    const created = await query<{ id: string; name: string }>(
      `INSERT INTO places(name, city, street, house_number, postal_code, country_code, location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography, $9)
       RETURNING id, name`,
      [
        body.name,
        body.city ?? null,
        body.street ?? null,
        body.house_number ?? null,
        body.postal_code ?? null,
        body.country_code?.toUpperCase() ?? null,
        body.lat,
        body.lng,
        auth.userId
      ]
    );

    const place = created[0];
    if (!place) return reply.code(500).send({ error: 'Place creation failed' });
    return reply.code(201).send({ deduped: false, place });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    throw error;
  }
});

app.get('/api/v1/places/:id/reviews', async (req) => {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const queryParams = z.object({ sort: z.enum(['new', 'top']).default('new'), cursor: z.string().optional() }).parse(req.query);
  const cursor = parseCursor(queryParams.cursor);

  const orderField = queryParams.sort === 'top' ? 'rating DESC, created_at DESC' : 'created_at DESC';
  const rows = await query<{
    id: string;
    dish_name: string;
    rating: number;
    text: string;
    created_at: string;
  }>(
    `SELECT id, dish_name, rating, text, created_at::text
     FROM reviews
     WHERE place_id = $1 AND status = 'active'
      ${cursor ? `AND (created_at, id) < ($2::timestamptz, $3::uuid)` : ''}
     ORDER BY ${orderField}
     LIMIT 21`,
    cursor ? [params.id, cursor.created_at, cursor.id] : [params.id]
  );

  const items = rows.slice(0, 20);
  const next = rows.length > 20 ? items[items.length - 1] : null;
  return {
    items,
    next_cursor: next ? buildCursor(next.created_at, next.id) : null
  };
});

app.get('/api/v1/feed', async (req) => {
  const params = z.object({ cursor: z.string().optional() }).parse(req.query);
  const cursor = parseCursor(params.cursor);

  const rows = await query<{
    id: string;
    dish_name: string;
    rating: number;
    text: string;
    created_at: string;
    place_id: string;
    place_name: string;
  }>(
    `SELECT r.id, r.dish_name, r.rating, r.text, r.created_at::text, p.id AS place_id, p.name AS place_name
     FROM reviews r
     JOIN places p ON p.id = r.place_id
     WHERE r.status = 'active'
      ${cursor ? `AND (r.created_at, r.id) < ($1::timestamptz, $2::uuid)` : ''}
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT 21`,
    cursor ? [cursor.created_at, cursor.id] : []
  );

  const items = rows.slice(0, 20);
  const next = rows.length > 20 ? items[items.length - 1] : null;

  return {
    items,
    next_cursor: next ? buildCursor(next.created_at, next.id) : null
  };
});

app.post('/api/v1/reviews', async (req, reply) => {
  const allowed = checkRateLimit(`review:${req.ip}`, 20, 60);
  if (!allowed) return reply.code(429).send({ error: 'Too many requests' });

  try {
    const auth = requireAuth(req);
    const body = reviewCreateSchema.parse(req.body);

    const created = await query<{ id: string; created_at: string; status: string }>(
      `INSERT INTO reviews(user_id, place_id, dish_name, rating, taste_rating, price_rating, portion_rating, text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, created_at::text, status`,
      [
        auth.userId,
        body.place_id,
        body.dish_name,
        body.rating,
        body.taste_rating ?? null,
        body.price_rating ?? null,
        body.portion_rating ?? null,
        body.text
      ]
    );

    const review = created[0];
    if (!review) return reply.code(500).send({ error: 'Review creation failed' });

    for (let i = 0; i < body.photo_ids.length; i += 1) {
      await query(
        'INSERT INTO review_photos(review_id, photo_id, sort_order) VALUES ($1,$2,$3)',
        [review.id, body.photo_ids[i], i + 1]
      );
    }

    return reply.code(201).send(review);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    throw error;
  }
});

app.get('/api/v1/reviews/:id', async (req, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const rows = await query(
    `SELECT r.id, r.dish_name, r.rating, r.taste_rating, r.price_rating, r.portion_rating,
      r.text, r.status, r.created_at, r.place_id, p.name AS place_name, r.user_id
     FROM reviews r
     JOIN places p ON p.id = r.place_id
     WHERE r.id = $1`,
    [params.id]
  );

  if (!rows[0]) return reply.code(404).send({ error: 'Review not found' });
  return rows[0];
});

app.patch('/api/v1/reviews/:id', async (req, reply) => {
  try {
    const auth = requireAuth(req);
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        rating: z.number().int().min(1).max(5).optional(),
        text: z.string().min(40).max(2000).optional(),
        dish_name: z.string().min(2).max(120).optional()
      })
      .refine((v) => Object.keys(v).length > 0)
      .parse(req.body);

    const owner = await query<{ user_id: string }>('SELECT user_id FROM reviews WHERE id = $1', [params.id]);
    const ownerRow = owner[0];
    if (!ownerRow) return reply.code(404).send({ error: 'Review not found' });
    if (ownerRow.user_id !== auth.userId) return reply.code(403).send({ error: 'Forbidden' });

    const current = await query<{ rating: number; text: string; dish_name: string }>(
      'SELECT rating, text, dish_name FROM reviews WHERE id = $1',
      [params.id]
    );
    const currentReview = current[0];
    if (!currentReview) return reply.code(404).send({ error: 'Review not found' });

    const updated = await query(
      `UPDATE reviews
       SET rating = $2,
           text = $3,
           dish_name = $4,
           updated_at = now()
       WHERE id = $1
       RETURNING id, rating, text, dish_name, updated_at`,
      [
        params.id,
        body.rating ?? currentReview.rating,
        body.text ?? currentReview.text,
        body.dish_name ?? currentReview.dish_name
      ]
    );

    const updatedReview = updated[0];
    if (!updatedReview) return reply.code(500).send({ error: 'Review update failed' });
    return updatedReview;
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    throw error;
  }
});

app.delete('/api/v1/reviews/:id', async (req, reply) => {
  try {
    const auth = requireAuth(req);
    const params = z.object({ id: z.string().uuid() }).parse(req.params);

    const owner = await query<{ user_id: string }>('SELECT user_id FROM reviews WHERE id = $1', [params.id]);
    const ownerRow = owner[0];
    if (!ownerRow) return reply.code(404).send({ error: 'Review not found' });
    if (ownerRow.user_id !== auth.userId && auth.role === 'user') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await query("UPDATE reviews SET status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = $1", [params.id]);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    throw error;
  }
});

app.post('/api/v1/photos/initiate-upload', async (req, reply) => {
  const allowed = checkRateLimit(`upload:${req.ip}`, 20, 60);
  if (!allowed) return reply.code(429).send({ error: 'Too many requests' });

  try {
    const auth = requireAuth(req);
    const body = uploadInitiateSchema.parse(req.body);

    if (body.size_bytes > env.uploadMaxBytes) {
      return reply.code(400).send({ error: 'File too large' });
    }

    const uploadId = randomUUID();
    const ext = body.mime_type === 'image/png' ? 'png' : body.mime_type === 'image/webp' ? 'webp' : 'jpg';
    const key = `uploads/${auth.userId}/${new Date().toISOString().slice(0, 10)}/${uploadId}.${ext}`;

    const cmd = new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      ContentType: body.mime_type,
      ContentLength: body.size_bytes
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    return { upload_id: uploadId, storage_key: key, upload_url: uploadUrl, expires_in: 300 };
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    throw error;
  }
});

app.post('/api/v1/photos/confirm-upload', async (req, reply) => {
  try {
    const auth = requireAuth(req);
    const body = z
      .object({
        upload_id: z.string().uuid(),
        storage_key: z.string().min(10),
        mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        size_bytes: z.number().int().positive().max(8 * 1024 * 1024),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        checksum_sha256: z.string().min(32).max(128)
      })
      .parse(req.body);

    const created = await query<{ id: string }>(
      `INSERT INTO photos (
        owner_user_id, storage_key_original, storage_key_thumb, storage_key_medium, storage_key_large,
        mime_type, width, height, size_bytes, checksum_sha256, moderation_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
      RETURNING id`,
      [
        auth.userId,
        body.storage_key,
        body.storage_key.replace('uploads/', 'processed/thumb/'),
        body.storage_key.replace('uploads/', 'processed/medium/'),
        body.storage_key.replace('uploads/', 'processed/large/'),
        body.mime_type,
        body.width,
        body.height,
        body.size_bytes,
        body.checksum_sha256
      ]
    );

    const createdPhoto = created[0];
    if (!createdPhoto) return reply.code(500).send({ error: 'Photo creation failed' });

    await redis.lpush(
      'photo:process',
      JSON.stringify({
        photoId: createdPhoto.id,
        originalKey: body.storage_key
      })
    );

    return reply.code(201).send({ photo_id: createdPhoto.id, status: 'queued' });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    throw error;
  }
});

app.get('/api/v1/photos/:id', async (req, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(req.params);
  const rows = await query(
    `SELECT id, storage_key_thumb, storage_key_medium, storage_key_large,
      mime_type, width, height, size_bytes, moderation_status, created_at
     FROM photos
     WHERE id = $1 AND deleted_at IS NULL`,
    [params.id]
  );
  if (!rows[0]) return reply.code(404).send({ error: 'Photo not found' });
  return rows[0];
});

app.post('/api/v1/reports', async (req, reply) => {
  try {
    const auth = requireAuth(req);
    const body = reportCreateSchema.parse(req.body);
    const created = await query<{ id: string }>(
      `INSERT INTO reports(reporter_user_id, target_type, target_id, reason, details)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [auth.userId, body.target_type, body.target_id, body.reason, body.details ?? null]
    );
    const report = created[0];
    if (!report) return reply.code(500).send({ error: 'Report creation failed' });
    return reply.code(201).send({ id: report.id, status: 'open' });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    throw error;
  }
});

app.get('/api/v1/mod/queue', async (req, reply) => {
  try {
    const auth = requireAuth(req);
    requireRole(auth, ['mod', 'admin']);

    const rows = await query(
      `SELECT id, target_type, target_id, reason, details, status, created_at
       FROM reports
       WHERE status IN ('open','triaged')
       ORDER BY created_at ASC
       LIMIT 200`
    );

    return { items: rows };
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return reply.code(401).send({ error: 'Unauthorized' });
    if (error instanceof Error && error.message === 'FORBIDDEN') return reply.code(403).send({ error: 'Forbidden' });
    throw error;
  }
});

app.post('/api/v1/mod/actions', async (req, reply) => {
  try {
    const auth = requireAuth(req);
    requireRole(auth, ['mod', 'admin']);

    const body = z
      .object({
        target_type: z.enum(['review', 'photo', 'user', 'place']),
        target_id: z.string().uuid(),
        action: z.enum(['hide', 'restore', 'ban', 'warn']),
        reason: z.string().min(5).max(500),
        metadata: z.record(z.any()).optional()
      })
      .parse(req.body);

    await query(
      `INSERT INTO moderation_actions(actor_user_id, target_type, target_id, action, reason, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [auth.userId, body.target_type, body.target_id, body.action, body.reason, body.metadata ?? {}]
    );

    if (body.target_type === 'review' && body.action === 'hide') {
      await query("UPDATE reviews SET status = 'hidden', updated_at = now() WHERE id = $1", [body.target_id]);
    }
    if (body.target_type === 'review' && body.action === 'restore') {
      await query("UPDATE reviews SET status = 'active', updated_at = now() WHERE id = $1", [body.target_id]);
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return reply.code(401).send({ error: 'Unauthorized' });
    if (error instanceof Error && error.message === 'FORBIDDEN') return reply.code(403).send({ error: 'Forbidden' });
    throw error;
  }
});

app.setErrorHandler((error, _req, reply) => {
  if (typeof error === 'object' && error !== null && 'issues' in error) {
    const zodError = error as { issues: unknown };
    return reply.code(400).send({ error: 'Validation failed', details: zodError.issues });
  }
  app.log.error(error);
  return reply.code(500).send({ error: 'Internal Server Error' });
});

const closeSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of closeSignals) {
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}

await app.listen({ port: env.port, host: '0.0.0.0' });
