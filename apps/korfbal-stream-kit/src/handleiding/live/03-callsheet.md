# De callsheet

De callsheet laat per positie zien wat jij wanneer moet doen. Hij volgt de actieve productie en loopt live mee met de Show Caller.

## Je positie kiezen

Open **Callsheet** in de menubalk. Je krijgt de tegels **Kies je positie**: één per positie die in het draaiboek van deze productie voorkomt. Kies de jouwe; het adres wordt bijvoorbeeld `/callsheet/12/camera-links`. Bewaar dat adres als bladwijzer op je eigen apparaat, dan kom je er de volgende keer direct.

Staat er **Geen posities gevonden voor deze productie**, dan heeft het draaiboek nog geen items met posities. Dat wordt in Beheer ingericht.

## Wat je ziet

Bovenaan staan de ploegen en de **aanvangstijd**, en een klokbalk:

| Klok | Betekenis |
|---|---|
| **Zaal** | De wedstrijdklok van het scorebord in de zaal |
| **Tijd** | De huidige tijd op je apparaat |
| **Resterend** | Hoe lang het actieve item nog duurt |
| **Productie** | Hoe lang de productie al loopt (als er geen item actief is) |

Daaronder staan jouw items onder elkaar, op tijd. Per item zie je:

- de **begintijd** (wordt automatisch bijgesteld als de show uitloopt of voorloopt);
- de **titel** en eventueel een **opmerking**;
- de **duur**;
- labels: **Stream** (te zien in de livestream), **Zaal** (in de zaal), **Link** (hoort bij een ander item) en **Auto** (gaat vanzelf door naar het volgende item; tijdens het aftellen staat er **Auto TIMER**).

Items zonder positie gelden voor iedereen en staan dus in elke callsheet.

## Kleuren

- **Dikke rand**: dit item is nu bezig. In het vak ernaast telt de resterende tijd af.
  - **Groen**: meer dan 10 seconden over.
  - **Oranje**: 10 seconden of minder.
  - **Rood, knipperend**: over tijd; de tijd staat er met een min ervoor.
- **Amber**: het tijdanker, meestal *Start wedstrijd*. Daar wordt het schema op uitgerekend.
- **Lichtblauw**: een item dat aan een ander item gekoppeld is.

Wordt een ander item actief, dan scrolt de callsheet er vanzelf naartoe.

> Als de show gestopt is, kleurt **Productie 00:00** rood en knippert het. Dat is geen alarm.

## Instellingen voor jouw scherm

Via het **tandwiel** linksboven. Deze instellingen gelden alleen voor jouw scherm:

- **Wissel Positie**: terug naar de positiekeuze.
- **Lettergrootte**: S, M, L of XL. Dit wordt op je apparaat onthouden en geldt ook voor de Show Caller.
- **Show Caller**: hetzelfde draaiboek in de Show Caller-weergave (alleen kijken, tenzij je de knoppen gebruikt).
- **Kolommen**: toon **2 Posities** (standaard) of **3 Posities** naast elkaar. Zet je beide uit, dan zie je alleen je eigen positie.
- **Positie Instellingen**: kies welke positie in kolom 1, 2 en 3 staat. Kolom 2 toont standaard de Showcaller, zodat je ziet wat er aangekondigd wordt.

> De keuze van kolommen en posities wordt níet onthouden na het herladen. Alleen je hoofdpositie (in het adres) en de lettergrootte blijven.
>
> Kolom 2 is altijd groen getint. Dat betekent niet dat het om de zaal gaat.

## Interviewnamen

Titels en opmerkingen kunnen een plek voor een interviewnaam bevatten. Die wordt gevuld met de keuze op [Actieve productie](/handleiding/actieve-productie#interviews-kiezen):

| In het draaiboek | Wordt |
|---|---|
| `{speler-thuis}` | Jessica Jansen |
| `{coach-uit:kort}` | J. de Vries |
| `{speler-tegenstander:achternaam}` | de Vries |

*Eigen* en *tegenstander* volgen de eigen club. Zolang er niemand gekozen is, zie je een lichtere tekst als **coach uit**. Een nieuwe keuze verschijnt binnen ongeveer 10 seconden.

## Niet bij de les?

De callsheet is alleen om te lezen: wat je hier aanklikt, verandert niets aan de show. Doorgaan naar het volgende item doet de Show Caller.
