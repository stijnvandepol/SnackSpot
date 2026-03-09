# SnackSpot Admin Panel

Beveiligd admin panel voor het beheren van gebruikers, restaurants en reviews.

## ⚠️ Beveiliging

**BELANGRIJK:** Dit admin panel draait op een aparte poort (3001) en moet zorgvuldig worden beveiligd:

### 🔒 Beveiligingsmaatregelen

**Aanbevolen: Cloudflare Tunnel + OAuth** ⭐
- Geen poorten openen in firewall
- HTTPS automatisch
- OAuth/SSO authenticatie (Google, GitHub, Microsoft)
- **👉 Zie [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) voor complete instructies**

**Alternatieve opties:**

1. **Firewall configuratie**
   - Blokkeer poort 3001 van buitenaf
   - Alleen toegankelijk via intern netwerk of VPN
   
2. **Reverse Proxy (nginx)**
   - IP whitelist
   - HTTPS termination
   - Rate limiting
   - Zie [SECURITY.md](SECURITY.md)

3. **VPN Access**
   - WireGuard, OpenVPN
   - Meest veilig voor remote toegang
   - Zie [SECURITY.md](SECURITY.md)

4. **Admin Gebruikers**
   - Maak ADMIN gebruikers alleen via database
   - Gebruik sterke wachtwoorden (min. 16 karakters)

## 🚀 Toegang

### Lokale Ontwikkeling
```bash
# Start admin panel in development mode
cd apps/admin
pnpm dev
# Toegankelijk op http://localhost:3001
```

### Productie (Docker)
```bash
# Admin panel start standaard alleen op localhost:3001
docker-compose up -d admin
```

### Toegang tot admin panel

Lokaal:
```
http://localhost:3001
```

LAN toegang (alleen als je `ADMIN_BIND_ADDRESS=0.0.0.0` zet):
```
http://192.168.x.x:3001
```

Standaard bindt het admin panel alleen op localhost. Zet `ADMIN_BIND_ADDRESS=0.0.0.0` als je het bewust via LAN of een tunnelhost wilt aanbieden.

## 👤 Admin Gebruiker Aanmaken

Maak je eerste admin gebruiker via de database:

```sql
-- Connecteer met je database
psql -U snackspot -d snackspot

-- Update een bestaande gebruiker naar ADMIN rol
UPDATE users SET role = 'ADMIN' WHERE email = 'jouw-email@example.com';

-- Of maak een nieuwe admin aan (je moet eerst een account registreren via de app)
```

Of gebruik Prisma Studio:

```bash
# Via Prisma Studio
pnpm --filter @snackspot/db prisma studio
# Selecteer Users tabel en wijzig de 'role' naar 'ADMIN'
```

## 📋 Functionaliteiten

### Gebruikersbeheer
- ✅ Bekijk alle gebruikers
- ✅ Zoek gebruikers op email/username
- ✅ Bewerk gebruikersgegevens (email, username, rol)
- ✅ Reset wachtwoorden
- ✅ Ban/unban gebruikers
- ✅ Verwijder gebruikers (inclusief hun reviews)

### Restaurant Beheer
- ✅ Bekijk alle restaurants
- ✅ Zoek restaurants op naam/adres
- ✅ Maak nieuwe restaurants aan
- ✅ Bewerk restaurant details
- ✅ Verwijder individuele restaurants
- ✅ **Bulk actie:** Verwijder alle restaurants zonder reviews

### Review Beheer
- ✅ Bekijk alle reviews
- ✅ Zoek reviews op tekst/gebruiker/restaurant
- ✅ Filter op status (PUBLISHED, HIDDEN, DELETED)
- ✅ Wijzig review status
- ✅ Soft delete reviews (status = DELETED)
- ✅ Permanent verwijderen van reviews
- ✅ Bekijk gedetailleerde review informatie

### Meldingen & Moderatie
- ✅ Bekijk gerapporteerde reviews, foto's en gebruikers
- ✅ Filter op status (Open, Afgehandeld, Afgewezen)
- ✅ Filter op type (Review, Photo, User)
- ✅ Verberg of verwijder gerapporteerde content
- ✅ Wijs meldingen af als ze niet valide zijn
- ✅ Zie wie de melding heeft gemaakt en waarom

### Dashboard
- 📊 Statistieken overzicht
- 📈 Recent activiteit (laatste 7 dagen)
- ⚠️ Restaurants zonder reviews teller
- 🚨 Open meldingen counter met directe link

## 🔐 Authenticatie

Het admin panel gebruikt een server-side admin sessiecookie op basis van dezelfde JWT secrets als de hoofd-app en vereist de `ADMIN` rol.

### Login Flow
1. Navigeer naar `http://localhost:3001` (of je admin domein)
2. Log in met een account met ADMIN rol
3. De server zet een `httpOnly` sessiecookie
4. De sessie is 8 uur geldig

### API Endpoints
Alle admin API endpoints bevinden zich in `/api/*` en vereisen:
- een geldige admin sessiecookie
- ADMIN rol in de JWT token

## 🛠️ Technische Details

### Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL + Prisma
- **Styling:** Tailwind CSS
- **Auth:** JWT (shared with main app)

### Poorten
- **Hoofd app:** 3000 (dev) / 8080 (docker)
- **Admin panel:** 3001
- **Database:** 5432
- **Redis:** 6379
- **MinIO:** 9000

### Environment Variables
Zelfde als hoofd-app:
```env
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
```

## 🔄 Updates & Maintenance

### Database Migraties
Het admin panel gebruikt dezelfde database als de hoofd-app. Migraties worden gedeeld:

```bash
# Maak nieuwe migratie
cd packages/db
pnpm prisma migrate dev

# Deploy naar productie
docker-compose restart migrate
```

### Updates Deployen
```bash
# Rebuild admin container
docker-compose build admin
docker-compose up -d admin
```

## 📝 Best Practices

1. **Gebruik** Cloudflare Tunnel + OAuth voor externe toegang (aanbevolen)
2. **Of gebruik nooit** het admin panel op een publiek IP zonder extra beveiliging
3. **Log altijd** admin acties (toekomstige feature: audit log)
4. **Backup** regelmatig je database voor kritieke bulk acties
5. **Test** bulk acties eerst in een staging omgeving
6. **Roteer** JWT secrets regelmatig

## 🐛 Troubleshooting

### Kan niet inloggen
- ✅ Controleer of je account ADMIN rol heeft in de database
- ✅ Controleer of JWT_ACCESS_SECRET correct is ingesteld
- ✅ Check browser console voor error messages

### Admin panel niet bereikbaar
- ✅ Controleer of admin container draait: `docker-compose ps`
- ✅ Check poort 3001 is niet in gebruik: `netstat -an | grep 3001`
- ✅ Review firewall regels

### Database verbinding errors
- ✅ Zelfde DATABASE_URL als hoofd-app
- ✅ Database container is healthy: `docker-compose ps db`
- ✅ Network connectivity: admin en db in zelfde Docker network

## 📚 Documentatie

- **[CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md)** - Cloudflare Tunnel + OAuth setup (aanbevolen)
- **[SECURITY.md](SECURITY.md)** - Alternatieve beveiligingsopties (firewall, VPN, nginx)

## 📚 Meer Informatie

Zie hoofdproject README voor algemene setup en deployment instructies.
