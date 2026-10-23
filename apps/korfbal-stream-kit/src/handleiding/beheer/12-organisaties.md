# Organisaties

Korfbal StreamKit kan door meer dan één organisatie gebruikt worden, bijvoorbeeld Fortuna en het KNKV. Elke organisatie heeft haar eigen producties, draaiboeken, crew (personen, posities, skills), sponsors, wedstrijden en instellingen, en ziet niets van een andere organisatie. **Gedeeld** zijn alleen de seizoenen, de clubs en de spelers.

## Organisatie kiezen

Open je Beheer of LIVE voor het eerst op een apparaat, dan kies je op het scherm **Kies een organisatie** voor welke organisatie je werkt. De keuze wordt op dit apparaat onthouden; de adressen blijven hetzelfde. Is er maar één actieve organisatie, dan kiest de app die zelf.

Rechtsboven in de menubalk staan het logo en de naam van de gekozen organisatie. Klik erop om te **wisselen**; met **Terug** blijft alles zoals het was. Na het wisselen zie je alleen de gegevens van de nieuwe organisatie.

Het keuzescherm komt ook terug als de gekozen organisatie is uitgezet, of als haar slug is gewijzigd.

## Organisaties beheren

Onder **Overig → Organisaties** staan alle organisaties, ook de inactieve, met hun **Slug**, **Club** en status (**Actief** of **Inactief**).

- **Nieuwe organisatie**: vul de **Naam** in; de **Slug** (een korte naam met kleine letters, cijfers en streepjes, bijvoorbeeld `fortuna`) wordt voorgesteld. Kies eventueel de eigen **Club** en druk op **Aanmaken**. Een nieuwe organisatie krijgt meteen de **standaardset**: skills, posities, titel-templates, draaiboek- en segment-templates. Daarna kun je een logo toevoegen.
- **Wijzigen**: naam, slug, club en logo. De **Club** is ook de **Eigen Club** bij **Instellingen → Club & Teams**: wijzig je hem op de ene plek, dan zie je dat op de andere. Wijzig je de slug, dan kiest iedereen die deze organisatie gebruikt opnieuw op het keuzescherm (behalve jij op dit apparaat). De logo's verhuizen mee: de map `storage/sponsors/<slug>` en het logo `storage/organizations/<slug>.png` krijgen de nieuwe slug. Staan er voor de nieuwe slug al bestanden, dan krijg je een foutmelding en verandert er niets. Pas in vMix het adres voor sponsorlogo's aan (zie [vMix](/admin/handleiding/vmix)).
- **Deactiveren** / **Activeren**: een inactieve organisatie staat niet op het keuzescherm en haar gegevens zijn niet te openen, maar er wordt niets verwijderd. De laatste actieve organisatie kun je niet deactiveren.

**Logo**: met **Logo uploaden** (PNG, JPG, GIF of WebP) en **Logo verwijderen**. Zonder eigen logo zie je het logo van de gekoppelde club, en anders de initialen.

> Zolang er geen inlog is, kan iedereen met Beheer de organisaties beheren.

## Organisatie

Onder **Overig → Organisatie** staan de instellingen van de **gekozen** organisatie: het **Logo**, de **Wedstrijdimport** en de **API-sleutels**.

### Wedstrijdimport

Hier stel je in waar het wedstrijdprogramma van deze organisatie vandaan komt (de knop **Wedstrijden importeren** bij [Instellingen → Seizoen](/admin/handleiding/instellingen)).

| Veld | Wat |
|---|---|
| **Bron** | Nu alleen *Sportclub Vrijwilligersmanagement* |
| **Adres (URL)** | Het adres van de bron, altijd `https://` |
| **Token** | De sleutel van de bron. Leeg laten houdt het huidige token. |
| **Wedstrijdimport aan** | Uit: er wordt niets geïmporteerd |

- Het token wordt **nooit getoond**. Je ziet alleen **Token: ingesteld** of **Token: niet ingesteld**. Met **Token verwijderen** haal je het weg.
- Wijzig je de **bron** of het **adres**, dan wordt het opgeslagen token **gewist** (zodat het niet naar een ander adres gaat). Vul het dan in hetzelfde formulier opnieuw in.
- **Test verbinding** vraagt met de opgeslagen instellingen de wedstrijden van deze week op. Gaat het goed, dan zie je **Verbinding gelukt (N wedstrijden)**; anders wat er mis is en wat je kunt doen (zie de tabel hieronder). Sla wijzigingen eerst op.

Welke datums je bij het importeren kunt gebruiken (`DD-MM-JJJJ`, `30-weeks` of **Zaalcompetitie**) staat bij [Wedstrijden importeren](/admin/handleiding/instellingen#wedstrijden-importeren).

#### Foutmeldingen

| Foutmelding | Wat te doen |
|---|---|
| **Wedstrijdimport is niet ingesteld voor deze organisatie** | Vul bij **Overig → Organisatie → Wedstrijdimport** de bron, het adres en het token in, vink **Wedstrijdimport aan** aan en klik op **Opslaan**. |
| **Ongeldige datum** of **Datum … bestaat niet** | Typ een dag als `DD-MM-JJJJ` (bijvoorbeeld `07-11-2026`) of een aantal weken (bijvoorbeeld `30-weeks`). Dagen of maanden als periode (`1-days`, `8-months`) werken niet. |
| **De startdatum van de zaalcompetitie is niet ingesteld** | Vul bij **Instellingen → Seizoen → Seizoenen** de **Start zaalcompetitie** van het actieve seizoen in. |
| **Token ongeldig of verlopen** | Vraag een nieuw token aan bij de wedstrijdbron, vul het in bij **Overig → Organisatie → Wedstrijdimport** en klik op **Opslaan**. |
| **URL klopt niet** | Controleer het **Adres (URL)**; voor Sportclub Vrijwilligersmanagement is dat `https://api.sportclubvrijwilligersmanagement.nl/v1`. |
| **De wedstrijdbron weigerde het verzoek** | Controleer de datum en het adres. Blijft het misgaan, neem dan contact op met de beheerder van de wedstrijdbron. |
| **De wedstrijdbron gaf een serverfout** | Mogelijk klopt het datumformaat niet (gebruik `DD-MM-JJJJ` of `30-weeks`), of de bron heeft een storing. Probeer het later opnieuw. |
| **De wedstrijdbron reageert niet op tijd** | Probeer het later opnieuw, of kies een kortere periode. |
| **De wedstrijdbron is niet bereikbaar** | Controleer het **Adres (URL)** en of de server van StreamKit internet heeft. |
| **De wedstrijdbron gaf een onverwacht antwoord** | Het adres wijst waarschijnlijk naar een website in plaats van naar de API. Controleer het **Adres (URL)** (eindigt meestal op `/v1`). |

> De melding zegt alleen **wat voor** fout het is, nooit wat de bron precies terugstuurde. De details (statuscode, het antwoord van de bron, hoe lang het duurde) staan in het serverlog van de API (`docker logs`), zonder het token.

### API-sleutels

vMix-datasources, vMix-triggers en scorebordschermen kunnen geen organisatie kiezen. Ze sturen daarom een **API-sleutel** van de organisatie mee, als `?key=…` achter het adres. Een sleutel geeft alleen toegang tot die gegevens (de datasources en het scorebord), nooit tot Beheer.

1. Vul bij **Naam van de sleutel** in waar hij voor is, bijvoorbeeld *vMix stream-pc*, en druk op **Sleutel aanmaken**.
2. De volledige sleutel staat in het venster dat opent. **Je ziet hem alleen nu**: kopieer hem met de kopieerknop (**Kopieer sleutel**). Daaronder staan de datasource-adressen met de sleutel al ingevuld, klaar om in vMix te plakken.
3. Druk op **Klaar**. Daarna zie je in de lijst alleen nog het begin van de sleutel (**Begint met**), wanneer hij is aangemaakt en wanneer hij voor het laatst is gebruikt.

Ben je een sleutel kwijt, maak dan een nieuwe en trek de oude in. **Intrekken** (na bevestigen) werkt meteen: apparaten met die sleutel krijgen geen gegevens meer. Gebruik per apparaat een eigen sleutel, dan kun je er één intrekken zonder de rest aan te passen.

### Eenmalig na de update: sleutels in vMix

Sinds de organisaties werken de vMix-datasources en vMix-triggers **alleen nog met een API-sleutel**. Een bestaande datasource zonder `?key=` geeft de fout **401** ("API-sleutel ontbreekt") en ververst niet meer. Doe daarom één keer:

1. Maak bij **Overig → Organisatie → API-sleutels** een sleutel per vMix-pc.
2. Kopieer de adressen uit het venster (of uit **Stamgegevens → vMix → Datasources**, zie [Datasources](/admin/handleiding/vmix#datasources)).
3. Vervang in vMix bij **Data Sources** elk adres door het nieuwe, met `?key=` (of `&key=` als er al een `?` in staat).
4. Controleer dat de datasources weer verversen.
