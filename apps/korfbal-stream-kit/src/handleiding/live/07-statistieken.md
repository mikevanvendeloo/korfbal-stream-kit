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

## Seizoen

Op het tabblad **Seizoen** staan de cijfers van het eigen team over het hele seizoen: vanaf de start van de zaalcompetitie van het actieve seizoen (Beheer, Instellingen), voor het team van de actieve productie.

- **Topscorers eigen club**: per speler de doelpunten, de pogingen met het percentage en in hoeveel wedstrijden ze schoten. Een speler telt als één speler zolang de naam in de statistieken precies hetzelfde gespeld is.
- **Teamcijfers**: voor het eigen team en de tegenstanders samen: doelpunten en pogingen, aanvallen, aanvallen met doelpunt, **aanvallen zonder schot**, **schoten per aanval**, hoeveel aanvallen 0, 1, 2, 3, 4 of 5+ schoten hadden, en het balverlies per soort.
- **Gebaseerd op … wedstrijden**: de wedstrijden waar de cijfers uit komen, nieuwste eerst, met uitslag en per wedstrijd de aanvallen, zonder schot, schoten per aanval, het percentage met doelpunt, het balverlies en per vak de aanvallen / zonder doelpunt / zonder schot.

Streamz bewaart elke wedstrijd van het eigen team uit het Access-bestand van de statistiek-pc zodra de venue-bridge het bestand kan lezen (via de share, robocopy of zijn lokale kopie), en werkt de lopende wedstrijd elke minuut bij. Zo blijven de cijfers er ook na de wedstrijd en als de statistiek-pc of de bridge er niet meer is: dit tabblad werkt ook als de bridge offline is. Wedstrijden van een ander team van de club (bijvoorbeeld *Fortuna2* in het bestand van het eerste) en van andere clubs telt Streamz niet mee. Een wedstrijd die niet op de statistiek-pc is bijgehouden, ontbreekt.

Staat er *Wedstrijden worden niet bijgewerkt*, dan kan de bridge het bestand niet lezen (alleen de live pagina, *Database gebruiken* uit, of de share niet bereikbaar) of is hij offline. De bewaarde wedstrijden blijven dan gewoon zichtbaar.

## Verbinding met de statistiek-pc

Bovenaan staat of de venue-bridge en de statistiek-pc bereikbaar zijn; dat wordt elke 15 seconden opnieuw getest, en met **Verbinding testen** meteen:

- **Venue-bridge**: *online* of *offline*. Is de bridge offline, dan zie je *De venue-bridge is offline* in plaats van de tabellen (het tabblad **Seizoen** werkt wel); de rest van Streamz werkt gewoon door. Controleer dan of de bridge in de zaal draait (zie Beheer, Instellingen, Venue, en het hoofdstuk *Venue-bridge in de zaal*).
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
