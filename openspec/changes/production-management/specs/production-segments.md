# Spec: production-segments

## Overview

A Production is divided into named time segments (e.g., Voorbeschouwing, Eerste helft, Rust). Segments are ordered by `volgorde` (sequence number) and have a duration in minutes. One segment can be marked as the time anchor — the reference point for calculating absolute times.

## Requirements

### Segment CRUD
- `GET /api/production/:id/segments` — list ordered by `volgorde`
- `POST /api/production/:id/segments` — create; auto-inserts at correct position by shifting subsequent segments
- `PUT /api/production/:id/segments/:sid` — update name, duration, `volgorde`, `isTimeAnchor`
- `DELETE /api/production/:id/segments/:sid` — delete and renumber remaining segments to close gaps

### Reorder Behavior
- Changing `volgorde` uses a 2-phase DB transaction to avoid unique constraint violations:
  1. Bump conflicting segment's `volgorde` by 1000
  2. Set the new `volgorde` on the target
  3. Renumber all segments sequentially (1, 2, 3, …)

### Time Anchor
- At most one segment per production may have `isTimeAnchor=true`
- Setting `isTimeAnchor=true` on a segment does not automatically clear it from others (managed by the caller)
- The anchor segment's start time corresponds to `production.liveTime` plus the sum of preceding segment durations
- All callsheet and event times are calculated relative to the anchor

### Default Segments
- On production creation, segments are seeded from the default SegmentTemplate (`isDefault=true`)
- Fallback (no default template): 6 segments in order:
  1. Voorbeschouwing — 20 min
  2. Oplopen — 10 min
  3. Eerste helft — 35 min (`isTimeAnchor=true`)
  4. Rust — 10 min
  5. Tweede helft — 35 min
  6. Nabeschouwing — 20 min

## Constraints

- `volgorde` is unique per production (enforced by DB unique constraint)
- Segment durations are in whole minutes
- Deleting a segment does not cascade to callsheet items (items retain their `productionSegmentId` reference)
