# Instellingen en een nieuw seizoen

De instellingen open je met het **tandwiel** rechtsboven, of door op het label **Seizoen …** te klikken. Er zijn vijf tabbladen: **Seizoen**, **Club & Teams**, **Koppelingen**, **Sponsors** en **Backup**.

## Een nieuw seizoen starten

Een seizoen loopt van 1 juli tot en met 30 juni. Wedstrijden, producties en spelers horen bij een seizoen; clubs, personen, posities en sponsors gelden voor alle seizoenen.

Doe het in deze volgorde:

1. **Seizoen → Nieuw seizoen**: vul de naam in (bijvoorbeeld `2026/2027`), laat **Direct activeren** aangevinkt en klik op **Seizoen aanmaken**.
2. **Seizoenen → Start zaalcompetitie**: vul de eerste speeldag van de zaalcompetitie in (zie [Startdatum zaalcompetitie](#startdatum-zaalcompetitie)).
3. **Seizoen vullen → Wedstrijden importeren** met **Zaalcompetitie**: haalt alle wedstrijden op vanaf die dag (zie [Wedstrijden importeren](#wedstrijden-importeren)).
4. **Seizoen vullen → Teams/spelers importeren**: haalt de ploegen en spelers van de Korfbal League op, met foto's.
4. **Club & Teams**: controleer de **Eigen Club** en vink de **Productie Teams** aan.
5. Voeg eventueel [handmatige wedstrijden](/admin/handleiding/stamgegevens#competitie) toe en controleer spelers en foto's bij **Clubs & spelers**.

> - Spelers komen in het **actieve** seizoen. Activeer het nieuwe seizoen dus vóór je spelers importeert.
> - Wedstrijden komen in het seizoen van hun **speeldatum**, wat het actieve seizoen ook is. Begint het seizoen pas over een tijd, dan komen de latere wedstrijden pas binnen als je de import later herhaalt.
> - Een import kun je gerust herhalen: nieuwe gegevens worden toegevoegd, bestaande bijgewerkt. Afgelaste wedstrijden en vertrokken spelers worden niet verwijderd.

## Seizoen

- **Actief seizoen**: welk seizoen je ziet in de lijsten van wedstrijden, producties en spelers. Kies er een en klik op **Actief seizoen opslaan**.
- **Seizoen vullen**: de twee imports van hierboven.
- **Nieuw seizoen**: een seizoen aanmaken.
- **Seizoenen**: alle seizoenen met de **Start zaalcompetitie** en het aantal wedstrijden en spelers. Alleen een leeg seizoen dat niet actief is, kun je verwijderen.

> Het actieve seizoen geldt voor **iedereen** tegelijk: wissel je het, dan wisselt het in alle browsers.

### Startdatum zaalcompetitie

De zaalcompetitie begint elk seizoen op een andere dag; het KNKV bepaalt die voor iedereen. Vul hem daarom **elk seizoen** in bij **Seizoenen**, in de kolom **Start zaalcompetitie**: typ de datum als `DD-MM-JJJJ` (bijvoorbeeld `07-11-2026`) en druk op Enter of klik ergens anders. Een rood veld betekent dat de datum niet bestaat; de datum moet ook binnen het seizoen liggen (1 juli t/m 30 juni). Maak het veld leeg om de datum te wissen.

De startdatum geldt voor alle organisaties. De keuze **Zaalcompetitie** bij het importeren gebruikt de startdatum van het **actieve** seizoen.

### Wedstrijden importeren

Bij **Seizoen vullen** (en bij **Stamgegevens → Wedstrijdprogramma → Wedstrijden importeren**) kies je wat je importeert en klik je op **Wedstrijden importeren**:

- **Zaalcompetitie (vanaf …)**: alle wedstrijden vanaf de startdatum van de zaalcompetitie tot het einde van het programma dat de bron al heeft gepubliceerd. Is er geen startdatum, dan staat de keuze uit met *Stel de startdatum van de zaalcompetitie in bij Seizoenen*.
- **Vanaf datum of periode**, met in het veld:
  - een dag als `DD-MM-JJJJ` (bijvoorbeeld `08-02-2026`): alles vanaf die dag tot het einde van het gepubliceerde programma. Een dag in het verleden mag ook.
  - een aantal weken, bijvoorbeeld `30-weeks` (de standaard): geteld vanaf **de huidige week**. Alleen weken werken; `1-days` of `8-months` geven een fout.

Na de import zie je hoeveel wedstrijden er per seizoen zijn binnengekomen, en hoeveel daarvan **nieuw** en **bijgewerkt** zijn.

> Het advies: elk seizoen de startdatum invullen, daarna **Zaalcompetitie** importeren; later opnieuw importeren werkt bij. Een nieuwe import voegt wedstrijden toe die de bron inmiddels heeft gepubliceerd en werkt bestaande wedstrijden bij (tijd, veld, scheidsrechter).

Gaat het mis, dan zie je wat er mis is en wat je kunt doen:

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

## Club & Teams

- **Eigen Club**: de club waarvoor de uitzendingen zijn. Dit bepaalt wat *eigen* en *tegenstander* zijn in interviewnamen als `{coach-tegenstander}`. Het is de club van de organisatie, dezelfde als bij **Overig → Organisaties**: kies je hier een andere, dan verandert hij daar ook (en andersom). Staat je club er niet tussen (omdat hij niet in de League speelt), maak hem dan eerst aan bij **Clubs & spelers → Nieuwe club**.
- **Productie Teams**: de teams van je eigen club waarvan je thuiswedstrijden uitzendt. Alleen hun thuiswedstrijden, plus de handmatige wedstrijden, staan in de lijst bij **Nieuwe productie**. De teams verschijnen pas als de wedstrijden van het actieve seizoen zijn geïmporteerd.

Klik op **Instellingen Opslaan**.

## Koppelingen

- **vMix**: die stel je in bij [Stamgegevens → vMix-koppeling](/admin/handleiding/vmix).
- **Scorebord & Shotclock**: het adres van het scorebord en van de schotklok in de zaal, bijvoorbeeld `http://192.168.1.20:8080`. Hiermee werken het scorebord in LIVE en de zaalklok in de callsheet. Laat je een veld leeg, dan geldt het adres uit de installatie.

## Sponsors

Per vMix-onderdeel kies je welke sponsortypes (premium, goud, zilver, brons, event) meedoen:

- **Sponsor Namen (Ticker & Carrousel)**: de lopende tekst en de logocarrousel.
- **Sponsor Rows (Spelerfoto's)**.
- **Sponsor Slides (Pauze)**.

Alleen sponsors die op **actief** staan, doen mee.

## Backup

Per onderdeel (Personen, Skills, Posities, Wedstrijden, Producties, Clubs, Sponsors, Instellingen, Segment templates) maak je met **Backup** een JSON-bestand, en zet je het met **Restore** terug.

Backup en restore gaan over de **gekozen organisatie** (de naam staat op het tabblad): een backup bevat alleen haar gegevens, en een restore zet ze terug in die organisatie zonder die van andere organisaties aan te raken. Een oude backup van voor de organisaties komt in de gekozen organisatie. **Clubs** (met spelers) zijn gedeeld door alle organisaties. Kies dus eerst de juiste organisatie voor je een restore doet. Het **actieve seizoen** geldt voor de hele installatie: een restore van **Instellingen** verandert het niet. Kies het zo nodig zelf bij **Actief seizoen**.

Een restore **vult aan en werkt bij**, hij wist niets. Bestaande gegevens worden herkend (personen en sponsors op naam, skills op code, posities op naam, wedstrijden op hun code of datum en teams) en overschreven met wat in het bestand staat. Een productie die al bestaat, krijgt de segmenten, titels, interviews en het draaiboek uit het bestand.

> **Niet** in de backup:
> - de API-sleutels en het token van de wedstrijdimport ([Organisaties](/admin/handleiding/organisaties));
> - afbeeldingen (logo's en spelerfoto's): bewaar de map `storage` apart;
> - draaiboek-templates, titel-templates en de standaardbezetting per segment (draaiboek-templates kun je wel los exporteren);
> - de koppelingen tussen posities.
>
> Zet een volledige backup terug in deze volgorde: Skills, Posities, Personen, Clubs, Wedstrijden, Producties, Sponsors, Segment templates, Instellingen.
>
> Een restore van sponsors zet alle sponsors weer op actief.
