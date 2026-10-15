# Proposal: organizations

## Why

StreamKit was built for one club: Fortuna/Ruitenheer. Other clubs, and the KNKV, want to make their own productions with it on the same installation. Today everything is shared: one list of matches, one set of sponsors, crew, positions and templates, one set of settings, and one active production for the whole server. A second club would see and change Fortuna's data, and two clubs that broadcast on the same Saturday would control each other's show.

## What changes

- A new **organization** (club or federation) owns its productions, matches, match import, sponsors, crew, positions, skills, templates and settings. Clubs, players, player images and seasons stay shared (KNKV reference data).
- **Choosing the organization**: a start screen shows large buttons, with logos, for the active organizations. The choice is remembered on the device, and the URLs are the same for every organization. Later, logging in will set the organization from your account; people with a role at more than one organization will see the same choice.
- **Live per organization**: one active production per organization, with its own live state, clocks and Socket.io room.
- **Match import per organization**: each organization configures its own source (now the volunteer system, later Sportlink) in Beheer.
- **API keys per organization** for vMix and other feeds that can't choose an organization themselves.
- **Standard set**: a new organization starts with the standard positions, skills, title templates, callsheets and segment templates.
- **Backup/restore per organization.**
- The migration creates **Fortuna** (all existing data) and **KNKV** (empty, with the standard set).

## Crew workflow

Nothing changes for the crew of an existing club, apart from choosing the club once per device. vMix data sources need the club's API key once.

## Out of scope (later steps of the multi-tenant design)

Login (better-auth) and roles; storing live state in the database; Row Level Security; shared productions; the crew pool; the venue agent.
