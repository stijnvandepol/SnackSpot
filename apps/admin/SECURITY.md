# 🔒 Admin Panel Beveiligingsgids

Deze gids beschrijft hoe je het SnackSpot Admin Panel veilig kunt configureren en beheren.

## ⭐ Aanbevolen: Cloudflare Tunnel + OAuth

**Dit is de meest gebruiksvriendelijke én veilige optie.**

Voordelen:
- ✅ Geen poorten openen in firewall
- ✅ Automatische HTTPS
- ✅ OAuth/SSO (Google, GitHub, etc.)
- ✅ Email-based access control
- ✅ Gratis voor kleine teams (tot 50 users)
- ✅ Audit logs inbegrepen
- ✅ DDoS bescherming
- ✅ Eenvoudig te beheren

**👉 Zie [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) voor complete setup instructies.**

---

## Alternatieve Beveiliging Setup Opties

### Optie 2: IP Whitelist via Firewall (Voor kleine teams zonder OAuth)

**Windows Firewall:**
```powershell
# Blokkeer alle toegang tot poort 3001
New-NetFirewallRule -DisplayName "Block Admin Panel" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Block

# Sta specifieke IPs toe
New-NetFirewallRule -DisplayName "Allow Admin from Office" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow -RemoteAddress 192.168.1.100
```

**Linux (ufw):**
```bash
# Blokkeer standaard
sudo ufw deny 3001

# Sta specifieke IPs toe
sudo ufw allow from 192.168.1.100 to any port 3001
```

**Linux (iptables):**
```bash
# Blokkeer alle toegang
iptables -A INPUT -p tcp --dport 3001 -j DROP

# Sta jouw IP toe
iptables -I INPUT -p tcp -s 192.168.1.100 --dport 3001 -j ACCEPT
```

### Optie 3: Nginx Reverse Proxy met IP Whitelist

**Voordelen:**
- Gecentraliseerd access control
- HTTPS termination
- Rate limiting
- Extra security headers

**Configuratie:**
```nginx
# /etc/nginx/sites-available/snackspot-admin

# IP whitelist
geo $admin_allowed {
    default 0;
    192.168.1.0/24 1;      # Kantoor netwerk
    10.0.0.5/32 1;         # Jouw thuis IP
}

server {
    listen 443 ssl http2;
    server_name admin.snackspot.example.com;

    # SSL certificaten (gebruik Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/admin.snackspot.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.snackspot.example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' 'unsafe-eval'" always;

    # IP check
    if ($admin_allowed = 0) {
        return 403;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=10r/m;
    limit_req zone=admin_limit burst=5 nodelay;

    # Proxy naar admin panel
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Redirect HTTP naar HTTPS
server {
    listen 80;
    server_name admin.snackspot.example.com;
    return 301 https://$server_name$request_uri;
}
```

**Activeer configuratie:**
```bash
sudo ln -s /etc/nginx/sites-available/snackspot-admin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Optie 4: VPN Access (Meest veilig voor remote work)

**Met WireGuard:**

1. **Installeer WireGuard op server:**
```bash
sudo apt install wireguard
```

2. **Genereer keys:**
```bash
wg genkey | tee server_private.key | wg pubkey > server_public.key
wg genkey | tee client_private.key | wg pubkey > client_public.key
```

3. **Server configuratie** (`/etc/wireguard/wg0.conf`):
```ini
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = <SERVER_PRIVATE_KEY>

[Peer]
PublicKey = <CLIENT_PUBLIC_KEY>
AllowedIPs = 10.0.0.2/32
```

4. **Admin panel alleen beschikbaar via VPN:**
```bash
# Firewall: admin panel alleen bereikbaar vanaf VPN
sudo iptables -A INPUT -i wg0 -p tcp --dport 3001 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3001 -j DROP
```

5. **Start VPN:**
```bash
# Server
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0
```

**Toegang via VPN:**
```
http://10.0.0.1:3001
```

### Optie 5: SSH Tunnel (Tijdelijke toegang)

Voor eenmalige/tijdelijke toegang:

```bash
# Maak SSH tunnel vanaf je lokale machine
ssh -L 3001:localhost:3001 user@server-ip

# Admin panel nu beschikbaar op:
# http://localhost:3001
```

**Voordelen:**
- Geen configuratie wijzigingen nodig
- Automatisch veilig via SSH
- Tijdelijk, sluit automatisch bij disconnect

## Admin Gebruiker Management

### Admin Aanmaken via SQL

```sql
-- Connecteer met database
psql postgresql://snackspot:password@localhost:5432/snackspot

-- Promoveer bestaande gebruiker
UPDATE users 
SET role = 'ADMIN' 
WHERE email = 'jouw-email@example.com';

-- Verificatie
SELECT id, email, username, role, created_at 
FROM users 
WHERE role = 'ADMIN';
```

### Admin via Migration Script

Maak bestand: `packages/db/migrations/009_create_admin.sql`

```sql
-- Voeg admin user toe indien deze nog niet bestaat
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'ADMIN') THEN
    INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)
    VALUES (
      gen_random_uuid()::text,
      'admin@snackspot.local',
      'admin',
      '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',  -- MOET GERESET
      'ADMIN',
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Admin user created. Please reset password immediately!';
  END IF;
END $$;
```

## Wachtwoord Beleid

### Sterke Admin Wachtwoorden

**Minimale eisen:**
- 16+ karakters
- Hoofdletters, kleine letters, cijfers, symbolen
- Geen persoonlijke informatie
- Uniek per admin

**Wachtwoord genereren:**
```bash
# Linux/Mac
openssl rand -base64 24

# Of gebruik een password manager (aanbevolen)
```

## Monitoring & Audit Logging

### Nginx Access Logs

Monitor admin toegang:
```bash
# Real-time monitoring
tail -f /var/log/nginx/access.log | grep admin.snackspot

# Failed access attempts
grep "403" /var/log/nginx/access.log | grep admin
```

### Docker Logs

```bash
# Admin panel logs
docker-compose logs -f admin

# Bekijk login attempts
docker-compose logs admin | grep "login"
```

### Toekomstige Features

- [ ] Audit log in database voor alle admin acties
- [ ] 2FA/TOTP support
- [ ] Session management (force logout)
- [ ] IP ban na meerdere mislukte login pogingen
- [ ] Email notificaties bij admin login

## Checklist: Admin Panel in Productie

- [ ] Beveiliging gekozen en geconfigureerd (Cloudflare aanbevolen)
- [ ] HTTPS ingeschakeld
- [ ] Minimaal 1 admin gebruiker aangemaakt
- [ ] Admin wachtwoorden zijn sterk (16+ chars)
- [ ] Security headers toegevoegd
- [ ] Rate limiting actief (indien van toepassing)
- [ ] Backups ingesteld
- [ ] Monitoring/logging actief
- [ ] JWT secrets zijn sterk en uniek
- [ ] Environment variabelen veilig opgeslagen
- [ ] Team is getraind in veilig gebruik

## Incident Response

### Bij verdachte activiteit:

1. **Blokkeer toegang onmiddellijk:**
```bash
# Firewall
sudo ufw deny 3001

# Of stop container
docker-compose stop admin
```

2. **Check logs:**
```bash
docker-compose logs admin | tail -100
# Of Cloudflare Access logs (indien gebruikt)
```

3. **Roteer JWT secrets:**
```bash
# Genereer nieuwe secrets
openssl rand -base64 64

# Update .env
# Herstart services
docker-compose restart web admin
```

4. **Reset alle admin wachtwoorden**

5. **Review database voor ongeautoriseerde wijzigingen**

## Vragen?

Zie [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) voor de aanbevolen setup of het hoofdproject README voor algemene vragen.
