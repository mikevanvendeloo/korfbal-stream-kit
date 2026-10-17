-- The own club has one source: Organization.clubId (Beheer → Organisaties and Instellingen → Club).
-- The ownClubId setting goes away: its value is copied to organizations without a club, then removed.
UPDATE "Organization" o
SET "clubId" = c."id"
FROM "OrganizationSetting" s
JOIN "Club" c ON jsonb_typeof(s."value") = 'number' AND c."id" = (s."value")::text::int
WHERE s."organizationId" = o."id" AND s."key" = 'ownClubId' AND o."clubId" IS NULL;

DELETE FROM "OrganizationSetting" WHERE "key" = 'ownClubId';

DELETE FROM "Setting" WHERE "key" = 'ownClubId';
