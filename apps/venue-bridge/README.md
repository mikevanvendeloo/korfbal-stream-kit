# Venue-bridge

De venue-bridge draait **in de zaal** en verbindt de apparaten daar met de Streamz API, die ergens anders (bijvoorbeeld in de cloud) draait: het scorebord, de zaalklok, de schotklok, de statistiek-pc en vMix. De API kan die apparaten niet bereiken; de bridge wel.

```
scorebord, schotklok, zaalklok  ──┐
statistiek-pc (share en pagina) ──┼──  venue-bridge (zaal)  ◄══ socket.io, door de bridge zelf geopend ══►  Streamz API (cloud)  ◄──  Kit, vMix
vMix-pc's                       ◄─┘            │
                                               └── pagina en reserve-API op http://<bridge>:3340 (alleen in de zaal)
```

De bridge belt zelf naar de API (uitgaand, via `API_URL`); er hoeft geen poort van de zaal naar buiten open. **Een bridge per organisatie**: een tweede bridge met dezelfde sleutel vervangt de eerste. De bridge heeft geen database en kent geen organisaties: de API-sleutel bepaalt voor welke organisatie hij werkt.

## Startinstellingen

Alleen wat de bridge nodig heeft om de API te bereiken, met omgevingsvariabelen:

| Variabele | Standaard | Betekenis |
|---|---|---|
| `API_URL` | verplicht | Adres van de Streamz API, bijvoorbeeld `https://streamz.example.nl` |
| `API_KEY` | verplicht | API-sleutel van de organisatie (Beheer, Organisatie-instellingen, API-sleutels). Wordt nooit gelogd of getoond |
| `BRIDGE_NAME` | `venue-bridge` | Naam van de bridge, zichtbaar in de Kit |
| `BRIDGE_PAGE_URL` | leeg | Adres van de pagina van deze bridge op het netwerk van de zaal; de Kit toont er een link naar |
| `STATS_DIR` | leeg | Alleen-lezen map met de bestanden van de statistiek-pc: de gemounte share of een lokale map |
| `COPY_DIR` | `/data` | Waar de lokale kopie van de statistiekendatabase komt (schrijfbaar, uid 1000) |
| `CONFIG_FILE` | `/data/venue-bridge.json` | Waar de ontvangen configuratie wordt bewaard |
| `PORT` / `HOST` | `3340` / `0.0.0.0` | Waar de pagina en de reserve-API luisteren |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info` of `debug` |

Zonder `API_URL` of `API_KEY` stopt de bridge meteen met een melding.

## Centrale configuratie en de cache

Alles over de zaal stel je **in de Kit** in, bij **Beheer, Instellingen, Venue**: de adressen van scorebord en schotklok, de statistiekeninstellingen (pagina, databasepad, database aan of uit, adres van de statistiek-pc, lokale kopie) en de vMix-pc's. De API stuurt die configuratie naar de bridge zodra hij verbindt en na elke wijziging; de bridge past hem direct toe.

De bridge bewaart de laatst ontvangen configuratie in `/data/venue-bridge.json` (rechten 600). Valt de verbinding met de API weg, of start de bridge opnieuw terwijl de API niet bereikbaar is, dan werkt hij door met die opgeslagen configuratie. Is het bestand beschadigd, dan gebruikt hij het niet en wacht hij op een nieuwe. **Zet daarom een volume op `/data`.** Configuratie wijzigen kan alleen als de bridge verbonden is.

## De pagina

`http://<bridge>:3340/` toont de status, voor iedereen op het netwerk van de zaal, zonder sleutel: verbinding met de API (en bij *Niet verbonden met de API* de laatste fout), wanneer de configuratie voor het laatst is ontvangen, per apparaat en vMix-pc de status en de leeftijd van de laatste meting, en de reserve-adressen met een kopieerknop. Ververst elke 2 seconden en werkt op een telefoon. De gegevens komen van `GET /bridge/status`. `GET /health` is voor de containercheck (`{ok, connected, devices}`, ook 200 als de API weg is).

## De reserve-API

Valt de verbinding met de API weg, dan blijven vMix en de Stream Deck in de zaal werken met de adressen van de bridge. Ze vragen **dezelfde API-sleutel** als de bridge zelf (`?key=<sleutel>` of de header `X-Api-Key`):

| Adres | Wat |
|---|---|
| `GET http://<bridge>:3340/api/scoreboard` | Het scorebord |
| `GET http://<bridge>:3340/api/scoreboard/clock` | De zaalklok |
| `GET http://<bridge>:3340/api/scoreboard/shotclock` | De schotklok, met kleur |
| `GET http://<bridge>:3340/api/stats/...` | De statistieken (dezelfde paden als in de API) |
| `POST http://<bridge>:3340/api/vmix/set-timer` | Countdown in vMix, met `{"seconds": 30}` |

Zonder of met een foute sleutel is het antwoord 401. Gebruik de sleutel alleen op het netwerk van de zaal.

## Installatie in de zaal

1. Maak in de Kit bij **Beheer, Organisatie-instellingen, API-sleutels** een sleutel, bijvoorbeeld *venue-bridge Zaal Fortuna*. Je ziet hem maar één keer.
2. Kies hoe de bridge bij de statistiek-pc komt (zie hieronder) en start hem met de compose-bestanden in `compose/`:

   ```bash
   API_URL=https://streamz.example.nl API_KEY=<sleutel> BRIDGE_NAME="Zaal Fortuna" \
   STREAMZ_BRIDGE_VERSION=2026.11.1 \
   docker compose -f apps/venue-bridge/compose/docker-compose.venue-bridge.prod.yml \
                  -f apps/venue-bridge/compose/variants/<variant>.yml up -d venue-bridge
   ```

   Of met `PROD=1 scripts/venue-bridge/start.sh <variant>` (Windows: `scripts\venue-bridge\start.ps1 <variant> -Prod`). De image is `mvanvendeloo/streamz-kit-venue-bridge`; poort 3340 staat open op het netwerk van de zaal, de container herstart vanzelf (`restart: unless-stopped`). Zet de map `./data/venue-bridge` op uid 1000 (`sudo chown -R 1000:1000 data/venue-bridge`; Docker Desktop doet dat zelf).
3. Controleer in de Kit bij **Instellingen, Venue** (*Verbonden*, configuratie *Toegepast*, apparaten *In orde*) en open `http://<bridge>:3340`.
4. Schrijf de reserve-adressen in het draaiboek van de zaal.

### Bij de statistiek-pc komen (varianten)

Alleen nodig voor de database; de statistiekenpagina kan ook op een http(s)-adres. Kies één variant uit `compose/variants/`:

- **mac.yml**: de share staat gemount op de Mac (`scripts/venue-bridge/mount-share-mac.sh`, `//GUEST@10.12.0.63/KL2627` op `/Volumes/KL2627`).
- **windows-robocopy.yml**: `scripts/venue-bridge/sync-stats.ps1` kopieert elke paar seconden de gewijzigde bestanden naar `C:\streamz\stats`; de bridge leest alleen die map. Met `-Install` start het script bij het inloggen.
- **cifs.yml**: Docker mount de share zelf. Staat de pc uit, dan start de bridge niet.
- **page-only.yml**: geen share, alleen een pagina op een http(s)-adres.

De variant mount de map als `STATS_DIR` (`/stats`). Het databasepad in de Kit is relatief aan die map, bijvoorbeeld `F{team}/WEDSTRIJDEN.mdb`.

## Ontwikkelen

`npm run bridge:dev` (leest de omgevingsvariabelen), tests `npm run bridge:test`, build `nx build @korfbal-stream-kit/venue-bridge` (bouwt eerst de pagina uit `apps/venue-bridge-ui` naar `dist/apps/venue-bridge/public`). De pagina draait ook los met `nx serve @korfbal-stream-kit/venue-bridge-ui` (stuurt `/bridge` door naar `localhost:3340`).

Naast de dev-omgeving: zet `API_KEY` (een sleutel van de organisatie) in een env-file en gebruik `docker-compose.venue-bridge.yml` (de bridge op `korfbal-network` tegen `http://korfbal-streamz-api:3333`):

```bash
VENUE_BRIDGE_ENV_FILE=./venue-bridge.env scripts/venue-bridge/start.sh
```

Standaard staat dan de opgeslagen pagina `compose/local-html/tweede-scherm.html` in `/stats`. Stel in de Kit bij Instellingen, Venue, Statistieken de pagina `tweede-scherm.html` in en zet *Database gebruiken* uit; dan werkt alles zonder statistiek-pc. Controleer met `curl http://localhost:3340/bridge/status`. In de Kit staat dan *Bron: live pagina (database uit)*.

## Migratie van de statistics-bridge

De oude `statistics-bridge` (image `mvanvendeloo/statistics-bridge`, poort 3340, door de API aangeroepen) is vervangen. Stop hem en start deze bridge. De instellingen die eerst omgevingsvariabelen van de oude bridge waren, staan nu in de Kit:

| Oud (omgevingsvariabele) | Nu |
|---|---|
| `PAGE_URL` | Instellingen, Venue, Statistieken: **Statistiekenpagina** |
| `MDB_PATH` | **Pad van de database** |
| `MDB_ENABLED` | **Database gebruiken** |
| `SHARE_HOST` | **Adres van de statistiek-pc** |
| `KEEP_COPY` | **Lokale kopie van de database bewaren** |
| `BRIDGE_TOKEN` en het **Statistics bridge URL** in de Kit | vervallen: de bridge verbindt zich zelf met een API-sleutel |
| `STATS_DIR`, `COPY_DIR`, `PORT`, `LOG_LEVEL` | blijven omgevingsvariabelen |

Nieuw zijn `API_URL`, `API_KEY` en `BRIDGE_NAME`. Het adres van het scorebord en de schotklok en de vMix-pc's stonden al in de Kit en worden nu door de bridge gebruikt. De map `data/statistics-bridge` mag je hernoemen naar `data/venue-bridge`. De oude bridgeadres- en tokeninstellingen blijven in de database staan (voor terugdraaien) maar worden genegeerd. Terugdraaien kan met de vorige API en de oude statistics-bridge-image.

## Problemen oplossen

| Symptoom | Oorzaak en oplossing |
|---|---|
| Bridge start niet, melding over `API_URL` of `API_KEY` | Zet beide in de omgeving |
| *Bridge offline* in de Kit, pagina zegt *Niet verbonden met de API* | Klopt `API_URL`, kan de zaal naar buiten, is de sleutel niet ingetrokken (401)? De laatste fout staat op de pagina |
| Verbonden, maar configuratie *Wacht op bevestiging* of *Geweigerd* | Bij *Geweigerd* staat de reden op de kaart in de Kit; verbeter de instelling en sla opnieuw op |
| Scorebord, zaalklok of schotklok *Niet bereikbaar* | Adres bij Instellingen, Venue klopt niet, of het apparaat staat uit of zit niet op het netwerk van de bridge |
| Apparaat *Niet ingesteld* | Vul het adres in bij Instellingen, Venue |
| Statistieken: database niet beschikbaar | Controleer `STATS_DIR` (volume), het databasepad en of *Database gebruiken* aan staat; zonder database gebruikt hij de pagina |
| vMix *Niet bereikbaar* | Adres of Web Controller van de vMix-pc; de pc moet voor de bridge bereikbaar zijn |
| Na herstart zonder verbinding werkt niets | Geen volume op `/data`: zonder opgeslagen configuratie wacht de bridge op de API |
| 401 op een reserve-adres | Sleutel ontbreekt of is niet die van de bridge |

## Beveiliging

- De bridge schrijft alleen naar `COPY_DIR` (kopie van de database) en `CONFIG_FILE` (rechten 600), nooit naar `STATS_DIR`.
- De sleutel staat nergens in de logs, op de pagina of in `/bridge/status`; de reserve-API vergelijkt hem tijdveilig.
- De pagina en `/bridge/status` hebben geen sleutel: zet de poort alleen open op het netwerk van de zaal.
- Paden binnen `STATS_DIR`: geen `..`, geen absolute paden, alleen `.mdb`/`.accdb` (database) en `.html`/`.htm` (pagina), groottelimiet; het teamnummer is alleen cijfers.
- Een share die hangt kan de bridge niet blokkeren: één bewerking tegelijk, een tijdslimiet op elke toegang en eerst een poortcontrole van de pc.
- De container draait als non-root (uid 1000), zonder shell.
