# Streamz installeren en starten

Deze map bevat alles om Streamz en de venue-bridge te draaien: de compose-bestanden, de start- en upgradescripts en
voorbeelden van de instellingen. Kopieer de inhoud naar een eigen map op een machine met Docker, bijvoorbeeld `C:\streamz`; de broncode is niet
nodig. De naam van die map maakt niet uit: de projectnamen (`streamz`, `venue-bridge`) staan vast in de compose-bestanden.

## Wat er in staat

| Bestand | Waarvoor |
|---|---|
| `docker-compose.yml` | **Productie**: database, API en Kit, images van Docker Hub (project `streamz`) |
| `docker-compose.venue-bridge.yml` + `variants/` | **De venue-bridge** in de zaal, image van Docker Hub (project `venue-bridge`); de variant bepaalt waar de statistieken vandaan komen |
| `start.cmd`, `upgrade.cmd` | Windows: starten en upgraden (dubbelklikken). De PowerShell staat in `scripts/` |
| `streamz.local.env.example` | Instellingen voor `start.cmd`/`upgrade.cmd`: wat er draait, versies, de bridge |
| `secrets.prod.env.example` | Geheimen van de database en de API |
| `scripts/sync-stats.ps1` | Windows: kopieert de share van de statistiek-pc naar een lokale map (variant `windows-robocopy`) |
| `scripts/mount-share-mac.sh`, `scripts/venue-bridge-start.sh` | Mac/Linux: share mounten, bridge starten |
| `docker-compose-dev.yml`, `-db.yml`, `-localtest.yml`, `-monitoring.yml`, `docker-compose.venue-bridge-dev.yml`, `start-localtest.*`, `local-html/`, `monitoring/`, `servers*.json` | **Alleen voor ontwikkelen**, in een checkout van de repo: ze bouwen uit de broncode erboven |

De data van productie komt naast `docker-compose.yml`: `dbdata/` (database), `storage/` en `uploads/` (afbeeldingen),
`backups/` (backups van `upgrade.cmd`) en `data/venue-bridge/` (configuratie en kopie van de statistieken). Neem die
mappen mee als je naar een andere machine verhuist.

## Nieuwe machine (Windows)

1. Installeer Docker Desktop en kopieer de inhoud van deze map naar bijvoorbeeld `C:\streamz`.
2. Kopieer `secrets.prod.env.example` naar `secrets.prod.env` en vul hem in (alleen als Streamz hier draait).
3. Kopieer `streamz.local.env.example` naar `streamz.local.env` en vul hem in:
   - `RUN_STREAMZ` / `RUN_BRIDGE`: wat er op deze pc draait.
   - Voor de bridge (de container leest deze waarden rechtstreeks uit dit bestand): `API_URL` (het adres van Streamz zonder `/api`; op dezelfde pc `http://host.docker.internal:3333`),
     `API_KEY` (Beheer > Organisatie-instellingen > API-sleutels), `BRIDGE_NAME`, `BRIDGE_PAGE_URL`
     (`http://<ip van deze pc>:3340`, niet `localhost`), `LOG_LEVEL` en `BRIDGE_VARIANT`.
4. Bij `BRIDGE_VARIANT=windows-robocopy` eenmalig de kopieertaak, met het UNC-pad van de share (geen schijfletter):
   `scripts\sync-stats.ps1 -Install -Source '\\192.168.1.20\KL2627'`. Vraagt de share om een wachtwoord:
   eerst `cmdkey /add:192.168.1.20 /user:<naam> /pass:<wachtwoord>`.
5. `upgrade.cmd` haalt de laatste versies op en start alles; daarna start `start.cmd` dezelfde versies.

`upgrade.cmd -Version 2026.11.6` of `-Api ... -Kit ... -Bridge ...` kiest een versie, `-Only streamz|bridge` één deel.
Voor een upgrade van de API maakt het script eerst een backup in `backups\`.

Start Streamz altijd via `start.cmd` (of `docker compose --env-file streamz.local.env up -d`): een kale
`docker compose up -d` neemt de standaardversies uit `docker-compose.yml`.

## Overstappen van de oude indeling

Tot deze map stonden de compose-bestanden en de data in de root van de repo (`docker-compose-prod.yml`, `dbdata/`,
`storage/`, `uploads/`, `backups/`, `secrets.prod.env`), met een projectnaam naar die map. `start.cmd` en
`upgrade.cmd` beschermen je daarbij: ze weigeren te starten zolang de oude containers draaien (de poorten botsen), en
staat er nog geen `dbdata` in de nieuwe map, dan vragen ze eerst of je echt met een lege database wilt beginnen.
Antwoord dan "n" als je nog moet verhuizen. Eenmalig:

1. Kijk hoe het oude project heet en stop het (de data blijft staan):
   `docker ps --format "{{.Names}}  {{.Label \"com.docker.compose.project\"}}"`, dan `docker compose -p <naam> down`.
   Draait er een bridge in het project `compose`: `docker compose -p compose down`.
2. Verplaats uit de root van de oude installatie naar de nieuwe map (bijv. `C:\streamz`): `dbdata`, `storage`, `uploads`, `backups`,
   `secrets.prod.env` en, als hij er is, `streamz.local.env`. Een bridge-kopie stond in
   `apps\venue-bridge\compose\data\venue-bridge` of `data\venue-bridge`: verplaats die naar `data\venue-bridge` in de nieuwe map.
3. Start met `start.cmd`.

## Ontwikkelen

Vanuit de root van de repo: `npm run db:up` (de database voor `npm run dev`), de hele app in Docker met
`docker compose -f distribution/docker-compose-dev.yml up -d --build`, en localtest met de bridge met
`distribution/start-localtest.sh` (instellingen in `localtest.local.env`, voorbeeld ernaast). Zie
`docs/claude/docker.md`.
