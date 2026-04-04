# SnackSpot Schaalbaarheidsplan — Aanpak B

**Datum:** 2026-04-04
**Status:** Goedgekeurd ontwerp
**Doel:** Preventief opschalen van ~100 naar ~500-1000 concurrent users zonder architectuurwijziging

## Context

- **Hosting:** Proxmox VM, 2 cores, 8 GB RAM (uitbreidbaar)
- **Stack:** Docker Compose, Nginx, Next.js (standalone), PostgreSQL 16 + PostGIS, Redis 7, MinIO, BullMQ worker
- **Ingress:** Cloudflare tunnel → Nginx :8080
- **Constraint:** Bestaande data in PostgreSQL moet behouden blijven. Geen database migraties.
- **Constraint:** Geen applicatiecode-wijzigingen. Enkel infra/config.

## 1. PgBouncer — Connection Pooling

### Probleem

Prisma opent per request een connectie naar PostgreSQL. Zonder pooling loopt `max_connections` (100) snel vol bij concurrent traffic. Dit is de #1 bottleneck.

### Oplossing

Nieuwe `pgbouncer` service in docker-compose, tussen web/worker/admin en PostgreSQL.

**Image:** `edoburu/pgbouncer`
**Pool mode:** `transaction` — compatibel met Prisma, deelt connecties per transactie.

### Config

| Parameter              | Waarde | Toelichting                                            |
| ---------------------- | ------ | ------------------------------------------------------ |
| `default_pool_size`    | 25     | Server-connecties per database/user combinatie          |
| `max_client_conn`      | 400    | Max gelijktijdige client-connecties                    |
| `max_db_connections`   | 80     | Hard cap op echte PG-connecties (20 over voor admin)   |
| `reserve_pool_size`    | 5      | Extra connecties bij pieken                            |
| `reserve_pool_timeout` | 3      | Seconden voordat reserve pool wordt aangesproken       |

### DATABASE_URL wijziging

- Web, worker, admin: `DATABASE_URL` wijst naar `pgbouncer:5432` i.p.v. `db:5432`
- Query parameter toevoegen: `?pgbouncer=true&connection_limit=10`
- **Migrate service behoudt directe `db:5432` URL** — Prisma migraties vereisen een directe connectie

### Resource limits

- `mem_limit: 64m`
- `cpus: 0.25`

## 2. PostgreSQL Tuning

### Probleem

De productie docker-compose (`infra/docker/docker-compose.yml`) heeft geen PostgreSQL tuning parameters. Defaults zijn geoptimaliseerd voor een 512 MB machine, niet voor 2 GB.

### Oplossing

PostgreSQL `command` toevoegen aan de productie compose met tuning parameters.

| Parameter                     | Default  | Nieuw    | Waarom                            |
| ----------------------------- | -------- | -------- | --------------------------------- |
| `shared_buffers`              | 128MB    | `512MB`  | ~25% van PG-geheugen              |
| `effective_cache_size`        | (laag)   | `1536MB` | Hint voor query planner           |
| `work_mem`                    | 4MB      | `16MB`   | Meer ruimte voor sorts/joins      |
| `maintenance_work_mem`        | 64MB     | `128MB`  | Snellere VACUUM/INDEX             |
| `max_connections`             | 100      | `120`    | Iets ruimer, PgBouncer vangt rest |
| `checkpoint_completion_target`| 0.5      | `0.9`    | Smooth I/O bij checkpoints        |
| `random_page_cost`            | 4.0      | `1.1`    | SSD-optimalisatie                 |
| `effective_io_concurrency`    | 1        | `200`    | SSD-optimalisatie                 |

### Resource limits

- `mem_limit`: van `512m` naar `2g`
- `cpus`: van `1.0` naar `1.0` (ongewijzigd)

## 3. Redis Tuning

Kleine alignering tussen dev en productie compose.

| Parameter          | Huidig (prod) | Nieuw     | Waarom                                  |
| ------------------ | ------------- | --------- | --------------------------------------- |
| `maxmemory`        | (geen)        | `256mb`   | Voorkomt ongecontroleerde groei         |
| `maxmemory-policy` | (geen)        | `allkeys-lru` | Voorkomt OOM bij volle cache        |
| `tcp-keepalive`    | (default)     | `60`      | Detecteert dode connecties sneller      |

## 4. Nginx Caching & Optimalisatie

### 4a. Proxy cache voor semi-statische API endpoints

Endpoints als `/api/v1/discover` en `/api/v1/places/featured` veranderen niet per seconde. Een korte cache (30s) haalt load weg bij pieken.

```nginx
proxy_cache_path /var/cache/nginx/api levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=5m;
proxy_cache_path /var/cache/nginx/static levels=1:2 keys_zone=static_cache:10m max_size=200m inactive=60m;
```

Nieuwe location block voor cacheable API endpoints:

```nginx
location ~ ^/api/v1/(discover|places/featured) {
    proxy_cache api_cache;
    proxy_cache_valid 200 30s;
    proxy_cache_use_stale error timeout updating;
    proxy_cache_lock on;
    limit_req zone=api burst=60 nodelay;
    limit_req_status 429;
    proxy_pass         http://web;
    proxy_http_version 1.1;
    proxy_set_header   Host $host;
    proxy_set_header   X-Forwarded-Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

`proxy_cache_lock on`: bij een cache miss wordt slechts 1 request doorgestuurd, de rest wacht. Voorkomt thundering herd.

### 4b. Static asset caching

Next.js `_next/static/` bestanden zijn content-hashed en immutable:

```nginx
location /_next/static/ {
    proxy_pass         http://web;
    proxy_cache        static_cache;
    proxy_cache_valid  200 365d;
    add_header         Cache-Control "public, immutable";
}
```

### 4c. Gzip compressie

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 1000;
gzip_vary on;
```

### Resource limits

- `mem_limit`: van `64m` naar `128m`
- `tmpfs` toevoegen: `/var/cache/nginx`

## 5. Web Service Replicas

De Next.js standalone build is stateless (sessions in Redis, files in MinIO). Dit maakt replicas eenvoudig.

### Wijzigingen

- `deploy.replicas: 2` toevoegen aan web service (optioneel, activeer wanneer nodig)
- Docker Compose DNS resolved `web` automatisch naar alle replicas met round-robin
- Nginx `resolver 127.0.0.11 valid=10s;` toevoegen zodat DNS-wijzigingen bij scaling worden opgepikt

### Resource per replica

- `mem_limit: 768m`
- `cpus: 1.0`

### Activatie

Start met 1 replica + alle andere optimalisaties. Zet `replicas: 2` aan wanneer nodig. Geen code-wijziging vereist.

## 6. Worker Optimalisatie

### Wijzigingen

| Parameter            | Huidig | Nieuw | Waarom                                  |
| -------------------- | ------ | ----- | --------------------------------------- |
| `WORKER_CONCURRENCY` | 3      | 5     | Meer parallelle foto-processing         |
| `mem_limit`          | 768m   | 1g    | Sharp gebruikt ~100-150MB per resize    |
| `cpus`               | 1.0    | 1.0   | Ongewijzigd, voldoende voor 5 jobs      |

Worker is stateless (BullMQ in Redis, files in MinIO). Een tweede replica kan later met `deploy.replicas: 2`. BullMQ verdeelt jobs automatisch.

## 7. Resource Verdeling

### Totaal op 8 GB VM (1 web replica)

| Service      | RAM   | CPU  | Opmerking      |
| ------------ | ----- | ---- | -------------- |
| PostgreSQL   | 2g    | 1.0  | Verhoogd       |
| PgBouncer    | 64m   | 0.25 | **Nieuw**      |
| Redis        | 256m  | 0.5  | Ongewijzigd    |
| MinIO        | 512m  | 1.0  | Ongewijzigd    |
| Web (x1)     | 768m  | 1.0  | Klaar voor x2  |
| Worker       | 1g    | 1.0  | Verhoogd       |
| Admin        | 512m  | 0.5  | Ongewijzigd    |
| Nginx        | 128m  | 0.25 | Licht verhoogd |
| **Totaal**   | ~5.2g | 5.5  |                |

Met web x2: ~6 GB / 6.5 CPU. Past op 8 GB VM. Voor verdere schaling: 4 cores / 12 GB in Proxmox.

## 8. Verwachte Capaciteit

| Metric                       | Huidig    | Na Aanpak B    |
| ---------------------------- | --------- | -------------- |
| Comfortabel concurrent       | ~50-100   | ~300-500       |
| Max concurrent (degraded)    | ~200-300  | ~800-1000+     |
| DB connecties effectief      | 100       | 400 via pool   |
| Foto-processing throughput   | ~3 par.   | ~5-10 par.     |
| Geregistreerde gebruikers    | Duizenden | Tienduizenden  |

## 9. Migratiepad

Alle stappen kunnen in een enkele deploy. Volgorde:

1. PgBouncer service toevoegen aan docker-compose
2. DATABASE_URL aanpassen voor web/worker/admin (migrate behoudt directe URL)
3. PostgreSQL tuning parameters toevoegen
4. Redis config alignen tussen dev/prod
5. Nginx caching config uitbreiden
6. Worker concurrency verhogen
7. Resource limits bijwerken
8. Testen met bestaande data
9. Later optioneel: web replicas activeren

## Scope

Wijzigingen worden doorgevoerd in de **productie** docker-compose (`infra/docker/docker-compose.yml`) en de Nginx config (`infra/nginx/default.conf`). De dev compose (root `docker-compose.yml`) krijgt dezelfde PgBouncer service en DATABASE_URL wijziging zodat dev en prod consistent zijn.

## Wat NIET verandert

- Database schema — geen migraties, data intact
- Applicatiecode — geen code-wijzigingen
- Cloudflare tunnel — blijft op :8080
- Admin panel — blijft op :3001
