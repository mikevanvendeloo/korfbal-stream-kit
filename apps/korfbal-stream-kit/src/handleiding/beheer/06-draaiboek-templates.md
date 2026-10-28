# Draaiboek-templates

Onder **Stamgegevens → Draaiboeken → Draaiboek-templates** staan de draaiboeken die je bij elke productie opnieuw gebruikt. Een draaiboek bestaat uit **hoofdstukken** (bijvoorbeeld *Voorbereiding*, *Voorbeschouwing*, *Oplopen*, *Eerste helft*, *Rust*, *Tweede helft*, *Nabeschouwing*), met in elk hoofdstuk de items: wie doet wat, en hoe lang. Kies je een draaiboek bij een productie, dan komen de hoofdstukken, de items en de standaardbezetting in één keer mee.

Je richt dit één keer in en past het per productie toe.

## Hoofdstukken

Een hoofdstuk is een deel van het draaiboek. Het heeft **geen eigen duur**: begin, einde en duur volgen uit de items erin. Wil je dat de rust 10 minuten duurt, zet dan in het hoofdstuk *Rust* een item van 10 minuten. Elk item hoort in precies één hoofdstuk; een hoofdstuk *Voorbereiding* is handig voor de checklist vóór de stream (alles aangesloten, thumbnail klaar).

Elk hoofdstuk is een blok met bovenaan:

- de **naam** en het aantal items, en de tijd **ten opzichte van de aftrap** (bijvoorbeeld *−30:00 tot 0:00*), gerekend vanaf het item met het anker *Wedstrijd starttijd*;
- **+**: een nieuw item onderaan dit hoofdstuk;
- het **potlood**: de naam wijzigen;
- de **prullenbak**: het hoofdstuk verwijderen. Staan er items in, dan kies je eerst bij **Items verplaatsen naar** waar ze heen gaan;
- de **pijl** om het blok in en uit te klappen;
- **Standaardbezetting**: de posities die je in dit hoofdstuk meestal nodig hebt, bijvoorbeeld bij *Eerste helft*: Camera overzicht, Camera links, Camera rechts, Regie livestream, Commentaar. Voeg ze toe met **+ Positie**; een wijziging wordt meteen bewaard. Op het tabblad **Bezetting** van een productie verschijnen ze als snelkeuzeknoppen; er wordt niemand automatisch ingepland.

Onderaan voeg je met **Hoofdstuk toevoegen** een hoofdstuk toe.

**Slepen**: pak een item bij de greep links en sleep het naar een andere plek, ook naar een ander hoofdstuk. Een heel hoofdstuk sleep je aan de greep in de kop. Een gekoppeld item (zie hieronder) gaat altijd mee met het item waaraan het gekoppeld is, en blijft in hetzelfde hoofdstuk: sleep je het los naar een ander hoofdstuk, dan blijft het staan en zegt een melding waarom. Sleep dan het hoofditem, of maak eerst de koppeling los (**Koppel aan item** op *Geen*).

> Staat er bovenaan **Hoofdstukken automatisch ingedeeld — controleer de indeling**, dan is dit draaiboek bij de overstap van segmenten naar hoofdstukken automatisch ingedeeld (op tijd: elk item in het blok waarin het begint; wat vóór het eerste blok viel, staat in *Voorbereiding*). Kijk de indeling na, sleep wat verkeerd staat, en klik op **Indeling klopt**.

## Items

Met **Nieuw Draaiboek** maak je een lege template; met **Bekijken / Bewerken** open je er een. Elk item staat op één regel: de **cue**, de titel, labels (anker, Auto, Zaal, *Geen stream*), de posities (de eerste drie, daarna *+2*; Showcaller staat er niet bij, die staat altijd aan) en de duur. Klik op een regel om hem te openen en te wijzigen:

| Veld | Betekenis |
|---|---|
| **Cue** | Een korte code, bijvoorbeeld `INTRO`. Komt mee naar de callsheet van elke productie, zodat bijvoorbeeld vMix er later naar kan verwijzen. Mag leeg blijven. |
| **Titel** en **Notitie** | Wat er gebeurt. Hierin mag je [interviewnamen](#interviewnamen) gebruiken. |
| **Duur (seconden)** | Hoe lang het item duurt |
| **Zaal** / **Stream** | Of het in de zaal en/of in de livestream te zien is |
| **Tijd Anchor** | Het ijkpunt van het schema: *Wedstrijd starttijd* of *Livestream start*. Alle andere tijden worden daar vóór of na gerekend. |
| **Auto Advance** | Het item gaat in LIVE vanzelf door naar het volgende als de duur om is |
| **Koppel aan item (Parent)** | Een item dat tegelijk met een ander item gebeurt (in LIVE ernaast getoond); het staat altijd in hetzelfde hoofdstuk |
| **Posities** | Voor wie het item is: de gekozen posities staan als labels (met × haal je er een weg); met **+ Positie** zoek je er een bij, per categorie (Techniek, Entertainment, Algemeen). **Showcaller** staat altijd aan. |

De volgorde wijzig je door te slepen. Een nieuw item (met **+** in een hoofdstuk) duurt 60 seconden en opent meteen om te wijzigen. **Opslaan** bewaart, **Annuleren** (of Escape) laat alles zoals het was.

### Importeren en exporteren

Met **Excel Import** of **JSON Import** maak je een template uit een bestand. Vul eerst een naam in; pas daarna kun je een bestand kiezen. Via de knoppen op een kaart exporteer je een template naar Excel of JSON. Beide nemen de hoofdstukken mee (JSON ook de standaardbezetting per hoofdstuk).

In Excel staan per regel: Volgorde, Titel, Notitie, Duur (sec), Tijd Anchor (JA/NEE), Anchor Type (MATCH_START of LIVESTREAM_START), Auto Advance (JA), Zaal (JA), Stream (NEE om uit te zetten), **Hoofdstuk**, **Cue**. Daarna één kolom per positie, met precies de naam van de positie als kop, en een X bij de items voor die positie.

> - Een kolom met een positienaam die niet bestaat, wordt zonder melding overgeslagen.
> - Excel neemt geen gekoppelde items (parent) mee; JSON wel.
> - Een bestand zonder hoofdstukken (een oudere export) wordt na de import op tijd ingedeeld, zoals bij de overstap; controleer de indeling.
> - Een naam die al bestaat geeft geen foutmelding: er gebeurt dan niets. Kies een andere naam.

### Interviewnamen

In titels en notities kun je een plek voor een interviewnaam typen. Die wordt in LIVE en vMix gevuld met de interviewkeuze van de productie:

| Typ | Wordt |
|---|---|
| `{speler-thuis}` | de gekozen speler/speelster van de thuisploeg, volledige naam |
| `{coach-uit:kort}` | de coach van de uitploeg, als *J. de Vries* |
| `{speler-tegenstander:achternaam}` | de speler van de tegenstander, als *de Vries* |

Kies **thuis** of **uit**, of **eigen** en **tegenstander**: die laatste twee volgen de eigen club (bij **Instellingen**, dezelfde als de club van de organisatie), zodat hetzelfde draaiboek werkt voor thuis- én uitwedstrijden.

