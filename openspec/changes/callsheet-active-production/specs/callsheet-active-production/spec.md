# Spec Delta

## Purpose

The LIVE callsheet and show caller always show the organization's active production, at addresses without a production id, and follow a change of the active production on every open screen without a reload.

## ADDED Requirements

### Requirement: Addresses without a production
The LIVE callsheet SHALL be at `/callsheet` (position choice) and `/callsheet/<positie>`, the show caller at `/show-caller` (all items) and `/show-caller/<positie>`. These addresses SHALL NOT contain a production id and SHALL NOT redirect to one.

#### Scenario: Callsheet entry
- **WHEN** a crew member opens `/callsheet` while production 12 is active
- **THEN** the position choice of production 12 is shown and the address stays `/callsheet`

#### Scenario: Position callsheet
- **WHEN** `/callsheet/camera-links` is opened
- **THEN** the callsheet of camera links in the active production is shown at that address

### Requirement: Always the active production
These screens SHALL show the active production of the organization. Without an active production they SHALL show "Geen actieve productie".

#### Scenario: No active production
- **WHEN** `/callsheet/camera-links` is opened and the organization has no active production
- **THEN** "Geen actieve productie" is shown

### Requirement: Live switch on activation
When another production is activated, the API SHALL emit `active_production_changed` with its id to the organization only, and every open callsheet and show caller SHALL switch to that production without a reload.

#### Scenario: Another production activated
- **WHEN** production 13 is activated while a callsheet of production 12 is open
- **THEN** the open callsheet shows production 13 at the same address

#### Scenario: Other organizations
- **WHEN** organization A activates a production
- **THEN** sockets of organization B receive no `active_production_changed`

### Requirement: Old bookmarks
An address whose first segment after `/callsheet` or `/show-caller` is only digits SHALL be rewritten once, replacing the history entry, to the address without that segment (`/show-caller/12/all` to `/show-caller`).

#### Scenario: Old callsheet bookmark
- **WHEN** `/callsheet/12/camera-links` is opened
- **THEN** the address becomes `/callsheet/camera-links` and shows the active production

### Requirement: Open in LIVE from Beheer
Beheer SHALL offer "Open in LIVE" only for the active production; for another production it SHALL be disabled with the explanation "Activeer deze productie om hem in LIVE te openen".

#### Scenario: Non-active production
- **WHEN** a production that is not active is opened in Beheer
- **THEN** "Open in LIVE" is disabled with that explanation
