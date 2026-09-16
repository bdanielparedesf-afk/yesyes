import { z } from 'zod';
import { dropshipBool, dropshipCount, dropshipList, dropshipOptionalId, dropshipId } from './dropship-common';

// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.ds.category.tree.get
// Official params: lang*  → response container: envelope root (rsp_code/rsp_msg/result)
// `result` is a JSON string holding an array of nodes:
//   { id, name, level, isleaf, children: [...] }
// ─────────────────────────────────────────────────────────────────────────────
export const categoryTreeInputSchema = z.object({
  lang: z.string().trim().min(2).max(16).default('es_ES'),
}).strict();
export interface CategoryTreeInput { lang?: string }

export const categoryTreeResponseSchema = z.object({
  rsp_code: dropshipCount.optional(),
  rsp_msg: z.string().optional(),
  result: z.string(),
}).passthrough();

export interface CategoryTreeNode {
  id: string; name: string; level: number; isLeaf: boolean; children: CategoryTreeNode[];
}
const treeNodeSchema: z.ZodType<CategoryTreeNode, z.ZodTypeDef, unknown> = z.lazy(() => z.object({
  id: dropshipId,
  name: z.string().min(1),
  level: dropshipCount.optional().transform(value => value ?? 0),
  isleaf: dropshipBool.optional(),
  children: dropshipList(treeNodeSchema, ['children']).optional().transform(value => value ?? []),
}).passthrough().transform(node => ({
  id: node.id, name: node.name, level: node.level, isLeaf: node.isleaf === true, children: node.children,
})));

/** Parses the official `result` JSON string. Fails closed on malformed payloads. */
export function parseCategoryTree(resultJson: unknown): CategoryTreeNode[] {
  if (typeof resultJson !== 'string') throw new Error('Árbol de categorías no reconocido.');
  let parsed: unknown;
  try { parsed = JSON.parse(resultJson); } catch { throw new Error('Árbol de categorías ilegible.'); }
  const result = dropshipList(treeNodeSchema, ['categories', 'children']).safeParse(parsed);
  if (!result.success) throw new Error('Árbol de categorías no reconocido.');
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.ds.category.get
// Official params: categoryId, language, app_signature
// Response container: envelope.resp_result (resp_code/resp_msg/result)
// ─────────────────────────────────────────────────────────────────────────────
export const categoryGetInputSchema = z.object({
  categoryId: z.string().regex(/^[1-9]\d*$/).max(20).optional(),
  language: z.string().trim().min(2).max(16).default('es_ES'),
  app_signature: z.string().trim().max(256).optional(),
}).strict();
export interface CategoryGetInput { categoryId?: string; language?: string; app_signature?: string }

export const categoryEntrySchema = z.object({
  category_id: dropshipOptionalId.optional(),
  category_name: z.string().optional(),
  parent_category_id: dropshipOptionalId.optional(),
}).passthrough();
export type CategoryEntry = z.infer<typeof categoryEntrySchema>;

export const categoryGetResultSchema = z.object({
  resp_code: dropshipCount.optional(),
  resp_msg: z.string().optional(),
  result: z.object({
    total_result_count: dropshipCount.optional(),
    categories: dropshipList(categoryEntrySchema, ['category']).optional(),
  }).passthrough().optional(),
}).passthrough();
export interface CategoryGetResult extends z.infer<typeof categoryGetResultSchema> {}

// ─────────────────────────────────────────────────────────────────────────────
// aliexpress.ds.feed.itemids.get
// Official params: page_size, category_id, feed_name*, search_id
// ─────────────────────────────────────────────────────────────────────────────
export const feedItemIdsInputSchema = z.object({
  feed_name: z.string().trim().min(1).max(128),
  page_size: z.number().int().min(1).max(200).optional(),
  category_id: z.string().regex(/^[1-9]\d*$/).max(20).optional(),
  search_id: z.string().trim().max(128).optional(),
}).strict();
export interface FeedItemIdsInput {
  feed_name: string; page_size?: number; category_id?: string; search_id?: string;
}

export const feedItemIdsResultSchema = z.object({
  ret: dropshipBool.optional(),
  rsp_code: dropshipCount.optional(),
  rsp_msg: z.string().optional(),
  result: z.object({
    products: z.array(dropshipId).optional(),
    search_id: z.string().optional(),
    total: z.union([z.string(), dropshipCount]).optional(),
  }).passthrough().optional(),
}).passthrough();
export interface FeedItemIdsResult extends z.infer<typeof feedItemIdsResultSchema> {}
