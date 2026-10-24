ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

ALTER TABLE "Device" DROP CONSTRAINT IF EXISTS "Device_ownerId_fkey";
ALTER TABLE "Device" ADD CONSTRAINT "Device_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "Device_ownerId_idx" ON "Device"("ownerId");
