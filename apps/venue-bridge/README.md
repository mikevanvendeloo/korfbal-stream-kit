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

`http://<bridge>:3340/` toont de status, voor iedereen op het netwerk van de zaal, zonder sleutel: verbinding met de API (en bij *Niet verbonden met de API* de laatste fout), wanneer de configuratie voor het laatst is ontvangen, per apparaat en vMix-pc de status en de leeftijd van de laatste meting, de statistieken en de reserve-adressen met een kopieerknop.

De kaart **Statistieken** toont of de pagina en de database aan staan, of `/stats` gekoppeld is en het adres van de statistiek-pc. Met de database aan zie je ook:

| Regel | Betekenis |
|---|---|
| Laatste antwoord | *Van de share* of *Van de lokale kopie*, met de tijd van de cijfers en het team |
| Share | *Bereikbaar*, *Mislukt* of *Overgeslagen tot* (met het aantal fouten na elkaar) |
| Statistiek-pc op het netwerk | Antwoordde de pc op poort 445 bij de laatste controle |
| Laatst gekeken / Laatst gelezen | Laatste controle van de wijzigingstijd, laatste echte lezing (met de duur van het inlezen) |
| Bestand gewijzigd | Wijzigingstijd en grootte van WEDSTRIJDEN.mdb in `/stats` |
| Lokale kopie | Wanneer de kopie in `/data` is geschreven, of de foutcode (`EACCES`, `ENOSPC`) |
| Laatste fout | De laatste fout bij de share, met hoe lang geleden |

Paden op de share of in `/data` staan er niet op, alleen de meldingen van de bridge zelf. Ververst elke 2 seconden en werkt op een telefoon. De gegevens komen van `GET /bridge/status`. `GET /health` is voor de containercheck (`{ok, connected, devices}`, ook 200 als de API weg is).

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

## Configureren, stap voor stap

De bridge configureer je op twee plekken:

- **Op de machine in de zaal**: hoe de bridge de API bereikt (`API_URL`, `API_KEY`, `BRIDGE_NAME`) en welke map van de statistiek-pc hij ziet (de variant). Dat zijn omgevingsvariabelen en compose-bestanden.
- **In de Kit**, bij **Beheer, Instellingen, Venue**: al het andere (scorebord, schotklok, statistieken, vMix). De API stuurt dat naar de bridge.

### 1. Maak een API-sleutel

In de Kit bij **Beheer, Organisatie-instellingen, API-sleutels**, bijvoorbeeld *venue-bridge Zaal Fortuna*. Je ziet hem maar één keer: zet hem meteen in de env-file van stap 3.

### 2. Kies hoe de bridge bij de statistiek-pc komt (de variant)

De bridge leest de statistieken in de container altijd uit de map **`/stats`** (`STATS_DIR`), en alleen-lezen. Welke map van de host of van het netwerk daar komt, bepaalt de variant in `compose/variants/`:

| Variant | Wat er op `/stats` komt | Wanneer |
|---|---|---|
| `mac.yml` | De op de Mac gemounte share: `${STATS_SOURCE_DIR:-/Volumes/KL2627}`. Mount hem eerst met `scripts/venue-bridge/mount-share-mac.sh` (`//GUEST@10.12.0.63/KL2627`) | Bridge op een Mac |
| `windows-robocopy.yml` | Een lokale map: `${STATS_SOURCE_DIR:-C:/streamz/stats}`. `scripts/venue-bridge/sync-stats.ps1` kopieert daar elke 5 seconden de gewijzigde bestanden van `\\10.12.0.63\KL2627` naartoe (`-Install`: start bij het inloggen) | Bridge op Windows: een share die hangt, hangt dan alleen robocopy |
| `cifs.yml` | Het Docker-volume `stats-share`: Docker mount zelf de share `${STATS_CIFS_DEVICE:-//10.12.0.63/KL2627}` als gast. Staat de pc uit, dan start de bridge niet | Bridge op Linux |
| `page-only.yml` | Niets (`STATS_DIR` leeg) | Alleen de statistiekenpagina op een http(s)-adres, geen database |
| geen variant (alleen bij ontwikkelen) | `compose/local-html`, met een opgeslagen pagina | Testen zonder statistiek-pc |

In de prod-compose zonder variant is `/stats` leeg: dan werkt alleen een statistiekenpagina op een http(s)-adres. Een andere map geef je mee met `STATS_SOURCE_DIR` (mac, robocopy) of `STATS_CIFS_DEVICE` (cifs).

Daarnaast komt `./data/venue-bridge` van de host op **`/data`**: daar bewaart de bridge de ontvangen configuratie en de lokale kopie van de database (`COPY_DIR`). Die map moet van uid 1000 zijn (`sudo chown -R 1000:1000 data/venue-bridge`; Docker Desktop regelt dat zelf).

### 3. Start de bridge

Zet de startinstellingen in een env-file die je niet incheckt, bijvoorbeeld `venue-bridge.env`:

```bash
API_URL=https://streamz.example.nl
API_KEY=<sleutel uit stap 1>
BRIDGE_NAME=Zaal Fortuna
BRIDGE_PAGE_URL=http://<ip van de bridge>:3340
STREAMZ_BRIDGE_VERSION=2026.11.1
# LOG_LEVEL=debug   # tijdelijk, voor meer detail in docker logs (zie Problemen oplossen)
```

Start hem met de variant uit stap 2:

```bash
PROD=1 VENUE_BRIDGE_ENV_FILE=./venue-bridge.env scripts/venue-bridge/start.sh <variant>
# Windows: scripts\venue-bridge\start.ps1 <variant> -Prod
```

Dat is hetzelfde als:

```bash
docker compose --env-file ./venue-bridge.env \
  -f apps/venue-bridge/compose/docker-compose.venue-bridge.prod.yml \
  -f apps/venue-bridge/compose/variants/<variant>.yml up -d venue-bridge
```

De image is `mvanvendeloo/streamz-kit-venue-bridge`. Poort 3340 staat open op het netwerk van de zaal en de container herstart vanzelf (`restart: unless-stopped`). Zie [Startinstellingen](#startinstellingen) voor alle variabelen.

### 4. Stel de zaal in de Kit in

Bij **Beheer, Instellingen, Venue**. De bridge krijgt elke wijziging meteen.

- **Scorebord & Shotclock**: de adressen in het netwerk van de zaal, bijvoorbeeld `http://192.168.1.20:8080`.
- **Statistieken**:

  | Veld | Wat je invult |
  |---|---|
  | **Statistiekenpagina** | Het http(s)-adres van het tweede scherm op de statistiek-pc (`http://10.12.0.63/TweedeScherm/klassiek.html`), of een `.html`-pad binnen `/stats` |
  | **Pad van de database** | Het pad van `WEDSTRIJDEN.mdb` **relatief aan `/stats`**, dus aan de root van de share: bijvoorbeeld `F{team}/WEDSTRIJDEN.mdb`. `{team}` wordt het teamnummer van de actieve productie. Geen `..` of absoluut pad |
  | **Adres van de statistiek-pc** | Het IP-adres van de pc (`10.12.0.63`). Vóór elke toegang tot de map kijkt de bridge of die pc op poort 445 (SMB) antwoordt; zo niet, dan raakt hij de map niet aan en antwoordt hij uit de lokale kopie. Leeg: de host van de statistiekenpagina als die een http(s)-adres is |
  | **Database gebruiken** | Aan: de bridge leest WEDSTRIJDEN.mdb. Uit: alleen de statistiekenpagina |
  | **Lokale kopie van de database bewaren** | Aan (aanbevolen): de bridge bewaart een kopie in `/data` en gebruikt die als de share wegvalt |

  Met **Verbinding testen** zie je wat de bridge van de pc bereikt.

  Let op bij **windows-robocopy**: de bridge leest dan een lokale map, maar controleert nog wel het adres van de statistiek-pc. Kan de container die pc niet bereiken, dan blijft hij de kopie gebruiken.
- **vMix-pc's**: de adressen van de Web Controller van elke vMix-pc.

### 5. Controleer

- In de Kit bij **Instellingen, Venue**: *Verbonden*, configuratie *Toegepast*, apparaten *In orde*.
- Op `http://<bridge>:3340`: de kaart **Statistieken** zegt *Van de share* en het bestand heeft een recente wijzigingstijd.
- Schrijf de reserve-adressen in het draaiboek van de zaal.

### Hoe de bridge WEDSTRIJDEN.mdb leest

Bij elke vraag om statistieken:

1. Is het laatste antwoord minder dan 3 seconden oud, dan gebruikt de bridge dat.
2. Hij kijkt of de statistiek-pc op poort 445 antwoordt (dat resultaat geldt 5 seconden). Daarna leest hij alleen de wijzigingstijd en de grootte van het bestand. Is het niet veranderd, dan gebruikt hij de vorige lezing. Een veranderd bestand leest hij hooguit eens per 10 seconden opnieuw.
3. Elke toegang tot de share heeft een tijdslimiet van 3 seconden en er loopt er één tegelijk. Na een fout slaat hij de share over: 5 seconden, bij elke volgende fout twee keer zo lang, tot een minuut.
4. Na een gelukte lezing schrijft hij de kopie in `/data` (`<hash>-WEDSTRIJDEN.mdb`). Dat gebeurt meteen als er nog geen kopie is en daarna hooguit eens per 5 minuten.
5. Lukt de share niet, dan antwoordt hij uit de kopie, met de tijd waarop die is geschreven. De Kit toont dan *Bron: lokale kopie van HH:MM*.
6. Het bestand wordt ingelezen in een aparte thread, met een limiet van 10 seconden.

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
| Kit toont *Bron: lokale kopie van HH:MM* | Open de kaart **Statistieken** op de pagina van de bridge. *Statistiek-pc op het netwerk: Nee*: de pc staat uit, zit op een ander netwerk, of poort 445 is dicht (firewall). *Overgeslagen tot*: de share faalde net; de bridge probeert het vanzelf weer |
| *Statistiekenmap: Niet gekoppeld* | De container is zonder variant gestart: start opnieuw met `mac`, `windows-robocopy` of `cifs` |
| *Laatste fout: Het statistiekenbestand is niet gevonden* | Het **Pad van de database** klopt niet met de map op `/stats` (let op `{team}` en hoofdletters), of robocopy heeft het bestand nog niet gekopieerd |
| *Bestand gewijzigd* loopt niet mee tijdens de wedstrijd | De statistiek-pc slaat niet op, of de kopie loopt niet: bij windows-robocopy draait `sync-stats.ps1` niet (Taakplanner, taak *Streamz statistics sync*) |
| *Lokale kopie: Kopie niet geschreven (EACCES)* | `./data/venue-bridge` is niet van uid 1000 |

### Meer detail in de logs

Zet tijdelijk `LOG_LEVEL=debug` in de env-file en herstart de bridge (`start.sh` opnieuw). Volg de logs met `docker logs -f --since 5m <container>` (de naam staat in `docker ps`). Per vraag om statistieken zie je dan regels als:

| Logregel | Betekenis |
|---|---|
| `Statistics PC probed` | Controle van poort 445, met `ok` en de tijd in ms |
| `Statistics file unchanged, reusing the last read` | Bestand niet veranderd: geen nieuwe lezing |
| `Statistics file changed, read again shortly` | Veranderd, maar minder dan 10 s na de vorige lezing |
| `Statistics file read from the share` | Gelezen, met de grootte en de duur |
| `Statistics file parsed` | Ingelezen, met de bron (`share` of `copy`) en de duur |
| `Statistics copy written` / `Statistics copy is recent, not written` | De kopie in `/data` |
| `Statistics share failed, skipping it for a while` | Fout, met het aantal fouten na elkaar en hoe lang de share wordt overgeslagen |
| `Statistics share skipped after a failure` | Vraag binnen die periode: de share wordt niet aangeraakt |
| `Statistics answered from the local copy` | Antwoord uit de kopie, met de tijd van de kopie |

Ook zonder debug staan `Statistics share not readable, trying the local copy` en `Statistics copy not written` (warn) in de logs. Zet het daarna terug op `info`: debug schrijft bij elke vraag een paar regels.
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
