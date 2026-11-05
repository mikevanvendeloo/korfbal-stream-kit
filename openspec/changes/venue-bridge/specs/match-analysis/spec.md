# Spec Delta

## MODIFIED Requirements

### Requirement: API forward
The API SHALL forward `GET /api/stats/analysis` to the organization's venue-bridge over its connection, with `?team=` of the active production, like the other statistics routes. It SHALL be a feed route: an organization API key or `X-Organization` is required. Without a connected venue-bridge, or without an answer in time, the API SHALL give 503 `VENUE_BRIDGE_OFFLINE`, and the bridge's own 503 with `error` SHALL pass through.

#### Scenario: Without key or organization
- **WHEN** `/api/stats/analysis` is requested without API key and without `X-Organization`
- **THEN** the API answers 401 `API-sleutel ontbreekt`

#### Scenario: Database message passes through
- **WHEN** the bridge answers 503 `De analyse heeft het statistiekenbestand nodig`
- **THEN** the API answers 503 with the same message

#### Scenario: No venue-bridge
- **WHEN** the organization has no connected venue-bridge
- **THEN** the API answers 503 `{error: 'De venue-bridge is offline', code: 'VENUE_BRIDGE_OFFLINE'}`
