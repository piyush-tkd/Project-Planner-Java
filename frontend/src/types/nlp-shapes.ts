/**
 * Standard NLP Response Shapes (Phase 1.4/1.10)
 *
 * Every response from the NLP system conforms to one of these 5 shapes.
 * The backend sets `response.shape` field, and the frontend has one
 * renderer component per shape.
 */

/** LIST shape: collection of entities with optional numbered items */
export interface NlpListData {
  _type: string;
  _shape: 'LIST';
  listType?: string;          // PROJECTS, RESOURCES, PODS, SPRINTS, etc.
  Count?: string;
  _structuredItems?: Array<Record<string, string>>;
  _itemIds?: number[];
  _itemType?: string;         // PROJECT, POD, RESOURCE
  [key: string]: unknown;     // #1, #2, etc. for numbered items
}

/** DETAIL shape: single entity profile with typed fields */
export interface NlpDetailData {
  _type: string;
  _shape: 'DETAIL';
  entityType?: string;
  name?: string;
  // Resource fields
  Role?: string;
  POD?: string;
  Location?: string;
  'Billing Rate'?: string;
  FTE?: string;
  // Project fields
  Priority?: string;
  Owner?: string;
  Status?: string;
  'Assigned PODs'?: string;
  Timeline?: string;
  Duration?: string;
  Client?: string;
  // Pod fields
  Members?: string;
  Projects?: string;
  'Avg BAU'?: string;
  // Sprint/Release fields
  Type?: string;
  'Start Date'?: string;
  'End Date'?: string;
  'Release Date'?: string;
  'Code Freeze'?: string;
  [key: string]: unknown;
}

/** SUMMARY shape: aggregated metrics and breakdowns */
export interface NlpSummaryData {
  _type: string;
  _shape: 'SUMMARY';
  [key: string]: unknown;     // Arbitrary metric keys
}

/** COMPARISON shape: two or more entities side by side */
export interface NlpComparisonData {
  _type: string;
  _shape: 'COMPARISON';
  entityA?: string;
  entityB?: string;
  [key: string]: unknown;     // Prefixed keys like entityA_Members, entityB_Members
}

/** ERROR shape: failed query with suggestions */
export interface NlpErrorData {
  _type: string;
  _shape: 'ERROR';
  error?: string;
  suggestions?: string[];
}

/** Union of all shape data types */
export type NlpShapeData = NlpListData | NlpDetailData | NlpSummaryData | NlpComparisonData | NlpErrorData;

/** Resolve shape from response — uses explicit shape field, falls back to _type inference */
export function resolveShape(data: Record<string, unknown> | null | undefined, shape?: string | null): string {
  // Prefer explicit shape from backend
  if (shape) return shape;

  // Fall back to _shape in data
  if (data?._shape) return String(data._shape);

  // Infer from _type
  const type = String(data?._type ?? '');
  if (type === 'LIST') return 'LIST';
  if (type.endsWith('_PROFILE')) return 'DETAIL';
  if (type === 'COMPARISON') return 'COMPARISON';
  if (type === 'ERROR') return 'ERROR';

  // Default to SUMMARY for everything else
  return 'SUMMARY';
}

/** Enhanced NLP response payload with shape */
export interface NlpResponsePayload {
  message: string | null;
  route: string | null;
  formData: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  drillDown: string | null;
  shape?: string | null;
}

/** Full query response with shape support */
export interface NlpQueryResponse {
  intent: string;
  confidence: number;
  resolvedBy: string;
  response: NlpResponsePayload;
  suggestions: string[];
  queryLogId: number | null;
  debug?: Record<string, unknown> | null;
}
