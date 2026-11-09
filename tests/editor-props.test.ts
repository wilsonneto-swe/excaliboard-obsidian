// The editor's wiring to Excalidraw (src/editor.tsx). React's root is replaced so the props given to <Excalidraw> can be
// read, with a stand-in for Excalidraw's imperative API: keyboard focus, renames and links to elements.
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { elementLink, hasWebPictures, linkedElementId, mountEditor, type EditorProps } from '../src/editor';
import { parseScene } from '../src/scene';

const rendered = vi.hoisted(() => [] as { props: Record<string, unknown> }[]);
vi.mock('react-dom/client', () => ({
  createRoot: () => ({ render: (el: { props: Record<string, unknown> }) => rendered.push(el), unmount: () => {} }),
}));

const parsed = parseScene(readFileSync('tests/fixtures/sample.excalidraw', 'utf8'));
if (!parsed.ok) throw new Error(parsed.error);
const SCENE = parsed.scene;

type Props = {
  autoFocus: boolean;
  initialData: { scrollToContent: boolean; appState: Record<string, unknown> };
  onChange: (elements: readonly unknown[], appState: { width: number; height: number }, files: object) => void;
  generateLinkForSelection: unknown;
  excalidrawAPI: (api: unknown) => void;
  onLinkOpen: (element: { id: string; link: string }, event: CustomEvent) => void;
};

let api: {
  scrolled: unknown[];
  toasts: unknown[];
  updates: unknown[];
  getSceneElements(): { id: string; groupIds: string[] }[];
  scrollToContent(target: unknown, opts?: unknown): void;
  setToast(toast: unknown): void;
  updateScene(data: unknown): void;
};

beforeEach(() => {
  rendered.length = 0;
  api = {
    scrolled: [],
    toasts: [],
    updates: [],
    getSceneElements: () => [
      { id: 'rect-1', groupIds: ['group-a'] },
      { id: 'text-1', groupIds: [] },
    ],
    scrollToContent(target, opts) {
      this.scrolled.push(opts === undefined ? target : [target, opts]);
    },
    setToast(toast) {
      this.toasts.push(toast);
    },
    updateScene(data) {
      this.updates.push(data);
    },
  };
});

function mount(overrides: Partial<EditorProps> = {}, container = document.createElement('div')) {
  const onLinkOpen = vi.fn();
  const handle = mountEditor(container, {
    scene: SCENE,
    theme: 'light',
    name: 'Board',
    autoFocus: false,
    canFocus: () => true,
    viewMode: false,
    viewState: null,
    onChange: () => {},
    onLinkOpen,
    onWebPicturesLeftOut: () => {},
    ...overrides,
  });
  const props = rendered.at(-1)!.props as Props;
  props.excalidrawAPI(api);
  /** Opens a shape's link the way Excalidraw does; returns whether Excalidraw's own window.open was stopped. */
  const open = (link: string) => {
    const detail = { nativeEvent: new MouseEvent('click') };
    const event = new CustomEvent('excalidraw-link', { cancelable: true, detail });
    props.onLinkOpen({ id: 'source', link }, event);
    return event.defaultPrevented;
  };
  return { handle, props, onLinkOpen, open };
}

/** A stand-in for Excalidraw's canvas container, which React renders after the mount. */
const addCanvas = (container: HTMLElement) => {
  const canvas = container.appendChild(document.createElement('div'));
  canvas.className = 'excalidraw';
  canvas.tabIndex = 0;
  return canvas;
};

describe('OUTSIDE-CHANGE', () => {
  it("asks to be mounted again when a picture's data changed, since Excalidraw keeps the pictures it has", () => {
    const { handle, props } = mount();
    const updates: unknown[] = [];
    const file = { id: 'pic', mimeType: 'image/png', dataURL: 'data:image/png;base64,AAAA', created: 1 };
    props.excalidrawAPI({
      ...api,
      getFiles: () => ({ pic: file }),
      addFiles: () => {},
      updateScene: (data: unknown) => updates.push(data),
      history: { clear: () => {} },
      getSceneElementsIncludingDeleted: () => [],
      getAppState: () => ({}),
    });
    const changed = { ...SCENE, files: { pic: { ...file, dataURL: 'data:image/png;base64,BBBB' } } };
    expect(handle.updateScene(changed)).toBeNull();
    expect(updates).toEqual([]);
    expect(handle.updateScene({ ...SCENE, files: { pic: file } })).not.toBeNull(); // the same picture: in place
  });
});

describe('SCENE', () => {
  it("gives Excalidraw only the drawing: its elements, pictures and saved settings, never a file's other state", () => {
    const scene = {
      ...SCENE,
      appState: {
        viewBackgroundColor: '#ffffff',
        gridSize: 20,
        currentItemOpacity: '0%),url(http://example.com/x.png),linear-gradient(red 0',
        activeTool: { type: 'rectangle' },
        openSidebar: { name: 'default' },
        selectedElementIds: { 'rect-1': true },
        collaborators: [{ pointer: { laserColor: 'url(http://example.com/x.svg#p)' } }],
      },
      libraryItems: [{ id: 'lib', elements: [] }],
    };
    const { props } = mount({ scene, viewState: { scrollX: 1, scrollY: 2, zoom: 1 } });
    expect(Object.keys(props.initialData).sort()).toEqual(['appState', 'elements', 'files', 'scrollToContent']);
    expect(props.initialData.appState).toEqual({
      viewBackgroundColor: '#ffffff',
      gridSize: 20,
      scrollX: 1,
      scrollY: 2,
      zoom: { value: 1 },
    });
  });
});

describe('the editor', () => {
  it("takes the keyboard as it mounts only when the view wants it then, never through Excalidraw's own autoFocus", () => {
    for (const [autoFocus, canFocus, focused] of [
      [true, true, true],
      [true, false, false], // another tab became active while React rendered
      [false, true, false],
    ] as const) {
      const container = document.body.appendChild(document.createElement('div'));
      const { props } = mount(
        { autoFocus, canFocus: () => canFocus, viewState: { scrollX: 0, scrollY: 0, zoom: 1 } },
        container,
      );
      expect((props as unknown as { autoFocus: boolean }).autoFocus).toBe(false);
      const canvas = addCanvas(container);
      props.onChange([], { width: 1000, height: 800 }, {}); // Excalidraw reports the loaded scene
      expect(document.activeElement === canvas).toBe(focused);
      container.remove();
    }
  });

  it('gives the keyboard to the canvas, or to the canvas React has yet to render as soon as it is there', () => {
    const container = document.body.appendChild(document.createElement('div'));
    const { handle, props } = mount({ viewState: { scrollX: 0, scrollY: 0, zoom: 1 } }, container);
    handle.focus(); // the tab became active before React rendered Excalidraw
    expect(document.activeElement).toBe(document.body);
    const canvas = addCanvas(container);
    props.onChange([], { width: 1000, height: 800 }, {}); // Excalidraw reports the loaded scene
    expect(document.activeElement).toBe(canvas);
    canvas.blur();
    props.onChange([], { width: 1000, height: 800 }, {}); // only once
    expect(document.activeElement).toBe(document.body);
    handle.focus();
    expect(document.activeElement).toBe(canvas);
    container.remove();
  });

  it('fits a drawing without a saved view into the canvas, once the canvas has a size', () => {
    const { props } = mount();
    expect(props.initialData.scrollToContent).toBe(false);
    const elements = [
      { id: 'a', isDeleted: false },
      { id: 'gone', isDeleted: true },
    ];
    props.onChange(elements, { width: 0, height: 0 }, {}); // a tab restored in the background
    expect(api.scrolled).toEqual([]);
    props.onChange(elements, { width: 1000, height: 800 }, {});
    props.onChange(elements, { width: 1000, height: 800 }, {});
    const offsets = { top: 16, right: 16, bottom: 16, left: 16 }; // a margin around the toolbar and panels
    expect(api.scrolled).toEqual([[[elements[0]], { fitToContent: true, canvasOffsets: offsets }]]);
  });

  it("fits it into the area Excalidraw's bars leave free, its toolbar at the top or, in its phone layout, the bottom", () => {
    /** An element of Excalidraw's interface, `top` to `bottom` pixels down a 1000 x 800 editor at the window's top left. */
    const bar = (parent: HTMLElement, tag: string, cls: string, top: number, bottom: number) => {
      const el = parent.appendChild(document.createElement(tag));
      el.className = cls;
      el.getBoundingClientRect = () => ({ top, bottom, height: bottom - top, left: 0, right: 1000 }) as DOMRect;
      return el;
    };
    const fit = (layout: (container: HTMLElement) => void) => {
      const container = document.createElement('div');
      container.getBoundingClientRect = () => ({ top: 0, bottom: 800, height: 800, left: 0, right: 1000 }) as DOMRect;
      layout(container);
      api.scrolled = [];
      const { props } = mount({}, container);
      props.onChange([{ id: 'a', isDeleted: false }], { width: 1000, height: 800 }, {});
      return (api.scrolled[0] as [unknown, { canvasOffsets: unknown }])[1].canvasOffsets;
    };
    const desktop = fit((c) => {
      bar(c, 'div', 'App-toolbar', 10, 60);
      bar(c, 'div', 'layer-ui__wrapper__footer-left', 750, 790);
    });
    expect(desktop).toEqual({ top: 76, right: 16, bottom: 66, left: 16 });
    // As Excalidraw 0.18.1 lays it out: a bottom bar as tall as the canvas, with the toolbar at its foot.
    const phone = fit((c) => bar(bar(c, 'div', 'App-bottom-bar', 0, 790), 'footer', 'App-toolbar', 740, 790));
    expect(phone).toEqual({ top: 16, right: 16, bottom: 76, left: 16 });
  });

  it('starts a drawing with a saved view where it was left, without fitting it', () => {
    const { props } = mount({ viewState: { scrollX: 10, scrollY: 20, zoom: 1.5 } });
    expect(props.initialData.appState).toMatchObject({ scrollX: 10, scrollY: 20, zoom: { value: 1.5 } });
    props.onChange([{ id: 'a', isDeleted: false }], { width: 1000, height: 800 }, {});
    expect(api.scrolled).toEqual([]);
  });

  it('gives a rename to Excalidraw through its appState, since Excalidraw reads its name prop only once', () => {
    const { handle } = mount();
    const renders = rendered.length;
    handle.setName('Renamed');
    expect(api.updates).toEqual([{ appState: { name: 'Renamed' }, captureUpdate: CaptureUpdateAction.NEVER }]);
    expect(rendered).toHaveLength(renders);
  });
});

describe('LINKS to elements', () => {
  it("scroll to the element or group, whether made here (this app's address) or on excalidraw.com", () => {
    const { open, onLinkOpen } = mount();
    expect(open(new URL('?element=rect-1', window.location.href).href)).toBe(true);
    expect(open('https://excalidraw.com/?element=group-a')).toBe(true);
    const scroll = { fitToContent: true, animate: true };
    expect(api.scrolled).toEqual([
      ['rect-1', scroll],
      ['group-a', scroll],
    ]);
    expect(onLinkOpen).not.toHaveBeenCalled();
  });

  it("say so when the element isn't in the drawing, and open nothing", () => {
    const { open, onLinkOpen } = mount();
    expect(open('https://excalidraw.com/?element=gone')).toBe(true);
    expect(api.scrolled).toEqual([]);
    expect(api.toasts).toEqual([{ message: "Linked object wasn't found on canvas.", closable: true, duration: 3000 }]);
    expect(onLinkOpen).not.toHaveBeenCalled();
  });

  it('into another scene (Excalidraw+, or shared from excalidraw.com) go to the view, like any other link', () => {
    const { open, onLinkOpen } = mount();
    const links = [
      'https://app.excalidraw.com/s/team/scene?element=rect-1',
      'https://excalidraw.com/?element=rect-1#json=abc,key',
      '[[Sharding]]',
    ];
    for (const link of links) expect(open(link)).toBe(true);
    expect(onLinkOpen.mock.calls.map(([link]) => link as string)).toEqual(links);
    expect(api.scrolled).toEqual([]);
  });

  it("are made in excalidraw.com's form, which reads back here", () => {
    const { props } = mount();
    expect(props.generateLinkForSelection).toBe(elementLink);
    expect(elementLink('rect 1')).toBe('https://excalidraw.com/?element=rect+1');
    expect(linkedElementId(elementLink('rect 1'))).toBe('rect 1');
    expect(linkedElementId('Sharding')).toBeNull();
  });
});

describe('NO-NETWORK: a paste from a web page', () => {
  const PAGE = '<p>Tram 28</p><img src="https://example.com/tram.jpg">';
  class FakeDataTransfer {
    files: unknown[] = [];
    private items = new Map<string, string>();
    constructor(items: Record<string, string> = {}, files: unknown[] = []) {
      for (const [type, value] of Object.entries(items)) this.items.set(type, value);
      this.files = files;
    }
    setData(type: string, value: string) {
      this.items.set(type, value);
    }
    getData(type: string) {
      return this.items.get(type) ?? '';
    }
  }
  class FakeClipboardEvent extends Event {
    clipboardData: unknown;
    constructor(type: string, init: EventInit & { clipboardData?: unknown }) {
      super(type, init);
      this.clipboardData = init.clipboardData;
    }
  }

  /** Pastes into the editor's canvas; returns what Excalidraw's own listener (on the document) receives. */
  function paste(items: Record<string, string>, { files = [] as unknown[], into = 'canvas', plain = false } = {}) {
    vi.stubGlobal('DataTransfer', FakeDataTransfer);
    vi.stubGlobal('ClipboardEvent', FakeClipboardEvent);
    const container = document.body.appendChild(document.createElement('div'));
    const leftOut = vi.fn();
    mount({ onWebPicturesLeftOut: leftOut }, container);
    const target = into === 'canvas' ? addCanvas(container) : container.appendChild(document.createElement('textarea'));
    const seen: { html: string; text: string }[] = [];
    const excalidraw = (event: Event) => {
      const data = (event as FakeClipboardEvent).clipboardData as FakeDataTransfer;
      seen.push({ html: data.getData('text/html'), text: data.getData('text/plain') });
    };
    document.addEventListener('paste', excalidraw);
    if (plain)
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', metaKey: true, shiftKey: true, bubbles: true }));
    const event = new FakeClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new FakeDataTransfer(items, files),
    });
    target.dispatchEvent(event);
    document.removeEventListener('paste', excalidraw);
    container.remove();
    vi.unstubAllGlobals();
    return { seen, leftOut, stopped: event.defaultPrevented };
  }

  it('goes in as its text, without the pictures Excalidraw would download, and the view says so', () => {
    const { seen, leftOut, stopped } = paste({ 'text/html': PAGE, 'text/plain': 'Tram 28' });
    expect(stopped).toBe(true);
    expect(seen).toEqual([{ html: '', text: 'Tram 28' }]);
    expect(leftOut).toHaveBeenCalledOnce();
  });

  it('is left to Excalidraw when it brings no web pictures, holds a picture file, is a plain paste or goes into a field', () => {
    const cases = [
      paste({ 'text/html': '<p>Tram 28</p><img src="data:image/png;base64,AAAA">', 'text/plain': 'Tram 28' }),
      paste({ 'text/html': PAGE, 'text/plain': 'Tram 28' }, { files: [{ name: 'tram.jpg' }] }),
      paste({ 'text/html': PAGE, 'text/plain': 'Tram 28' }, { plain: true }),
      paste({ 'text/html': PAGE, 'text/plain': 'Tram 28' }, { into: 'field' }),
    ];
    for (const { seen, leftOut, stopped } of cases) {
      expect(stopped).toBe(false);
      expect(seen.map((pasted) => pasted.text)).toEqual(['Tram 28']); // Excalidraw gets the paste as it was
      expect(leftOut).not.toHaveBeenCalled();
    }
  });

  it('is recognised by its <img> with a web address, as Excalidraw recognises it', () => {
    expect(hasWebPictures(PAGE)).toBe(true);
    expect(hasWebPictures('<img src=" http://example.com/a.png">')).toBe(true);
    expect(hasWebPictures('<img src="data:image/png;base64,AAAA"><p>https://example.com</p>')).toBe(false);
    expect(hasWebPictures('')).toBe(false);
  });
});

describe('READ-ONLY: view mode on phones and tablets', () => {
  type ModeProps = { viewModeEnabled?: boolean; UIOptions: { canvasActions: Record<string, unknown> } };

  it('locks Excalidraw in view mode, with nothing in its menu that would change or export the drawing', () => {
    mount({ viewMode: true });
    const props = rendered.at(-1)!.props as ModeProps;
    expect(props.viewModeEnabled).toBe(true);
    expect(props.UIOptions.canvasActions).toEqual({
      loadScene: false,
      saveToActiveFile: false,
      changeViewBackgroundColor: false,
      clearCanvas: false,
      export: false,
      saveAsImage: false,
    });
  });

  it("in the desktop app, leaves view mode to Excalidraw's own switch and keeps image export", () => {
    mount();
    const props = rendered.at(-1)!.props as ModeProps;
    expect('viewModeEnabled' in props).toBe(false);
    expect(props.UIOptions.canvasActions).toEqual({ loadScene: false, saveToActiveFile: false });
  });
});
