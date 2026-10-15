# Draaiboek-templates

Onder **Draaiboeken** staan de onderdelen die je bij elke productie opnieuw gebruikt:

- **Draaiboek-templates**: de callsheet met alle items (wie doet wat, hoe lang).
- **Segment-templates**: de blokken van de uitzending (voorbeschouwing, eerste helft, rust, …) met hun duur.
- **Standaardbezetting per segment**: welke posities je per segment voorstelt bij het inplannen.

Je richt dit één keer in en past het per productie toe.

## Draaiboek-templates

Een draaiboek-template is een lijst items, zoals *Livestream starten*, *Presentator heet publiek welkom* of *Opkomst spelers*. Met **Nieuw Draaiboek** maak je een lege template; met **Bekijken / Bewerken** open je er een.

Per item stel je in:

| Veld | Betekenis |
|---|---|
| **Volgorde** | De plek in de lijst. Een nummer dat al bestaat schuift de volgende items één op. Je kunt items ook verslepen. |
| **Titel** en **Notitie** | Wat er gebeurt. Hierin mag je [interviewnamen](#interviewnamen) gebruiken. |
| **Duur (seconden)** | Hoe lang het item duurt |
| **Zaal** / **Stream** | Of het in de zaal en/of in de livestream te zien is |
| **Tijd Anchor** | Het ijkpunt van het schema: *Wedstrijd starttijd* of *Livestream start*. Alle andere tijden worden daar vóór of na gerekend. Eén item per draaiboek. |
| **Auto Advance** | Het item gaat in LIVE vanzelf door naar het volgende als de duur om is |
| **Koppel aan item (Parent)** | Een item dat tegelijk met een ander item gebeurt (in LIVE ernaast getoond) |
| **Posities** | Voor wie het item is. **Showcaller** staat altijd aan. |

Met **Item toevoegen** komt er onderaan een nieuw item van 60 seconden bij.

### Importeren en exporteren

Met **Excel Import** of **JSON Import** maak je een template uit een bestand. Vul eerst een naam in; pas daarna kun je een bestand kiezen. Via de knoppen op een kaart exporteer je een template naar Excel of JSON.

In Excel staan per regel: Volgorde, Titel, Notitie, Duur (sec), Tijd Anchor (JA/NEE), Anchor Type (MATCH_START of LIVESTREAM_START), Auto Advance (JA), Zaal (JA), Stream (NEE om uit te zetten). Daarna één kolom per positie, met precies de naam van de positie als kop, en een X bij de items voor die positie.

> - Een kolom met een positienaam die niet bestaat, wordt zonder melding overgeslagen.
> - Excel neemt geen gekoppelde items (parent) mee; JSON wel.
> - Een naam die al bestaat geeft geen foutmelding: er gebeurt dan niets. Kies een andere naam.

### Interviewnamen

In titels en notities kun je een plek voor een interviewnaam typen. Die wordt in LIVE en vMix gevuld met de interviewkeuze van de productie:

| Typ | Wordt |
|---|---|
| `{speler-thuis}` | de gekozen speler/speelster van de thuisploeg, volledige naam |
| `{coach-uit:kort}` | de coach van de uitploeg, als *J. de Vries* |
| `{speler-tegenstander:achternaam}` | de speler van de tegenstander, als *de Vries* |

Kies **thuis** of **uit**, of **eigen** en **tegenstander**: die laatste twee volgen de eigen club (bij **Instellingen**), zodat hetzelfde draaiboek werkt voor thuis- én uitwedstrijden.

## Segment-templates

Een segment-template is een rijtje blokken met hun duur, bijvoorbeeld *Voorbeschouwing 20 min, Oplopen 10, Eerste helft 35, Rust 10, Tweede helft 35, Nabeschouwing 20*. Eén segment is het **tijdsanker** (meestal *Eerste helft*): dat begint op de aanvangstijd van de wedstrijd.

- **Nieuwe Template** maakt een template; **Segment Toevoegen** voegt onderaan een segment toe.
- **Maak Standaard**: deze template krijgt elke nieuwe productie automatisch. Er is één standaard.
- Met het potlood hernoem je een segment of wijzig je de duur; met **Markeer als tijdsanker** zet je het anker.

> De volgorde van segmenten kun je hier niet wijzigen: nieuwe segmenten komen onderaan. Verwijder je de standaard-template, dan krijgt een nieuwe productie een vaste indeling van zes segmenten.

## Standaardbezetting per segment

Hier leg je per segmentnaam vast welke posities je meestal nodig hebt, bijvoorbeeld bij *Eerste helft*: Camera overzicht, Camera links, Camera rechts, Regie livestream, Commentaar. Op het tabblad **Bezetting** van een productie verschijnen die posities dan als snelkeuzeknoppen.

- Kies bij **Kies segment** een segmentnaam, of typ een nieuwe bij **Of nieuw segment**. **Algemeen** geldt voor segmenten zonder eigen lijst.
- Voeg posities toe uit de **Catalogus** en zet ze met de pijlen in volgorde.
- Druk op **Opslaan**: pas dan is de lijst bewaard.

> De lijst hoort bij de **exacte** segmentnaam. Er wordt niemand automatisch ingepland: het zijn alleen voorstellen.
