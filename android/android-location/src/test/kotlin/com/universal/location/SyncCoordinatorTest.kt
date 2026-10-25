package com.universal.location

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.util.UUID

class SyncCoordinatorTest {

    @Test
    fun testSyncOnceAcknowledgesAcceptedAndDuplicateEvents() = runBlocking {
        val queue = InMemoryEventQueue()
        val event1 = LocationEvent(eventId = UUID.randomUUID(), deviceId = "dev-1", capturedAt = Instant.now(), latitude = 1.0, longitude = 2.0)
        val event2 = LocationEvent(eventId = UUID.randomUUID(), deviceId = "dev-1", capturedAt = Instant.now(), latitude = 1.1, longitude = 2.1)

        queue.enqueue(event1)
        queue.enqueue(event2)
        assertEquals(2, queue.size())

        val mockUploader = BatchUploader { _ ->
            UploadResult.Acknowledged(
                accepted = setOf(event1.eventId),
                duplicates = setOf(event2.eventId)
            )
        }

        val coordinator = SyncCoordinator(queue, mockUploader)
        val result = coordinator.syncOnce()

        assertTrue(result is UploadResult.Acknowledged)
        val ack = result as UploadResult.Acknowledged
        assertEquals(setOf(event1.eventId), ack.accepted)
        assertEquals(setOf(event2.eventId), ack.duplicates)
        assertEquals(0, queue.size())
    }
}
