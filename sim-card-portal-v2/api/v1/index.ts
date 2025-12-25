/**
 * Provisioning API v1 Entry Point
 *
 * Usage:
 * ```typescript
 * import { createV1Router } from './api/v1';
 * const v1Router = createV1Router(pool);
 * app.use('/api/v1', v1Router);
 * ```
 */

export { createV1Router } from './router.js';

// Re-export types for consumers
export * from './types/provisioning.types.js';

// Re-export services for direct use
export { SimService } from './services/sim.service.js';
export { WebhookService } from './services/webhook.service.js';
export { UsageService } from './services/usage.service.js';
