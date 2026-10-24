/**
 * Universal Location Engine — Core Domain
 *
 * This module is framework-independent. It contains:
 * - Domain types and value objects
 * - Port interfaces (abstract contracts)
 * - Validation logic
 * - Error types
 * - Business rules
 *
 * Zero NestJS, Prisma, or HTTP/transport-specific dependencies.
 */

export * from './domain/index.js';
export * from './ports/index.js';
export * from './errors/index.js';
