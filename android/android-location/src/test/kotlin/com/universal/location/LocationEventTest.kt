package com.universal.location

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.util.UUID

class LocationEventTest {

    @Test
    fun testLocationEventCreationAndUuidPreservation() {
        val uuid = UUID.randomUUID()
        val now = Instant.now()
        val event = LocationEvent(
            eventId = uuid,
            deviceId = "test-device-001",
            capturedAt = now,
            latitude = 23.8103,
            longitude = 90.4125,
            accuracyMeters = 5.0,
            provider = "fused"
        )

        assertEquals(uuid, event.eventId)
        assertEquals("test-device-001", event.deviceId)
        assertEquals(23.8103, event.latitude, 0.00001)
        assertEquals(90.4125, event.longitude, 0.00001)
        assertEquals(5.0, event.accuracyMeters!!, 0.01)
        assertEquals("fused", event.provider)
    }
}
