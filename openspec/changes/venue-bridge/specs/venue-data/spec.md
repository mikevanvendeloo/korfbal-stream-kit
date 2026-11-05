# Spec Delta

## Purpose

The API side of the venue: it accepts one venue-bridge connection per organization, keeps the latest scoreboard, zaalklok and shot clock readings for LIVE and the data sources, sends statistics questions and vMix commands through the bridge, and reports whether the venue is connected.

## ADDED Requirements

### Requirement: Bridge connection authenticated by API key
The API SHALL accept venue-bridge connections on a socket.io namespace of its own, separate from the browser clients. The handshake SHALL carry an organization API key (`auth.key`, the `X-Api-Key` header or `?key=`); the key's organization owns the connection. A key SHALL never be logged.

#### Scenario: No key
- **WHEN** a bridge connects without a key
- **THEN** the handshake is refused with `connect_error` `API-sleutel ontbreekt` and `data.code` `API_KEY_MISSING`

#### Scenario: Revoked key
- **WHEN** a bridge connects with a revoked key or a key of an inactive organization
- **THEN** the handshake is refused with `API_KEY_INVALID`

#### Scenario: Browser page of another site
- **WHEN** a page on another host opens the bridge namespace with a valid key
- **THEN** the handshake is refused by the same-origin rule, as for every socket

### Requirement: One bridge per organization
The API SHALL keep at most one connected bridge per organization: a new connection SHALL replace the previous one, which is disconnected. A bridge SHALL only ever deliver data for, and answer requests of, the organization of its key.

#### Scenario: Second bridge
- **WHEN** a second bridge connects with a key of the same organization
- **THEN** the first one is disconnected and the second one is used from then on

#### Scenario: Two organizations
- **WHEN** organizations A and B each have a bridge and A's bridge sends a zaalklok
- **THEN** only A's `/api/scoreboard/clock` and A's live clients get it

### Requirement: Accepting device readings
The API SHALL accept readings `{device, ok, data, error, readAt}` for `score`, `clock` and `shotclock` from a connected bridge, keep the latest reading per device per organization in memory with the time it arrived, and drop a reading that is not of that shape or larger than 4 KB.

#### Scenario: Malformed reading
- **WHEN** a bridge sends `{device: "clock", ok: true, data: "15:34"}`
- **THEN** the reading is ignored and the previous one stays

### Requirement: A reading is current for 10 seconds
A device reading SHALL count as current when it is `ok` and arrived less than 10 s ago and its bridge is still connected; otherwise the device SHALL count as unavailable.

#### Scenario: Bridge disconnects
- **WHEN** the bridge disconnects
- **THEN** every device of that organization is unavailable at once

#### Scenario: Readings stop
- **WHEN** the last `shotclock` reading arrived 11 s ago
- **THEN** the shot clock is unavailable

### Requirement: Scoreboard routes from the venue data
`GET /api/scoreboard`, `/api/scoreboard/clock` and `/api/scoreboard/shotclock` SHALL keep their URLs, feed-key access and answers: the current device array (the shot clock items with `color`: `red` at 10 s or less, `orange` at 15 s or less, else `green`), or 502 `Failed to fetch scoreboard`, `Failed to fetch scoreboard clock`, `Failed to fetch shotclock` when the device is unavailable.

#### Scenario: Shot clock at 12
- **WHEN** the current shot clock reading is `[{"time": "12"}]`
- **THEN** `/api/scoreboard/shotclock` answers `[{"time": "12", "color": "orange"}]`

#### Scenario: No bridge
- **WHEN** the organization has no connected bridge
- **THEN** `/api/scoreboard` answers 502 `{error: 'Failed to fetch scoreboard'}`

### Requirement: Zaalklok from the venue data
A current `clock` reading SHALL update the venue clock of the organization's running show as `MM:SS` (`["15","34"]` or `[{minute, second}]`), with `venue_clock_update` only when the time changed. Without a running show the reading SHALL only be kept. The manual routes `POST /api/show/clock` and `POST /api/time/venue-clock` SHALL stay.

#### Scenario: Show runs
- **WHEN** the show runs and a reading `["15","34"]` arrives after `["15","35"]`
- **THEN** the live clients get `venue_clock_update {scoreboardTime: "15:34"}`

### Requirement: Statistics over the bridge
`/api/stats/*` SHALL keep its URLs, feed-key access, `?team=` of the active production and `X-Stats-*` headers, and ask the organization's bridge over its connection: a deadline of 5 s, answers up to 10 MB, a 200 reused for 2 s per path, one request per path at a time. No connected bridge, no answer in time or a malformed answer SHALL give 503 `VENUE_BRIDGE_OFFLINE`.

#### Scenario: Bridge answers late
- **WHEN** the bridge does not answer `/api/stats/live` within 5 s
- **THEN** the API answers 503 `{error: 'De venue-bridge is offline', code: 'VENUE_BRIDGE_OFFLINE'}`

#### Scenario: Bridge's own refusal
- **WHEN** the bridge answers 503 `{error: 'De analyse heeft het statistiekenbestand nodig'}`
- **THEN** the API answers 503 with that message

### Requirement: Bridge status
`GET /api/venue-bridge/status` (organization or feed key) SHALL answer `{connected, name, version, pageUrl, connectedAt, config: {state: 'applied' | 'refused' | 'pending', error}, devices: {score, clock, shotclock}}`, each device `{state: 'ok' | 'unreachable' | 'invalid' | 'not-configured' | 'no-data', ageMs}`. `GET /api/stats/status` SHALL keep its shape.

#### Scenario: Connected without shot clock
- **WHEN** the bridge is connected and reports the shot clock as not configured
- **THEN** the status shows `connected: true` and `shotclock.state: 'not-configured'`

### Requirement: Bridge status pushed to the kit
The API SHALL emit `venue_bridge_status`, with the body of the status route, to the organization's clients when the connection, the configuration state or a device state changes, and not when only an age changes.

#### Scenario: Bridge disconnects
- **WHEN** the organization's bridge disconnects
- **THEN** its clients get `venue_bridge_status` with `connected: false`

#### Scenario: Clock keeps ticking
- **WHEN** only new `clock` readings arrive and every device stays `ok`
- **THEN** no `venue_bridge_status` is emitted

### Requirement: vMix commands through the bridge
The API SHALL send every vMix call — the automatic callsheet push, `POST /api/vmix/callsheet/push`, `GET /api/vmix/inputs` and `POST /api/vmix/set-timer` — to the organization's bridge, which carries it out. These routes SHALL keep their URLs, access and answers; without a connected bridge they SHALL answer 503 `VENUE_BRIDGE_OFFLINE`, and the automatic push SHALL skip the organization.

#### Scenario: Stream Deck countdown
- **WHEN** a Stream Deck posts `/api/vmix/set-timer?key=<key>` with `{seconds: 30}` and the bridge is connected
- **THEN** the bridge sets the countdown to `00:30` and the API answers as before

#### Scenario: No bridge
- **WHEN** the callsheet push runs for an organization without a connected bridge
- **THEN** nothing is sent and no error is logged more than once per disconnect

### Requirement: Venue configuration sent to the bridge
The API SHALL send the organization's venue configuration — `scoreboardUrl` and `shotclockUrl` (scoreboard config), the statistics settings and the vMix instances with their targets — to its bridge when the bridge connects and within a second after any of these settings is saved. The configuration SHALL never contain an API key or another organization's data.

#### Scenario: On connect
- **WHEN** a bridge connects
- **THEN** it receives the current venue configuration of the organization of its key

#### Scenario: Saved in the kit
- **WHEN** someone saves new vMix instances in Instellingen while the bridge is connected
- **THEN** the bridge receives the new configuration within a second

#### Scenario: Bridge refuses it
- **WHEN** the bridge answers that the configuration is invalid
- **THEN** the bridge status shows the configuration as refused with the bridge's reason

### Requirement: Statistics settings
`GET|PUT /api/settings/match-stats` SHALL hold the statistics settings for the bridge: `pageUrl` (http(s) or a relative `.html` path), `mdbPath` (relative, `{team}` allowed, `.mdb`/`.accdb`), `mdbEnabled`, `shareHost` and `keepCopy`, validated with zod. The former `bridgeUrl` and bridge token SHALL be gone.

#### Scenario: Path outside the share
- **WHEN** `mdbPath` `../WEDSTRIJDEN.mdb` is saved
- **THEN** the API answers 400 and keeps the old settings

### Requirement: No direct venue access
The API SHALL NOT call the scoreboard, the shot clock, the statistics PC or vMix itself; it SHALL only keep their addresses as configuration for the bridge. The vMix data sources (vMix reading from the API) SHALL stay in the API.

#### Scenario: Scoreboard URL set, no bridge
- **WHEN** `scoreboardUrl` is set and no bridge is connected
- **THEN** the API makes no request to that URL and `/api/scoreboard` answers 502 `Failed to fetch scoreboard`

#### Scenario: Old statistics settings
- **WHEN** an installation still has `matchStats.bridgeUrl` or `matchStatsBridgeToken` stored
- **THEN** the API ignores them and a settings backup leaves them out

### Requirement: Venue tab in Instellingen
Instellingen SHALL have a tab "Venue" with the venue-bridge status (connection, name, version, configuration state, per device state and age, link to the bridge page) and the venue configuration: scoreboard and shot clock addresses, the statistics settings and the vMix instances with their functions. These settings SHALL leave the tabs they are on now.

#### Scenario: Open the tab
- **WHEN** the user opens Instellingen → Venue
- **THEN** the bridge status is on top and the scoreboard, statistics and vMix settings below it

### Requirement: Bridge indicator in Beheer
Beheer SHALL show in its top bar whether the organization's venue-bridge is connected ("Bridge verbonden" or "Bridge offline"), updated live from `venue_bridge_status`, linking to Instellingen → Venue. At 360 px it SHALL show the coloured dot only, with the text for screen readers.

#### Scenario: Bridge drops
- **WHEN** the bridge disconnects while Beheer is open
- **THEN** the indicator turns to "Bridge offline" without a reload
