CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS "Device" (
  "id" TEXT NOT NULL,
  "externalDeviceKey" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);


CREATE UNIQUE INDEX IF NOT EXISTS "Device_externalDeviceKey_key"
  ON "Device"("externalDeviceKey");

CREATE TABLE IF NOT EXISTS "LocationEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "position" geography(Point,4326),
  "accuracyM" DOUBLE PRECISION,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sequence" INTEGER,
  "provider" TEXT,
  "altitudeM" DOUBLE PRECISION,
  "speedMps" DOUBLE PRECISION,
  "bearingDeg" DOUBLE PRECISION,
  "platformVersion" TEXT,
  "mockLocationIndicator" BOOLEAN,
  CONSTRAINT "LocationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LocationEvent_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LocationEvent_eventId_key"
  ON "LocationEvent"("eventId");
CREATE INDEX IF NOT EXISTS "LocationEvent_deviceId_capturedAt_idx"
  ON "LocationEvent"("deviceId", "capturedAt");
CREATE INDEX IF NOT EXISTS "LocationEvent_position_gist_idx"
  ON "LocationEvent" USING GIST ("position");

CREATE TABLE IF NOT EXISTS "LatestLocation" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracyM" DOUBLE PRECISION,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "freshnessStatus" TEXT NOT NULL,
  CONSTRAINT "LatestLocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LatestLocation_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LatestLocation_deviceId_key"
  ON "LatestLocation"("deviceId");
CREATE UNIQUE INDEX IF NOT EXISTS "LatestLocation_eventId_key"
  ON "LatestLocation"("eventId");

UPDATE "LocationEvent"
SET "position" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
WHERE "position" IS NULL;
