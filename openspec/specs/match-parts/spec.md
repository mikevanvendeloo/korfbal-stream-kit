# match-parts Specification

## Purpose
Lets the draaiboek mark which callsheet items are parts of the match and which show the venue clock, so LIVE shows the venue clock only while the match is played and graphics know which match part is on.

## Requirements

### Requirement: Item choices
A callsheet item (template item, production callsheet item and live item) SHALL have `isMatchPart` and `showVenueClock`, both false by default. The editor SHALL tick Zaalklok tonen when Wedstrijddeel is ticked; the user SHALL be able to untick it.

#### Scenario: New item
- **WHEN** an item is created without these fields
- **THEN** both are false

#### Scenario: Ticking Wedstrijddeel in the editor
- **WHEN** the user ticks Wedstrijddeel on an item
- **THEN** Zaalklok tonen is ticked as well and both are saved

### Requirement: Copied with the item
Both fields SHALL be copied wherever an item is copied: applying a template, syncing a callsheet to LIVE, production export and import, backup and restore, the draaiboek file, the chapter copy and the template Excel. Input without them SHALL read as false.

#### Scenario: Template to LIVE
- **WHEN** a template item with both fields true is applied to a production and its callsheet is synced to LIVE
- **THEN** the live item has both fields true

#### Scenario: Old export
- **WHEN** a production export without these fields is imported
- **THEN** the import succeeds and the items have both fields false

### Requirement: Venue clock only while wanted
LIVE (callsheet and show caller) SHALL show the venue clock only while the running stream item or the running hall item has `showVenueClock`.

#### Scenario: Voorbeschouwing
- **WHEN** the running item does not show the venue clock
- **THEN** the Zaal clock is not shown

#### Scenario: Eerste helft
- **WHEN** the running item has `showVenueClock`
- **THEN** the Zaal clock is shown

### Requirement: Current match part
The current match part SHALL be the number of match-part items of the active production that have started (ACTIVE or COMPLETED), in draaiboek order, and 0 before the first; `matchPartRunning` SHALL tell whether one of them is ACTIVE.

#### Scenario: During the rust
- **WHEN** the first half is COMPLETED and the rust is ACTIVE
- **THEN** `matchPart` is 1 and `matchPartRunning` is false

#### Scenario: Four quarters
- **WHEN** the third of four match-part items is ACTIVE
- **THEN** `matchPart` is 3 and `matchPartRunning` is true

### Requirement: Match data source
`GET /api/vmix/active-production/match` SHALL include `matchPart` and `matchPartRunning`; without an active production they SHALL be 0 and false.

#### Scenario: Second half running
- **WHEN** the second match part is ACTIVE
- **THEN** the row has `matchPart` 2 and `matchPartRunning` true
