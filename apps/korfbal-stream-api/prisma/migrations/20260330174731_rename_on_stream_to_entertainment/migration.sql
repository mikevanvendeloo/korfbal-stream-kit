/*
  Warnings:

  - The values [on_stream] on the enum `SkillType` will be removed. If these variants are still used in the database, this will fail.

*/

-- 1. Create the new enum type
CREATE TYPE "SkillType_new" AS ENUM ('crew', 'entertainment');

-- 2. Add a new temporary column with the new type
ALTER TABLE "public"."Capability" ADD COLUMN "type_new" "SkillType_new" NOT NULL DEFAULT 'crew';

-- 3. Copy data from the old column to the new column, mapping 'on_stream' to 'entertainment'
UPDATE "public"."Capability"
SET "type_new" = CASE
    WHEN "type"::text = 'on_stream' THEN 'entertainment'::"SkillType_new"
    ELSE "type"::text::"SkillType_new"
END;

-- 4. Drop the old column and the old enum type
ALTER TABLE "public"."Capability" DROP COLUMN "type";
DROP TYPE "public"."SkillType";

-- 5. Rename the new column to the old name
ALTER TABLE "public"."Capability" RENAME COLUMN "type_new" TO "type";

-- 6. Rename the new enum type to the original name
ALTER TYPE "SkillType_new" RENAME TO "SkillType";

-- 7. Set the default value for the renamed column
ALTER TABLE "public"."Capability" ALTER COLUMN "type" SET DEFAULT 'crew';
