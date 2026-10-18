# Beschikbaarheid en bezetting

Wie er bij een productie is en wat ieder doet, regel je op twee tabbladen van de productie: eerst **Beschikbaarheid**, dan **Bezetting**.

## Beschikbaarheid

Op **Beschikbaarheid** (*Aanwezigheid crew*) vink je aan wie er bij deze productie aanwezig is. Alle personen van je organisatie staan erop, op alfabet, in twee groepen:

- **Entertainment**: personen van wie **alle** skills alleen bij posities met de categorie *Entertainment* horen, zoals presentatie, commentaar en analist;
- **Crew**: alle anderen. Ook wie een technische of algemene skill heeft, en wie (nog) geen skills heeft.

De groep volgt de categorie van de posities bij [Stamgegevens → Posities](/admin/handleiding/stamgegevens). Zet je een positie in een andere categorie, dan verhuizen de personen met die skill mee. Achter elke groep staat hoeveel personen er aanwezig zijn; onderaan het totaal.

> Elk vinkje wordt **direct bewaard**. De knop **Opslaan** brengt je alleen terug naar het draaiboek, en **Annuleren** maakt niets ongedaan.
>
> Vink je iemand uit, dan blijven zijn posities staan. Haal die bij Bezetting weg.

Alleen aanwezige personen kun je op het tabblad Bezetting een positie geven.

### Minimale bezetting

Bovenaan staat de **Minimale bezetting**: kun je met de aanwezige personen de uitzending draaien? Per rol zie je hoeveel personen er zijn en hoeveel er nodig zijn:

| Rol | Nodig | Telt mee met de skill |
|---|---|---|
| Regisseur | 1 | Regie livestream |
| Camera | 3 | Camera zoom (Camera links/rechts) en Camera overzicht; niet PTZ en niet Herhalingen |
| Commentaar | 1, optioneel | Commentaar |
| Presentatie | 1, optioneel | Presentatie |
| Analist | 1, optioneel | Analist |

- ✓ betekent gehaald, ✗ nog niet. Een optionele rol zonder persoon krijgt een grijs –: die houdt de minimale bezetting nooit tegen.
- Iemand met meer skills telt **maar één keer**. Kan iemand regie én camera doen, dan telt hij voor één van de twee; de app kiest de verdeling waarmee de meeste rollen gevuld zijn, eerst de verplichte.
- Onderaan staat **Minimale bezetting gehaald** (groen) of bijvoorbeeld **Minimale bezetting nog niet gehaald: nog 1 camera** (oranje). Het overzicht werkt bij met elk vinkje.

> Staat er bij een rol *Vaardigheid … bestaat niet in deze organisatie*, dan heeft je organisatie die skill-code niet (bijvoorbeeld omdat hij is verwijderd). Die rol telt dan als niet gehaald. Voeg de skill met die code weer toe bij **Stamgegevens → Skills**.

## Bezetting

Het tabblad **Bezetting** heeft drie delen.

### Productie-brede posities

Bij **Productie-brede Positietoewijzingen** geef je elke aanwezige persoon de positie(s) die hij de hele uitzending heeft, bijvoorbeeld *Regie livestream* of *Commentaar*. Je ziet alleen posities waarvoor de persoon de juiste skill heeft (zie [Stamgegevens](/admin/handleiding/stamgegevens#crew)). Wijzigingen worden direct bewaard.

Dit is de basis: de rapporten, de vMix-naamtitels (presentatie, analist, commentaar) en LIVE gebruiken deze posities.

### Afwijkingen per segment

Doet iemand in één segment iets extra's, bijvoorbeeld in de rust de camera in de studio? Voeg dan bij **Segment-specifieke afwijkingen** een afwijking toe: kies de **Persoon**, het **Segment** en de **Positie (afwijking)**, en klik op **Afwijking toevoegen**.

> Een afwijking komt **bovenop** de productie-brede posities: de persoon houdt in dat segment ook zijn gewone positie.

### Bezetting per segment

Onderaan staat per segment wie er effectief staat (productie-breed plus de afwijkingen). Met **Filter op persoon** zie je alleen de segmenten van één persoon.

In elk segment kun je direct iemand toevoegen. De knoppen bij **Standaard posities voor dit segment** komen uit de [standaardbezetting](/admin/handleiding/draaiboek-templates#standaardbezetting-per-segment); kies je een positie die een skill vereist, dan zie je alleen personen met die skill. Heeft iemand de skill niet, dan krijg je de melding *Persoon mist de vereiste skill voor deze positie*.

Met **Kopieer naar…** neem je de toewijzingen van een segment over in andere segmenten: **Merge** voegt toe, **Overwrite** vervangt. Alleen de afwijkingen per segment worden gekopieerd, niet de productie-brede posities.

> Afwijkingen en toewijzingen verwijderen gaat zonder bevestiging.

## Waar zie ik het terug?

- In LIVE op **Actieve productie** (de crew per groep).
- In het **Crewrapport** (bezetting per segment) en het **Productierapport**.
- In de **Rapportages** Dagbezetting, Positieoverzicht en Crewrollen. Die tonen alleen de productie-brede posities.
