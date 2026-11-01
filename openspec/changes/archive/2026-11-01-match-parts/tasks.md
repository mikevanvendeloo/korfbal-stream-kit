# Tasks: match-parts

## 1. Database and API

- [x] 1.1 Prisma: `isMatchPart`, `showVenueClock` on `CallSheetTemplateItem`, `CallSheetItem`, `ProductionEvent`; migration
- [x] 1.2 Copy paths: template CRUD and apply, chapter copy, template Excel (two last columns), production callsheet CRUD and sync to events, callsheet files / draaiboek file schema, export/import, backup, standard set (halves marked), OpenAPI in `main.ts`
- [x] 1.3 `services/matchParts.ts` (pure) + unit test
- [x] 1.4 `GET /api/vmix/active-production/match`: `matchPart`, `matchPartRunning`
- [x] 1.5 Integration tests: template → callsheet → events; export/import and backup round trip; match row

## 2. Kit

- [x] 2.1 Types in the hooks (`useCallsheet`, `useCallSheetTemplates`, `useProductions`, `useLiveState`)
- [x] 2.2 Editor: Wedstrijddeel and Zaalklok tonen on the item (template and production callsheet), Wedstrijddeel ticks Zaalklok
- [x] 2.3 `TimeDisplay`: Zaal clock only while a running item has `showVenueClock` (callsheet and show caller)
- [x] 2.4 Specs: editor ticking, TimeDisplay with and without

## 3. Docs

- [x] 3.1 Handleiding: editor chapter, callsheet / show caller (zaalklok), vMix match fields
- [x] 3.2 Security review
