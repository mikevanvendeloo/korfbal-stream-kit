# Venue-bridge in de zaal

De **venue-bridge** is een kleine app die in de zaal draait, op een machine in het netwerk van het scorebord, de schotklok, de statistiek-pc en vMix. Streamz zelf draait ergens anders (bijvoorbeeld in de cloud) en kan die apparaten niet bereiken. De bridge doet dat voor Streamz.

```
scorebord, schotklok, statistiek-pc, vMix  <--  venue-bridge (zaal)  <-->  Streamz  <--  Beheer, LIVE en vMix-datasources
```

## Wat de bridge doet

- Hij leest elke seconde het **scorebord**, de **zaalklok** en de **schotklok** en geeft de waarden aan Streamz. Daar komen het scorebord in LIVE en de zaalklok in de callsheet vandaan.
- Hij leest de **statistiek-pc** (de statistiekenpagina en WEDSTRIJDEN.mdb op de gedeelde map) wanneer Streamz om statistieken vraagt.
- Hij stuurt de **opdrachten aan vMix** door: de countdown, de callsheet voor presentator en analist, en het ophalen van de inputs.

De bridge belt zelf naar Streamz, niet andersom. In de zaal hoeft dus geen poort naar buiten open te staan.

## Opstarten

De bridge draait in een eigen container (`streamz-kit-venue-bridge`). Je geeft hem alleen mee hoe hij Streamz bereikt; alle andere instellingen (adressen van scorebord, schotklok en vMix, de statistiekeninstellingen) staan in Streamz zelf, bij **Instellingen → Venue**.

| Instelling | Betekenis |
|---|---|
| `API_URL` | Het adres van Streamz, bijvoorbeeld `https://streamz.example.nl`. Verplicht |
| `API_KEY` | De API-sleutel van de organisatie voor deze bridge. Verplicht |
| `BRIDGE_NAME` | Hoe de bridge heet in Streamz, bijvoorbeeld *Zaal Fortuna*. Standaard `venue-bridge` |
| `STATS_DIR` | De map met de bestanden van de statistiek-pc (de gemounte share). Leeg: geen share |

Zonder `API_URL` of `API_KEY` start de bridge niet. Maak de sleutel bij **Organisatie-instellingen → API-sleutels** ([Organisaties](/admin/handleiding/organisaties)); geef de bridge een eigen sleutel, bijvoorbeeld *venue-bridge Zaal Fortuna*, zodat je hem kunt intrekken zonder iets anders te raken. Per organisatie is er één bridge tegelijk: start je een tweede met dezelfde sleutel, dan vervangt die de eerste.

Daarna zie je bij **Instellingen → Venue** en in de balk bovenaan **Bridge verbonden**.

## De pagina van de bridge

De bridge heeft een statuspagina op `http://<bridge>:3340/`, voor iedereen op het netwerk van de zaal. Er staat geen sleutel op. Je ziet:

- of de bridge **verbonden is met de API**, en sinds wanneer; zo niet, dan staat er *Niet verbonden met de API*;
- wanneer de **configuratie** voor het laatst is ontvangen en welke versie;
- per apparaat (scorebord, zaalklok, schotklok) en per vMix-pc de **status** en hoe lang geleden de laatste meting was;
- de **reserve-adressen** (zie hieronder), met een knop om ze te kopiëren.

De pagina werkt zichzelf elke 2 seconden bij en is ook op een telefoon te lezen. Dezelfde link staat op de kaart Venue-bridge in Beheer; die werkt alleen op het netwerk van de zaal.

## De opgeslagen configuratie

Streamz stuurt de bridge zijn configuratie (de adressen en de statistiekeninstellingen) zodra hij verbindt en na elke wijziging bij **Instellingen → Venue**. De bridge bewaart die configuratie op zijn eigen schijf (de map `/data`; zet daar een volume op). Valt de verbinding met Streamz weg, of herstart de bridge terwijl Streamz niet bereikbaar is, dan werkt hij gewoon door met de laatst ontvangen configuratie. Instellingen wijzigen kan alleen als de bridge verbonden is.

Is de opgeslagen configuratie beschadigd, dan gebruikt de bridge hem niet en wacht hij op een nieuwe van Streamz. Op de kaart in Beheer zie je *Geweigerd* met de reden als de bridge een configuratie niet kan gebruiken.

## Als Streamz niet bereikbaar is: de reserve-adressen

De bridge heeft zelf een kleine API, met dezelfde sleutel als de bridge (`?key=...` of de header `X-Api-Key`):

| Adres | Wat |
|---|---|
| `http://<bridge>:3340/api/scoreboard` | Het scorebord |
| `http://<bridge>:3340/api/scoreboard/clock` | De zaalklok |
| `http://<bridge>:3340/api/scoreboard/shotclock` | De schotklok, met kleur |
| `http://<bridge>:3340/api/stats/...` | De statistieken |
| `POST http://<bridge>:3340/api/vmix/set-timer` | De countdown in vMix, met `{"seconds": 30}` |

Hiermee blijven vMix en de Stream Deck in de zaal werken, ook als de verbinding met Streamz uitvalt. Zie ook [Stream Deck](/admin/handleiding/organisaties#stream-deck). De knoppen die de show bedienen werken niet zonder Streamz.

## Als het niet werkt

- **Bridge offline** in de balk: draait de container in de zaal, staat `API_URL` goed en is de sleutel niet ingetrokken? De pagina van de bridge zegt wat hij ziet.
- **Een apparaat is *Niet bereikbaar***: klopt het adres bij **Instellingen → Venue** en staat het apparaat aan, op het netwerk van de zaal?
- **Een apparaat is *Niet ingesteld***: vul het adres in bij **Instellingen → Venue**.
- **De configuratie is *Geweigerd***: de reden staat op de kaart. Verbeter de instelling en sla opnieuw op.
