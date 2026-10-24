/**
 * Port interface for clock/time abstraction.
 *
 * Enables deterministic testing of time-dependent logic
 * (freshness classification, clock-skew detection, TTLs).
 */
export interface Clock {
  /** Get the current time */
  now(): Date;

  /** Get the current time as Unix timestamp in milliseconds */
  nowMs(): number;
}

/**
 * Default system clock implementation.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowMs(): number {
    return Date.now();
  }
}

/**
 * Fixed clock for testing — always returns the same time.
 */
export class FixedClock implements Clock {
  constructor(private readonly fixedTime: Date) {}

  now(): Date {
    return new Date(this.fixedTime.getTime());
  }

  nowMs(): number {
    return this.fixedTime.getTime();
  }

  /** Advance the clock by the specified milliseconds */
  advance(ms: number): void {
    this.fixedTime.setTime(this.fixedTime.getTime() + ms);
  }
}

/** Injection token for the Clock port */
export const CLOCK = Symbol('CLOCK');
