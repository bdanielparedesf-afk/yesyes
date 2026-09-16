import { z } from 'zod';

/**
 * Shared primitives for the AliExpress Dropship schemas.
 * Values come from the captured official contracts (backend/docs/api-contracts).
 * Numeric identifiers are accepted only while lossless: large SKU/order ids must
 * be strings, otherwise parsing fails instead of silently truncating.
 */
export const dropshipId = z.union([
  z.string().regex(/^[1-9]\d*$/),
  z.number().int().positive().safe().transform(String),
]);

export const dropshipOptionalId = z.union([
  z.string().regex(/^[1-9]\d*$/),
  z.number().int().nonnegative().safe().transform(String),
]);

/** Provider amounts stay as strings; converting them is a caller decision. */
export const dropshipAmount = z.union([
  z.string().regex(/^\d+(?:\.\d+)?$/),
  z.number().finite().nonnegative().transform(String),
]);

export const dropshipCount = z.union([
  z.number(),
  z.string().regex(/^-?\d+$/).transform(Number),
]).pipe(z.number().int().nonnegative().safe());

export const dropshipBool = z.union([
  z.boolean(), z.literal('true').transform(() => true), z.literal('false').transform(() => false),
]);

/** A JSON blob transported as a string (official `result: String` members). */
export const dropshipJsonString = z.string();

function unwrapList(value: unknown, wrappers: readonly string[]): unknown {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const wrapper of wrappers) if (Array.isArray(record[wrapper])) return record[wrapper];
  }
  return value;
}

/**
 * Official responses document lists directly as `Object[]`, while some legacy
 * payloads wrap them in a single-key object (e.g. `ae_item_sku_info_d_t_o`).
 * Both shapes are accepted and normalized to an array; anything else fails closed.
 */
export function dropshipList<T extends z.ZodTypeAny>(item: T, wrappers: readonly string[]) {
  return z.preprocess(value => unwrapList(value, wrappers), z.array(item));
}

export const dropshipLooseObject = z.record(z.unknown());
