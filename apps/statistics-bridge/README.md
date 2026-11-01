# Statistics bridge

Een kleine, **tijdelijke** app die de statistiek-pc in de zaal uitleest en de cijfers aan de Streamz API geeft. Hij staat los van de API in een eigen Docker-image: valt de pc, de share of het netwerk uit, dan valt alleen de bridge om. De Streamz Kit toont dan "De statistics bridge is offline" en de rest werkt gewoon door.

```
statistiek-pc (10.12.0.63)  --share/pagina-->  statistics-bridge  <--HTTP--  Streamz API  <--  Kit en vMix
```

Kit en vMix blijven de Streamz API gebruiken (`/api/stats/*`, met dezelfde API-sleutels); alleen de API praat met de bridge. **Een bridge per zaal/statistiek-pc**, ingesteld met omgevingsvariabelen. De bridge kent geen organisaties en heeft geen database.

## Omgevingsvariabelen

| Variabele | Standaard | Betekenis |
|---|---|---|
| `PORT` | `3340` | Poort van de bridge |
| `STATS_DIR` | leeg | Alleen-lezen map met de bestanden van de statistiek-pc: de gemounte share of een lokale map. Leeg: geen share |
| `PAGE_URL` | leeg | Adres van de "Tweede Scherm klassiek"-pagina (`http(s)://...`), of een relatief `.html`-pad binnen `STATS_DIR` |
| `MDB_PATH` | leeg | Pad van `WEDSTRIJDEN.mdb` binnen `STATS_DIR`. `{team}` wordt het teamnummer van de actieve productie (`F{team}/WEDSTRIJDEN.mdb`) |
| `MDB_ENABLED` | `true` | `false`: de database wordt nooit aangeraakt (ook `STATS_DIR`, de share en de kopie niet); alleen de pagina telt |
| `SHARE_HOST` | leeg | De statistiek-pc (IP of naam) voor de SMB-poortcontrole. Leeg: de host uit `PAGE_URL` |
| `KEEP_COPY` | `true` | Na een geslaagde lezing een lokale kopie bewaren (hooguit elke 5 minuten) |
| `COPY_DIR` | `/data` | Waar die kopie staat (schrijfbaar, van uid 1000) |
| `BRIDGE_TOKEN` | leeg | Gedeeld geheim: is het gezet, dan vraagt elke route behalve `/health` de header `X-Bridge-Token` (tijdveilig vergeleken). Vul hetzelfde in bij Beheer, Instellingen, Statistieken |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info` of `debug` |

De bridge schrijft nooit naar `STATS_DIR` en logt geen tokens.

## Routes

`GET` op de bridge zelf (de Streamz API stuurt dezelfde paden door onder `/api/stats`):

| Route | Wat |
|---|---|
| `/health` | Het proces draait (geen token, geen share) |
| `/status` | Verbinding: `network`, `database` (`disabled` of ok/mislukt), `page`, `team` |
| `/live`, `/live/players?team=home\|away&vak=1` | De pagina, en vlakke spelersrijen voor vMix |
| `/matches` | Wedstrijden uit de database (nieuwste eerst). Zonder database: één regel `live` (`source: page`) |
| `/matches/:table/actions`, `/matches/:table/players` | Acties, en totalen per speler. `/matches/live/players`: de spelers van de pagina |
| `/team-stats` | Twee vlakke rijen (thuis, uit): doelpunt-, rebound-, strafworp-, vrije bal-, afstand-, korte schot- en doorloop-percentages, doelpunten dames/heren, aanvalscijfers |
| `/top-scorers` | Per ploeg de spelers met een doelpunt, de meeste eerst, met `rank` |
| `/analysis` | Analyse van de wedstrijd met de laatste actie, voor de analist: verloop van de stand, runs (3+ doelpunten op rij), langste periode zonder doelpunt, aanvallen per vak (aanvallen, met doelpunt, schoten per aanval, balverlies, rebounds), duels (speler tegen directe tegenstander), schotkaart per zone en type, balverlies per soort; alles ook per helft. Alleen uit de database: zonder database 503 "De analyse heeft het statistiekenbestand nodig" |
| `/players` | Spelersoverzicht (alleen database; anders 503 "Database niet beschikbaar") |
| `/current/players` | De spelers van de wedstrijd met de laatste actie; zonder database die van de pagina (`source: page`) |

`?team=<cijfers>` kiest `{team}` in `MDB_PATH` (standaard 1). De antwoorden hebben `X-Stats-Source` (`share`, `copy` of `page`), `X-Stats-Read-At` en `X-Stats-Team`; bij een pagina als stand-in ook `X-Stats-Database` (`disabled` of `unreachable`).

## Draaien

Zonder Docker (ontwikkelen): `npm run bridge:dev` (leest de omgevingsvariabelen), tests `npm run bridge:test`, build `npm run bridge:build`.

Met Docker naast de bestaande omgeving: de compose-bestanden staan in `compose/`. Het zijn **overrides**: de hoofdbestanden blijven ongemoeid.

```bash
scripts/statistics-bridge/start.sh                # standaard: de opgeslagen pagina, geen database
scripts/statistics-bridge/start.sh mac            # of: windows-robocopy | cifs | page-only
scripts/statistics-bridge/start.ps1 windows-robocopy    # Windows
```

Of met de hand:

```bash
docker compose -f docker-compose.yml \
  -f apps/statistics-bridge/compose/docker-compose.statistics-bridge.yml \
  -f apps/statistics-bridge/compose/variants/mac.yml up -d --build statistics-bridge
```

Daarna in Beheer, Instellingen, Statistieken: **Statistics bridge URL** `http://statistics-bridge:3340` (de servicenaam binnen Docker), en eventueel het **Bridge-token**. Productie: `docker-compose.statistics-bridge.prod.yml` met de image `mvanvendeloo/statistics-bridge:${STREAMZ_BRIDGE_VERSION}`.

## De drie manieren om bij de share te komen (plus alleen de pagina)

1. **Mac, share gemount** (`variants/mac.yml`). Mount de share met `scripts/statistics-bridge/mount-share-mac.sh` (`//GUEST@10.12.0.63/KL2627` op `/Volumes/KL2627`, idempotent, geeft een melding als de pc uit staat). De container ziet die map als `/stats` (alleen-lezen).
2. **Windows, robocopy** (`variants/windows-robocopy.yml`). `scripts/statistics-bridge/sync-stats.ps1` kopieert elke paar seconden alleen gewijzigde bestanden van de share naar `C:\streamz\stats` (`/R:0 /W:0`: een share die niet antwoordt houdt niets op). Met `-Install` wordt het een geplande taak die bij het inloggen start. De container leest alleen die lokale map.
3. **CIFS-volume** (`variants/cifs.yml`). Docker mount de share zelf. Let op: staat de pc uit, dan kan Docker het volume niet maken en **start de bridge niet**. Dat is nu geen probleem: alleen de bridge valt om. Heb je dat niet nodig, kies dan 1 of 2.
4. **Alleen de pagina** (`variants/page-only.yml`): `MDB_ENABLED=false`, alleen `PAGE_URL`, geen volume. De spelerscijfers komen dan van de pagina.

Voor alle varianten geldt: de lokale kopie van de database staat in `./data/statistics-bridge` (op de host), die van uid 1000 moet zijn (`sudo chown -R 1000:1000 data/statistics-bridge`; Docker Desktop doet dat zelf goed).

## De HTML-terugval testen

**Standaard** gebruikt `docker-compose.statistics-bridge.yml` zonder variant de opgeslagen pagina `compose/local-html/tweede-scherm.html` met `MDB_ENABLED=false`: de bridge werkt dan meteen, zonder statistiek-pc (`scripts/statistics-bridge/start.sh` zonder variant doet dit). Vervang dat bestand door een nieuwer opgeslagen "Tweede Scherm klassiek", of kies een van de andere manieren. Zonder statistiek-pc, met alleen `MDB_ENABLED=false` en de pagina:

- **Een opgeslagen pagina als bestand.** Zet een opgeslagen `tweede-scherm.html` in een lokale map, bijvoorbeeld `./stats-test/`, en mount die als `/stats` in de container (voeg `STATS_DIR: /stats` en het volume toe). Zet `PAGE_URL=tweede-scherm.html` en `MDB_ENABLED=false`. Een relatief `PAGE_URL` leest dat ene bestand uit `STATS_DIR`; de database, de kopie en de rest van de map blijven onaangeroerd.
- **Een kleine webserver.** `cd stats-test && python3 -m http.server 8099`, dan op de bridge `PAGE_URL=http://host.docker.internal:8099/tweede-scherm.html` en `MDB_ENABLED=false` (op Linux: voeg `extra_hosts: ["host.docker.internal:host-gateway"]` toe).

Controleren: `curl http://localhost:3340/status` (`database: "disabled"`), `/matches` (één regel `live`) en `/current/players` (`source: "page"`). In de Kit staat dan "Bron: live pagina (database uit)".

## Beveiliging

- Alleen-lezen: de bridge schrijft alleen naar `COPY_DIR`.
- Paden binnen `STATS_DIR`: geen `..`, geen absolute paden, alleen `.mdb`/`.accdb` (database) en `.html`/`.htm` (pagina), echte pad binnen de root, groottelimiet; het teamnummer is alleen cijfers.
- Een share die hangt kan de bridge niet blokkeren: één bewerking tegelijk, een tijdslimiet op elke toegang, groeiende wachttijd na een fout, en eerst een poortcontrole van de pc.
- Het Access-bestand wordt in een aparte thread gelezen (limiet 10 s); de bron is de eigen statistiek-pc.
- Zet `BRIDGE_TOKEN` als de bridge op een netwerk staat waar meer dan de API bij kan.
