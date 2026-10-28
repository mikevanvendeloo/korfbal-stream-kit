# vMix koppelen

Alles voor vMix staat onder **Stamgegevens → vMix**: de **vMix-koppeling** (welke pc's en wat er naartoe gaat), de **Titel-templates** (de naamtitels) en de **Datasources** (de adressen die je in vMix invult).

Er zijn twee manieren waarop de app met vMix samenwerkt:

- **vMix haalt gegevens op** via een *Data Source* (JSON): sponsors, wedstrijdinformatie, de namen voor de titels, de callsheet-tijden. Daarvoor hoeft de app niets van vMix te weten.
- **De app stuurt opdrachten naar vMix**: de countdown-timer en de callsheet voor presentator en analist. Daarvoor moet de app weten waar vMix draait.

## vMix-pc's

Op **vMix-koppeling** zet je bij **vMix-pc's** één regel per pc waarop vMix draait, bijvoorbeeld een *Stream-PC* en een *Scherm-PC*. Heb je er maar één, vul dan één regel in.

- **Naam**: hoe je de pc noemt; die naam zie je terug in LIVE.
- **Web Controller URL**: het adres van de vMix Web Controller, bijvoorbeeld `http://192.168.1.50:8088`. Zet de Web Controller in vMix aan (Settings → Web Controller). `/api` hoeft er niet achter.

Met **vMix toevoegen** voeg je een pc toe (maximaal 10). Daaronder kies je bij **Welke vMix voor welke functie** per functie de pc:

- **Countdown timer**: de knoppen 10s, 30s en 1m in LIVE.
- **Callsheet naar vMix (presentator & analist)**.

Staat een functie op **Eerste vMix**, dan gaat hij naar de bovenste pc. Druk op **Opslaan**.

> Een pc hernoemen is veilig. Verwijder je een pc waar een functie aan hing, dan gaat die functie naar de eerste pc.

## Callsheet naar vMix

De presentator en analist kunnen in vMix zien welk item nu loopt, hoe lang nog, en wat er straks komt. De achtergrond kleurt mee: groen, oranje als de tijd bijna op is, rood als hij over tijd is. De app zet de teksten en kleuren elke seconde in een vMix-title.

### De title in vMix voorbereiden

1. Maak in vMix (GT Title Designer) een title met tekstvelden, bijvoorbeeld *Titel*, *Timer*, *Start*, *Volgend*, *VolgendDuur*, *VolgendOver* en *VolgendStart*.
2. Zet achter elk blok een **rechthoek (shape)**: dat wordt de gekleurde achtergrond.
3. Voeg de title toe als input en onthoud de naam (of het nummer).

### De instellingen

| Instelling | Uitleg |
|---|---|
| **Automatisch pushen naar vMix** | Aan: de app werkt de title elke seconde bij, ook als niemand de app open heeft. Uit: alleen met *Nu pushen*. |
| **vMix title (naam, nummer of key)** | De input in vMix. Druk op **Inputs ophalen uit vMix** en kies de title bij **Kies een title uit vMix**; dan staat de key van de input erin. Typ je zelf een naam, dan moet die precies kloppen, met hoofdletters en extensie (bijvoorbeeld *Callsheet.gtzip*); klopt hij niet, dan negeert vMix de opdrachten zonder foutmelding. Een nummer verschuift als je inputs toevoegt of verplaatst. |
| **Oranje vanaf (sec)** | Vanaf hoeveel seconden het blok oranje wordt (standaard 10) |
| **Positie** | Welke callsheet-items meetellen: items met deze positie, plus items zonder positie. *Alle items* neemt alles mee. Standaard Presentatie. Wil je een tweede positie in een andere title, gebruik daarvoor de datasource *Callsheet Timing* met `?position=` erachter. |

Bij **Huidig item** en **Volgend item** vul je per gegeven de veldnaam in de title in, zoals vMix die noemt: tekstvelden eindigen op `.Text`, bijvoorbeeld `Titel.Text`. Een veld dat je leeg laat, wordt niet gevuld. Heb je de inputs opgehaald, dan stelt elk veldnaamvak de tekstvelden van de gekozen title voor.

- **Achtergrond (shape)**: de naam van de rechthoek; die krijgt de kleur van de toestand.
- **Tekstkleur velden (komma gescheiden)**: de tekstvelden waarvan de tekstkleur mee moet veranderen.

Daaronder kies je per toestand (**Normaal**, **Bijna op**, **Over tijd**) de kleur van de achtergrond en de tekst. Bij het huidige item telt de resterende tijd; bij het volgende item de tijd tot het begint.

Het **Voorbeeld** toont wat er in vMix komt; met **Live / Normaal / Bijna op / Over tijd** bekijk je elke toestand. Sla eerst op: het voorbeeld gebruikt de opgeslagen positie. Met **Nu pushen** test je meteen; je ziet hoeveel velden zijn verstuurd en of er fouten waren. Daarna controleert de app bij vMix of de input en de tekstvelden bestaan en meldt in oranje wat vMix zou negeren (vMix zelf geeft daar geen fout op). De achtergrond-shape wordt niet gecontroleerd.

> Komen de teksten niet aan? Controleer de vMix-title (naam of nummer), de veldnamen (met `.Text`) en de Web Controller URL. De app stuurt elke 15 seconden alles opnieuw, dus na een herstart van vMix herstelt de title zich vanzelf.

## Titel-templates

Op **Titel-templates** leg je vast welke naamtitels (functie + naam) er bij een productie horen, in welke volgorde. Elke template heeft een **Naam**, een vinkje **Ingeschakeld** en één of meer **Onderdelen**. Per onderdeel kies je een **Bron**:

| Bron | Wordt |
|---|---|
| **Presentatie & analist** | De presentator en analist van de productie samen |
| **Presentatie** | Alleen de presentator |
| **Commentaar (allen)** | Alle commentatoren |
| **Team speler** / **Team coach** | De gekozen interview-speler of -coach van **Thuis** of **Uit** |
| **Vrije tekst** | Een vaste **Functie** en **Naam** die je zelf typt |

De namen komen uit de bezetting van de productie (presentatie, analist, commentaar) en uit de interviewkeuze (spelers en coaches). Met de pijlen zet je de volgorde; die volgorde krijgt vMix ook.

Templates zijn het **standaardlijstje**. Per productie neem je ze over op het tabblad **vMix-titels** (zie [Interviews en vMix-titels](/admin/handleiding/interviews-en-titels)). Een latere wijziging in een template werkt niet door in productie-titels die al zijn overgenomen.

> **Verwijder** vraagt geen bevestiging.
>
> Het veld **Limiet** bij Team speler/coach wordt opgeslagen, maar heeft nu nog geen effect.

## Datasources

Op **Datasources** staan de adressen die je in vMix gebruikt, met een knop om ze te kopiëren. Je voegt ze in vMix toe via **Data Sources → JSON → URL** en stelt daar in hoe vaak vMix ze ververst.

Elk adres eindigt op `key=<jouw-sleutel>`: vMix moet een **API-sleutel** van je organisatie meesturen, anders krijgt het de fout 401 en ververst de datasource niet. Vervang `<jouw-sleutel>` door een sleutel van [Organisatie-instellingen](/admin/handleiding/organisaties#api-sleutels). Maak je bovenaan de pagina bij **API-sleutel** een nieuwe sleutel (**Naam van de sleutel**, **Sleutel aanmaken**), dan staat hij meteen in alle adressen op de pagina, klaar om te kopiëren. Die ingevulde adressen zie je alleen tot je de pagina verlaat.

| Datasource | Wat je krijgt |
|---|---|
| **Sponsor Names (Ticker)** | Eén regel met alle sponsornamen, voor een lopende tekst. Premium eerst, verder in willekeurige volgorde. |
| **Sponsor Carrousel** | Per sponsor naam, logo-bestandsnaam (*commercial*), type en website |
| **Sponsor Slides** | Per spelerfoto drie sponsorlogo's, voor de pauzeschermen |
| **Wedstrijdinformatie (actieve productie)** | Teams, korte namen en **afkortingen** van de clubs (`homeAbbreviation`, `awayAbbreviation`; aan te passen bij [Clubs & spelers](/admin/handleiding/stamgegevens#clubs-spelers)), de twee **clubkleuren** als HTML-kleurcode (`homePrimaryColor`, `homeSecondaryColor`, `awayPrimaryColor`, `awaySecondaryColor`, bijvoorbeeld `#e30613`; leeg als de club geen kleur heeft), clublogo's, datum, aanvang, verzamel- en livetijd, zaal, veld, scheidsrechters, score, wedstrijd- en balsponsor met logo |
| **Active Production Titles** | De naamtitels (functie + naam) van de actieve productie |
| **Titel per rol (actieve productie)** | Eén naamtitel: zet aan het eind van het adres de rol, een van `presentatie`, `presentatie-analist`, `commentaar`, `coach-thuis`, `coach-uit`, `speler-thuis` of `speler-uit`. Heeft een titel-template een eigen interviewkeuze voor die rol, dan telt die. Is er geen actieve productie of nog niemand gekozen, dan krijg je een lege regel, zodat de titel leeg wordt. |
| **Active Production Staff** | Een oudere bron met crewrollen |
| **Callsheet Timing** | Het huidige en volgende callsheet-item met tijden en de kleuren van de toestand als HTML-kleurcode (`currentBackgroundColor`, `currentTextColor`, `nextBackgroundColor`, `nextTextColor`; normaal, bijna voorbij of over tijd, zoals ingesteld bij de callsheet-push), voor wie liever zelf ophaalt dan laat pushen |

Welke **sponsortypes** in de ticker, carrousel en slides meedoen, stel je in bij **Instellingen → Sponsors**. Alleen ingeschakelde sponsors doen mee.

### Afbeeldingen

- **Wedstrijdinformatie** geeft volledige adressen van logo's; die kun je direct in een title-afbeelding gebruiken.
- **Carrousel** en **Slides** geven alleen de **bestandsnaam** van een logo. Zet in vMix het adres ervoor: `http://<server>:<poort>/uploads/sponsors/<slug>/`, met de slug van je organisatie (bijvoorbeeld `fortuna`).

### Let op

- Bestonden je datasources al van voor de organisaties, zet er dan één keer de sleutel in ([zo doe je dat](/admin/handleiding/organisaties#eenmalig-na-de-update-sleutels-in-vmix)).
- De adressen op deze pagina gebruiken het IP-adres van de server. Draait de app in Docker, zorg dan dat bij de installatie `HOST_IP` is ingesteld; anders staat er een intern adres dat vMix niet kan bereiken. Controleer ook de poort.
- De sponsorbronnen husselen bij elke verversing. Voor **Sponsor Slides** kun je `?seed=1` achter het adres zetten voor een vaste volgorde.
- **Sponsor Slides** geeft een fout zolang er minder dan 3 sponsors met logo of geen spelerfoto's zijn.
- **Active Production Staff** kijkt naar de eerstvolgende wedstrijd en werkt niet meer zodra de wedstrijd begonnen is. Gebruik voor naamtitels **Active Production Titles**.
