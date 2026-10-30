# De callsheet

Tik of klik op een foto om hem groter te maken; nog een keer tikken maakt hem weer klein.

De callsheet laat per positie zien wat jij wanneer moet doen. Hij volgt de actieve productie en loopt live mee met de Show Caller.

## Je positie kiezen

Open **Callsheet** in de menubalk. Je krijgt de tegels **Kies je positie**: eerst **Show Caller** (het hele draaiboek met de knoppen, zie [De Show Caller](/handleiding/show-caller)), dan één per positie die in het draaiboek van deze productie voorkomt. Kies de jouwe; het adres wordt bijvoorbeeld `/callsheet/12/camera-links`. Bewaar dat adres als bladwijzer op je eigen apparaat, dan kom je er de volgende keer direct.

Staat er **Geen posities gevonden voor deze productie**, dan heeft het draaiboek nog geen items met posities. Dat wordt in Beheer ingericht.

## Wat je ziet

Bovenaan staan de ploegen en de **aanvangstijd**, en een klokbalk:

| Klok | Betekenis |
|---|---|
| **Zaal** | De wedstrijdklok van het scorebord in de zaal |
| **Tijd** | De huidige tijd op je apparaat |
| **Resterend** | Hoe lang het actieve item nog duurt |
| **Productie** | Hoe lang de productie al loopt (als er geen item actief is) |

Daaronder staan jouw items onder elkaar, op tijd, verdeeld over de **hoofdstukken** van het draaiboek (bijvoorbeeld *Voorbereiding*, *Voorbeschouwing*, *Eerste helft*, *Rust*). Elk hoofdstuk begint met een kopregel; staat er in een hoofdstuk niets voor jou, dan is het één dunne regel met **— niets voor jou**. Met meer kolommen staan de kopregels op dezelfde hoogte. Per item zie je:

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

## Even niets voor jou

Loopt er in de show een item dat niet voor jouw positie is, dan staat er een **gestippelde regel** in je callsheet, op de plek waar de show nu is:

- **Even niets voor jou**: met daarachter hoe lang het nog duurt tot jouw volgende item (**nog 4:30**), en daaronder **Volgende:** met de titel en begintijd van dat item, en het hoofdstuk waarin het zit.
- **Maak je klaar** (oranje): nog 30 seconden of minder tot jouw volgende item. Is die tijd voorbij maar is de Show Caller nog niet verder, dan blijft de regel oranje zonder tijd. Je item begint pas als de Show Caller verder gaat.
- **Klaar — geen items meer voor jou**: je hebt in deze productie niets meer te doen.

De callsheet scrolt naar deze regel, net als naar een actief item. Met meer kolommen krijgt elke kolom zijn eigen regel.

### Zaal en Stream tegelijk

In de rust lopen de zaal en de stream naast elkaar: in de zaal bijvoorbeeld reclame op het LED-scherm, tegelijk in de stream de analyse. Er kunnen dan **twee items tegelijk** bezig zijn, één in de zaal en één in de stream. Allebei hebben ze een dikke rand en tellen ze hun eigen resterende tijd af. Een zaal-item gaat vanzelf door als zijn tijd om is (of als de Show Caller op **Zaal ›** drukt).

Voor de gestippelde regel tellen beide: loopt er in de zaal of in de stream iets voor jou, dan staat er geen *Even niets voor jou*. Is jouw zaal-item klaar, dan wacht je op je volgende item, meestal het samenkomstpunt waar zaal en stream weer samenkomen (bijvoorbeeld *Start tweede helft*).

## Instellingen voor jouw scherm

Via het **tandwiel** linksboven. Deze instellingen gelden alleen voor jouw scherm:

- **Wissel Positie**: terug naar de positiekeuze.
- **Lettergrootte**: S, M, L of XL. Dit wordt op je apparaat onthouden en geldt ook voor de Show Caller.
- **Interviewfoto's**: **AAN** of **UIT**, de kleine foto's naast de interviewnamen (zie [Interviewfoto's](#interviewfoto-s)). Wordt op je apparaat onthouden.
- **Show Caller**: hetzelfde draaiboek in de Show Caller-weergave (alleen kijken, tenzij je de knoppen gebruikt).
- **Kolommen**: standaard zie je alleen je eigen positie. Zet **2 Posities** of **3 Posities** aan om andere posities ernaast te zien.
- **Positie Instellingen**: kies welke positie in kolom 1, 2 en 3 staat. Zet je kolom 2 aan, dan toont die standaard de Showcaller, zodat je ziet wat er aangekondigd wordt.

> De keuze van kolommen en posities wordt níet onthouden na het herladen. Alleen je hoofdpositie (in het adres), de lettergrootte en **Interviewfoto's** blijven.
>
> Kolom 2 is altijd groen getint. Dat betekent niet dat het om de zaal gaat.

## Interviewnamen

Titels en opmerkingen kunnen een plek voor een interviewnaam bevatten. Die wordt gevuld met de keuze op [Actieve productie](/handleiding/actieve-productie#interviews-kiezen):

| In het draaiboek | Wordt |
|---|---|
| `{speler-thuis}` | Jessica Jansen |
| `{coach-uit:kort}` | J. de Vries |
| `{speler-tegenstander:achternaam}` | de Vries |

*Eigen* en *tegenstander* volgen de eigen club. Zolang er niemand gekozen is, zie je een lichtere tekst als **coach uit**. Een nieuwe keuze verschijnt meteen nadat hij is opgeslagen; is de verbinding even weg, dan binnen ongeveer 10 seconden.

## Interviewfoto's

Naast elke ingevulde interviewnaam staat een kleine foto van die speler of coach, met het rugnummer erachter (bijvoorbeeld **#7**). Dat gaat vanzelf: in het draaiboek hoef je er niets voor in te stellen. Staan er twee namen in een item, dan krijgen ze allebei een foto.

- Geen foto? Dan staat het rugnummer in het rondje.
- Geen rugnummer, of een coach? Dan staan er de initialen, zoals **KC**.
- Nog niemand gekozen? Dan is er geen foto, alleen de lichtere tekst als **coach uit**.

Wil je de foto's niet zien, zet dan in het **tandwiel** onder **Weergave** de knop **Interviewfoto's** op **UIT**. Die keuze wordt op je apparaat onthouden (net als de lettergrootte) en geldt ook voor de Show Caller. Standaard staan de foto's **AAN**.

Alle gekozen interviews in het groot zie je op het scherm [Interviews](/handleiding/interviews).

## Niet bij de les?

De callsheet is alleen om te lezen: wat je hier aanklikt, verandert niets aan de show. Doorgaan naar het volgende item doet de Show Caller.
