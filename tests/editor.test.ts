// CHECK (src/editor.tsx) against the real library: what would Excalidraw 0.18.1 silently drop when loading a file?
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkScene } from '../src/editor';
import { parseScene, type SceneData } from '../src/scene';

const scene = (text: string): SceneData => {
  const result = parseScene(text);
  if (!result.ok) throw new Error(result.error);
  return result.scene;
};
const SAMPLE = scene(readFileSync('tests/fixtures/sample.excalidraw', 'utf8'));
const base = { x: 0, y: 0, width: 100, height: 60, angle: 0, version: 1, versionNonce: 1, isDeleted: false };
// As saved by excalidraw.com in November 2026 (sticky notes are newer than Excalidraw 0.18).
const stickyNote = {
  ...base,
  id: 'note-1',
  type: 'stickynote',
  baseHeight: 60,
  strokeColor: '#1e1e1e',
  backgroundColor: '#ffec99',
};
const withElements = (...extra: object[]) => ({ ...SAMPLE, elements: [...SAMPLE.elements, ...extra] }) as SceneData;

describe('checkScene', () => {
  it('accepts a normal drawing', () => {
    expect(checkScene(SAMPLE)).toBeNull();
  });

  it('refuses element types this Excalidraw version would drop, naming them', () => {
    expect(checkScene(withElements(stickyNote, { ...stickyNote, id: 'note-2' }))).toBe(
      'It has 2 element(s) of type "stickynote" that this Excalidraw version does not support.',
    );
  });

  it('ignores what dropping cannot lose: deleted elements and invisibly small ones', () => {
    expect(checkScene(withElements({ ...stickyNote, isDeleted: true }))).toBeNull();
    expect(checkScene(withElements({ ...base, id: 'dot', type: 'rectangle', width: 0, height: 0 }))).toBeNull();
  });

  it('opens drawings with AI web pages and with pictures at web addresses, which the build keeps offline', () => {
    const page = {
      ...base,
      id: 'page',
      type: 'iframe',
      customData: { generationData: { status: 'done', html: '<script src="https://cdn.example.com/x.js"></script>' } },
    };
    expect(checkScene(withElements(page))).toBeNull(); // the build shows a note in its place (esbuild.config.mjs)
    const files = { ...SAMPLE.files, web: { id: 'web', mimeType: 'image/png', dataURL: 'https://example.com/a.png' } };
    expect(checkScene({ ...SAMPLE, files })).toBeNull(); // shown as a picture that failed to load (view.ts REAL-CHANGES)
  });

  it('refuses what Excalidraw fails on when it loads a drawing, bindings included', () => {
    const rect = SAMPLE.elements.find((el) => el.type === 'rectangle')!;
    const elements = SAMPLE.elements.map((el) => (el === rect ? { ...el, boundElements: [null] } : el));
    expect(checkScene({ ...SAMPLE, elements })).toMatch(/^Excalidraw cannot load it: /);
  });

  it('counts an element it would drop even when it shares its id with one it keeps, in either order', () => {
    const rect = SAMPLE.elements.find((el) => el.type === 'rectangle')!;
    const twin = { ...stickyNote, id: rect.id };
    for (const elements of [
      [...SAMPLE.elements, twin],
      [twin, ...SAMPLE.elements],
    ])
      expect(checkScene({ ...SAMPLE, elements })).toMatch(/1 element\(s\) of type "stickynote"/);
  });

  it('refuses elements the library cannot even read, instead of leaving the editor stuck', () => {
    expect(checkScene(withElements({ ...base, id: 'broken', type: 'arrow' }))).toMatch(/^Excalidraw cannot load it: /);
  });
});
