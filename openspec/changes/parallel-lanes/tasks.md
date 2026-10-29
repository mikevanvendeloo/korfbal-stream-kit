# Tasks: parallel-lanes

## Backend
- [ ] `services/laneTimes.ts` + unit tests; `layOutTimes` delegates to it (D1, D2)
- [ ] Migration `minDurationSec` (production + template hoofdstukken); hoofdstuk PUT/POST, apply template, backup, production export/import, draaiboek file carry it; standard set 35/10/35 (D3)
- [ ] Template GET returns `startOffsetSec` per item and start/end/overrun per hoofdstuk; `/timing` and reports use the minimum (D2)
- [ ] LIVE: Volgend/Vorig skip ZAAL events; hall lane auto start/advance; `POST /api/production/:id/venue-next`; `activeVenueEventId` in the snapshot; Volgend at a JOIN ends the hall item; `stopOrganization` clears the timer; `callsheetTiming` (D4)
- [ ] Leak suite, security and integration tests (D6); PROJECT_STRUCTURE.md, CLAUDE.md (time anchoring → lanes)

## Frontend
- [ ] Editor: Minimale duur per hoofdstuk, overrun notice, lane edge on rows; times from the API (`relativeChapterTimes` removed) (D5)
- [ ] Show Caller (wide + phone): hall lane runs by itself, **Zaal ›**, wait row, *Zaal nog m:ss bezig* on Volgend; callsheet per position with the active hall item (D4)
- [ ] Component tests; one e2e (rust with two lanes)
- [ ] Manual: Beheer 07 and 08 ("Zaal en Stream: parallel" with the rust example, Minimale duur), LIVE 03 and 04; GLOSSARY: *Baan*, *Samenkomstpunt*, *Minimale duur*
