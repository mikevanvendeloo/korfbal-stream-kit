# Producties

Een **productie** is één uitzending van één wedstrijd: het draaiboek, de crew, de interviews, de vMix-titels en het rapport. Je beheert ze bij **Producties → Productieoverzicht**.

Het overzicht toont de producties van het **actieve seizoen**, de nieuwste bovenaan. De actieve productie heeft het groene label **Active**.

## Een productie aanmaken

1. Klik op **Nieuw**.
2. Kies bij **Kies match** de wedstrijd. De eerstvolgende wedstrijd staat al geselecteerd.
3. Klik op **Opslaan**.

De nieuwe productie krijgt meteen:

- een **livestream-start** 5 minuten voor de aanvang;
- de **segmenten** van de segment-template die op *Standaard* staat (zie [Draaiboek-templates](/admin/handleiding/draaiboek-templates#segment-templates));
- een lege callsheet.

Daarna kies je op het tabblad **Draaiboek** het draaiboek (zie [Het draaiboek](/admin/handleiding/draaiboek)).

> **Ik zie mijn wedstrijd niet in de lijst.** Je ziet alleen wedstrijden uit het actieve seizoen die óf handmatig zijn toegevoegd, óf thuiswedstrijden van een team dat bij **Instellingen → Club & Teams → Productie Teams** is aangevinkt. Staat daar niets aangevinkt, dan zie je alleen handmatige wedstrijden.
>
> Een wedstrijd die al een productie heeft, staat er ook tussen; kiezen geeft dan de melding *Production already exists for this match*.

## Een productie activeren

LIVE volgt altijd de **actieve** productie. Klik bij de juiste productie op **Activeren**. Er is altijd maar één actieve productie: de vorige wordt automatisch uitgezet.

> Loopt er op dat moment een show in LIVE van een andere productie, dan wordt die gestopt. Activeer dus niet tijdens een uitzending.

## Wijzigen en verwijderen

- **Wijzig** laat je een andere wedstrijd kiezen. De rest blijft zoals het is, ook de livestream-start.
- **Verwijder** verwijdert de productie met alles wat erbij hoort: segmenten, draaiboek, crew, interviews, titels en het rapport.

> **Verwijder** vraagt geen bevestiging en kan niet ongedaan worden gemaakt. Exporteer de productie eerst als je twijfelt.

## Als de wedstrijd verschuift

Wijzig je de datum of tijd van de wedstrijd (bij [Handmatige wedstrijden](/admin/handleiding/stamgegevens#handmatige-wedstrijden)), of zet een nieuwe [import](/admin/handleiding/instellingen#wedstrijden-importeren) de wedstrijd op een ander moment, dan schuift de productie mee:

- de **livestream-start** schuift evenveel op als de wedstrijd. Gaat de wedstrijd van zaterdag 19:30 naar zondag 20:00, dan gaat een livestream-start van zaterdag 19:25 naar zondag 19:55;
- de tijden in de **callsheet** en de geplande tijden van de items in LIVE schuiven ook mee.

Het overzicht toont meteen de nieuwe datum, tijd en ploegnamen. Ook over de wissel naar zomer- of wintertijd blijft de livestream-start op dezelfde afstand van de aanvang.

> Loopt de show van die productie op dat moment in LIVE, dan schuift er niets mee: alleen de wedstrijd krijgt de nieuwe tijd. Pas de livestream-start daarna zelf aan op het tabblad **Draaiboek**.

## Exporteren en importeren

- **Exporteer** downloadt de hele productie als JSON-bestand: wedstrijd, crew met skills, posities, segmenten, titels, interviews, draaiboek en rapport.
- **Importeer** leest zo'n bestand weer in. Bestaat de wedstrijd al, dan gebruikt de app die; anders wordt hij aangemaakt. Personen worden op naam herkend; onbekende personen en skills worden aangemaakt.

> Heeft de wedstrijd al een productie, dan **overschrijft** de import de segmenten, titels, interviews en het draaiboek van die productie.

## Binnen een productie

Klik op de wedstrijd of op **Details**. Bovenaan staan de ploegen, de knop **Open in LIVE** en de tabbladen:

| Tabblad | Waarvoor |
|---|---|
| **Draaiboek** | Livestream-start, draaiboek kiezen, segmenten en callsheet |
| **Beschikbaarheid** | Wie er aanwezig is, per groep (Crew en Entertainment), en of de minimale bezetting gehaald is |
| **Bezetting** | Wie welke positie heeft, voor de hele productie en per segment |
| **vMix-titels** | De naamtitels en de interviewkeuze |
| **Rapport** | Productierapport, crewrapport en tijdsanalyse |
