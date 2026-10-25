package com.universal.location

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import java.time.Instant
import java.util.UUID

@Entity(tableName = "location_events", primaryKeys = ["eventId"])
data class LocationEventEntity(
    val eventId: String,
    val deviceId: String,
    val capturedAtEpochMillis: Long,
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double?,
    val altitudeMeters: Double?,
    val speedMps: Double?,
    val bearingDegrees: Double?,
    val provider: String?,
    val isMock: Boolean,
)

@Dao
interface LocationEventDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    fun insert(event: LocationEventEntity): Long

    @Query("SELECT * FROM location_events ORDER BY capturedAtEpochMillis ASC LIMIT :limit")
    fun peek(limit: Int): List<LocationEventEntity>

    /** Deletes only IDs acknowledged as accepted or duplicate by the server. */
    @Query("DELETE FROM location_events WHERE eventId IN (:eventIds)")
    fun acknowledge(eventIds: Set<String>)

    @Query("SELECT COUNT(*) FROM location_events")
    fun count(): Int
}

@Database(entities = [LocationEventEntity::class], version = 1, exportSchema = false)
abstract class LocationQueueDatabase : RoomDatabase() {
    abstract fun events(): LocationEventDao
}

/** SQLite-backed queue. Rows survive process death, crashes, and device restarts. */
class RoomEventQueue private constructor(
    private val dao: LocationEventDao,
    private val maxSize: Int,
) : EventQueue {
    override fun enqueue(event: LocationEvent): Boolean {
        if (dao.count() >= maxSize && dao.peek(1).none { it.eventId == event.eventId.toString() }) {
            return false
        }
        dao.insert(event.toEntity())
        return true
    }

    override fun peek(limit: Int): List<LocationEvent> =
        dao.peek(limit.coerceAtLeast(0)).map(LocationEventEntity::toEvent)

    override fun acknowledge(eventIds: Set<UUID>) {
        if (eventIds.isNotEmpty()) dao.acknowledge(eventIds.map(UUID::toString).toSet())
    }

    override fun size(): Int = dao.count()

    companion object {
        fun create(context: Context, maxSize: Int = 10_000): RoomEventQueue {
            val database = Room.databaseBuilder(
                context.applicationContext,
                LocationQueueDatabase::class.java,
                "universal-location-events.db",
            )
                .allowMainThreadQueries()
                .fallbackToDestructiveMigration()
                .build()
            return RoomEventQueue(database.events(), maxSize)
        }
    }
}

private fun LocationEvent.toEntity() = LocationEventEntity(
    eventId.toString(), deviceId, capturedAt.toEpochMilli(), latitude, longitude,
    accuracyMeters, altitudeMeters, speedMps, bearingDegrees, provider, isMock,
)

private fun LocationEventEntity.toEvent() = LocationEvent(
    UUID.fromString(eventId), deviceId, Instant.ofEpochMilli(capturedAtEpochMillis),
    latitude, longitude, accuracyMeters, altitudeMeters, speedMps, bearingDegrees,
    provider, isMock,
)
