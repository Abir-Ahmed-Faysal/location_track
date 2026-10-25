package com.universal.location

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class RetryManagerTest {

    @Test
    fun testRetryDelayCalculation() {
        val policy = RetryPolicy(initialDelayMillis = 1000, maxDelayMillis = 10000, maxAttempts = 5)
        val manager = RetryManager(policy)

        val retry1 = manager.nextDelayMillis(1, UploadResult.RetryableFailure())
        assertNotNull(retry1)
        assertEquals(2000L, retry1)

        val retryMax = manager.nextDelayMillis(5, UploadResult.RetryableFailure())
        assertNull(retryMax)

        val ackResult = manager.nextDelayMillis(1, UploadResult.Acknowledged(emptySet(), emptySet()))
        assertNull(ackResult)
    }
}
