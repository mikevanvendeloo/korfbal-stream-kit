# Statistieken

**Statistieken** toont de wedstrijdstatistieken van de statistiek-pc in de zaal, zoals het Tweede Scherm ze laat zien. De cijfers komen via de *venue-bridge*, de app in de zaal die de pc uitleest.

## Live

Op het tabblad **Live** zie je de **Stand**, de **Tijd** en per ploeg (thuis geel, uit rood) de aantal **Wissels**. Daaronder staat per vak een tabel met per speler:

- **Afstand**, **Door** (doorloop), **Kort** (korte schot), **Vrije bal** en **Straf**: gescoord/pogingen.
- **Totaal**: alle schoten samen.
- **Rebound**: gewonnen/totaal.
- **Aangeef**: het aantal aangeefballen.

Onder de spelers staan **Vaktotaal** en **Vakpercentage**, en onderaan de ploeg **Teamtotaal** en **Teampercentage**. Boven elk vak staat het aantal **Ballen** en de **Tijd** van balbezit. De pagina ververst zichzelf elke 5 seconden. Lukt verversen even niet, dan blijft de laatste stand staan met een oranje melding.

Op een telefoon scroll je de tabel zijwaarts; de rest van de pagina blijft op het scherm.

## Teamstatistieken

Op het tabblad **Teamstatistieken** staan de twee ploegen naast elkaar, voor de wedstrijd waar nu het laatst in is geturfd. Bij elk onderdeel zie je gescoord/pogingen met het percentage:

- **Doelpunten / pogingen**: het doelpuntenpercentage over alle schoten.
- **Rebounds**: gewonnen rebounds van alle rebounds.
- **Strafworpen**, **Vrije ballen**, **Afstandsschoten**, **Korte schoten** en **Doorloopballen**: hoeveel er raak waren.
- **Doelpunten dames : heren**: het aantal doelpunten van dames en heren, met het percentage dames. Dit komt uit de spelerslijst van de database; zonder database staat er een streepje.
- **Aanvallen**: de balbezittingen die eindigden in een doelpunt of in balverlies, met hoeveel er **met doelpunt** eindigden.
- **Balverlies zonder doelpunt**: de aanvallen die in balverlies eindigden, en **Balverlies zonder schot**: daarvan de aanvallen zonder één schot.
- **Gemiddeld aantal schoten per aanval**.

De aanvalscijfers komen van de statistiekenpagina (de verdeling van pogingen per balbezit); is die niet bereikbaar, dan staat er een streepje. Een streepje bij een percentage betekent dat er in dat onderdeel nog niet op is gericht.

## Topscorers

Op het tabblad **Topscorers** staan de ploegen naast elkaar, met per ploeg de spelers die gescoord hebben, de meeste doelpunten eerst. Bij gelijk aantal staat de speler met het beste percentage bovenaan. Je ziet het rangnummer, de naam, het aantal doelpunten en gescoord/pogingen met het percentage. Op een telefoon staan de ploegen onder elkaar.

## Wedstrijd uit database

Op het tabblad **Wedstrijd uit database** kies je bij **Wedstrijd** een wedstrijd uit het Access-bestand van de statistiek-pc (nieuwste eerst). Je ziet per ploeg de totalen per speler over de hele wedstrijd, met het **%** van het totaal.

## Verbinding met de statistiek-pc

Bovenaan staat of de venue-bridge en de statistiek-pc bereikbaar zijn; dat wordt elke 15 seconden opnieuw getest, en met **Verbinding testen** meteen:

- **Venue-bridge**: *online* of *offline*. Is de bridge offline, dan zie je *De venue-bridge is offline* in plaats van de tabellen; de rest van Streamz werkt gewoon door. Controleer dan of de bridge in de zaal draait (zie Beheer, Instellingen, Venue, en het hoofdstuk *Venue-bridge in de zaal*).
- **Netwerk**: de pc staat aan en zit op het netwerk (de bridge kan de gedeelde map van de pc bereiken).
- **Database op de share**: het bestand WEDSTRIJDEN.mdb is te lezen. Staat de database uit op de bridge, dan staat er *Database: uitgeschakeld (alleen de statistiekenpagina)*.
- **Statistiekenpagina**: de pagina van de pc antwoordt.

Een groen bolletje is bereikbaar, een rood niet. Is **Netwerk** rood, dan staat de pc uit of zit hij niet op het netwerk; de database wordt dan niet geprobeerd.

## Bron van de gegevens

Boven de gegevens staat de **Bron**. Bij **Live** is dat de *live pagina*. Bij **Wedstrijd uit database** is het de *share* (het bestand op de statistiek-pc is net gelezen) of een *lokale kopie van* een tijdstip. De app leest het bestand alleen opnieuw als het veranderd is (hooguit eens per 10 seconden) en werkt de kopie hooguit eens per 5 minuten bij; de cijfers in de kopie kunnen dus tot 5 minuten oud zijn. Is de share niet bereikbaar, antwoordt hij niet, staat de statistiekenmap niet op de server of ontbreekt het bestand, dan gebruikt de app die kopie en zie je de tijd waarop ze is gemaakt. Staat er een oude tijd, dan zijn de cijfers niet actueel.

Bij **Teamstatistieken** en **Topscorers** staat dezelfde bron onder de tabel. Is de database uitgeschakeld op de bridge of niet te lezen, dan staat er één wedstrijd, *live*, en zie je **Bron: live pagina (database uit)** of **Bron: live pagina (database niet bereikbaar)**. De spelerscijfers komen dan van de statistiekenpagina; ze tellen de vakken op tot de hele wedstrijd.

## Als er niets verschijnt

- *De venue-bridge is offline*: de bridge in de zaal draait niet of heeft geen verbinding met Streamz. Kijk bij Beheer, Instellingen, Venue, en start de bridge.
- *De statistiekenpagina is niet bereikbaar*: de statistiek-pc staat uit of het adres klopt niet (bij Beheer, Instellingen, Venue, Statistieken). Die pc kan ook even traag zijn; probeer het na een paar seconden opnieuw.
- *Geen statistieken beschikbaar*: de share is niet bereikbaar en er is nog geen lokale kopie. Controleer de verbinding met de statistiek-pc.
- *Database niet beschikbaar*: de database staat uit of is niet te lezen; alleen de spelers van de pagina zijn er dan.
