# Het scorebord

**Scoreboard** toont op een zwart scherm de stand zoals het scorebord in de zaal hem geeft: de ploegen met logo, de score, de wedstrijdklok met de helft, en de schotklok.

## Waar de gegevens vandaan komen

De app leest het scorebord en de schotklok in de zaal uit via het netwerk. De adressen daarvan staan in Beheer bij de instellingen. De score en wedstrijdklok worden elke seconde opgehaald, de schotklok twee keer per seconde.

## Kleuren van de schotklok

- **Groen**: meer dan 15 seconden.
- **Oranje**: 11 tot en met 15 seconden.
- **Rood**: 10 seconden of minder.

## Verbinding met scorebord en schotklok

Onderaan het scherm staat een balk met **● Scorebord** en **● Schotklok**. De wedstrijdklok komt van het scorebord, dus valt onder **Scorebord**.

- **Groene stip**: het apparaat antwoordt.
- **Grijze stip**: de app maakt verbinding (net geopend of na **Reconnect**).
- **Rode stip** met *geen verbinding*: het apparaat gaf drie keer achter elkaar geen antwoord. De app vraagt het dan niet meer op.

Eén gemist antwoord is geen probleem: de laatste stand blijft staan. Pas na drie keer achter elkaar geen antwoord geldt het apparaat als niet verbonden. Dan zie je:

- Schotklok: **UIT**.
- Wedstrijdklok: **-:-**.
- Score thuis en uit: **-**.

Het scorebord en de schotklok zijn aparte apparaten: valt de schotklok uit, dan blijven score en wedstrijdklok gewoon lopen, en andersom.

**Opnieuw verbinden**: zet het apparaat aan of los de netwerkfout op en druk dan op **Reconnect** naast de rode stip. De app probeert het meteen opnieuw. Lukt dat, dan wordt de stip groen en loopt alles weer. Lukt het drie keer niet, dan wordt de stip weer rood.

## Als iets niet klopt

- **UIT**, **-:-** of **-** met een rode stip: zie hierboven. Controleer of het apparaat aan staat en op het netwerk zit, en druk op **Reconnect**.
- **0 – 0** terwijl er al gescoord is: het scorebord geeft (nog) geen stand door.

> De teksten op dit scherm, zoals *Time*, *Home*, *Away* en *1st half*, zijn standaard Engels. Ze kunnen bij de installatie worden aangepast.
