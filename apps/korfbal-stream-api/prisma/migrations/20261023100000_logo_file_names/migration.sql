-- Logos: the database stores only the file name; the directory follows from the organization's slug
-- (sponsors/<slug>/<file>, organizations/<slug>.<ext>). The files themselves are moved at startup
-- (services/logoStorage.ts, migrateLogoStorage), which also finds them under the old id paths.

-- Sponsor.logoUrl "<organizationId>/<file>" -> "<file>"; plain (legacy) file names stay as they are
UPDATE "Sponsor" SET "logoUrl" = regexp_replace("logoUrl", '^[0-9]+/', '') WHERE "logoUrl" ~ '^[0-9]+/';

-- Organization.logoUrl "organizations/<id>.<ext>" -> "<slug>.<ext>"
UPDATE "Organization"
SET "logoUrl" = "slug" || lower(substring("logoUrl" from '(\.[A-Za-z0-9]+)$'))
WHERE "logoUrl" ~ '^organizations/[^/]+\.[A-Za-z0-9]+$';
