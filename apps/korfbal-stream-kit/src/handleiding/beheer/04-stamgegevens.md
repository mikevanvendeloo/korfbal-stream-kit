# Stamgegevens

Stamgegevens richt je één keer in, of één keer per seizoen: de crew, de competitie, de sponsors en vMix (zie [vMix koppelen](/admin/handleiding/vmix)).

## Crew

De crew bestaat uit drie onderdelen die op elkaar aansluiten:

- **Skills**: wat iemand kan, bijvoorbeeld *Camera zoom*, *Regie livestream* of *Commentaar*.
- **Posities**: de plekken bij een uitzending, bijvoorbeeld *Camera links*. Een positie kan een skill vereisen.
- **Personen**: de crewleden, met hun skills.

Bij het inplannen kun je iemand alleen op een positie zetten als hij de skill heeft die de positie vereist. Zo voorkom je dat iemand zonder ervaring op een camera komt.

### Skills

Met **Nieuw** maak je een skill aan:

- **Code**: een vaste code in hoofdletters, bijvoorbeeld `CAMERA_ZOOM`.
- **Naam**, **Naam (man)** en **Naam (vrouw)**.
- **Type**: **Crew** of **Entertainment**. Entertainment-skills (presentatie, analist, commentaar) bepalen wie er in de vMix-naamtitels komt.

> Een skill verwijderen gaat zonder bevestiging en haalt hem weg bij alle personen en posities. Een code wijzigen kan het inplannen verstoren: sommige posities zijn in de app aan een vaste code gekoppeld.

### Posities

Op **Posities & taken** maak je met **Nieuwe positie** een positie aan:

- **Naam**: kies één schrijfwijze. Een naam die al bestaat in een andere schrijfwijze (*camera links* naast *Camera links*, of *regie* naast *Regie livestream*) wordt geweigerd.
- **Categorie**: **GENERAL** (algemeen), **TECHNICAL** (techniek) of **ENTERTAINMENT**. Hierop wordt de crew in LIVE en de rapporten gegroepeerd.
- **Skill**: de skill die iemand nodig heeft voor deze positie.

Sleep de posities in de goede volgorde; die volgorde zie je terug in de lijsten en rapporten. Met **Export JSON** en **Import JSON** neem je de posities mee naar een andere installatie.

> Een positie verwijderen gaat zonder bevestiging en haalt hem weg uit alle producties, draaiboeken en templates.

### Personen

Op **Persons** maak je met **Nieuw persoon** een crewlid aan: **Naam**, **Geslacht** en eventueel direct de **Skills**. Met **Beheer skills** pas je de skills van een bestaand crewlid aan.

> De lijst toont de eerste 50 personen; gebruik **Zoek** om iemand anders te vinden. Een persoon verwijderen gaat zonder bevestiging en haalt hem uit alle producties.

## Competitie

### Wedstrijdprogramma

Het **Wedstrijdprogramma** toont de geïmporteerde wedstrijden per dag. Blader met de pijlen per dag of week, en kies **Home**, **Away** of **All**.

> Gebruik voor het importeren de knop **Wedstrijden importeren** bij [Instellingen → Seizoen](/admin/handleiding/instellingen). De knop **Import (default)** op dit scherm werkt niet.

### Handmatige wedstrijden

Voor wedstrijden die niet in het programma staan, zoals een oefenwedstrijd of een evenement, klik je op **Nieuwe Wedstrijd** en vul je **Datum & Tijd**, **Thuisploeg**, **Uitploeg** en eventueel de **Scheidsrechter** en een **Beschrijving** in. Een handmatige wedstrijd staat altijd in de lijst bij **Nieuwe productie**.

> - Een handmatige wedstrijd verwijderen gaat zonder bevestiging en verwijdert ook de productie van die wedstrijd.
> - Bij **bewerken** staat de tijd een of twee uur te vroeg in het formulier. Corrigeer de tijd voordat je opslaat, anders schuift de wedstrijd op.
> - De lijst toont alleen het actieve seizoen.

### Clubs & spelers

Kies bij **Kies club** een club om de spelers en coaches van het actieve seizoen te zien. Met **Nieuwe speler** voeg je iemand toe (naam, rugnummer, geslacht, type, functie en foto); met de iconen bewerk of verwijder je een speler.

- **Importeer alle teams** haalt alle ploegen en spelers van de Korfbal League op (hetzelfde als bij Instellingen → Seizoen).
- Bij **Handmatige import** kun je één ploeg importeren met het team-id van league.korfbal.nl.
- **Nieuwe club** maakt een club aan die niet in de League speelt, bijvoorbeeld je eigen club.

Coaches staan bovenaan, daarna speelsters en spelers. Deze spelers verschijnen in de interviewkeuze van een productie.

> **Verwijder club** verwijdert ook alle spelers van die club, van alle seizoenen.

## Sponsors

### Sponsors

Met **Nieuwe sponsor** voeg je een sponsor toe:

| Veld | Waarvoor |
|---|---|
| **Naam** | De officiële naam (*B.V.* wordt weggelaten) |
| **Type** | Premium, Goud, Zilver, Brons of Evenement. Bij **Instellingen → Sponsors** kies je welke types in de ticker, carrousel en slides komen. |
| **Website URL** | Verplicht |
| **Logo** | Upload een png-, jpg-, gif- of webp-bestand. Zonder upload heeft de sponsor geen logo; het wordt niet meer van de naam afgeleid. |
| **Weergavenaam** | Een kortere naam voor de ticker en carrousel |
| **Sponsor is actief** | Alleen actieve sponsors komen in vMix |

In de lijst zet je een sponsor met het vinkje bij **Actief** snel aan of uit.

Met **Upload sponsors** lees je een Excel-bestand in, met kolommen als *Naam*, *Type* (of *Pakket*), *Website*, *Logo*, *Weergavenaam* en *Actief*. Bestaande sponsors worden op naam herkend en bijgewerkt. Met **Export sponsors naar Excel** download je de lijst.

> - Heeft het Excel-bestand geen kolom *Actief*, dan worden alle geïmporteerde sponsors weer actief.
> - Sponsors van het type *event* worden bij de Excel-import overgeslagen.
> - De kolom *Logo* wordt alleen overgenomen als het een logo van je eigen organisatie is (uit een eigen export). Anders upload je het logo daarna bij de sponsor.
> - Geüploade logo's staan in de map `storage/sponsors/<nummer van de organisatie>`; oudere logo's staan direct in `storage/sponsors`. Zie je geen logo, upload het dan opnieuw bij de sponsor.

### Sponsor-slides

Voor de pauzeschermen combineert vMix spelerfoto's met sponsorlogo's. Upload hier de foto's: geef een **Subject** (bijvoorbeeld de naam van de speler), kies het bestand en klik op **Upload**. Elke foto wordt een slide met drie sponsorlogo's. Met **Download JSON** zie je wat vMix krijgt.

> Hiervoor zijn minstens 3 actieve sponsors met een logo nodig, en minstens één foto.
