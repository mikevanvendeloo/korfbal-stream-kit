-- A sponsor's logo is set by an upload (sponsors/<organizationId>/<file>) and is no longer derived
-- from its name, so a sponsor without an upload has none. Existing rows keep their (legacy) file name.
ALTER TABLE "Sponsor" ALTER COLUMN "logoUrl" DROP NOT NULL;
