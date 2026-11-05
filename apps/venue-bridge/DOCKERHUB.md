# Korfbal StreamKit – Statistics bridge

Kleine, tijdelijke app die de **statistiek-pc** in de zaal uitleest (de gedeelde map met `WEDSTRIJDEN.mdb` en de "Tweede Scherm klassiek"-pagina) en de cijfers aan de [`korfbal-stream-api`](https://hub.docker.com/r/mvanvendeloo/korfbal-stream-api) geeft. Een storing van de pc of de share valt alleen de bridge; de Streamz Kit toont dan "De statistics bridge is offline". Een bridge per zaal.

## Gebruik

```yaml
services:
  statistics-bridge:
    image: mvanvendeloo/statistics-bridge:latest
    restart: unless-stopped
    networks:
      - korfbal-network
    environment:
      PAGE_URL: http://10.12.0.63/tweede-scherm.html
      SHARE_HOST: 10.12.0.63
      STATS_DIR: /stats
      MDB_PATH: F{team}/WEDSTRIJDEN.mdb
      # BRIDGE_TOKEN: een-geheim
    volumes:
      - /Volumes/KL2627:/stats:ro           # Mac: gemounte share; Windows: C:/streamz/stats (robocopy)
      - ./data/statistics-bridge:/data      # lokale kopie van de database, van uid 1000
```

Alleen de pagina, zonder database: `MDB_ENABLED: "false"`, `PAGE_URL` en geen volume.

Vul daarna in de Streamz Kit (Beheer, Instellingen, Statistieken) het **Statistics bridge URL** in: `http://statistics-bridge:3340`.

## Omgevingsvariabelen

| Variabele | Verplicht | Betekenis |
|---|---|---|
| `PORT` | nee | Poort (standaard `3340`) |
| `STATS_DIR` | nee | Alleen-lezen map van de statistiek-pc (gemounte share of lokale map) |
| `PAGE_URL` | nee | Adres van de statistiekenpagina, of een relatief `.html`-pad in `STATS_DIR` |
| `MDB_PATH` | nee | Pad van `WEDSTRIJDEN.mdb` in `STATS_DIR`; `{team}` wordt het teamnummer van de actieve productie |
| `MDB_ENABLED` | nee | `false`: nooit de database, de share of de kopie aanraken (standaard `true`) |
| `SHARE_HOST` | nee | De statistiek-pc voor de SMB-poortcontrole (anders de host van `PAGE_URL`) |
| `KEEP_COPY` | nee | Lokale kopie van de database bewaren (standaard `true`) |
| `COPY_DIR` | nee | Map voor die kopie (standaard `/data`; schrijfbaar voor uid 1000) |
| `BRIDGE_TOKEN` | nee | Gedeeld geheim: dan vraagt elke route behalve `/health` de header `X-Bridge-Token` |
| `LOG_LEVEL` | nee | `error`, `warn`, `info` of `debug` |

De container draait als non-root (uid 1000), zonder shell. Healthcheck: `GET /health`.
