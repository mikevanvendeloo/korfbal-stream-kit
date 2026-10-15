# Instellingen en een nieuw seizoen

De instellingen open je met het **tandwiel** rechtsboven, of door op het label **Seizoen …** te klikken. Er zijn vijf tabbladen: **Seizoen**, **Club & Teams**, **Koppelingen**, **Sponsors** en **Backup**.

## Een nieuw seizoen starten

Een seizoen loopt van 1 juli tot en met 30 juni. Wedstrijden, producties en spelers horen bij een seizoen; clubs, personen, posities en sponsors gelden voor alle seizoenen.

Doe het in deze volgorde:

1. **Seizoen → Nieuw seizoen**: vul de naam in (bijvoorbeeld `2026/2027`), laat **Direct activeren** aangevinkt en klik op **Seizoen aanmaken**.
2. **Seizoen vullen → Wedstrijden importeren**: haalt het wedstrijdprogramma op, tot ongeveer 20 weken vooruit vanaf vandaag.
3. **Seizoen vullen → Teams/spelers importeren**: haalt de ploegen en spelers van de Korfbal League op, met foto's.
4. **Club & Teams**: controleer de **Eigen Club** en vink de **Productie Teams** aan.
5. Voeg eventueel [handmatige wedstrijden](/admin/handleiding/stamgegevens#competitie) toe en controleer spelers en foto's bij **Clubs & spelers**.

> - Spelers komen in het **actieve** seizoen. Activeer het nieuwe seizoen dus vóór je spelers importeert.
> - Wedstrijden komen in het seizoen van hun **speeldatum**, wat het actieve seizoen ook is. Begint het seizoen pas over een tijd, dan komen de latere wedstrijden pas binnen als je de import later herhaalt.
> - Een import kun je gerust herhalen: nieuwe gegevens worden toegevoegd, bestaande bijgewerkt. Afgelaste wedstrijden en vertrokken spelers worden niet verwijderd.

## Seizoen

- **Actief seizoen**: welk seizoen je ziet in de lijsten van wedstrijden, producties en spelers. Kies er een en klik op **Actief seizoen opslaan**.
- **Seizoen vullen**: de twee imports van hierboven.
- **Nieuw seizoen**: een seizoen aanmaken.
- **Seizoenen**: alle seizoenen met het aantal wedstrijden en spelers. Alleen een leeg seizoen dat niet actief is, kun je verwijderen.

> Het actieve seizoen geldt voor **iedereen** tegelijk: wissel je het, dan wisselt het in alle browsers.

## Club & Teams

- **Eigen Club**: de club waarvoor de uitzendingen zijn. Dit bepaalt wat *eigen* en *tegenstander* zijn in interviewnamen als `{coach-tegenstander}`. Staat je club er niet tussen (omdat hij niet in de League speelt), maak hem dan eerst aan bij **Clubs & spelers → Nieuwe club**.
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

Een restore **vult aan en werkt bij**, hij wist niets. Bestaande gegevens worden herkend (personen en sponsors op naam, skills op code, posities op naam, wedstrijden op hun code of datum en teams) en overschreven met wat in het bestand staat. Een productie die al bestaat, krijgt de segmenten, titels, interviews en het draaiboek uit het bestand.

> **Niet** in de backup:
> - afbeeldingen (logo's en spelerfoto's): bewaar de map `storage` apart;
> - draaiboek-templates, titel-templates en de standaardbezetting per segment (draaiboek-templates kun je wel los exporteren);
> - de koppelingen tussen posities.
>
> Zet een volledige backup terug in deze volgorde: Skills, Posities, Personen, Clubs, Wedstrijden, Producties, Sponsors, Segment templates, Instellingen.
>
> Een restore van sponsors zet alle sponsors weer op actief.
