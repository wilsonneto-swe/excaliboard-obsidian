/**
 * Pure scene helpers: no Obsidian and no Excalidraw at run time, so they load with the plugin and are unit-tested.
 *  - PARSE: a file opens only if it is an Excalidraw scene (`type: "excalidraw"`, an array of elements with an id
 *    and a type, `files` an object). An empty file is a new drawing. Anything else opens read-only (view.ts).
 *  - KEEP-UNKNOWN: a save writes the library's standard JSON and keeps the original's top-level keys it doesn't
 *    know, so data from Excalidraw+ or another tool survives. Its `source` is Excaliboard's address (SOURCE), where
 *    the library would write the page's origin, app://obsidian.md.
 *  - FINGERPRINT: changes whenever the saved file would change (element versions, file ids, the saved appState
 *    keys); scroll, zoom and selection leave it unchanged, so they never cause a save.
 */
import type { serializeAsJSON } from '@excalidraw/excalidraw';
import { SOURCE } from './constants';

type Serialize = typeof serializeAsJSON;
type Args = Parameters<Serialize>;
type ElementLike = { id: string; type: string; version?: number; versionNonce?: number; isDeleted?: boolean };

export interface SceneData {
  type: 'excalidraw';
  elements: readonly ElementLike[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
  [key: string]: unknown;
}
export type ParseResult = { ok: true; scene: SceneData } | { ok: false; error: string };

/** A new drawing: what "Create new drawing" writes. */
export const EMPTY_SCENE = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  source: SOURCE,
  elements: [],
  appState: {},
  files: {},
});

/** The appState keys serializeAsJSON(..., "local") writes to the file (Excalidraw 0.18.1). */
export const SAVED_APP_STATE = ['viewBackgroundColor', 'gridSize', 'gridStep', 'gridModeEnabled'] as const;
const STANDARD_KEYS = new Set(['type', 'version', 'source', 'elements', 'appState', 'files']);
/** The `source` line at the start of the library's JSON. */
const SOURCE_LINE = /^(\{\s*"type": "excalidraw",\s*"version": \d+,\s*"source": )"[^"\\]*"/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (error: string): ParseResult => ({ ok: false, error });

/** PARSE: validates the file's text without changing it. */
export function parseScene(text: string): ParseResult {
  if (text.trim() === '') return parseScene(EMPTY_SCENE); // an empty file is a new drawing
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return fail(`Invalid JSON: ${(e as Error).message}.`);
  }
  if (!isObject(data) || data['type'] !== 'excalidraw')
    return fail('Not an Excalidraw scene: "type" is not "excalidraw".');
  const elements = data['elements'] ?? [];
  if (!Array.isArray(elements)) return fail('"elements" is not an array.');
  for (const el of elements as unknown[]) {
    if (!isObject(el) || typeof el['id'] !== 'string' || typeof el['type'] !== 'string')
      return fail('An element has no id or type.');
  }
  if (data['files'] !== undefined && !isObject(data['files'])) return fail('"files" is not an object.');
  return { ok: true, scene: { ...data, elements } as unknown as SceneData };
}

/** KEEP-UNKNOWN: standard Excalidraw JSON from the library's serializer, plus the original's unknown top-level keys. */
export function serializeScene(
  original: SceneData,
  elements: Args[0],
  appState: Args[1],
  files: Args[2],
  serialize: Serialize,
): string {
  const json = serialize(elements, appState, files, 'local').replace(SOURCE_LINE, `$1${JSON.stringify(SOURCE)}`);
  if (Object.keys(original).every((key) => STANDARD_KEYS.has(key))) return json;
  return JSON.stringify({ ...original, ...(JSON.parse(json) as Record<string, unknown>) }, null, 2);
}

/**
 * FINGERPRINT: element versions as Excalidraw's getSceneVersion and hashElementsVersion see them, the ids of the
 * image files, and the saved appState keys.
 */
export function sceneFingerprint(
  elements: readonly ElementLike[],
  files?: object | null,
  appState?: object | null,
): string {
  let hash = 5381;
  let versions = 0;
  for (const el of elements) {
    hash = ((hash << 5) + hash + (el.versionNonce ?? 0)) | 0;
    versions += el.version ?? 0;
  }
  const state = (appState ?? {}) as Record<string, unknown>;
  const saved = SAVED_APP_STATE.map((key) => state[key] ?? null);
  return JSON.stringify([elements.length, versions, hash >>> 0, Object.keys(files ?? {}).sort(), saved]);
}
