package com.universal.location

/** Queue abstraction: events are removed only after accepted/duplicate acknowledgement. */
interface EventQueue {
    fun enqueue(event: LocationEvent): Boolean
    fun peek(limit: Int): List<LocationEvent>
    fun acknowledge(eventIds: Set<java.util.UUID>)
    fun size(): Int
}

/** Small reference implementation for host tests; production should use Room/SQLite. */
class InMemoryEventQueue(private val maxSize: Int = 1_000) : EventQueue {
    private val events = LinkedHashMap<java.util.UUID, LocationEvent>()

    override fun enqueue(event: LocationEvent): Boolean {
        if (events.size >= maxSize && event.eventId !in events) return false
        events.putIfAbsent(event.eventId, event)
        return true
    }

    override fun peek(limit: Int): List<LocationEvent> =
        events.values.take(limit.coerceAtLeast(0))

    override fun acknowledge(eventIds: Set<java.util.UUID>) {
        eventIds.forEach(events::remove)
    }

    override fun size(): Int = events.size
}
