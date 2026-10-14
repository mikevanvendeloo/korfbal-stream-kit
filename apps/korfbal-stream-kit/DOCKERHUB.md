# Korfbal StreamKit – Kit

Webapp van **Korfbal StreamKit**, een systeem voor het produceren van livestreams van korfbalwedstrijden.

## Doel

De Kit is wat de crew tijdens en rond een uitzending op scherm heeft. Het zijn twee apps in één image:

- **LIVE** (`/`) – voor tijdens de uitzending: de actieve productie, het scorebord, de **callsheet** per positie, de **Show Caller** met klokken en het actieve item, en de vMix-bediening (countdown, callsheet naar vMix). Verder is alleen de interviewkeuze (speler/coach) hier aan te passen.
- **Beheer** (`/admin`) – voor de voorbereiding: producties (draaiboek, beschikbaarheid, bezetting), draaiboek-templates, stamgegevens (crew, competitie, sponsors, vMix), rapportages en instellingen.

Alle schermen blijven via Socket.io realtime gelijk met de API.

## Gebruik

De Kit is een nginx-image dat de webapp serveert en `/api`, `/uploads`, `/storage` en `/socket.io` doorstuurt naar de API. Die moet in hetzelfde Docker-netwerk draaien onder de naam **`korfbal-streamz-api`** op poort 3333 (zie [`korfbal-stream-api`](https://hub.docker.com/r/mvanvendeloo/korfbal-stream-api)).

```yaml
services:
  korfbal-streamz-kit:
    image: mvanvendeloo/korfbal-stream-kit:latest
    environment:
      TZ: Europe/Amsterdam
    ports:
      - "80:8080"
    depends_on:
      - korfbal-streamz-api
```

Open daarna `http://<host>/` voor LIVE en `http://<host>/admin` voor Beheer.

## Image

- Gebouwd op een **Docker Hardened Image** (nginx): geen shell; draait als non-root en luistert daarom op poort **8080**.
- Multi-arch: `linux/amd64` en `linux/arm64`.
- Health check: `GET /health`.
- Tags: releases van `main` krijgen `yyyy.mm.n` en `latest`; branch-builds krijgen `yyyy-mm-<branch>-nn` en nooit `latest`. De release notes staan bij de GitHub Release van de tag.

Bedoeld voor gebruik binnen het eigen productienetwerk: er is geen authenticatie.
