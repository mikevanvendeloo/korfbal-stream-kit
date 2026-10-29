# Het draaiboek van een productie

Op het tabblad **Draaiboek** van een productie richt je het verloop van de uitzending in: het draaiboek met zijn hoofdstukken en items, en de tijden.

## Livestream start

Vul bij **Livestream start** de tijd in waarop de livestream begint, in 24-uursnotatie. Je mag ook kort typen: `1925`, `19.25` of `19:25`. De tijd wordt bewaard als je het veld verlaat of op Enter drukt; met Escape zet je de oude waarde terug.

Het **einde van de livestream** in de rapporten is het einde van het laatste item van het draaiboek. De livestream-start is het ijkpunt voor items met het anker *Livestream start*.

### Verzamelen en opbouw

Naast **Livestream start** staan **Verzamelen** en, bij de eerste stream van de dag, **Opbouw**. Laat je ze leeg, dan geldt de standaard: die staat grijs in het veld (verzamelen 30 minuten voor live, opbouw 2,5 uur voor de eerste stream; aan te passen bij [Instellingen → Club & Teams](/admin/handleiding/instellingen#club-teams)). Vul een tijd in om af te wijken; maak het veld leeg om terug te gaan naar de standaard. Verandert de livestream-start, dan schuift de standaard vanzelf mee.

De tijden komen in de **dagplanning** bij Rapportages → Dagbezetting en op **Productie** in LIVE. Wordt de wedstrijd verplaatst, dan schuiven ook eigen tijden mee.

## Het draaiboek kiezen

Kies bij **Draaiboek (CallSheet Template)** een draaiboek-template en klik op **Draaiboek toepassen**. De productie krijgt dan de hoofdstukken en items van de template, met tijden berekend vanaf het tijdanker. Een hoofdstuk met dezelfde naam als een bestaand hoofdstuk blijft staan, met zijn bezetting op het tabblad **Bezetting**; de andere hoofdstukken worden vervangen.

> **Let op:** toepassen verwijdert het huidige draaiboek van deze productie, inclusief wat er in LIVE al is gebeurd (de werkelijke tijden voor de tijdsanalyse). Doe dit bij het voorbereiden, niet na de uitzending.

## Hoofdstukken

Onder **Hoofdstukken** zie je de hoofdstukken van het draaiboek met hun begin, einde en duur. Die tijden volgen uit de items in elk hoofdstuk (zie [Draaiboek-templates](/admin/handleiding/draaiboek-templates#hoofdstukken)). Hoofdstukken en items wijzig je via **Bewerk Draaiboek**.

Met het **diskette-icoon** bewaar je het draaiboek van deze productie als nieuwe draaiboek-template, met de hoofdstukken, items en de standaardbezetting per hoofdstuk (de naam moet uniek zijn).

## Draaiboek als bestand

Onder **Draaiboek als bestand** zet je het draaiboek van deze productie in een bestand, of haal je het uit een bestand:

- **Exporteer JSON** downloadt het draaiboek met zijn hoofdstukken, items, tijdankers, koppelingen en posities. Zo'n bestand kun je in een andere productie importeren, of bij [Draaiboek-templates](/admin/handleiding/draaiboek-templates#importeren-en-exporteren) als template (**JSON Import**).
- **Exporteer Excel** downloadt hetzelfde als spreadsheet (met de kolom *Hoofdstuk*), om te lezen of te printen.
- **Importeer draaiboek** vervangt de items van dit draaiboek door die uit een JSON-bestand (een export van een productie of van een draaiboek-template, max. 2 MB). Je krijgt eerst de vraag *Het draaiboek van deze productie wordt vervangen …*; klik op **OK** om door te gaan. Daarna zie je hoeveel items er zijn geïmporteerd en welke hoofdstukken er nieuw zijn bijgekomen. Een hoofdstuk met dezelfde naam als een bestaand hoofdstuk wordt hergebruikt (met zijn bezetting); de tijden worden berekend vanaf het tijdanker. Is het bestand ongeldig, dan zie je de reden in rood en verandert er niets.

> **Let op:** importeren vervangt alle items van het draaiboek. Zet het daarna met **PAS TOE OP LIVE VIEW** door naar LIVE, en doe dit niet tijdens of na de uitzending.

De knoppen werken pas als de productie een draaiboek heeft (kies eerst een draaiboek-template).

## De callsheet bewerken

Met **Bewerk Draaiboek** open je het draaiboek van deze productie, in hoofdstukken, net als bij een [draaiboek-template](/admin/handleiding/draaiboek-templates#hoofdstukken): sleep items binnen en tussen hoofdstukken, of een heel hoofdstuk; voeg hoofdstukken toe, hernoem of verwijder ze. De hoofdstukken horen bij de productie; de volgorde geldt na **PAS TOE OP LIVE VIEW** ook in LIVE. Staat er **Hoofdstukken automatisch ingedeeld — controleer de indeling**, kijk de indeling dan na en klik op **Indeling klopt**. Elk item staat op één regel met zijn berekende begintijd, de **cue**, de titel, labels en de posities; klik op een regel om de cue, titel, notitie, duur, **Zaal**/**Stream**, **Auto**, het tijdanker, de koppeling en de posities te wijzigen, en druk op **Opslaan** (net als bij een [draaiboek-template](/admin/handleiding/draaiboek-templates#items)). Een nieuw item maak je met **+** in de kop van een hoofdstuk: het komt achteraan in dat hoofdstuk en opent meteen.

- **Tijden herberekenen** rekent alle tijden opnieuw uit vanaf het tijdanker: bij *Start wedstrijd* vanaf de aanvang, bij *Start livestream* vanaf de livestream-start.
- **PAS TOE OP LIVE VIEW** zet het bewerkte draaiboek door naar LIVE.

> **Wijzigingen in de callsheet zijn pas in LIVE te zien na PAS TOE OP LIVE VIEW.** Die knop vervangt wel alles wat er in LIVE al is gebeurd, dus gebruik hem niet tijdens of na de uitzending.
>
> Heeft het draaiboek geen tijdanker, dan doet *Tijden herberekenen* niets en zie je geen melding.

## Interviewnamen in titels

In titels en notities kun je `{speler-thuis}`, `{coach-uit:kort}` en dergelijke typen. In LIVE en vMix staat daar de gekozen naam (zie [Draaiboek-templates](/admin/handleiding/draaiboek-templates#interviewnamen)). In Beheer zie je ze zoals getypt.
