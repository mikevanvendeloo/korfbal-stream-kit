# Korfbal StreamKit – Venue-bridge

De app die **in de zaal** draait en het scorebord, de zaalklok, de schotklok, de statistiek-pc en vMix verbindt met de Streamz API (bijvoorbeeld in de cloud). De bridge belt zelf naar de API; in de zaal hoeft geen poort naar buiten open. Een bridge per organisatie.

```
zaal: scorebord, schotklok, statistiek-pc, vMix  ──  venue-bridge  ══►  Streamz API (cloud)
```

## Gebruik

```yaml
services:
  venue-bridge:
    image: mvanvendeloo/streamz-kit-venue-bridge:latest
    restart: unless-stopped
    environment:
      API_URL: https://streamz.example.nl
      API_KEY: <API-sleutel van de organisatie>
      BRIDGE_NAME: Zaal Fortuna
      STATS_DIR: /stats                    # alleen nodig voor de statistiekendatabase
    ports:
      - "3340:3340"                        # pagina en reserve-API, alleen op het netwerk van de zaal
    volumes:
      - ./data/venue-bridge:/data          # opgeslagen configuratie en kopie van de database, van uid 1000
      - /Volumes/KL2627:/stats:ro          # Mac: gemounte share; Windows: C:/streamz/stats (robocopy)
```

Alles over de zaal (adressen van scorebord, schotklok en vMix, de statistiekeninstellingen) stel je in de Kit in bij **Beheer, Instellingen, Venue**. De bridge ontvangt het van de API en bewaart het in `/data`, zodat hij ook doorwerkt als de verbinding met de API wegvalt.

## Startinstellingen

| Variabele | Verplicht | Betekenis |
|---|---|---|
| `API_URL` | ja | Adres van de Streamz API |
| `API_KEY` | ja | API-sleutel van de organisatie (nooit gelogd) |
| `BRIDGE_NAME` | nee | Naam in de Kit (standaard `venue-bridge`) |
| `BRIDGE_PAGE_URL` | nee | Adres van de pagina van de bridge, als link in de Kit |
| `STATS_DIR` | nee | Alleen-lezen map van de statistiek-pc (gemounte share of lokale map) |
| `COPY_DIR` | nee | Kopie van de database (standaard `/data`) |
| `CONFIG_FILE` | nee | Opgeslagen configuratie (standaard `/data/venue-bridge.json`) |
| `PORT` | nee | Standaard `3340` |
| `LOG_LEVEL` | nee | `error`, `warn`, `info` of `debug` |

## Pagina en reserve-API

`http://<bridge>:3340/` toont de status (verbinding met de API, configuratie, apparaten, vMix). Valt de API weg, dan werken `http://<bridge>:3340/api/scoreboard`, `/api/scoreboard/clock`, `/api/scoreboard/shotclock`, `/api/stats/...` en `POST /api/vmix/set-timer` met dezelfde API-sleutel (`?key=` of `X-Api-Key`).

De container draait als non-root (uid 1000), zonder shell. Healthcheck: `GET /health`. Meer: `apps/venue-bridge/README.md` in de repository.
