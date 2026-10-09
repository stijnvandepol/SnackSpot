#!/usr/bin/env bash
# Checks the live Cloudflare setup that infra/SEO_CRAWL_HEALTH.md asks for, from the outside.
# Read-only: it only sends GET/HEAD requests, the same a browser or crawler would.
#
#   bash infra/check-cloudflare.sh                       # checks https://snackspot.online
#   bash infra/check-cloudflare.sh snackspot.online 203.0.113.7
#                                   ^ domain        ^ optional origin IP: checks that port 8080
#                                                     is not reachable from the internet
set -u

DOMAIN="${1:-snackspot.online}"
ORIGIN_IP="${2:-}"
BASE="https://$DOMAIN"
UA_BROWSER='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
UA_GOOGLE='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
UA_BING='Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'

pass=0; warn=0; fail=0
ok()   { printf '  \033[32mOK\033[0m    %s\n' "$1"; pass=$((pass + 1)); }
wrn()  { printf '  \033[33mLET OP\033[0m %s\n' "$1"; warn=$((warn + 1)); }
bad()  { printf '  \033[31mFOUT\033[0m  %s\n' "$1"; fail=$((fail + 1)); }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Response headers of a GET (body discarded), lowercased names. HEAD is avoided on purpose:
# some routes answer HEAD differently from GET, and Cloudflare caches on GET.
headers() { curl -sS -o /dev/null -D - --max-time 20 -A "${2:-$UA_BROWSER}" "$1" 2>/dev/null | tr -d '\r'; }
header()  { printf '%s\n' "$1" | grep -i "^$2:" | head -1 | cut -d' ' -f2- ; }
status()  { printf '%s\n' "$1" | head -1 | awk '{print $2}'; }

step "1. Loopt het verkeer via Cloudflare?"
H=$(headers "$BASE/")
if [ -z "$H" ]; then bad "$BASE is niet bereikbaar"; echo; exit 1; fi
printf '%s\n' "$H" | grep -qi '^server: cloudflare$' && ok "server: cloudflare" || bad "geen 'server: cloudflare', de proxy (oranje wolk) staat uit"
[ -n "$(header "$H" cf-ray)" ] && ok "cf-ray aanwezig" || bad "geen cf-ray header"
[ "$(status "$H")" = "200" ] && ok "homepage geeft 200" || bad "homepage geeft $(status "$H")"

step "2. HTTPS en redirects"
S=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 "http://$DOMAIN/" 2>/dev/null)
case "$S" in
  30[18]\ https://$DOMAIN/*) ok "http:// stuurt door naar https:// ($S)";;
  *) bad "http:// stuurt niet door naar https:// (kreeg: $S). Zet 'Always Use HTTPS' aan";;
esac
S=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 "https://www.$DOMAIN/snackplekken?x=1" 2>/dev/null)
case "$S" in
  301\ https://$DOMAIN/snackplekken\?x=1) ok "www stuurt met 301 door, pad en query blijven staan";;
  30[1278]\ https://$DOMAIN/*) wrn "www stuurt door, maar niet als 301 met pad en query intact (kreeg: $S)";;
  000*) bad "www.$DOMAIN geeft geen antwoord. Voeg een CNAME 'www' toe (proxied) plus een redirect rule";;
  *) bad "www stuurt niet door naar $DOMAIN (kreeg: $S)";;
esac
HSTS=$(header "$H" strict-transport-security)
[ -n "$HSTS" ] && ok "HSTS: $HSTS" || wrn "geen Strict-Transport-Security header"
if curl -sS -o /dev/null --max-time 10 --tlsv1.0 --tls-max 1.1 "$BASE/" 2>/dev/null; then
  wrn "TLS 1.0/1.1 wordt nog geaccepteerd. Zet 'Minimum TLS Version' op 1.2"
else
  ok "TLS 1.0/1.1 geweigerd"
fi

step "3. Foto's worden aan de rand gecachet (Cache Rule /api/v1/photos/)"
SITEMAP=$(curl -sS --max-time 30 -A "$UA_GOOGLE" "$BASE/sitemap.xml" 2>/dev/null)
PHOTO=$(printf '%s' "$SITEMAP" | grep -o '<image:loc>[^<]*' | head -1 | sed 's/<image:loc>//; s/&amp;/\&/g')
if [ -z "$PHOTO" ]; then
  wrn "geen foto-URL in de sitemap gevonden, deze stap overgeslagen"
else
  headers "$PHOTO" >/dev/null
  P=$(headers "$PHOTO")
  CS=$(header "$P" cf-cache-status)
  case "$CS" in
    HIT|REVALIDATED|UPDATING) ok "tweede keer ophalen: cf-cache-status $CS";;
    DYNAMIC) bad "cf-cache-status DYNAMIC: foto's gaan altijd naar je server. Maak de Cache Rule aan (infra/SEO_CRAWL_HEALTH.md §1)";;
    MISS|EXPIRED) wrn "cf-cache-status $CS bij de tweede keer. Draai het script nog eens; blijft dit zo, controleer de Cache Rule";;
    *) bad "geen cf-cache-status voor foto's (kreeg '${CS:-niets}')";;
  esac
  CC=$(header "$P" cache-control)
  case "$CC" in *immutable*) ok "foto Cache-Control: $CC";; *) wrn "foto Cache-Control mist immutable: '${CC:-niets}'";; esac
  case "$(header "$P" content-type)" in image/*) ok "foto content-type $(header "$P" content-type)";; *) bad "foto geeft geen afbeelding terug";; esac
fi

step "4. Pagina's en API worden NIET gecachet (anders zie je andermans sessie)"
for path in "/" "/api/v1/auth/me" "/profile"; do
  CS=$(header "$(headers "$BASE$path")" cf-cache-status)
  case "$CS" in
    HIT) bad "$path komt uit de Cloudflare-cache (HIT). Haal dit pad uit je cache rules ('Cache Everything' is hier gevaarlijk)";;
    *) ok "$path: cf-cache-status ${CS:-niet gecachet}";;
  esac
done

step "5. Zoekmachines komen erdoor (geen challenge of blokkade)"
for ua_name in Google Bing; do
  [ "$ua_name" = Google ] && UA="$UA_GOOGLE" || UA="$UA_BING"
  for path in /robots.txt /sitemap.xml; do
    R=$(headers "$BASE$path" "$UA")
    ST=$(status "$R")
    if [ -n "$(header "$R" cf-mitigated)" ]; then
      bad "$ua_name $path krijgt een Cloudflare-challenge. Controleer Bot Fight Mode en je WAF-regels"
    elif [ "$ST" = "200" ]; then
      ok "$ua_name $path: 200, cf-cache-status $(header "$R" cf-cache-status)"
    else
      bad "$ua_name $path: status $ST"
    fi
  done
done
printf '%s' "$SITEMAP" | grep -q '<urlset' && ok "sitemap.xml is een geldige urlset" || bad "sitemap.xml lijkt geen sitemap te zijn"
ROBOTS=$(curl -sS --max-time 20 "$BASE/robots.txt" 2>/dev/null)
printf '%s' "$ROBOTS" | grep -qi "^sitemap: $BASE/sitemap.xml" && ok "robots.txt verwijst naar de sitemap" || wrn "robots.txt noemt $BASE/sitemap.xml niet"
if printf '%s' "$ROBOTS" | grep -qi 'Cloudflare\|Content-Signal'; then
  wrn "Cloudflare voegt eigen regels aan robots.txt toe ('Managed robots.txt'). Kan, maar controleer dat ze niet botsen met die van de app"
fi

step "6. Overig"
K=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/indexnow-key.txt" 2>/dev/null)
[ "$K" = "200" ] && ok "IndexNow-sleutel staat online" || wrn "IndexNow-sleutel geeft $K: INDEXNOW_KEY is nog niet gezet"
ENC=$(curl -sS -o /dev/null -D - --max-time 20 -H 'Accept-Encoding: br, gzip' "$BASE/" 2>/dev/null | tr -d '\r' | grep -i '^content-encoding:' | cut -d' ' -f2)
[ -n "$ENC" ] && ok "HTML wordt gecomprimeerd ($ENC)" || wrn "HTML komt ongecomprimeerd binnen"

if [ -n "$ORIGIN_IP" ]; then
  if curl -sS -o /dev/null --max-time 6 "http://$ORIGIN_IP:8080/" 2>/dev/null; then
    bad "poort 8080 op $ORIGIN_IP is open voor internet: wie Cloudflare omzeilt, kan CF-Connecting-IP vervalsen. Zet WEB_BIND_ADDRESS=127.0.0.1"
  else
    ok "poort 8080 op $ORIGIN_IP is niet bereikbaar van buitenaf"
  fi
fi

printf '\n%s goed, %s let op, %s fout\n' "$pass" "$warn" "$fail"
[ "$fail" -eq 0 ]
