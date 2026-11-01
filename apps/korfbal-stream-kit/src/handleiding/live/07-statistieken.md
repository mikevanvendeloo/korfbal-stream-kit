# Statistieken

**Statistieken** toont de wedstrijdstatistieken van de statistiek-pc in de zaal, zoals het Tweede Scherm ze laat zien. De cijfers komen via de *statistics bridge*, een aparte app die de pc uitleest.

## Live

Op het tabblad **Live** zie je de **Stand**, de **Tijd** en per ploeg (thuis geel, uit rood) de aantal **Wissels**. Daaronder staat per vak een tabel met per speler:

- **Afstand**, **Door** (doorloop), **Kort** (korte schot), **Vrije bal** en **Straf**: gescoord/pogingen.
- **Totaal**: alle schoten samen.
- **Rebound**: gewonnen/totaal.
- **Aangeef**: het aantal aangeefballen.

Onder de spelers staan **Vaktotaal** en **Vakpercentage**, en onderaan de ploeg **Teamtotaal** en **Teampercentage**. Boven elk vak staat het aantal **Ballen** en de **Tijd** van balbezit. De pagina ververst zichzelf elke 5 seconden. Lukt verversen even niet, dan blijft de laatste stand staan met een oranje melding.

Op een telefoon scroll je de tabel zijwaarts; de rest van de pagina blijft op het scherm.

## Wedstrijd uit database

Op het tabblad **Wedstrijd uit database** kies je bij **Wedstrijd** een wedstrijd uit het Access-bestand van de statistiek-pc (nieuwste eerst). Je ziet per ploeg de totalen per speler over de hele wedstrijd, met het **%** van het totaal.

## Verbinding met de statistiek-pc

Bovenaan staat of de statistics bridge en de statistiek-pc bereikbaar zijn; dat wordt elke 15 seconden opnieuw getest, en met **Verbinding testen** meteen:

- **Statistics bridge**: *online* of *offline*. Is de bridge offline, dan zie je *De statistics bridge is offline* in plaats van de tabellen; de rest van Streamz werkt gewoon door. Controleer dan of de bridge draait (zie Beheer, Instellingen, *De statistics bridge draaien*).
- **Netwerk**: de pc staat aan en zit op het netwerk (de bridge kan de gedeelde map van de pc bereiken).
- **Database op de share**: het bestand WEDSTRIJDEN.mdb is te lezen. Staat de database uit op de bridge, dan staat er *Database: uitgeschakeld op de bridge (alleen de statistiekenpagina)*.
- **Statistiekenpagina**: de pagina van de pc antwoordt.

Een groen bolletje is bereikbaar, een rood niet. Is **Netwerk** rood, dan staat de pc uit of zit hij niet op het netwerk; de database wordt dan niet geprobeerd.

## Bron van de gegevens

Boven de gegevens staat de **Bron**. Bij **Live** is dat de *live pagina*. Bij **Wedstrijd uit database** is het de *share* (het bestand op de statistiek-pc is net gelezen) of een *lokale kopie van* een tijdstip. De app leest het bestand alleen opnieuw als het veranderd is (hooguit eens per 10 seconden) en werkt de kopie hooguit eens per 5 minuten bij; de cijfers in de kopie kunnen dus tot 5 minuten oud zijn. Is de share niet bereikbaar, antwoordt hij niet, staat de statistiekenmap niet op de server of ontbreekt het bestand, dan gebruikt de app die kopie en zie je de tijd waarop ze is gemaakt. Staat er een oude tijd, dan zijn de cijfers niet actueel.

Is de database uitgeschakeld op de bridge of niet te lezen, dan staat er één wedstrijd, *live*, en zie je **Bron: live pagina (database uit)** of **Bron: live pagina (database niet bereikbaar)**. De spelerscijfers komen dan van de statistiekenpagina; ze tellen de vakken op tot de hele wedstrijd.

## Als er niets verschijnt

- *De statistics bridge is offline*: de bridge draait niet of het adres klopt niet. Controleer het **Statistics bridge URL** bij Beheer, Instellingen, Statistieken en start de bridge.
- *De statistics bridge is niet ingesteld*: vul in Beheer bij Instellingen het **Statistics bridge URL** in.
- *De statistiekenpagina is niet bereikbaar*: de statistiek-pc staat uit of het adres klopt niet (op de bridge). Die pc kan ook even traag zijn; probeer het na een paar seconden opnieuw.
- *Geen statistieken beschikbaar*: de share is niet bereikbaar en er is nog geen lokale kopie. Controleer de verbinding met de statistiek-pc.
- *Database niet beschikbaar*: de database staat uit of is niet te lezen op de bridge; alleen de spelers van de pagina zijn er dan.
