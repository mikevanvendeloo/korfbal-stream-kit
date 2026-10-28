# Het draaiboek van een productie

Op het tabblad **Draaiboek** van een productie richt je het verloop van de uitzending in: de segmenten, het draaiboek (de callsheet-items) en de tijden.

## Livestream start

Vul bij **Livestream start** de tijd in waarop de livestream begint, in 24-uursnotatie. Je mag ook kort typen: `1925`, `19.25` of `19:25`. De tijd wordt bewaard als je het veld verlaat of op Enter drukt; met Escape zet je de oude waarde terug.

De livestream-start bepaalt in de rapporten het **einde van de livestream** (start plus de duur van alle segmenten), en is het ijkpunt voor items met het anker *Livestream start*.

### Verzamelen en opbouw

Naast **Livestream start** staan **Verzamelen** en, bij de eerste stream van de dag, **Opbouw**. Laat je ze leeg, dan geldt de standaard: die staat grijs in het veld (verzamelen 30 minuten voor live, opbouw 2,5 uur voor de eerste stream; aan te passen bij [Instellingen → Club & Teams](/admin/handleiding/instellingen#club-teams)). Vul een tijd in om af te wijken; maak het veld leeg om terug te gaan naar de standaard. Verandert de livestream-start, dan schuift de standaard vanzelf mee.

De tijden komen in de **dagplanning** bij Rapportages → Dagbezetting en op **Productie** in LIVE. Wordt de wedstrijd verplaatst, dan schuiven ook eigen tijden mee.

## Het draaiboek kiezen

Kies bij **Draaiboek (CallSheet Template)** een draaiboek-template en klik op **Draaiboek toepassen**. De productie krijgt dan alle items van de template, met tijden berekend vanaf het tijdanker.

> **Let op:** toepassen verwijdert het huidige draaiboek van deze productie, inclusief wat er in LIVE al is gebeurd (de werkelijke tijden voor de tijdsanalyse). Doe dit bij het voorbereiden, niet na de uitzending.

## Segmenten

De segmenten zijn de blokken van de uitzending. Per segment zie je de volgorde, de naam en de duur. Het segment met **Anchor** begint op de aanvangstijd van de wedstrijd; de andere segmenten worden daar vóór en na gerekend. Rechts zie je onder **Timing** het resultaat.

Per segment:

- **Omhoog** / **Omlaag** verplaatst het segment.
- **Zet als anchor** maakt dit het tijdanker (het vorige anker vervalt).
- **Wijzig** en **Verwijder**.

Boven de lijst:

- **Nieuw segment**: naam, duur in minuten en eventueel de volgorde.
- **Template toepassen**: vervangt alle segmenten door die van een segment-template.
- **Sla huidige segmenten op als template**: bewaart de segmenten als nieuwe segment-template (de naam moet uniek zijn).

> - Een segment-template toepassen verwijdert ook de bezetting per segment (de afwijkingen op het tabblad Bezetting).
> - Een anker uitzetten gaat met het anker-icoon in de lijst, niet met het vinkje in het formulier.

## De callsheet bewerken

Met **Bewerk Draaiboek** open je de callsheet-items van deze productie. Per item kun je de titel, notitie, duur, **Zaal**/**Stream**, **Auto**, het tijdanker, de koppeling met een ander item en de posities aanpassen; die wijzigingen worden direct bewaard. Onderaan voeg je met **Nieuw item toevoegen** een item toe. **Begin** en **Einde** zijn optioneel: vul per tijd een **Datum** (`DD-MM-JJJJ`) en een **Tijd** in 24-uursnotatie (`19:30`) in, of laat beide leeg. Alleen een datum of een ongeldige tijd geeft de melding *Vul een geldige datum (DD-MM-JJJJ) en tijd (uu:mm) in.* en het item wordt niet toegevoegd.

- **Tijden herberekenen** rekent alle tijden opnieuw uit vanaf het tijdanker: bij *Start wedstrijd* vanaf de aanvang, bij *Start livestream* vanaf de livestream-start.
- **PAS TOE OP LIVE VIEW** zet het bewerkte draaiboek door naar LIVE.

> **Wijzigingen in de callsheet zijn pas in LIVE te zien na PAS TOE OP LIVE VIEW.** Die knop vervangt wel alles wat er in LIVE al is gebeurd, dus gebruik hem niet tijdens of na de uitzending.
>
> Van een bestaand item kun je de cue, kleur, volgorde en tijden niet meer wijzigen. Een nieuw item komt standaard bovenaan (volgorde 0): vul de volgorde dus goed in bij het toevoegen.
>
> Heeft het draaiboek geen tijdanker, dan doet *Tijden herberekenen* niets en zie je geen melding.

## Interviewnamen in titels

In titels en notities kun je `{speler-thuis}`, `{coach-uit:kort}` en dergelijke typen. In LIVE en vMix staat daar de gekozen naam (zie [Draaiboek-templates](/admin/handleiding/draaiboek-templates#interviewnamen)). In Beheer zie je ze zoals getypt.
