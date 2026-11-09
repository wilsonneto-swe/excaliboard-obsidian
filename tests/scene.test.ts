import { newElementWith, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMPTY_SCENE, parseScene, sceneFingerprint, serializeScene, type SceneData } from '../src/scene';
import { SOURCE } from '../src/constants';

const SAMPLE = readFileSync('tests/fixtures/sample.excalidraw', 'utf8');

function parsed(text = SAMPLE): SceneData {
  const result = parseScene(text);
  if (!result.ok) throw new Error(result.error);
  return result.scene;
}

/** The scene as the editor holds it after loading the file (Excalidraw restores initialData). */
function loaded(text = SAMPLE) {
  return restore(parsed(text) as never, null, null, { repairBindings: true });
}

describe('parseScene', () => {
  it('parses a valid file', () => {
    const scene = parsed();
    expect(scene.type).toBe('excalidraw');
    expect(scene.elements).toHaveLength(4);
    expect(Object.keys(scene.files ?? {})).toEqual(['file-1']);
  });

  it('rejects invalid JSON', () => {
    const result = parseScene('{"type":"excalidraw","elements":[');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Invalid JSON/);
  });

  it('rejects JSON whose type is not "excalidraw"', () => {
    expect(parseScene('{"type":"excalidrawlib","libraryItems":[]}').ok).toBe(false);
    expect(parseScene('[]').ok).toBe(false);
    expect(parseScene('null').ok).toBe(false);
  });

  it('rejects malformed elements and files', () => {
    expect(parseScene('{"type":"excalidraw","elements":{}}').ok).toBe(false);
    expect(parseScene('{"type":"excalidraw","elements":[{"type":"rectangle"}]}').ok).toBe(false);
    expect(parseScene('{"type":"excalidraw","elements":[{"id":"a"}]}').ok).toBe(false);
    expect(parseScene('{"type":"excalidraw","elements":[null]}').ok).toBe(false);
    expect(parseScene('{"type":"excalidraw","elements":[],"files":[]}').ok).toBe(false);
  });

  it('treats an empty file as a new drawing and accepts the new-drawing template', () => {
    expect(parsed('').elements).toEqual([]);
    expect(parsed(EMPTY_SCENE)).toMatchObject({ type: 'excalidraw', source: SOURCE, elements: [] });
  });
});

describe('serializeScene', () => {
  it('keeps unknown top-level keys', () => {
    const original = parsed();
    const { elements, appState, files } = loaded();
    const out = JSON.parse(serializeScene(original, elements, appState, files, serializeAsJSON)) as Record<
      string,
      unknown
    >;
    expect(out['plusMetadata']).toEqual({ workspace: 'studies', sceneId: 'abc123' });
    expect(out).toMatchObject({ type: 'excalidraw', version: 2 });
  });

  it('writes standard, pretty-printed Excalidraw JSON, naming Excaliboard as its source', () => {
    const original = parsed(EMPTY_SCENE);
    const { elements, appState, files } = loaded();
    const text = serializeScene(original, elements, appState, files, serializeAsJSON);
    const library = serializeAsJSON(elements, appState, files, 'local');
    expect(library).toContain(`"source": "${window.location.origin}"`); // the page's origin: app://obsidian.md
    expect(text).toBe(library.replace(`"source": "${window.location.origin}"`, `"source": "${SOURCE}"`));
    expect(text).toContain('\n  "elements": [');
  });

  it('round trip: parse, serialize, parse again gives equal elements and files', () => {
    const { elements, appState, files } = loaded();
    const again = parsed(serializeScene(parsed(), elements, appState, files, serializeAsJSON));
    expect(again.elements).toEqual(JSON.parse(JSON.stringify(elements)));
    expect(again.files).toEqual(parsed().files);
    expect(again.elements.map((el) => el.id)).toEqual(['rect-1', 'text-1', 'arrow-1', 'image-1']);
  });

  it("round trip leaves the file's own elements unchanged", () => {
    const original = parsed();
    const out = parsed(
      serializeScene(original, original.elements as never, {}, original.files as never, serializeAsJSON),
    );
    expect(out.elements).toEqual(original.elements);
    expect(out.files).toEqual(original.files);
  });
});

describe('sceneFingerprint', () => {
  const fp = (s: ReturnType<typeof loaded>) => sceneFingerprint(s.elements, s.files, s.appState);

  it('is unchanged when only scroll, zoom or selection change', () => {
    const scene = loaded();
    const moved = {
      ...scene,
      appState: {
        ...scene.appState,
        scrollX: 500,
        scrollY: -200,
        zoom: { value: 2.5 as never },
        selectedElementIds: { 'rect-1': true as const },
      },
    };
    expect(fp(moved)).toBe(fp(scene));
  });

  it('changes when an element moves', () => {
    const scene = loaded();
    const elements = scene.elements.map((el) => (el.id === 'rect-1' ? newElementWith(el, { x: el.x + 10 }) : el));
    expect(fp({ ...scene, elements })).not.toBe(fp(scene));
  });

  it('changes when an element is deleted, a file is added or the background changes', () => {
    const scene = loaded();
    const deleted = scene.elements.map((el) => (el.id === 'arrow-1' ? newElementWith(el, { isDeleted: true }) : el));
    expect(fp({ ...scene, elements: deleted })).not.toBe(fp(scene));
    expect(fp({ ...scene, files: { ...scene.files, extra: scene.files['file-1']! } })).not.toBe(fp(scene));
    expect(fp({ ...scene, appState: { ...scene.appState, viewBackgroundColor: '#000000' } })).not.toBe(fp(scene));
  });
});
