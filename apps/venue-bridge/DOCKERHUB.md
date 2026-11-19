# Korfbal StreamKit – Venue-bridge

De app die **in de zaal** draait en het scorebord, de zaalklok, de schotklok, de statistiek-pc en vMix verbindt met de Streamz API (bijvoorbeeld in de cloud). De bridge belt zelf naar de API; in de zaal hoeft geen poort naar buiten open. Een bridge per organisatie.

```
zaal: scorebord, schotklok, statistiek-pc, vMix  ──  venue-bridge  ══►  Streamz API (cloud)
```

## Gebruik

Zet alle instellingen in één env-bestand dat je niet deelt, bijvoorbeeld `venue-bridge.env` (in de map `distribution/` van de repository heet het `streamz.local.env`, met een voorbeeld ernaast):

```dotenv
# Verplicht
API_URL=https://streamz.example.nl
API_KEY=<API-sleutel van de organisatie>
# Optioneel
BRIDGE_NAME=Zaal Fortuna
BRIDGE_PAGE_URL=http://192.168.1.10:3340
LOG_LEVEL=info
```

Docker Compose leest dat bestand met `env_file`; in het compose-bestand staan alleen de vaste waarden:

```yaml
services:
  venue-bridge:
    image: mvanvendeloo/streamz-kit-venue-bridge:2026.11.7   # een vaste release-tag, geen latest
    restart: unless-stopped
    env_file:
      - path: venue-bridge.env
        required: true
    environment:
      STATS_DIR: /stats                    # alleen nodig voor de statistiekendatabase
    ports:
      - "3340:3340"                        # pagina en reserve-API, alleen op het netwerk van de zaal
    volumes:
      - ./data/venue-bridge:/data          # opgeslagen configuratie en kopie van de database (uid 1000)
      - C:/streamz/stats:/stats:ro         # map van de statistiek-pc: Windows (robocopy) of /Volumes/KL2627 op een Mac
```

Of zonder Compose:

```bash
docker run -d --name venue-bridge --restart unless-stopped --env-file venue-bridge.env \
  -e STATS_DIR=/stats -p 3340:3340 \
  -v "$PWD/data/venue-bridge:/data" -v /Volumes/KL2627:/stats:ro \
  mvanvendeloo/streamz-kit-venue-bridge:2026.11.7
```

Alles over de zaal (adressen van scorebord, schotklok en vMix, de statistiekeninstellingen) stel je in de Kit in bij **Beheer, Instellingen, Venue**. De bridge ontvangt het van de API en bewaart het in `/data`, zodat hij ook doorwerkt als de verbinding met de API wegvalt.

## Startinstellingen

In het env-bestand:

| Variabele | Verplicht | Voorbeeld | Betekenis |
|---|---|---|---|
| `API_URL` | ja | `https://streamz.example.nl` | Adres van Streamz, zonder `/api`. API op dezelfde pc (Docker Desktop): `http://host.docker.internal:3333`; in hetzelfde Docker-netwerk: `http://korfbal-streamz-api:3333`. De bridge verbindt met `<API_URL>/venue-bridge-socket` (WebSocket; een reverse proxy moet dat doorlaten) |
| `API_KEY` | ja | | API-sleutel van de organisatie (Beheer, Organisatie-instellingen, API-sleutels). Nooit gelogd of getoond |
| `BRIDGE_NAME` | nee | `Zaal Fortuna` | Naam in de Kit (standaard `venue-bridge`) |
| `BRIDGE_PAGE_URL` | nee | `http://192.168.1.10:3340` | Adres van de pagina van deze bridge op het netwerk van de zaal (niet `localhost`); de Kit toont er een link naar |
| `LOG_LEVEL` | nee | `info` | `error`, `warn`, `info` of `debug` (elke stap bij het lezen van de statistieken) |

Vast in de container, alleen aanpassen als je weet waarom:

| Variabele | Standaard | Betekenis |
|---|---|---|
| `STATS_DIR` | leeg | Alleen-lezen map met de bestanden van de statistiek-pc (`/stats` met een volume erop) |
| `COPY_DIR` | `/data` | Kopie van de statistiekendatabase (schrijfbaar, uid 1000) |
| `CONFIG_FILE` | `/data/venue-bridge.json` | Opgeslagen configuratie |
| `PORT` / `HOST` | `3340` / `0.0.0.0` | Waar de pagina en de reserve-API luisteren |

Volumes: **`/data`** (verplicht: zonder werkt de bridge niet door als de API wegvalt) en **`/stats`** alleen-lezen (de share of een lokale map; zonder alleen de statistiekenpagina op een http-adres). Poort **3340** alleen op het netwerk van de zaal. Zonder `API_URL` of `API_KEY` stopt de bridge meteen met een melding.

## Pagina en reserve-API

`http://<bridge>:3340/` toont de status (verbinding met de API, configuratie, apparaten, vMix). Valt de API weg, dan werken `http://<bridge>:3340/api/scoreboard`, `/api/scoreboard/clock`, `/api/scoreboard/shotclock`, `/api/stats/...` en `POST /api/vmix/set-timer` met dezelfde API-sleutel (`?key=` of `X-Api-Key`).

De container draait als non-root (uid 1000), zonder shell. Healthcheck: `GET /health`. Meer: `apps/venue-bridge/README.md` in de repository.
