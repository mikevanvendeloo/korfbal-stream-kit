# Korfbal StreamKit – API

Backend van **Korfbal StreamKit**, een systeem voor het produceren van livestreams van korfbalwedstrijden.

## Doel

De API is de centrale bron voor alles wat een productieteam tijdens een uitzending nodig heeft:

- **Producties en callsheets** – wedstrijden, crew, posities en het draaiboek per productie.
- **Live show control** – het actieve callsheet-item, klokken en auto-advance, realtime gedeeld via Socket.io.
- **vMix-integratie** – databronnen voor titles (crew, sponsors, interviews, wedstrijdinformatie, callsheet-timing) en het direct pushen van tekst en kleuren naar vMix, per functie naar de gekozen vMix-pc.
- **Sponsors, clubs en spelers** – beheer, import uit de KNKV en sponsorrotaties.
- **Wedstrijdplanning** – import uit de wedstrijdplanning-API, ingedeeld per seizoen.

De bijbehorende webapp is [`korfbal-stream-kit`](https://hub.docker.com/r/mvanvendeloo/korfbal-stream-kit).

## Gebruik

Draai de API samen met PostgreSQL 16 en de Kit, bijvoorbeeld met `docker compose`:

```yaml
services:
  streamz-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: fortuna
      POSTGRES_DB: streamz
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - ./dbdata:/var/lib/postgresql/data

  # Eenmalig: database migreren (en seeden), stopt daarna
  migrate-streamz:
    image: mvanvendeloo/korfbal-stream-api:latest
    environment:
      DATABASE_URL: postgresql://fortuna:${POSTGRES_PASSWORD}@streamz-db:5432/streamz?schema=public
    command: ["node", "/app/seed/migrate-and-seed.cjs"]
    restart: "no"

  # De Kit verwacht de API onder deze naam
  korfbal-streamz-api:
    image: mvanvendeloo/korfbal-stream-api:latest
    environment:
      TZ: Europe/Amsterdam
      NODE_ENV: production
      DATABASE_URL: postgresql://fortuna:${POSTGRES_PASSWORD}@streamz-db:5432/streamz?schema=public
      ASSETS_DIR: /app/storage
    ports:
      - "3333:3333"
    volumes:
      - ./storage:/app/storage
      - ./uploads:/app/uploads
    depends_on:
      migrate-streamz:
        condition: service_completed_successfully
```

## Configuratie

| Variabele | Verplicht | Omschrijving |
|-----------|-----------|--------------|
| `DATABASE_URL` | ja | PostgreSQL connection string |
| `PORT` | nee | Poort van de API (standaard `3333`) |
| `ASSETS_DIR` | nee | Map voor logo's, foto's en KNKV-downloads (koppel als volume) |
| `SCOREBOARD_BASE_URL` / `SHOTCLOCK_BASE_URL` | nee | Adressen van het scorebord en de schotklok in de zaal |
| `HOST_IP` | nee | IP van de host, zodat de vMix-endpoints het juiste adres tonen |
| `LOG_LEVEL` | nee | `error`, `warn`, `info` (standaard) of `debug` |
| `SKIP_SEED` | nee | `true` bij de migratiejob: alleen migreren, niet seeden (bijv. na het terugzetten van een backup) |

De vMix-pc's (één of meer, bijvoorbeeld een stream- en een scherm-pc) en andere instellingen stel je in via Beheer in de Kit.

De **wedstrijdimport** (provider, URL en token) stel je per organisatie in via Beheer → Overig → Organisatie → Wedstrijdimport, niet met env-variabelen. De vroegere env-variabelen voor de wedstrijdplanning worden niet meer gelezen; je kunt ze uit je omgeving halen.

vMix-databronnen en andere apparaten (scorebordschermen) hebben een **API-sleutel** van de organisatie nodig: zet `?key=<sleutel>` achter de URL of stuur de header `X-Api-Key`. Zonder sleutel antwoordt de API met 401 "API-sleutel ontbreekt". Een sleutel maak je in Beheer; hij wordt maar één keer getoond.

## Image

- Gebouwd op een **Docker Hardened Image**: geen shell en geen npm; draait als non-root (uid 1000).
- Multi-arch: `linux/amd64` en `linux/arm64`.
- Health check: `GET /api/health`. API-documentatie (Swagger): `/api/docs`.
- Tags: releases van `main` krijgen `yyyy.mm.n` en `latest`; branch-builds krijgen `yyyy-mm-<branch>-nn` en nooit `latest`. De release notes staan bij de GitHub Release van de tag.

Bedoeld voor gebruik binnen het eigen productienetwerk: er is geen authenticatie.
