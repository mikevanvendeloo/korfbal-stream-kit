# Spec: production-activation

## Overview

Only one production can be active at a time. Activating a production wires it into the in-memory live state, enabling clocks, show control, and Socket.io broadcasts for that production.

## Requirements

### Activate Production
- `POST /api/production/:id/activate`
- In a single DB transaction: sets all productions `isActive=false`, then sets the target `isActive=true`
- Calls `productionState.setActiveProduction(id)` to update in-memory state
- If another production was previously active, calls `productionState.stopProduction()` first to stop its clock
- Returns the updated Production

### Active Production Context
- Routes that operate on the "active production" (show control, vMix feeds) read `productionState.productionId`
- If no production is active, these routes return 404 or empty responses

## Constraints

- Activation is transactional — partial states (two active productions) are impossible
- In-memory state is reset on server restart; the DB flag persists
- A deactivated production retains all its data (events, crew, callsheets) unchanged
