// The data safety rules (src/view.ts), one block per rule, against a fake editor and the Obsidian stand-in; then the
// view's Obsidian integration: view state, links, export, keyboard and renames.
import { newElementWith, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkScene, type EditorHandle, type EditorProps, type Scene, type ViewState } from '../src/editor';
import { EMPTY_SCENE, type SceneData } from '../src/scene';
import { ExcalidrawFileView } from '../src/view';
import { ViewStateStore } from '../src/view-state';
import { App, Menu, moved, Notice, TextFileView, type TFile } from './obsidian-mock';

const SAMPLE = readFileSync('tests/fixtures/sample.excalidraw', 'utf8');
const PATH = 'Drawings/sample.excalidraw';
const tick = () => new Promise((resolve) => window.setTimeout(resolve, 0));

type SavedScene = {
  type: string;
  version: number;
  appState: Record<string, unknown>;
  elements: { id: string; x: number; [key: string]: unknown }[];
  files: Record<string, { dataURL: string }>;
  plusMetadata?: unknown;
};

/** Behaves like the Excalidraw editor as seen through EditorHandle. */
class FakeEditor implements EditorHandle {
  scene: Scene;
  updates = 0;
  themes: string[] = [];
  names: string[] = [];
  focused = 0;
  exports = 0;
  unmounted = false;
  constructor(public props: EditorProps) {
    this.scene = FakeEditor.restore(props.scene);
  }
  static restore(scene: SceneData): Scene {
    const { elements, appState, files } = restore(scene as never, null, null, { repairBindings: true });
    // Excalidraw reports the size of its canvas, as shown in the tab.
    return { elements, appState: { ...appState, width: 1000, height: 700 } as never, files };
  }
  /** Excalidraw reports the loaded scene once it has initialized. */
  init() {
    this.props.onChange(this.scene);
  }
  edit(id = 'rect-1', dx = 10) {
    const elements = this.scene.elements.map((el) => (el.id === id ? newElementWith(el, { x: el.x + dx }) : el));
    this.scene = { ...this.scene, elements };
    this.props.onChange(this.scene);
  }
  panZoomSelect() {
    const { appState } = this.scene;
    this.scene = {
      ...this.scene,
      appState: {
        ...appState,
        scrollX: appState.scrollX + 100,
        zoom: { value: 2 as never },
        selectedElementIds: { 'rect-1': true },
      },
    };
    this.props.onChange(this.scene);
  }
  /** Excalidraw marks a picture that failed to load: a new version of its image element, status "error". */
  failPicture(id = 'image-1') {
    const elements = this.scene.elements.map((el) =>
      el.id === id ? newElementWith(el, { status: 'error' } as never) : el,
    );
    this.scene = { ...this.scene, elements };
    this.props.onChange(this.scene);
  }
  x(id = 'rect-1') {
    return this.scene.elements.find((el) => el.id === id)!.x;
  }
  getScene() {
    // A real unmounted Excalidraw reports an empty scene; saving that would wipe the drawing.
    return this.unmounted ? { ...this.scene, elements: [], files: {} } : this.scene;
  }
  /** Like the editor when a picture's data changed on disk: it can't update in place, and asks to be mounted again. */
  picturesChanged = false;
  updateScene(scene: SceneData) {
    this.updates++;
    if (this.picturesChanged) return null;
    const next = FakeEditor.restore(scene);
    // Like Excalidraw: elements apply at once, appState only when React renders, which then reports it.
    this.scene = { ...next, appState: this.scene.appState };
    queueMicrotask(() => {
      this.scene = next;
      this.props.onChange(this.scene);
    });
    return next;
  }
  getViewState(): ViewState {
    const { scrollX, scrollY, zoom } = this.scene.appState;
    return { scrollX, scrollY, zoom: zoom.value };
  }
  setTheme(theme: 'light' | 'dark') {
    this.themes.push(theme);
  }
  setName(name: string) {
    this.names.push(name);
  }
  focus() {
    this.focused++;
  }
  exportImage() {
    this.exports++;
  }
  unmount() {
    this.unmounted = true;
  }
}

type View = ExcalidrawFileView & TextFileView & { requestSave: ReturnType<typeof vi.fn> };

let editors: FakeEditor[];
let app: App;
let plugin: {
  loadEditor: ReturnType<typeof vi.fn>;
  backup: ReturnType<typeof vi.fn>;
  writeNow: ReturnType<typeof vi.fn>;
  rememberView: ReturnType<typeof vi.fn>;
  viewStates: ViewStateStore;
};
let backupLog: { path: string; text: string; writesBefore: number }[];

beforeEach(() => {
  editors = [];
  backupLog = [];
  Notice.messages = [];
  app = new App();
  const lib = {
    serializeAsJSON,
    checkScene,
    mountEditor: (_container: HTMLElement, props: EditorProps) => {
      const editor = new FakeEditor(props);
      editors.push(editor);
      return editor;
    },
  };
  plugin = {
    loadEditor: vi.fn(async () => lib),
    backup: vi.fn((path: string, text: string) => {
      backupLog.push({ path, text, writesBefore: app.vault.writes.length });
    }),
    writeNow: vi.fn((path: string, data: string) => app.vault.diskWrite(path, data)),
    rememberView: vi.fn(),
    viewStates: new ViewStateStore(null),
  };
});

async function openView(file: TFile, leaf: { app: App } = { app }, active = false): Promise<View> {
  const view = new ExcalidrawFileView(leaf as never, plugin as never) as unknown as View;
  // Stand in for the 2 s debounce: tests call save() when the debounce would fire.
  view.requestSave = vi.fn(() => {
    view.dirty = true;
  });
  if (active) app.workspace.activeView = view;
  await view.onOpen();
  await view.loadFile(file);
  await tick(); // lazy editor load
  return view;
}

async function open(text = SAMPLE) {
  const file = app.vault.add(PATH, text);
  const view = await openView(file);
  return { file, view, editor: editors.at(-1)! };
}

const written = (i = -1): SavedScene => JSON.parse(app.vault.writes.at(i)!.data) as SavedScene;
const theirVersion = () => {
  const scene = JSON.parse(SAMPLE) as SavedScene;
  Object.assign(scene.elements[0]!, { x: 300, version: 9, versionNonce: 4242 });
  return JSON.stringify(scene, null, 2);
};

describe('READ-ONLY: a failed load means read-only', () => {
  it.each([
    ['invalid JSON', SAMPLE.slice(0, 400), /Invalid JSON/],
    ['a non-Excalidraw type', '{"type":"excalidrawlib","libraryItems":[]}', /"type" is not "excalidraw"/],
    [
      'an element type this Excalidraw does not know',
      '{"type":"excalidraw","elements":[{"id":"a","type":"hologram","x":0,"y":0,"width":10,"height":10}]}',
      /1 element\(s\) of type "hologram"/,
    ],
  ])(
    '%s: shows an error, never mounts the editor or saves, leaves the file byte-identical',
    async (_, text, reason) => {
      const { file, view } = await open(text);
      expect(view.contentEl.textContent).toContain("Can't open sample.excalidraw");
      expect(view.contentEl.textContent).toMatch(reason);
      expect(editors).toHaveLength(0);
      expect(view.getViewData()).toBe(text);
      expect(view.canExport()).toBe(false);
      await view.save();
      await view.onClose();
      expect(view.requestSave).not.toHaveBeenCalled();
      expect(app.vault.writes).toEqual([]);
      expect(await app.vault.read(file)).toBe(text);
    },
  );

  it('a file that cannot load its editor is also read-only', async () => {
    plugin.loadEditor.mockRejectedValueOnce(new Error('the bundle is broken'));
    const { view } = await open();
    expect(view.contentEl.textContent).toContain('the bundle is broken');
    expect(view.getViewData()).toBe(SAMPLE);
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });
});

describe('NO-EDITOR-NO-WRITE', () => {
  it('returns the original text exactly while the editor is loading', async () => {
    const file = app.vault.add(PATH, SAMPLE);
    const view = new ExcalidrawFileView({ app } as never, plugin as never) as unknown as View;
    await view.loadFile(file); // no tick: the editor is still loading
    expect(view.getViewData()).toBe(SAMPLE);
  });

  it('returns the original text exactly until the editor reports its loaded scene', async () => {
    const { view } = await open();
    expect(view.getViewData()).toBe(SAMPLE);
    await view.save();
    expect(app.vault.writes).toEqual([]);
  });
});

describe('REAL-CHANGES: save only real changes', () => {
  it('pan, zoom and selection never request a save or touch the file', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.panZoomSelect();
    editor.panZoomSelect();
    expect(view.requestSave).not.toHaveBeenCalled();
    await view.save();
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });

  it('an edit requests one save and writes standard Excalidraw JSON', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.edit('rect-1', 10);
    editor.panZoomSelect();
    expect(view.requestSave).toHaveBeenCalledTimes(1);
    await view.save();
    expect(app.vault.writes).toHaveLength(1);
    const saved = written();
    expect(saved).toMatchObject({ type: 'excalidraw', version: 2 });
    expect(saved.elements.find((el) => el.id === 'rect-1')!.x).toBe(110);
    expect(saved.files['file-1']!.dataURL).toMatch(/^data:image\/png;base64,/);
    await view.save(); // nothing new
    expect(app.vault.writes).toHaveLength(1);
  });
});

describe('KEEP-UNKNOWN', () => {
  it('unknown top-level keys survive a save', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.edit();
    await view.save();
    expect(written().plusMetadata).toEqual({ workspace: 'studies', sceneId: 'abc123' });
  });
});

describe('BACKUP: session backup', () => {
  it('copies the original text before the first write, once per opening', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.edit();
    await view.save();
    editor.edit();
    await view.save();
    expect(app.vault.writes).toHaveLength(2);
    expect(backupLog).toEqual([{ path: PATH, text: SAMPLE, writesBefore: 0 }]);
  });

  it('no backup when nothing is written', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.panZoomSelect();
    await view.onClose();
    expect(backupLog).toEqual([]);
  });
});

describe('FLUSH: flush before unmount', () => {
  it('closing the tab writes the pending edit with the live scene, then unmounts', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.edit('rect-1', 25);
    await view.onClose(); // well before the 2 s debounce
    expect(app.vault.writes).toHaveLength(1);
    expect(written().elements).toHaveLength(4);
    expect(written().elements[0]!.x).toBe(125);
    expect(editor.unmounted).toBe(true);
  });

  it('opening another file in the same tab writes the pending edit first', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.edit();
    await view.loadFile(app.vault.add('other.excalidraw', EMPTY_SCENE));
    await tick();
    expect(app.vault.writes.map((w) => w.path)).toEqual([PATH]);
    expect(written().elements[0]!.x).toBe(110);
    expect(editor.unmounted).toBe(true);
    expect(editors).toHaveLength(2);
    expect(view.getViewData()).toBe(EMPTY_SCENE);
  });

  it("quitting the app writes the pending edit (Obsidian's quit hook)", async () => {
    const { view, editor } = await open();
    editor.init();
    editor.edit();
    // What Obsidian's workspace does on "quit" for every TextFileView. Obsidian destroys the window 3 s later, and a
    // hidden window's timers are throttled, so the write must not wait for any timer.
    expect(view.dirty || view.saving || view.data !== view.lastSavedData).toBe(true);
    const saving = view.save();
    for (let i = 0; i < 5; i++) await Promise.resolve(); // microtasks only, no timers
    expect(app.vault.writes).toHaveLength(1);
    expect(written().elements[0]!.x).toBe(110);
    await saving;
  });
});

describe('SYNC-WRITE', () => {
  it('the write gets what Obsidian last read, so a version changed behind its back can be backed up', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.edit();
    await view.save();
    expect(plugin.writeNow).toHaveBeenCalledWith(PATH, expect.stringContaining('"type": "excalidraw"'), SAMPLE);
  });

  it("if the synchronous write fails, Obsidian's own write is used instead", async () => {
    plugin.writeNow.mockImplementationOnce(() => {
      throw new Error('EACCES');
    });
    const { view, editor } = await open();
    editor.init();
    editor.edit();
    await view.save();
    expect(app.vault.writes).toHaveLength(1);
    expect(written().elements[0]!.x).toBe(110);
  });
});

describe('OUTSIDE-CHANGE', () => {
  it('with no local edits: shows the disk version and does not write it back', async () => {
    const { file, view, editor } = await open();
    editor.init();
    app.vault.externalWrite(file, theirVersion());
    await tick();
    expect(editor.updates).toBe(1);
    expect(editor.x()).toBe(300);
    expect(view.requestSave).not.toHaveBeenCalled();
    await view.save();
    expect(app.vault.writes).toEqual([]);
    expect(view.getViewData()).toBe(theirVersion());
    editor.edit(); // later edits build on the new version
    await view.save();
    expect(written().elements[0]!.x).toBe(310);
  });

  it('with no local edits, a new background or grid on disk is shown and not written back', async () => {
    const { file, view, editor } = await open();
    editor.init();
    const scene = JSON.parse(SAMPLE) as SavedScene;
    Object.assign(scene.appState, { viewBackgroundColor: '#ffc9c9', gridModeEnabled: true });
    app.vault.externalWrite(file, JSON.stringify(scene, null, 2));
    await tick();
    expect(editor.scene.appState.viewBackgroundColor).toBe('#ffc9c9');
    expect(view.requestSave).not.toHaveBeenCalled();
    await view.save();
    expect(app.vault.writes).toEqual([]);
    expect(backupLog).toEqual([]);
  });

  it('with unsaved local edits: keeps them, backs up the disk version, saves and tells the user', async () => {
    const { file, view, editor } = await open();
    editor.init();
    editor.edit('rect-1', 10);
    app.vault.externalWrite(file, theirVersion());
    await tick();
    expect(editor.updates).toBe(0);
    expect(backupLog.map((b) => b.text)).toContain(theirVersion());
    expect(Notice.messages.at(-1)).toMatch(/changed on disk.*version from disk is in the session backups/);
    expect(app.vault.writes).toHaveLength(1);
    expect(written().elements[0]!.x).toBe(110);
    expect(await app.vault.read(file)).toBe(view.getViewData());
  });

  it('an outside change adding an element type this Excalidraw does not know switches to read-only', async () => {
    const { file, view, editor } = await open();
    editor.init();
    const scene = JSON.parse(SAMPLE) as SavedScene;
    scene.elements.push({ ...scene.elements[0]!, id: 'note-1', type: 'stickynote' });
    app.vault.externalWrite(file, JSON.stringify(scene));
    await tick();
    expect(editor.updates).toBe(0);
    expect(editor.unmounted).toBe(true);
    expect(view.contentEl.textContent).toMatch(/"stickynote"/);
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });

  it('an outside change that is not valid JSON switches to read-only instead of saving', async () => {
    const { file, view, editor } = await open();
    editor.init();
    app.vault.externalWrite(file, '{ half written');
    await tick();
    expect(editor.unmounted).toBe(true);
    expect(view.contentEl.textContent).toContain('Invalid JSON');
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });

  it('same file in two panes: the other pane reloads after one saves and does not write back', async () => {
    const file = app.vault.add(PATH, SAMPLE);
    const a = await openView(file);
    const b = await openView(file);
    const [editorA, editorB] = editors as [FakeEditor, FakeEditor];
    editorA.init();
    editorB.init();
    editorA.edit('rect-1', 10);
    await a.save();
    await tick();
    expect(editorB.updates).toBe(1);
    expect(editorB.x()).toBe(110);
    await b.save();
    await b.onClose();
    expect(app.vault.writes).toHaveLength(1);
  });
});

describe('REAL-CHANGES: a picture that fails to load', () => {
  it('is not an edit: a drawing whose picture fails to load, opened, writes nothing', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.failPicture();
    expect(view.requestSave).not.toHaveBeenCalled();
    await view.save();
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });

  it('during an unsaved edit, is saved with it', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.edit('rect-1', 10);
    editor.failPicture();
    await view.save();
    const saved = written();
    expect(saved.elements.find((el) => el.id === 'rect-1')!.x).toBe(110);
    expect(saved.elements.find((el) => el.id === 'image-1')!['status']).toBe('error');
  });

  it('together with another change in the same report (an undo bringing back a background), is an edit', async () => {
    const { view, editor } = await open();
    editor.init();
    const elements = editor.scene.elements.map((el) =>
      el.id === 'image-1' ? newElementWith(el, { status: 'error' } as never) : el,
    );
    editor.scene = {
      ...editor.scene,
      elements,
      appState: { ...editor.scene.appState, viewBackgroundColor: '#ffc9c9' },
    };
    editor.props.onChange(editor.scene);
    expect(view.requestSave).toHaveBeenCalled();
  });

  it('with anything else changed on the picture, is an edit', async () => {
    const { view, editor } = await open();
    editor.init();
    const elements = editor.scene.elements.map((el) =>
      el.id === 'image-1' ? newElementWith(el, { status: 'error', x: el.x + 5 } as never) : el,
    );
    editor.scene = { ...editor.scene, elements };
    editor.props.onChange(editor.scene);
    expect(view.requestSave).toHaveBeenCalled();
  });
});

describe('OUTSIDE-CHANGE: pictures and loading', () => {
  it("a picture whose data changed on disk: the editor is mounted again from the file, which isn't written", async () => {
    const { file, view, editor } = await open();
    editor.init();
    editor.picturesChanged = true;
    app.vault.externalWrite(file, theirVersion());
    await tick();
    await tick();
    expect(editors).toHaveLength(2);
    expect(editors[1]!.x()).toBe(300);
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });

  it('a version Excalidraw cannot load switches the tab to read-only, with the reason, and is never overwritten', async () => {
    const { file, view, editor } = await open();
    editor.init();
    const broken = JSON.parse(SAMPLE) as SavedScene;
    broken.elements[0]!['boundElements'] = [null];
    app.vault.externalWrite(file, JSON.stringify(broken));
    await tick();
    expect(editor.unmounted).toBe(true);
    expect(view.contentEl.textContent).toMatch(/Excalidraw cannot load it/);
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });
});

describe('VIEW-STATE', () => {
  it("the editor starts at the drawing's saved scroll and zoom; with none, it fits the drawing", async () => {
    plugin.viewStates.set(PATH, { scrollX: -120, scrollY: 40, zoom: 1.5 });
    const { editor } = await open();
    expect(editor.props.viewState).toEqual({ scrollX: -120, scrollY: 40, zoom: 1.5 });
    const other = await openView(app.vault.add('other.excalidraw', EMPTY_SCENE));
    expect(editors.at(-1)!.props.viewState).toBeNull();
    await other.onClose();
  });

  it('the view of a canvas with no size yet (a tab opened in the background) is not remembered', async () => {
    const { editor } = await open();
    editor.init();
    plugin.rememberView.mockClear();
    editor.props.onChange({ ...editor.scene, appState: { ...editor.scene.appState, width: 0, height: 0 } });
    expect(plugin.rememberView).not.toHaveBeenCalled();
  });

  it('panning and zooming are remembered, and never written to the drawing', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.panZoomSelect();
    expect(plugin.rememberView).toHaveBeenLastCalledWith(PATH, editor.getViewState());
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });
});

describe('Obsidian integration', () => {
  it('follows the Obsidian theme live', async () => {
    document.body.classList.add('theme-dark');
    const { editor } = await open();
    expect(editor.props.theme).toBe('dark');
    document.body.classList.remove('theme-dark');
    app.workspace.trigger('css-change');
    expect(editor.themes).toEqual(['light']);
  });

  it('LINKS: a note link opens in Obsidian, a web link in the browser, a script link nowhere', async () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { editor } = await open();
    editor.props.onLinkOpen('[[Sharding#Hash ranges|ranges]]', new MouseEvent('click'));
    editor.props.onLinkOpen('Meeting notes', new MouseEvent('click', { metaKey: true }));
    expect(app.workspace.links).toEqual([
      { linktext: 'Sharding#Hash ranges', sourcePath: PATH, newLeaf: false },
      { linktext: 'Meeting notes', sourcePath: PATH, newLeaf: 'tab' },
    ]);
    editor.props.onLinkOpen('https://excalidraw.com', new MouseEvent('click'));
    editor.props.onLinkOpen('javascript:alert(1)', new MouseEvent('click'));
    editor.props.onLinkOpen('about:blank', new MouseEvent('click'));
    expect(opened.mock.calls).toEqual([['https://excalidraw.com', '_blank']]);
    expect(app.workspace.links).toHaveLength(2);
    opened.mockRestore();
  });

  it('LINKS: a web address typed without https:// opens in the browser, unless it names a file in the vault', async () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    app.vault.add('Notes/www.example.com.md', '# A note named like a web address');
    const { editor } = await open();
    const links = [
      'www.example.com/docs',
      'github.com/excalidraw/excalidraw',
      'example.com',
      'Sharding.md',
      'v1.2',
      '[[example.com]]',
      'www.example.com',
    ];
    for (const link of links) editor.props.onLinkOpen(link, new MouseEvent('click'));
    expect(opened.mock.calls).toEqual([
      ['https://www.example.com/docs', '_blank'],
      ['https://github.com/excalidraw/excalidraw', '_blank'],
      ['https://example.com', '_blank'],
    ]);
    expect(app.workspace.links.map((l) => l.linktext)).toEqual([
      'Sharding.md',
      'v1.2',
      'example.com',
      'www.example.com',
    ]);
    opened.mockRestore();
  });

  it('another drawing opened from this tab opens in Excaliboard too, whichever plugin claims .excalidraw', async () => {
    const { view } = await open();
    expect(view.canAcceptExtension('excalidraw')).toBe(true);
    expect(view.canAcceptExtension('md')).toBe(false);
  });

  it("EXPORT: the tab's menu offers Export image, which opens the editor's export dialog", async () => {
    const { view, editor } = await open();
    expect(view.canExport()).toBe(true);
    const menu = new Menu();
    view.onPaneMenu(menu as never, 'more-options');
    expect(menu.items.map((i) => [i.section, i.title])).toEqual([['action', 'Export image']]);
    menu.items[0]!.click?.();
    expect(editor.exports).toBe(1);
  });

  it('FOCUS: the canvas takes the keyboard as it mounts only when its tab is the active one', async () => {
    const restored = await openView(app.vault.add('in a split.excalidraw', SAMPLE)); // e.g. restored at startup
    expect(editors.at(-1)!.props.autoFocus).toBe(false);
    const opened = await openView(app.vault.add(PATH, SAMPLE), { app }, true);
    expect(editors.at(-1)!.props.autoFocus).toBe(true);
    await restored.onClose();
    await opened.onClose();
  });

  it('FOCUS: the canvas takes the keyboard when its tab becomes active, unless the click focused something in it', async () => {
    const leaf = { app };
    const view = await openView(app.vault.add(PATH, SAMPLE), leaf);
    document.body.append(view.containerEl);
    const editor = editors[0]!;
    app.workspace.setActiveLeaf({ app }, null); // another tab
    await tick();
    expect(editor.focused).toBe(0);
    // A click on the tab's title, to rename the drawing: Obsidian makes the tab active, the click focuses the title,
    // and Obsidian reports the change after that.
    app.workspace.setActiveLeaf(leaf, view);
    view.titleEl.focus();
    await tick();
    expect(editor.focused).toBe(0);
    expect(document.activeElement).toBe(view.titleEl);
    // Coming to the tab from outside it (its tab header, the file explorer, a hotkey).
    view.titleEl.blur();
    app.workspace.setActiveLeaf(leaf, view);
    await tick();
    expect(editor.focused).toBe(1);
    view.containerEl.remove();
    await view.onClose();
  });

  it('FOCUS: a focus that waited for the canvas is applied only if the tab is still active, with its title not focused', async () => {
    const view = await openView(app.vault.add(PATH, SAMPLE), { app }, true);
    document.body.append(view.containerEl);
    const { canFocus } = editors.at(-1)!.props;
    expect(canFocus()).toBe(true);
    view.titleEl.focus();
    expect(canFocus()).toBe(false);
    view.titleEl.blur();
    app.workspace.activeView = null; // another tab
    expect(canFocus()).toBe(false);
    view.containerEl.remove();
    await view.onClose();
  });

  it('NO-NETWORK: a paste that left web pictures out is explained', async () => {
    const { editor } = await open();
    editor.props.onWebPicturesLeftOut();
    expect(Notice.messages.at(-1)).toMatch(/^Pasted the text without its pictures: they are on the web/);
  });

  it('WINDOWS: in a separate window, a panel says to move the tab back, and nothing is written', async () => {
    const view = new ExcalidrawFileView({ app } as never, plugin as never) as unknown as View;
    moved(view.contentEl, {}); // a tab restored in a separate window
    await view.onOpen();
    await view.loadFile(app.vault.add(PATH, SAMPLE));
    await tick();
    expect(editors).toEqual([]);
    expect(view.contentEl.textContent).toMatch(
      /can't edit a drawing in a separate window yet.*Any edits made before are saved\.$/,
    );
    await view.save();
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });

  it('WINDOWS: moving the tab to another window saves the edit first; moving it back brings the editor back', async () => {
    const { view, editor } = await open();
    editor.init();
    editor.edit('rect-1', 10);
    moved(view.contentEl, {});
    await tick();
    await tick();
    expect(written().elements[0]!.x).toBe(110);
    expect(editor.unmounted).toBe(true);
    expect(view.contentEl.textContent).toMatch(/separate window/);
    moved(view.contentEl, window);
    await tick();
    await tick();
    const back = editors.at(-1)!;
    expect(back).not.toBe(editor);
    back.init();
    expect(back.x()).toBe(110);
    await view.onClose();
    expect(app.vault.writes).toHaveLength(1);
  });

  it('a rename of the drawing gives image exports the new name and writes nothing; other renames change nothing', async () => {
    const { file, view, editor } = await open();
    editor.init();
    app.vault.trigger('rename', app.vault.add('Notes/Other.md', ''), 'Other.md');
    await tick();
    expect(editor.names).toEqual([]);
    file.path = 'Drawings/renamed.excalidraw';
    app.vault.trigger('rename', file, PATH);
    await tick();
    expect(editor.names).toEqual(['renamed']);
    await view.onClose();
    expect(app.vault.writes).toEqual([]);
  });

  it('KEYS: claims the Excalidraw shortcuts Obsidian would take, without preventing the default', async () => {
    const { view } = await open();
    const keys = (view.scope as unknown as { keys: { modifiers: string[]; key: string; func: () => unknown }[] }).keys;
    expect(keys.map((k) => `${k.modifiers.join('+')}+${k.key}`)).toEqual([
      'Mod+g',
      'Mod+k',
      'Mod+d',
      'Mod+f',
      'Mod+Enter',
    ]);
    expect(keys.every((k) => k.func() === true)).toBe(true);
  });

  it("shows the file's basename as the tab title", async () => {
    const { view } = await open();
    expect(view.getDisplayText()).toBe('sample');
  });
});
