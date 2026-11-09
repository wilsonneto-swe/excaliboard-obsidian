/**
 * VIEW-STATE: each drawing opens again where it was left (the scroll position and the zoom), after closing it,
 * after another drawing in the same tab, after a restart. The state lives in the plugin's data (data.json in the
 * plugin's folder: per vault, per device), never in the drawing, so looking around never changes a file.
 *  - CAP: at most MAX_DRAWINGS drawings; the one used longest ago goes first.
 *  - FOLLOW: a renamed or moved drawing (or folder) keeps its state under the new path; a deleted one loses it.
 *  - TOLERANT: whatever data.json holds (an older or newer shape, a hand edit), a bad entry is dropped, never thrown.
 * The same design as Mindslate's per-map view state.
 */
import type { ViewState } from './editor';

export const MAX_DRAWINGS = 200;
export const STORE_VERSION = 1;

interface StoredView {
  readonly view: ViewState;
  /** When it was saved (ms since the epoch): the oldest goes first beyond the cap. */
  readonly at: number;
}

export interface ViewStateData {
  readonly version: number;
  readonly drawings: Readonly<Record<string, StoredView>>;
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** A view state the editor accepts, or null when `v` isn't one. */
export function validViewState(v: unknown): ViewState | null {
  if (typeof v !== 'object' || v === null) return null;
  const s = v as Record<string, unknown>;
  const { scrollX, scrollY, zoom } = { scrollX: s['scrollX'], scrollY: s['scrollY'], zoom: s['zoom'] };
  if (!isNum(scrollX) || !isNum(scrollY) || !isNum(zoom) || zoom <= 0) return null;
  return { scrollX, scrollY, zoom };
}

/** Where `path` is after `from` was renamed to `to` (a file, or a folder above it); null when it isn't affected. */
export function renamedPath(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
  return null;
}

export class ViewStateStore {
  private readonly drawings = new Map<string, StoredView>();

  /** From what the plugin's data held (anything: TOLERANT). */
  constructor(
    data: unknown,
    private readonly cap: number = MAX_DRAWINGS,
  ) {
    const drawings =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>)['drawings'] : undefined;
    if (typeof drawings !== 'object' || drawings === null) return;
    const entries: Array<[string, StoredView]> = [];
    for (const [path, v] of Object.entries(drawings as Record<string, unknown>)) {
      const e = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
      const view = e ? validViewState(e['view']) : null;
      const at = e && isNum(e['at']) ? e['at'] : 0;
      if (view && path !== '') entries.push([path, { view, at }]);
    }
    entries.sort((a, b) => a[1].at - b[1].at); // oldest first: the map's order is the eviction order
    for (const [path, v] of entries) this.drawings.set(path, v);
    this.trim();
  }

  get size(): number {
    return this.drawings.size;
  }

  get(path: string): ViewState | null {
    return this.drawings.get(path)?.view ?? null;
  }

  /** Keeps the view of `path` (the newest entry now); false when it is the one already kept (nothing to save). */
  set(path: string, view: ViewState, now: number = Date.now()): boolean {
    const valid = validViewState(view);
    if (!valid) return false;
    const old = this.drawings.get(path)?.view;
    if (old && old.scrollX === valid.scrollX && old.scrollY === valid.scrollY && old.zoom === valid.zoom) return false;
    this.drawings.delete(path);
    this.drawings.set(path, { view: valid, at: now });
    this.trim();
    return true;
  }

  /** FOLLOW a rename or a move (of the drawing, or of a folder above it). True when something moved. */
  rename(from: string, to: string): boolean {
    let moved = false;
    for (const [path, v] of [...this.drawings]) {
      const next = renamedPath(path, from, to);
      if (next === null || next === path) continue;
      this.drawings.delete(path);
      this.drawings.set(next, v);
      moved = true;
    }
    return moved;
  }

  /** A deleted drawing (or folder) takes its state along. True when something went. */
  delete(path: string): boolean {
    let gone = false;
    for (const p of [...this.drawings.keys()]) {
      if (p === path || p.startsWith(`${path}/`)) gone = this.drawings.delete(p) || gone;
    }
    return gone;
  }

  toJSON(): ViewStateData {
    return { version: STORE_VERSION, drawings: Object.fromEntries(this.drawings) };
  }

  private trim(): void {
    while (this.drawings.size > this.cap) {
      const oldest = this.drawings.keys().next().value;
      if (oldest === undefined) break;
      this.drawings.delete(oldest);
    }
  }
}
