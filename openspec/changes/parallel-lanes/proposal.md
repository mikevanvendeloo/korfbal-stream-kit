# Proposal: parallel-lanes

## Why

In the rust the hall plays commercials on the LED screen while the stream runs the analysis of the first half. Today every item adds to one timeline, so a rust with 3 zaal items and 3 stream items takes the sum of both (15 minutes instead of 10), and parallel items no longer share a start time. Linking items to a parent doesn't help: linked items are laid out end to end too. A hoofdstuk also can't say "the rust takes 10 minutes" without a made-up 10-minute item.

## What changes

- **Zaal and Stream are lanes.** An item with only **Zaal** runs in the hall lane, an item with only **Stream** in the stream lane. An item with both (or neither), a time anchor and the start of a hoofdstuk are **samenkomstpunten**: the lanes split after one and join at the next. Between two samenkomstpunten both lanes start together and each lays out its own items; the next samenkomstpunt starts when the longest lane ends.
- **Minimale duur per hoofdstuk** (optional, empty = as long as its items): Rust 10:00, Eerste/Tweede helft 35:00. The next hoofdstuk starts at the later of *start + minimum* and the end of its items; items that run longer show a notice in the editor.
- **One timing rule** in the API for "Tijden herberekenen", applying a template, the import, the editor's times and the reports.
- **LIVE: Volgend follows the stream.** Zaal-only items run by themselves on their time (with a small **Zaal ›** to move on by hand). A zaal lane that is done early shows a wait row; at a samenkomstpunt **Volgend** warns *Zaal nog m:ss bezig* and, when pressed, ends what still runs in the hall. The time report records the actual times of both lanes.
- **Manual**: how to build a draaiboek with Zaal and Stream as parallel lanes (Beheer 07 and 08), and LIVE 03/04.

## Out of scope

More than two lanes; lanes per position; a second, equal "Volgend Zaal" control.
