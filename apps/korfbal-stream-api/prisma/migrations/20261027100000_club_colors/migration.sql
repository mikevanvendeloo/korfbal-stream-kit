-- Two base colours per club (#rrggbb), e.g. Fortuna red and white, for vMix. Clubs are global.
ALTER TABLE "Club" ADD COLUMN "primaryColor" TEXT;
ALTER TABLE "Club" ADD COLUMN "secondaryColor" TEXT;
