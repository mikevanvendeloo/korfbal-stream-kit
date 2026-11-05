# Spec Delta

## Purpose

The venue-bridge runs at the venue and is the only part that talks to the venue network: it reads the scoreboard, the shot clock and the statistics PC, carries out vMix commands, and connects out to the central API, with a cached configuration and a fallback API for when the cloud is out of reach.

## ADDED Requirements

### Requirement: Local start settings
The bridge SHALL take only its start settings locally, from environment variables: `API_URL`, `API_KEY`, `BRIDGE_NAME`, the folders `STATS_DIR` and `COPY_DIR`, `PORT`, `HOST`, `CONFIG_FILE` (default `/data/venue-bridge.json`) and `LOG_LEVEL`. Without `API_URL` or `API_KEY` it SHALL exit with a non-zero code; it SHALL never log the API key.

#### Scenario: Missing key
- **WHEN** the bridge starts without `API_KEY`
- **THEN** it logs "API_KEY ontbreekt" and exits with a non-zero code

### Requirement: Configuration from the API, cached
The bridge SHALL get its venue configuration — scoreboard and shot clock URLs, statistics settings (page URL, database path, database on/off, share host, keep copy), vMix instances and which instance each function uses — from the API when it connects and whenever the API sends a new one, apply it without a restart, and store it in the cache file.

#### Scenario: Changed in the kit
- **WHEN** someone changes the shot clock URL in Instellingen while the bridge is connected
- **THEN** the bridge reads the shot clock at the new URL from its next round

#### Scenario: Cloud down at start
- **WHEN** the bridge starts and the API cannot be reached
- **THEN** it reads the devices, carries out nothing for the API, and serves the fallback API with the configuration from the cache file

### Requirement: Safe cache writes
The bridge SHALL validate a configuration before applying it, write the cache to a temporary file and rename it (mode 600). An invalid configuration from the API SHALL be refused and reported back; an invalid or unreadable cache file at start SHALL leave the bridge without venue configuration until the API sends one, with the reason in the log.

#### Scenario: Corrupt cache
- **WHEN** the cache file holds invalid JSON at start
- **THEN** the bridge logs "Configuratie ongeldig", reads no devices, and applies the configuration the API sends on connect

### Requirement: Outbound connection
The bridge SHALL open one outbound socket.io connection to the API's venue-bridge namespace with its API key (`auth.key`), name, version and the address of its page, and reconnect by itself with a growing delay (1 s up to 30 s). It SHALL need no inbound port for this.

#### Scenario: API unreachable
- **WHEN** the API cannot be reached
- **THEN** the bridge keeps reading the devices and serving the fallback API, and retries with a delay of at most 30 s

#### Scenario: Key refused
- **WHEN** the API refuses the handshake with `API_KEY_INVALID`
- **THEN** the page shows "Ongeldige API-sleutel" and the bridge retries at the longest delay

### Requirement: Reading the scoreboard and shot clock
Every second the bridge SHALL read `<scoreboard>/score-as-array` (stand), `<scoreboard>/time-as-array` (zaalklok) and `<shotclock>/time-as-array`, each with a wall-clock deadline of 800 ms and an answer of at most 4 KB. A device still busy from the previous round SHALL be skipped; an answer that is not a JSON array SHALL count as `invalid`.

#### Scenario: Slow scoreboard
- **WHEN** the scoreboard does not answer within 800 ms
- **THEN** that reading is `unreachable`, and the shot clock is read and sent as usual

#### Scenario: Not an array
- **WHEN** the shot clock answers `{"time": 12}`
- **THEN** the reading is `invalid` and no value is sent

### Requirement: Sending device readings
The bridge SHALL send a reading per device (`score`, `clock`, `shotclock`) as `{device, ok, data, error, readAt}`, `data` being the device's array unchanged and `error` one of `unreachable`, `invalid`, `not-configured`. It SHALL send a reading when it differs from the last one sent, and every reading again at least every 5 s.

#### Scenario: Clock runs
- **WHEN** the zaalklok goes from `["15","34"]` to `["15","33"]`
- **THEN** the bridge sends `{device: "clock", ok: true, data: ["15","33"]}` within a second

#### Scenario: Clock stopped
- **WHEN** the zaalklok stays at `["15","33"]`
- **THEN** the bridge sends the same reading again at least every 5 s

### Requirement: Answering statistics requests
The bridge SHALL answer each statistics request `{path}` from the API with `{status, headers, body}`, the same answer its statistics routes (`/status`, `/live`, `/live/players`, `/matches`, `/matches/:table/actions`, `/matches/:table/players`, `/players`, `/current/players`, `/team-stats`, `/top-scorers`, `/analysis`) give for that path and query. Other paths SHALL get 404.

#### Scenario: Unknown path
- **WHEN** the API asks `/../etc/passwd`
- **THEN** the bridge answers 404 and reads no file

### Requirement: Statistics behaviour unchanged
The bridge SHALL read the statistics PC as the former statistics bridge did: page parser and caps, share access rules (relative paths only, `.mdb`/`.accdb`/`.html`, size limit, one operation at a time with a 3 s deadline, down window), the local copy, the switch to leave the database alone, the database worker with its 10 s limit, and the `X-Stats-*` answer headers.

#### Scenario: Database switched off
- **WHEN** the database is switched off and the API asks `/matches`
- **THEN** the answer is one synthetic `live` entry with `source: 'page'`, as before

### Requirement: Carrying out vMix commands
The bridge SHALL carry out vMix requests from the API on the instance its configuration gives for the function (`callsheet`, `countdown`) or the instance the request names: function calls (`Function`, `Input`, `SelectedName`, `Value`) and reading the inputs. Each call SHALL have a wall-clock deadline (1.5 s for a function, 2 s for the inputs) and a size cap, and SHALL answer `{ok}` or `{ok: false, error}` without the vMix address.

#### Scenario: Countdown
- **WHEN** the API asks the countdown function with `SetCountdown` and `Value` `00:30`
- **THEN** the bridge calls the countdown instance's Web Controller and answers `{ok: true}`

#### Scenario: vMix off
- **WHEN** the callsheet instance does not answer within 1.5 s
- **THEN** the bridge answers `{ok: false, error: 'unreachable'}`

### Requirement: Fallback API on the venue network
The bridge SHALL serve `GET /api/scoreboard`, `/api/scoreboard/clock`, `/api/scoreboard/shotclock`, `/api/stats/*` and `POST /api/vmix/set-timer` with the same paths, answers and API key (`?key=` or `X-Api-Key`) as the central API, from its own readings and cached configuration, so a vMix data source or Stream Deck button only needs another host. A missing key SHALL get 401 `API-sleutel ontbreekt`, a wrong one 401 `Ongeldige API-sleutel`.

#### Scenario: Internet down
- **WHEN** the API is out of reach and vMix asks `http://<bridge>:3340/api/scoreboard/shotclock?key=<key>`
- **THEN** the bridge answers the current shot clock with `color`, as the API would

#### Scenario: No key
- **WHEN** `/api/scoreboard` is asked on the bridge without a key
- **THEN** the bridge answers 401 `API-sleutel ontbreekt`

### Requirement: Page of the bridge
The bridge SHALL serve a page at `/` with the status — API connection, when the configuration was last received, per device and vMix instance the state and the age of the last reading, and the fallback addresses — readable by anyone on the venue network without secrets (the key masked). It SHALL look like the kit and work at 360 px wide.

#### Scenario: Cloud down
- **WHEN** the API connection is down
- **THEN** the page shows "Niet verbonden met de API", the time of the last received configuration and the fallback addresses

### Requirement: Health
The bridge SHALL answer `GET /health` without a key with `{ok, connected, devices}`, for the container health check.

#### Scenario: Health while the API is down
- **WHEN** the API connection is down
- **THEN** `/health` answers 200 with `connected: false`
