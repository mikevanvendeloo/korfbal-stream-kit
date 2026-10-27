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

Het **Wedstrijdprogramma** toont de geïmporteerde wedstrijden per dag. Blader met de pijlen per dag of week, en kies **Thuis**, **Uit** of **Alle**. Handmatige wedstrijden staan er altijd bij.

Onder **Wedstrijden importeren** (klik om open te klappen) importeer je het programma op dezelfde manier als bij [Instellingen → Seizoen](/admin/handleiding/instellingen#wedstrijden-importeren): **Zaalcompetitie** of een eigen datum (`DD-MM-JJJJ`) of periode (`30-weeks`).

### Handmatige wedstrijden

Voor wedstrijden die niet in het programma staan, zoals een oefenwedstrijd of een evenement, klik je op **Nieuwe Wedstrijd** en vul je **Datum**, **Tijd**, **Thuisploeg**, **Uitploeg** en eventueel de **Scheidsrechter** en een **Beschrijving** in. Een handmatige wedstrijd staat altijd in de lijst bij **Nieuwe productie**.

Typ de datum als `DD-MM-JJJJ` (bijvoorbeeld `07-11-2026`) en de tijd in 24-uursnotatie (`19:30`; kort typen mag ook: `1930` of `19.30`). Datum en tijd zijn Nederlandse tijd, ook op een laptop die op een andere tijdzone of taal staat. Een rood veld betekent dat de datum of tijd niet bestaat; **Opslaan** meldt dan *Vul een geldige datum (DD-MM-JJJJ) en tijd (uu:mm) in.*

> - Een handmatige wedstrijd verwijderen gaat zonder bevestiging en verwijdert ook de productie van die wedstrijd.
> - Wijzig je bij **bewerken** de datum of tijd, dan schuift de productie van die wedstrijd mee: livestream-start en callsheet-tijden (zie [Als de wedstrijd verschuift](/admin/handleiding/producties#als-de-wedstrijd-verschuift)).
> - De lijst toont alleen het actieve seizoen.

### Clubs & spelers

Kies bij **Kies club** een club om de spelers en coaches van het actieve seizoen te zien. Met **Nieuwe speler** voeg je iemand toe (naam, rugnummer, geslacht, type, functie en foto); met de iconen bewerk of verwijder je een speler.

- **Importeer alle teams** haalt alle ploegen en spelers van de Korfbal League op (hetzelfde als bij Instellingen → Seizoen). Ploegen die de league-site nog niet goed heeft (geen teampagina of nog geen team-id, zoals vlak na de start van een seizoen), worden overgeslagen; welke dat zijn, staat onder de melding na de import. Probeer het later opnieuw, of importeer de ploeg via **Handmatige import** zodra hij een team-id heeft.
- Bij **Handmatige import** kun je één ploeg importeren met het team-id van league.korfbal.nl.
- **Nieuwe club** maakt een club aan die niet in de League speelt, bijvoorbeeld je eigen club.
- **Wijzig club** past de **Naam**, **Korte naam** en **Afkorting** van de gekozen club aan; klik op **Opslaan**. De afkorting (1 tot 5 letters of cijfers, bijvoorbeeld `FOR` of `KZ`) gebruik je voor logo's en het ledscherm en wordt in hoofdletters bewaard. Bij **Hoofdkleur** en **Tweede kleur** zet je de twee basiskleuren van de club als HTML-kleurcode (bijvoorbeeld `#e30613` en `#ffffff` voor rood en wit); typ de code of kies de kleur met het vakje ernaast. Laat je een veld leeg, dan heeft de club die kleur niet. vMix krijgt de kleuren via de datasource **Wedstrijdinformatie**.

De import neemt als korte naam het deel vóór de `/`: *Fortuna/Ruitenheer* wordt *Fortuna*. De afkorting maakt hij zelf uit de korte naam (maximaal 3 letters of cijfers: *Fortuna* → `FOR`, *DOS '46* → `DOS`, *Koog Zaandijk* → `KZ`). Een club die al bestaat, wordt herkend aan zijn korte naam, ook als het deel na de `/` (de sponsor) dit seizoen anders is: *LDODK/Rinsma Modeplein* komt bij de bestaande club *LDODK*. Hoofdletters, accenten, spaties en leestekens tellen daarbij niet mee. Zo'n club houdt zijn naam, korte naam en afkorting, dus wat je met **Wijzig club** hebt aangepast, blijft staan. Spelers worden bijgewerkt, het logo alleen als de bron er een heeft.

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

> - Heeft het Excel-bestand geen kolom *Actief* (of is de cel leeg), dan blijft een bestaande sponsor aan of uit zoals hij stond; een nieuwe sponsor wordt actief. *Ja*, *true* of *1* zet hem aan, elke andere waarde (zoals *Nee*) zet hem uit.
> - Het type *event* wordt ook bij de Excel-import herkend.
> - De kolom *Logo* wordt alleen overgenomen als het een logo van je eigen organisatie is (uit een eigen export). Anders upload je het logo daarna bij de sponsor.
> - Geüploade logo's staan in de map `storage/sponsors/<nummer van de organisatie>`; oudere logo's staan direct in `storage/sponsors`. Zie je geen logo, upload het dan opnieuw bij de sponsor.

### Sponsor-slides

Voor de pauzeschermen combineert vMix spelerfoto's met sponsorlogo's. Upload hier de foto's: geef een **Subject** (bijvoorbeeld de naam van de speler), kies het bestand en klik op **Upload**. Elke foto wordt een slide met drie sponsorlogo's. Met **Download JSON** zie je wat vMix krijgt.

> Hiervoor zijn minstens 3 actieve sponsors met een logo nodig, en minstens één foto.
