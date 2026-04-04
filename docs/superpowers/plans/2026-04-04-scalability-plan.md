# SnackSpot Scalability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preventief opschalen van SnackSpot van ~100 naar ~500-1000 concurrent users via PgBouncer, PostgreSQL tuning, Nginx caching, en replica-ready config.

**Architecture:** Alle wijzigingen zijn infra/config — geen applicatiecode of DB migraties. PgBouncer wordt tussengevoegd als connection pooler. Nginx krijgt proxy caching voor semi-statische endpoints. PostgreSQL en Redis worden getuned voor de beschikbare resources.

**Tech Stack:** Docker Compose, PgBouncer, PostgreSQL 16, Redis 7, Nginx 1.27

**Spec:** `docs/superpowers/specs/2026-04-04-scalability-design.md`

---

## File Map

| File | Actie | Verantwoordelijkheid |
|------|-------|---------------------|
| `infra/docker/docker-compose.yml` | Modify | Productie compose: PgBouncer service, PG tuning, Redis tuning, resource limits, DATABASE_URL routing |
| `docker-compose.yml` | Modify | Dev compose: PgBouncer service, DATABASE_URL routing (consistent met prod) |
| `infra/nginx/default.conf` | Modify | Proxy caching, static caching, gzip |
| `.env.example` | Modify | Nieuwe `DATABASE_POOL_URL` env var documenteren |

---

### Task 1: PgBouncer toevoegen aan productie compose

**Files:**
- Modify: `infra/docker/docker-compose.yml`

De kern van de schaling. PgBouncer multiplext honderden client-connecties over ~25 server-connecties.

**Strategie voor DATABASE_URL:**
- `.env` behoudt `DATABASE_URL=postgresql://snackspot:password@db:5432/snackspot` (voor migraties)
- `.env` krijgt nieuw: `DATABASE_POOL_URL=postgresql://snackspot:password@pgbouncer:5432/snackspot?pgbouncer=true&connection_limit=10`
- `x-common-env` anchor gaat `DATABASE_POOL_URL` gebruiken als `DATABASE_URL` voor web/worker
- Admin service (eigen DATABASE_URL) gaat ook naar pool URL
- Migrate service behoudt directe `DATABASE_URL`

- [ ] **Step 1: Voeg de pgbouncer service toe**

In `infra/docker/docker-compose.yml`, voeg na de `redis` service (na regel 62) toe:

```yaml
  pgbouncer:
    image: edoburu/pgbouncer:1.24.0-p1
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    environment:
      DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
      POOL_MODE: transaction
      DEFAULT_POOL_SIZE: "25"
      MAX_CLIENT_CONN: "400"
      MAX_DB_CONNECTIONS: "80"
      RESERVE_POOL_SIZE: "5"
      RESERVE_POOL_TIMEOUT: "3"
      SERVER_TLS_SSLMODE: disable
      AUTH_TYPE: scram-sha-256
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -p 5432"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    mem_limit: 64m
    cpus: 0.25
    pids_limit: 64
    networks: [snackspot]
```

- [ ] **Step 2: Wijzig x-common-env om DATABASE_POOL_URL te gebruiken**

In `infra/docker/docker-compose.yml`, wijzig regel 2:

Van:
```yaml
  DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
```

Naar:
```yaml
  DATABASE_URL: ${DATABASE_POOL_URL:-${DATABASE_URL:?DATABASE_URL is required}}
```

Dit zorgt ervoor dat als `DATABASE_POOL_URL` is ingesteld, die wordt gebruikt. Zo niet, valt het terug op de directe `DATABASE_URL`. Dit maakt de migratie backwards-compatible.

- [ ] **Step 3: Wijzig admin service DATABASE_URL**

In `infra/docker/docker-compose.yml`, wijzig de admin service environment (regel 231):

Van:
```yaml
      DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
```

Naar:
```yaml
      DATABASE_URL: ${DATABASE_POOL_URL:-${DATABASE_URL:?DATABASE_URL is required}}
```

- [ ] **Step 4: Voeg pgbouncer toe als dependency voor web, worker, admin**

In `infra/docker/docker-compose.yml`, voeg aan de `depends_on` van web (na regel 148), worker (na regel 189), en admin (na regel 239) toe:

```yaml
      pgbouncer:
        condition: service_healthy
```

- [ ] **Step 5: Verifieer dat migrate NIET naar pgbouncer wijst**

Controleer dat de migrate service (regel 98-99) nog steeds de directe `DATABASE_URL` gebruikt:

```yaml
  migrate:
    # ...
    environment:
      DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
```

Dit is al correct — migrate gebruikt een eigen `DATABASE_URL`, niet de `x-common-env` anchor. Geen wijziging nodig.

- [ ] **Step 6: Commit**

```bash
git add infra/docker/docker-compose.yml
git commit -m "feat(infra): add PgBouncer connection pooler to production compose

Adds PgBouncer in transaction mode between app services and PostgreSQL.
Web/worker/admin route through pgbouncer via DATABASE_POOL_URL.
Migrate keeps direct DATABASE_URL for Prisma migrations."
```

---

### Task 2: PostgreSQL tuning in productie compose

**Files:**
- Modify: `infra/docker/docker-compose.yml`

- [ ] **Step 1: Voeg PostgreSQL command tuning toe**

In `infra/docker/docker-compose.yml`, voeg een `command` toe aan de `db` service (na regel 19, na `restart: unless-stopped`):

```yaml
    command: >
      postgres
      -c shared_buffers=512MB
      -c effective_cache_size=1536MB
      -c work_mem=16MB
      -c maintenance_work_mem=128MB
      -c max_connections=120
      -c checkpoint_completion_target=0.9
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
```

- [ ] **Step 2: Verhoog PostgreSQL resource limits**

In `infra/docker/docker-compose.yml`, wijzig de db service resources:

Van:
```yaml
    mem_limit: 512m
    cpus: 1.0
```

Naar:
```yaml
    mem_limit: 2g
    cpus: 1.0
```

- [ ] **Step 3: Commit**

```bash
git add infra/docker/docker-compose.yml
git commit -m "feat(infra): tune PostgreSQL for 8GB VM with SSD

shared_buffers=512MB, effective_cache_size=1536MB, SSD-optimized
random_page_cost and io_concurrency. Memory limit raised to 2GB."
```

---

### Task 3: Redis tuning in productie compose

**Files:**
- Modify: `infra/docker/docker-compose.yml`

- [ ] **Step 1: Voeg Redis command flags toe**

In `infra/docker/docker-compose.yml`, wijzig de redis `command` (regel 51):

Van:
```yaml
    command: redis-server --save 60 1 --loglevel warning
```

Naar:
```yaml
    command: redis-server --save 60 1 --loglevel warning --maxmemory 256mb --maxmemory-policy allkeys-lru --tcp-keepalive 60
```

- [ ] **Step 2: Commit**

```bash
git add infra/docker/docker-compose.yml
git commit -m "feat(infra): add Redis memory limit and LRU eviction policy

Align prod with dev: 256MB max, allkeys-lru eviction, tcp-keepalive 60s."
```

---

### Task 4: Worker optimalisatie

**Files:**
- Modify: `infra/docker/docker-compose.yml`

- [ ] **Step 1: Verhoog worker memory limit**

In `infra/docker/docker-compose.yml`, wijzig de worker service resources (rond regel 211-213):

Van:
```yaml
    mem_limit: 768m
    cpus: 1.0
```

Naar:
```yaml
    mem_limit: 1g
    cpus: 1.0
```

- [ ] **Step 2: Commit**

```bash
git add infra/docker/docker-compose.yml
git commit -m "feat(infra): increase worker memory to 1GB for higher concurrency

Supports WORKER_CONCURRENCY=5 (sharp uses ~150MB per concurrent resize)."
```

---

### Task 5: Nginx caching en gzip

**Files:**
- Modify: `infra/nginx/default.conf`
- Modify: `infra/docker/docker-compose.yml`

- [ ] **Step 1: Voeg cache zones en gzip toe aan Nginx config**

In `infra/nginx/default.conf`, voeg na de `limit_req_zone` regels (na regel 11) toe:

```nginx
# Proxy cache zones
proxy_cache_path /var/cache/nginx/api levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=5m;
proxy_cache_path /var/cache/nginx/static levels=1:2 keys_zone=static_cache:10m max_size=200m inactive=60m;

# Gzip compression
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
gzip_min_length 1000;
gzip_vary on;
```

- [ ] **Step 2: Voeg cacheable API location toe**

In `infra/nginx/default.conf`, voeg **voor** de bestaande `location /api/` block (voor regel 43) toe:

```nginx
    # ── Cacheable API endpoints — korte cache voor semi-statische data ─
    location ~ ^/api/v1/(discover|places/featured) {
        limit_req zone=api burst=60 nodelay;
        limit_req_status 429;

        proxy_cache            api_cache;
        proxy_cache_valid      200 30s;
        proxy_cache_use_stale  error timeout updating;
        proxy_cache_lock       on;
        add_header             X-Cache-Status $upstream_cache_status;

        proxy_pass         http://web;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
```

- [ ] **Step 3: Voeg static asset caching toe**

In `infra/nginx/default.conf`, voeg **voor** de bestaande `location /` block (voor regel 74) toe:

```nginx
    # ── Next.js static assets — immutable, lang cacheable ────────────
    location /_next/static/ {
        proxy_pass         http://web;
        proxy_cache        static_cache;
        proxy_cache_valid  200 365d;
        add_header         Cache-Control "public, immutable";
    }
```

- [ ] **Step 4: Verhoog Nginx resource limits en voeg tmpfs toe voor cache**

In `infra/docker/docker-compose.yml`, wijzig de nginx service:

Van:
```yaml
    mem_limit: 64m
    cpus: 0.25
```

Naar:
```yaml
    tmpfs:
      - /var/cache/nginx
    mem_limit: 128m
    cpus: 0.25
```

- [ ] **Step 5: Commit**

```bash
git add infra/nginx/default.conf infra/docker/docker-compose.yml
git commit -m "feat(infra): add Nginx proxy caching and gzip compression

Cache /api/v1/discover and /places/featured for 30s with cache lock.
Cache /_next/static/ for 365d (content-hashed, immutable).
Enable gzip for text/css/json/js responses."
```

---

### Task 6: PgBouncer toevoegen aan dev compose

**Files:**
- Modify: `docker-compose.yml`

Dezelfde PgBouncer setup als prod, zodat dev en prod consistent zijn.

- [ ] **Step 1: Voeg pgbouncer service toe aan dev compose**

In `docker-compose.yml`, voeg na de `redis` service (na regel 53) toe:

```yaml
  pgbouncer:
    image: edoburu/pgbouncer:1.24.0-p1
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
      POOL_MODE: transaction
      DEFAULT_POOL_SIZE: "25"
      MAX_CLIENT_CONN: "400"
      MAX_DB_CONNECTIONS: "80"
      RESERVE_POOL_SIZE: "5"
      RESERVE_POOL_TIMEOUT: "3"
      SERVER_TLS_SSLMODE: disable
      AUTH_TYPE: scram-sha-256
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -p 5432"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    networks: [snackspot]
```

- [ ] **Step 2: Wijzig x-common-env in dev compose**

In `docker-compose.yml`, wijzig regel 2:

Van:
```yaml
  DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
```

Naar:
```yaml
  DATABASE_URL: ${DATABASE_POOL_URL:-${DATABASE_URL:?DATABASE_URL is required}}
```

- [ ] **Step 3: Wijzig admin service DATABASE_URL in dev compose**

In `docker-compose.yml`, zoek de admin service en wijzig:

Van:
```yaml
      DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
```

Naar:
```yaml
      DATABASE_URL: ${DATABASE_POOL_URL:-${DATABASE_URL:?DATABASE_URL is required}}
```

- [ ] **Step 4: Voeg pgbouncer dependency toe aan web, worker, admin in dev compose**

Voeg `pgbouncer: condition: service_healthy` toe aan de `depends_on` van web, worker, en admin services.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(infra): add PgBouncer to dev compose for consistency with prod"
```

---

### Task 7: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Voeg DATABASE_POOL_URL toe aan .env.example**

In `.env.example`, voeg na regel 4 (`DATABASE_URL=...`) toe:

```env
# PgBouncer pool URL — set this to route app traffic through PgBouncer.
# When set, web/worker/admin use this instead of DATABASE_URL.
# Migrate always uses DATABASE_URL directly (Prisma requires a direct connection).
DATABASE_POOL_URL=postgresql://snackspot:change-this-db-password@pgbouncer:5432/snackspot?pgbouncer=true&connection_limit=10
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add DATABASE_POOL_URL to .env.example"
```

---

### Task 8: Web replica-ready config (optioneel activeerbaar)

**Files:**
- Modify: `infra/docker/docker-compose.yml`
- Modify: `infra/nginx/default.conf`

Dit maakt de config klaar voor replicas zonder ze direct te activeren.

- [ ] **Step 1: Voeg Nginx DNS resolver toe**

In `infra/nginx/default.conf`, voeg na de `upstream` blocks (na regel 8) toe:

```nginx
# Docker DNS — nodig voor het dynamisch resolven van replicas
resolver 127.0.0.11 valid=10s ipv6=off;
```

- [ ] **Step 2: Voeg een comment toe bij web service voor replicas**

In `infra/docker/docker-compose.yml`, voeg boven de web service toe:

```yaml
    # Uncomment to enable horizontal scaling:
    # deploy:
    #   replicas: 2
```

- [ ] **Step 3: Commit**

```bash
git add infra/docker/docker-compose.yml infra/nginx/default.conf
git commit -m "feat(infra): prepare web service for horizontal scaling

Add Docker DNS resolver to Nginx for replica discovery.
Add commented-out replicas config for easy activation."
```

---

### Task 9: Verificatie

Geen bestanden om te wijzigen — dit is een handmatige verificatiestap.

- [ ] **Step 1: Valideer docker-compose syntax (prod)**

```bash
cd infra/docker && docker compose config --quiet && echo "OK" || echo "FAIL"
```

Expected: `OK`

- [ ] **Step 2: Valideer docker-compose syntax (dev)**

```bash
docker compose config --quiet && echo "OK" || echo "FAIL"
```

Expected: `OK`

- [ ] **Step 3: Valideer nginx config**

```bash
docker compose -f infra/docker/docker-compose.yml run --rm nginx nginx -t
```

Expected: `nginx: configuration file /etc/nginx/nginx.conf syntax is ok`

- [ ] **Step 4: Test met bestaande data**

Op de Proxmox VM:
1. Voeg `DATABASE_POOL_URL` toe aan `.env` (met juiste wachtwoord en `@pgbouncer:5432`)
2. `docker compose -f infra/docker/docker-compose.yml down`
3. `docker compose -f infra/docker/docker-compose.yml up -d`
4. Check logs: `docker compose -f infra/docker/docker-compose.yml logs pgbouncer`
5. Check dat de app werkt: `curl -f http://localhost:8080/api/health/ready`
6. Check dat data intact is: log in en verifieer bestaande reviews/places

- [ ] **Step 5: Controleer PgBouncer stats**

```bash
docker compose -f infra/docker/docker-compose.yml exec pgbouncer pgbouncer -d /etc/pgbouncer/pgbouncer.ini
# Of via psql naar de PgBouncer admin console:
docker compose -f infra/docker/docker-compose.yml exec pgbouncer psql -p 5432 -U snackspot pgbouncer -c "SHOW POOLS;"
```

Verifieer dat `sv_active` en `sv_idle` samen < 80 zijn (onze `MAX_DB_CONNECTIONS`).
