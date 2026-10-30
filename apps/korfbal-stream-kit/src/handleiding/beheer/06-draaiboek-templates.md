# Draaiboek-templates

Onder **Stamgegevens → Draaiboeken → Draaiboek-templates** staan de draaiboeken die je bij elke productie opnieuw gebruikt. Een draaiboek bestaat uit **hoofdstukken** (bijvoorbeeld *Voorbereiding*, *Voorbeschouwing*, *Oplopen*, *Eerste helft*, *Rust*, *Tweede helft*, *Nabeschouwing*), met in elk hoofdstuk de items: wie doet wat, en hoe lang. Kies je een draaiboek bij een productie, dan komen de hoofdstukken, de items en de standaardbezetting in één keer mee.

Je richt dit één keer in en past het per productie toe.

## Hoofdstukken

Een hoofdstuk is een deel van het draaiboek. Begin, einde en duur volgen uit de items erin, tenzij je een [Minimale duur](#minimale-duur) invult. Elk item hoort in precies één hoofdstuk; een hoofdstuk *Voorbereiding* is handig voor de checklist vóór de stream (alles aangesloten, thumbnail klaar).

Elk hoofdstuk is een blok met bovenaan:

- de **naam** en het aantal items, en de tijd **ten opzichte van de aftrap** (bijvoorbeeld *−30:00 tot 0:00*), gerekend vanaf het item met het anker *Wedstrijd starttijd*. Ook elk item toont zijn begintijd ten opzichte van de aftrap. Die tijden rekent de server uit, met [Zaal en Stream naast elkaar](#zaal-en-stream-parallel) en de minimale duur; na elke wijziging zie je meteen de nieuwe tijden;
- **Minimale duur**: zie hieronder;
- **+**: een nieuw item onderaan dit hoofdstuk;
- het **potlood**: de naam wijzigen;
- de **prullenbak**: het hoofdstuk verwijderen. Staan er items in, dan kies je eerst bij **Items verplaatsen naar** waar ze heen gaan;
- de **pijl** om het blok in en uit te klappen;
- **Standaardbezetting**: de posities die je in dit hoofdstuk meestal nodig hebt, bijvoorbeeld bij *Eerste helft*: Camera overzicht, Camera links, Camera rechts, Regie livestream, Commentaar. Voeg ze toe met **+ Positie**; een wijziging wordt meteen bewaard. Op het tabblad **Bezetting** van een productie verschijnen ze als snelkeuzeknoppen; er wordt niemand automatisch ingepland.

Onderaan voeg je met **Hoofdstuk toevoegen** een hoofdstuk toe.

**Slepen**: pak een item bij de greep links en sleep het naar een andere plek, ook naar een ander hoofdstuk. Een heel hoofdstuk sleep je aan de greep in de kop. Een gekoppeld item (zie hieronder) gaat altijd mee met het item waaraan het gekoppeld is, en blijft in hetzelfde hoofdstuk: sleep je het los naar een ander hoofdstuk, dan blijft het staan en zegt een melding waarom. Sleep dan het hoofditem, of maak eerst de koppeling los (**Koppel aan item** op *Geen*).

### Minimale duur

Bij **Minimale duur** in de kop van een hoofdstuk vul je in hoe lang het hoofdstuk minstens duurt, als minuten en seconden (`10:00`; alleen `10` is ook 10 minuten). Bijvoorbeeld *Rust* 10:00, *Eerste helft* en *Tweede helft* 35:00. Het volgende hoofdstuk begint dan pas na die tijd, ook als de items korter zijn: je hoeft geen nep-item van 10 minuten meer te maken. Laat je het veld leeg, dan duurt het hoofdstuk zo lang als zijn items. De waarde wordt bewaard als je het veld verlaat of op Enter drukt; met Escape zet je de oude waarde terug.

Duren de items samen langer dan de minimale duur, dan staat er in de kop bijvoorbeeld *loopt 1:30 langer dan de minimale duur*. Dat is geen fout: het hoofdstuk duurt dan zo lang als de items. Maak items korter of de minimale duur langer als dat niet de bedoeling is.

Het standaarddraaiboek van een nieuwe organisatie heeft al *Eerste helft* 35:00, *Rust* 10:00 en *Tweede helft* 35:00.

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

## Zaal en Stream: parallel

In de rust gebeurt er in de zaal iets anders dan in de stream: in de zaal draait reclame op het LED-scherm, in de stream bespreken de commentatoren de eerste helft. Die dingen gebeuren **tegelijk**. Daarom zijn **Zaal** en **Stream** twee **banen** die naast elkaar lopen:

- een item met alleen **Zaal** loopt in de **zaalbaan**;
- een item met alleen **Stream** loopt in de **streambaan**;
- een item met **Zaal én Stream** (of geen van beide), een item met een **tijdanker** en het begin van een hoofdstuk is een **samenkomstpunt**: daar komen de banen weer samen.

Tussen twee samenkomstpunten beginnen beide banen tegelijk; in elke baan volgen de items elkaar op. Het volgende samenkomstpunt begint als de langste baan klaar is. Banen lopen nooit over een hoofdstuk heen.

In de editor zie je dat aan de rand links van een regel: **groen** voor de zaalbaan, **blauw** voor de streambaan (net als in de Show Caller). Alleen items die echt naast de andere baan lopen, krijgen een gekleurde rand.

**Voorbeeld: de rust** (hoofdstuk *Rust*, minimale duur 10:00):

| Item | Zaal | Stream | Baan |
|---|---|---|---|
| Speaker kondigt rust aan | ✓ | ✓ | samenkomstpunt |
| Reclame LED | ✓ | | zaal |
| Commentatoren | | ✓ | stream |
| Reclame | ✓ | | zaal |
| Analyse eerste helft | | ✓ | stream |
| Statistieken | ✓ | | zaal |
| Reclame | | ✓ | stream |
| Start tweede helft (hoofdstuk *Tweede helft*) | ✓ | ✓ | samenkomstpunt |

De zaal (reclame LED, reclame, statistieken) en de stream (commentatoren, analyse eerste helft, reclame) beginnen allebei direct na de speaker. *Start tweede helft* begint als de langste baan klaar is, maar niet eerder dan 10 minuten na het begin van de rust. De volgorde van zaal- en stream-items door elkaar maakt niet uit; binnen een baan wel.

**In LIVE volgt Volgend de stream.** Heeft een stuk tussen twee samenkomstpunten geen stream-items, dan volgt **Volgend** de zaal. Bijvoorbeeld:

- **Voorbereiding**: alleen checks in de zaal, dus **Volgend** gaat langs elk item;
- **Rust**: beide banen; **Volgend** gaat langs de stream-items en de zaal loopt vanzelf mee (met **Zaal ›** zet je de zaal met de hand een stap verder);
- **na de stream**, bijvoorbeeld een prijsuitreiking alleen in de zaal: **Volgend** gaat weer langs de zaal-items.

Een item met **Auto** gaat nog steeds vanzelf door als zijn tijd om is. Zie de [Show Caller](/handleiding/show-caller#zaal-en-stream-naast-elkaar) in de handleiding van LIVE.

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

