// VIEW-STATE (src/view-state.ts): scroll and zoom per drawing, capped, following renames, tolerant of bad data.
import { describe, expect, it } from 'vitest';
import { renamedPath, validViewState, ViewStateStore } from '../src/view-state';

const view = (n: number) => ({ scrollX: n, scrollY: -n, zoom: 1 + n / 10 });

describe('ViewStateStore', () => {
  it('keeps one view per drawing and says when nothing changed', () => {
    const store = new ViewStateStore(null);
    expect(store.set('a.excalidraw', view(1))).toBe(true);
    expect(store.set('a.excalidraw', view(1))).toBe(false);
    expect(store.get('a.excalidraw')).toEqual(view(1));
    expect(store.get('b.excalidraw')).toBeNull();
  });

  it('drops the drawing used longest ago beyond the cap', () => {
    const store = new ViewStateStore(null, 2);
    store.set('a', view(1), 1);
    store.set('b', view(2), 2);
    store.set('a', view(3), 3); // a is now the newest
    store.set('c', view(4), 4);
    expect(store.get('b')).toBeNull();
    expect(store.size).toBe(2);
  });

  it('follows a renamed drawing, and every drawing in a renamed folder', () => {
    const store = new ViewStateStore(null);
    store.set('Old/a.excalidraw', view(1));
    store.set('Old/Sub/b.excalidraw', view(2));
    store.set('Older/c.excalidraw', view(3));
    expect(store.rename('Old', 'New')).toBe(true);
    expect(store.get('New/a.excalidraw')).toEqual(view(1));
    expect(store.get('New/Sub/b.excalidraw')).toEqual(view(2));
    expect(store.get('Older/c.excalidraw')).toEqual(view(3));
    expect(store.delete('New')).toBe(true);
    expect(store.size).toBe(1);
  });

  it('round-trips through data.json and drops anything it cannot use', () => {
    const store = new ViewStateStore(null);
    store.set('a', view(1), 5);
    const again = new ViewStateStore(JSON.parse(JSON.stringify(store.toJSON())));
    expect(again.get('a')).toEqual(view(1));
    const messy = new ViewStateStore({
      drawings: { a: { view: view(1) }, b: { view: { scrollX: 'x' } }, c: null, '': { view: view(2) } },
    });
    expect(messy.size).toBe(1);
    expect(new ViewStateStore('nonsense').size).toBe(0);
  });
});

describe('helpers', () => {
  it('validViewState accepts finite numbers and a positive zoom only', () => {
    expect(validViewState(view(1))).toEqual(view(1));
    expect(validViewState({ scrollX: 0, scrollY: 0, zoom: 0 })).toBeNull();
    expect(validViewState({ scrollX: Infinity, scrollY: 0, zoom: 1 })).toBeNull();
  });

  it('renamedPath maps a file or anything below a folder, and nothing else', () => {
    expect(renamedPath('a.excalidraw', 'a.excalidraw', 'b.excalidraw')).toBe('b.excalidraw');
    expect(renamedPath('F/a.excalidraw', 'F', 'G')).toBe('G/a.excalidraw');
    expect(renamedPath('FF/a.excalidraw', 'F', 'G')).toBeNull();
  });
});
