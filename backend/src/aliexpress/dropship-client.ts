/**
 * Compatibility entry point. The Dropship client now lives in
 * `src/lib/aliexpress/dropship-client.ts` (official DS contracts, typed methods
 * and normalized responses). This module only re-exports it so existing imports
 * (probe script, tests, services) keep working without a duplicate client.
 */
export * from '../lib/aliexpress/dropship-client';
