# Proposal: chapters

## Why

A production has two timelines that don't know each other. **Segments** (Voorbeschouwing, Eerste helft, Rust, …) have their own durations and anchor, chosen from a segment template. The **draaiboek** (callsheet items) has its own durations and anchors, chosen from a draaiboek template. Applying a draaiboek leaves every item without a segment, and a segment of 35 minutes can hold items of 40. The end of the livestream comes from the segments, but LIVE runs only on the items. Standard positions hang on a segment *name* for the whole organization.

The crew thinks in one run of show: the checks, the pre-show, the warm-up, the halves. That should be one timeline, kept in one place.

## What changes

- **Hoofdstukken** become the parts of the draaiboek. Every item belongs to exactly one, e.g. *Voorbereiding* (checklist: is everything connected), *Voorbeschouwing*, *Oplopen*, *Eerste helft*, *Rust*, *Tweede helft*, *Nabeschouwing*.
- A hoofdstuk has **no duration of its own**: start, end and duration follow from its items. The anchor stays on an item. The livestream ends with the last item.
- **One editor** for templates and a production's draaiboek: hoofdstukken as blocks, items dragged within and between them, standard positions per hoofdstuk.
- **LIVE** shows hoofdstukken as headings, not steps: the Show Caller shows the current hoofdstuk and its remaining time, the phone a label above *Nu*, and the callsheet folds a hoofdstuk without own items into one line. Show control is unchanged.
- **Reports** follow the hoofdstukken; "Crewrapport" is renamed **Callsheet**.
- **Segment templates** and **Standaardbezetting per segment** go away; their content moves into the draaiboek templates.
- **Migration**: segments become the production's hoofdstukken, items are placed by their start time, templates get hoofdstukken from the default segment template; Beheer asks to check what was placed automatically.

## Crew workflow

Beheer: choose one draaiboek, and hoofdstukken, items and standard positions come with it. LIVE: the same buttons, plus where in the show you are. The standard set gets the Korfbal League draaiboek with hoofdstukken (Rust 10 minutes, halves 35 minutes).

## Out of scope

The production format with minimum/optimum staffing and a red/orange/green status (a later change building on this), and hoofdstuk names in the vMix callsheet push.
