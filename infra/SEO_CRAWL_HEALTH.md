# Crawl health runbook

Actions that live outside the repo — DNS and Cloudflare — plus how to verify the code-side
fixes after deploy. Written 2026-08-07 from Google Search Console crawl stats covering
9 May – 5 Aug 2026.

## Background

GSC reported host status **"Problemen in de afgelopen week"** for `snackspot.online`, with:

| Signal | Value |
|---|---|
| 200 OK | 90.84% |
| 5XX server errors | **2.95%** |
| robots.txt unavailable | **1.32%** |
| DNS unresponsive / DNS error | 0.10% / 0.10% |
| Crawl requests spent on JavaScript | 55.65% (HTML: 23.60%) |
| Crawls aimed at discovering new URLs | 9.87% |

Average crawl response time degraded over the same window:

| 9 May – 30 Jun | 1 Jul – 20 Jul | 21 Jul – 5 Aug |
|---|---|---|
| 203 ms | 236 ms | **375 ms** |

Search performance fell from 1.71 clicks/day (16 Jun – 16 Jul, avg position 6.12) to
0.20 clicks/day (17 Jul – 5 Aug, avg position 9.07), with 14 consecutive zero-click days
from 16 July. The last deploy was 18 June, so no code change triggered it.

---

## 1. Cloudflare Cache Rule for photo variants — highest priority

**Problem.** Every photo is served from `/api/v1/photos/variant?key=…`. Verified live:

```
HTTP 200 | image/webp | 724350 bytes
Cache-Control: public, max-age=31536000, immutable
cf-cache-status: DYNAMIC          <-- never cached at the edge
```

Cloudflare's default cache decision keys on file extension. This URL has none, so despite
`immutable` **every photo request reaches the origin** — 700 KB+ per image. This is a prime
suspect for both the response-time degradation and the 5XX rate.

**Urgency.** `app/robots.ts` previously carried a blanket `Disallow: /api/`, which hid every
photo from crawlers. That is now fixed (see §4), so Googlebot-Image will begin fetching photos.
**Without this cache rule, that fix increases origin load.** Do this before or with the deploy.

**Steps.** Cloudflare dashboard → *Caching* → *Cache Rules* → *Create rule*:

- Name: `Cache photo variants`
- If incoming requests match: `URI Path` `starts with` `/api/v1/photos/`
- Then: **Eligible for cache**
- Edge TTL: *Use cache-control header if present*, fallback 1 month
- Browser TTL: *Respect origin*

**Verify:**

```bash
curl -sI "https://snackspot.online/api/v1/photos/variant?key=<key>" | grep -i cf-cache-status
# first call: MISS   second call: HIT
```

---

## 2. Add the `www` DNS record

**Problem.** `www.snackspot.online` does not resolve:

```
$ nslookup www.snackspot.online
*** can't find www.snackspot.online: Non-existent domain
```

Googlebot attempted it anyway (1 request against that host in the crawl stats) and received a
DNS error. Minor in volume, but it is a host-level failure signal and costs nothing to remove.

**Steps.** Cloudflare → *DNS* → *Add record*:

- Type `CNAME`, Name `www`, Target `snackspot.online`, Proxy status **Proxied**

Then *Rules* → *Redirect Rules* → single redirect:

- If `Hostname` equals `www.snackspot.online`
- Then `301` to `https://snackspot.online${http.request.uri.path}` — preserve query string

**Verify:**

```bash
curl -sI https://www.snackspot.online/ | head -3   # expect 301 -> https://snackspot.online/
```

`ALLOWED_HOSTS` (see `apps/web/middleware.ts`) must not need changing — the redirect happens at
the edge, so the origin never sees the `www` host. If you instead let `www` reach the origin,
add it to `ALLOWED_HOSTS` or middleware will return `400 Host not allowed`.

---

## 3. Locate the 2.95% 5XX errors

Not diagnosable from the repo — it needs production telemetry. Where to look, in order:

**Cloudflare** → *Analytics & Logs* → *HTTP traffic*. Filter to status `5xx` over the last 30
days. Group by *Path* and by *Time*. Two shapes to distinguish:

- **Spikes correlated with traffic** → origin capacity. Cross-check against photo requests;
  §1 likely resolves it.
- **Steady low-level errors on specific paths** → application bugs. Take the top paths to the
  container logs.

**Application logs.** The app uses `pino` via `apps/web/lib/logger.ts`, and middleware stamps
every response with `X-Request-ID`:

```bash
docker compose -f infra/docker/docker-compose.yml logs web --since 720h \
  | grep -E '"level":(50|60)' | head -50
```

**Suspect worth checking first: `/sitemap.xml`.** It ran a full `places + reviews + users` scan
per request while uncached at the edge (`cf-cache-status: DYNAMIC`). Under concurrent crawler
hits that is a plausible source of both timeouts and 5XX. The code-side fix is deployed (§4);
confirm the header change actually landed.

Also check Postgres connection-pool exhaustion — the sitemap issues three concurrent
`findMany` calls per request.

---

## 4. Verify the code-side fixes after deploy

Three changes shipped in the repo. Each needs confirming in production, because Next.js does
not always let custom headers override framework defaults on metadata routes.

**a. Edge caching for robots.txt and sitemap.xml** (`apps/web/next.config.mjs`)

Both previously carried `max-age=0, must-revalidate` and RSC `Vary` headers, leaving
robots.txt at `EXPIRED` and sitemap.xml at `DYNAMIC`. Google treats an unfetchable robots.txt
as a reason to pause crawling of the **entire host**.

```bash
curl -sI https://snackspot.online/robots.txt  | grep -iE 'cache-control|vary|cf-cache-status'
curl -sI https://snackspot.online/sitemap.xml | grep -iE 'cache-control|vary|cf-cache-status'
```

Expect `stale-if-error=604800` present, **no** `rsc` in `Vary`, and `cf-cache-status: HIT` on a
second call. If `Cache-Control` still shows `max-age=0, must-revalidate`, Next.js is overriding
it — fall back to a Cloudflare Cache Rule on those two paths, same shape as §1.

**b. Narrowed middleware matcher** (`apps/web/middleware.ts`)

Middleware ran on `/:path*`, which made Next.js attach RSC `Vary` headers to every response and
blocked edge caching. Static assets and crawler files are now excluded.

```bash
curl -sI https://snackspot.online/robots.txt | grep -i x-request-id   # expect NO output
curl -sI https://snackspot.online/ | grep -i x-request-id             # expect a value
```

**c. robots.txt no longer blocks photos** (`apps/web/app/robots.ts`)

`Disallow: /api/` hid every review photo, so the `image` in the `Restaurant` JSON-LD and the
`og:image` both pointed at blocked URLs. GSC's Search Appearance report was entirely empty —
zero rich results — despite valid markup. An explicit `Allow: /api/v1/photos/` now overrides it
by longest-match.

```bash
curl -s https://snackspot.online/robots.txt | grep -A1 'Disallow: /api/'
```

Then in GSC: *URL Inspection* on a place page → *Test live URL* → confirm the photo is fetchable
and no "Indexed, though blocked by robots.txt" warning appears. Rich results can take weeks to
reappear after the block clears.

---

## What to measure

Judge recovery on **non-brand impressions**, not clicks. Brand queries ("snackspot", "snack
spot") accounted for 88.2% of impressions and 98.8% of clicks in the measured period; all 35
non-brand queries together produced one click in three months. Brand traffic reflects awareness
built elsewhere and will not indicate whether these fixes worked.

In GSC → *Performance*, filter *Query* → *doesn't contain* → `snack` and track impressions.
Baseline: **152 impressions over three months**.

Secondary, in *Settings* → *Crawl stats*:

- Average response time back under ~200 ms
- robots.txt unavailable at 0.00%
- 5XX under 1%
- Host status green
