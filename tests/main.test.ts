// The plugin shell (src/main.ts) with the Obsidian stand-in: opening, new drawings, export, view state, the safe
// write and session backups through the vault adapter, and the read-only phone and tablet app.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExcaliboardPlugin, { copyName, hashPath, newDrawingName } from '../src/main';
import { EMPTY_SCENE } from '../src/scene';
import { ExcalidrawFileView } from '../src/view';
import {
  App,
  Menu,
  MOBILE_APP,
  MOBILE_EMULATION,
  Notice,
  Platform,
  TextFileView,
  TFile,
  TFolder,
} from './obsidian-mock';

const DIR = 'custom-config/plugins/excaliboard'; // the config folder isn't always .obsidian (Vault#configDir)
let app: App;

const make = async (
  setup?: (plugin: ExcaliboardPlugin & { extensionsTakenBy: string | null; stored: unknown }) => void,
) => {
  const plugin = new ExcaliboardPlugin(app as never, { id: 'excaliboard', dir: DIR } as never) as ExcaliboardPlugin & {
    extensionsTakenBy: string | null;
    extensionCalls: string[][];
    stored: unknown;
    commands: { id: string; callback?: () => unknown; checkCallback?: (checking: boolean) => boolean }[];
    ribbon: { cb: () => unknown }[];
    settingTabs: unknown[];
  };
  setup?.(plugin);
  await plugin.onload();
  return plugin;
};

beforeEach(() => {
  app = new App();
  Notice.messages = [];
});
afterEach(() => vi.useRealTimers());

describe('OPEN', () => {
  it('claims .excalidraw files once Obsidian has loaded the plugins enabled at startup', async () => {
    app.workspace.layoutReady = false;
    const plugin = await make();
    expect(plugin.extensionCalls).toEqual([]);
    app.workspace.finishLayout();
    expect(plugin.extensionCalls).toEqual([['excalidraw']]);
    expect(plugin.ownsExtension).toBe(true);
    plugin.onUserEnable();
    expect(Notice.messages).toEqual([]);
  });

  it('claims them when the community Excalidraw plugin is installed but turned off, so drawings stay visible', async () => {
    app.plugins.manifests['obsidian-excalidraw-plugin'] = { id: 'obsidian-excalidraw-plugin' };
    const plugin = await make();
    expect(plugin.ownsExtension).toBe(true);
  });

  it('claims them when the Excalidraw plugin is listed as turned on but not installed here (synced settings)', async () => {
    app.plugins.enabledPlugins.add('obsidian-excalidraw-plugin');
    const plugin = await make();
    expect(plugin.ownsExtension).toBe(true);
  });

  it('waits for its claim at layout ready before taking freed files (plugins change the registry as they load)', async () => {
    vi.useFakeTimers();
    app.workspace.layoutReady = false;
    const plugin = await make();
    app.viewRegistry.trigger('extensions-updated'); // another plugin registered its own file type while loading
    await vi.advanceTimersByTimeAsync(0);
    expect(plugin.extensionCalls).toEqual([]);
    app.workspace.finishLayout();
    expect(plugin.ownsExtension).toBe(true);
  });

  it('takes them when the plugin that had them is turned off, but not while Excaliboard itself unloads', async () => {
    vi.useFakeTimers();
    const plugin = await make((p) => (p.extensionsTakenBy = 'obsidian-excalidraw-plugin'));
    expect(plugin.ownsExtension).toBe(false);
    plugin.extensionsTakenBy = null; // turned off: Obsidian unregisters its extension
    app.viewRegistry.trigger('extensions-updated');
    await vi.advanceTimersByTimeAsync(0);
    expect(plugin.ownsExtension).toBe(true);
    const other = await make((p) => (p.extensionsTakenBy = 'obsidian-excalidraw-plugin'));
    other.onunload();
    other.extensionsTakenBy = null;
    app.viewRegistry.registered.clear();
    app.viewRegistry.trigger('extensions-updated');
    await vi.advanceTimersByTimeAsync(0);
    expect(other.ownsExtension).toBe(false);
  });

  it('leaves them to the Excalidraw plugin while it is turned on, even before it has loaded', async () => {
    app.plugins.enabledPlugins.add('obsidian-excalidraw-plugin'); // loads after Excaliboard, after the layout
    app.plugins.manifests['obsidian-excalidraw-plugin'] = { id: 'obsidian-excalidraw-plugin' };
    const plugin = await make();
    expect(plugin.extensionCalls).toEqual([]);
    expect(plugin.ownsExtension).toBe(false);
    expect(Notice.messages).toEqual([]);
  });

  it('leaves them to a plugin that opened them at startup, saying so only when turned on in the settings', async () => {
    const plugin = await make((p) => (p.extensionsTakenBy = 'obsidian-excalidraw-plugin'));
    expect(plugin.ownsExtension).toBe(false);
    expect(Notice.messages).toEqual([]); // nothing at each startup
    plugin.onUserEnable();
    expect(Notice.messages.at(-1)).toMatch(/^Another plugin opens \.excalidraw files.*“Open in Excaliboard”/);
  });

  it('still loads when another plugin already opens .excalidraw files, and offers "Open in Excaliboard"', async () => {
    const plugin = await make((p) => (p.extensionsTakenBy = 'just-another-drawing-plugin'));
    expect(plugin.ownsExtension).toBe(false);
    expect(Notice.messages).toEqual([]);
    plugin.onUserEnable();
    expect(Notice.messages.at(-1)).toMatch(/Another plugin opens \.excalidraw files.*Open in Excaliboard/);
    const menu = new Menu();
    const file = app.vault.add('Board.excalidraw', EMPTY_SCENE);
    app.workspace.trigger('file-menu', menu, file, 'file-explorer');
    expect(menu.items.map((i) => [i.section, i.title])).toEqual([['open', 'Open in Excaliboard']]);
    await menu.items[0]!.click?.();
    expect(app.workspace.leaves.at(-1)!.opened).toEqual([
      { state: { type: 'excaliboard', state: { file: 'Board.excalidraw' }, active: true } },
    ]);
  });

  it('offers nothing extra for a drawing it opens itself, or for other files', async () => {
    await make();
    const menu = new Menu();
    app.workspace.trigger('file-menu', menu, app.vault.add('Board.excalidraw', EMPTY_SCENE), 'file-explorer');
    app.workspace.trigger('file-menu', menu, app.vault.add('Note.md', '# Note'), 'file-explorer');
    expect(menu.items).toEqual([]);
  });
});

describe('NEW', () => {
  const created = () => [...app.vault.contents.keys()].map((f) => f.path);
  /** What the new tab opened: always Excaliboard's view, whichever plugin claims .excalidraw files. */
  const openedIn = (path: string) => [{ state: { type: 'excaliboard', state: { file: path }, active: true } }];

  it('names a new drawing after the local date and time', () => {
    expect(newDrawingName(new Date(2026, 10, 8, 9, 5))).toBe('Drawing 2026-11-08 0905');
  });

  it('"New drawing" in a folder\'s menu makes it in that folder and opens it in a new tab', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 14, 2));
    await make();
    const menu = new Menu();
    const folder = await app.vault.createFolder('Studies');
    app.workspace.trigger('file-menu', menu, folder, 'file-explorer');
    expect(menu.items.map((i) => [i.section, i.title])).toEqual([['action-primary', 'New drawing']]);
    await menu.items[0]!.click?.();
    expect(created()).toEqual(['Studies/Drawing 2026-11-08 1402.excalidraw']);
    expect(await app.vault.read([...app.vault.contents.keys()][0]!)).toBe(EMPTY_SCENE);
    const leaf = app.workspace.leaves.at(-1)!;
    expect(leaf.kind).toBe('tab');
    expect(leaf.opened).toEqual(openedIn('Studies/Drawing 2026-11-08 1402.excalidraw'));
  });

  it('opens a new drawing in Excaliboard even when another plugin claims .excalidraw files', async () => {
    const plugin = await make((p) => (p.extensionsTakenBy = 'obsidian-excalidraw-plugin'));
    await plugin.createDrawing();
    expect(app.workspace.leaves.at(-1)!.opened).toEqual(openedIn(created()[0]!));
  });

  it('with no folder set, puts it where Obsidian puts new notes, and never overwrites a drawing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 14, 2));
    const plugin = await make();
    app.fileManager.newFileParent = new TFolder('Inbox');
    app.vault.add('Inbox/Drawing 2026-11-08 1402.excalidraw', 'mine');
    app.workspace.activeFile = app.vault.add('Notes/Today.md', '');
    await plugin.createDrawing();
    expect(created()).toEqual([
      'Inbox/Drawing 2026-11-08 1402.excalidraw',
      'Notes/Today.md',
      'Inbox/Drawing 2026-11-08 1402 1.excalidraw',
    ]);
    // Asked like for a new note: with a file name, Obsidian 1.15 would log an error for .excalidraw.
    expect(app.fileManager.parentCalls).toEqual([['Notes/Today.md']]);
  });

  it('uses the folder from the settings, creating it if needed; a file of that name is an error, not a crash', async () => {
    const plugin = await make((p) => (p.stored = { folder: 'Drawings' }));
    await plugin.createDrawing();
    expect(app.vault.folders.has('Drawings')).toBe(true);
    expect(created()[0]).toMatch(/^Drawings\/Drawing /);
    app.vault.add('Notes', 'a file');
    await plugin.setFolder('Notes');
    await plugin.createDrawing();
    expect(Notice.messages.at(-1)).toMatch(
      /^Could not create a new drawing: “Notes” in the settings is a file, not a folder/,
    );
    expect(created()).toHaveLength(2);
  });

  it('finds the settings folder whatever its case, as macOS and Windows do', async () => {
    await app.vault.createFolder('Sketches/2026');
    const plugin = await make((p) => (p.stored = { folder: 'sketches/2026' }));
    await plugin.createDrawing();
    expect(created()[0]).toMatch(/^Sketches\/2026\/Drawing /);
    expect(Notice.messages).toEqual([]);
  });

  it('refuses a hidden settings folder, which Obsidian would not show, and reports errors in one sentence', async () => {
    const plugin = await make((p) => (p.stored = { folder: '.drawings' }));
    await plugin.createDrawing();
    expect(Notice.messages.at(-1)).toBe(
      'Could not create a new drawing: the folder “.drawings” in the settings is hidden (a name in it starts with a dot).',
    );
    await plugin.setFolder('Drawings');
    app.vault.createFolder = () => Promise.reject(new Error('Disk full.'));
    await plugin.createDrawing();
    expect(Notice.messages.at(-1)).toBe('Could not create a new drawing: Disk full.');
    expect(created()).toEqual([]);
  });

  it('the ribbon button and the command create a drawing too', async () => {
    const plugin = await make();
    expect(plugin.commands.map((c) => c.id)).toEqual(['create-drawing', 'export-image']);
    expect(plugin.commands[1]!.checkCallback!(true)).toBe(false); // no drawing is active
    await plugin.ribbon[0]!.cb();
    await plugin.commands[0]!.callback!();
    await vi.waitFor(() => expect(created()).toHaveLength(2));
    expect(app.workspace.leaves.map((leaf) => leaf.opened)).toEqual(created().map(openedIn));
  });
});

describe('VIEW-STATE', () => {
  it('keeps scroll and zoom in data.json 1.5 s after a change, with the settings', async () => {
    vi.useFakeTimers();
    const plugin = await make((p) => (p.stored = { folder: 'Drawings' }));
    plugin.rememberView('a.excalidraw', { scrollX: 10, scrollY: 20, zoom: 2 });
    expect(plugin.stored).toEqual({ folder: 'Drawings' });
    await vi.advanceTimersByTimeAsync(1500);
    expect(plugin.stored).toMatchObject({
      folder: 'Drawings',
      viewStates: { version: 1, drawings: { 'a.excalidraw': { view: { scrollX: 10, scrollY: 20, zoom: 2 } } } },
    });
  });

  it('follows renames and deletes, and is written when Obsidian quits with a change still waiting', async () => {
    const plugin = await make();
    plugin.rememberView('Old/a.excalidraw', { scrollX: 1, scrollY: 2, zoom: 1 });
    app.vault.trigger('rename', new TFile('New/a.excalidraw'), 'Old/a.excalidraw');
    expect(plugin.viewStates.get('New/a.excalidraw')).toEqual({ scrollX: 1, scrollY: 2, zoom: 1 });
    app.vault.trigger('delete', new TFile('New/a.excalidraw'));
    expect(plugin.viewStates.size).toBe(0);
    const tasks: (() => Promise<void>)[] = [];
    app.workspace.trigger('quit', { add: (task: () => Promise<void>) => tasks.push(task) });
    await tasks[0]!();
    expect(plugin.stored).toEqual({ folder: '', viewStates: { version: 1, drawings: {} } });
  });

  it('quitting with nothing waiting writes nothing', async () => {
    const plugin = await make((p) => (p.stored = { folder: 'Drawings' }));
    const tasks: unknown[] = [];
    app.workspace.trigger('quit', { add: (task: unknown) => tasks.push(task) });
    expect(tasks).toEqual([]);
    expect(plugin.stored).toEqual({ folder: 'Drawings' });
  });

  it('a data.json changed by sync replaces the settings and view states, and cancels the write still waiting', async () => {
    vi.useFakeTimers();
    const plugin = await make((p) => (p.stored = { folder: 'Drawings' }));
    plugin.rememberView('a.excalidraw', { scrollX: 1, scrollY: 2, zoom: 1 });
    const synced = { folder: 'Sketches', viewStates: { version: 1, drawings: {} } };
    plugin.stored = synced;
    await plugin.onExternalSettingsChange();
    expect(plugin.settings.folder).toBe('Sketches');
    expect(plugin.viewStates.size).toBe(0);
    await vi.advanceTimersByTimeAsync(1500);
    expect(plugin.stored).toBe(synced);
  });

  it('reads whatever data.json holds without throwing', async () => {
    const plugin = await make(
      (p) => (p.stored = { folder: 7, viewStates: { drawings: { 'a.excalidraw': { view: 'bad' } } } }),
    );
    expect(plugin.settings.folder).toBe('');
    expect(plugin.viewStates.size).toBe(0);
  });
});

it('on an Obsidian without the save step the data safety rules rely on, says so', async () => {
  const proto = TextFileView.prototype as unknown as { writeData?: unknown };
  const writeData = proto.writeData;
  delete proto.writeData;
  try {
    await make();
  } finally {
    proto.writeData = writeData;
  }
  expect(Notice.messages.at(-1)).toBe(
    'Excaliboard needs Obsidian 1.15 or later to save drawings safely. Please update Obsidian.',
  );
});

describe('SAFE-WRITE and BACKUP, through the vault adapter', () => {
  const adapter = () => app.vault.adapter;
  const COPY = `${DIR}/saving/${copyName('a.excalidraw')}`;
  const backups = (path: string) => {
    const dir = `${DIR}/backups/${hashPath(path)}/`;
    return [...adapter().files.keys()]
      .filter((p) => p.startsWith(dir))
      .sort()
      .map((p) => adapter().files.get(p));
  };
  /** Obsidian's own write of a drawing, as TextFileView's write step makes it. */
  const obsidianWrite = (file: TFile, text: string) => () => app.vault.modify(file, text);

  it("writes a copy of the new version first, then the drawing with Obsidian's own write, then removes the copy", async () => {
    const plugin = await make();
    const file = app.vault.add('a.excalidraw', 'what Obsidian read');
    await plugin.writeDrawing('a.excalidraw', 'mine', 'what Obsidian read', obsidianWrite(file, 'mine'));
    expect(await app.vault.read(file)).toBe('mine');
    expect(adapter().log).toEqual([`write ${COPY}`, 'write a.excalidraw', `remove ${COPY}`]);
  });

  it('keeps the copy when the write fails, as the write may have emptied the drawing before failing', async () => {
    const plugin = await make();
    const file = app.vault.add('a.excalidraw', 'what Obsidian read');
    adapter().failWrites = /^a\.excalidraw$/;
    await expect(
      plugin.writeDrawing('a.excalidraw', 'mine', 'what Obsidian read', obsidianWrite(file, 'mine')),
    ).rejects.toThrow('EACCES');
    expect(adapter().files.get(COPY)).toBe('mine');
  });

  it('still saves the drawing when its copy cannot be written', async () => {
    const plugin = await make();
    const file = app.vault.add('a.excalidraw', 'what Obsidian read');
    adapter().failWrites = /\/saving\b/;
    await plugin.writeDrawing('a.excalidraw', 'mine', 'what Obsidian read', obsidianWrite(file, 'mine'));
    expect(await app.vault.read(file)).toBe('mine');
  });

  it('backs up a version that changed on disk since Obsidian last read it, before writing over it', async () => {
    const plugin = await make();
    const file = app.vault.add('a.excalidraw', 'theirs, synced a moment ago');
    await plugin.writeDrawing('a.excalidraw', 'mine', 'what Obsidian read', obsidianWrite(file, 'mine'));
    expect(await app.vault.read(file)).toBe('mine');
    expect(backups('a.excalidraw')).toEqual(['theirs, synced a moment ago']);
    expect(Notice.messages.at(-1)).toMatch(/“a\.excalidraw” changed on disk just before it was saved/);
  });

  it('backs up nothing when the disk holds what Obsidian last read', async () => {
    const plugin = await make();
    const file = app.vault.add('a.excalidraw', 'what Obsidian read');
    await plugin.writeDrawing('a.excalidraw', 'mine', 'what Obsidian read', obsidianWrite(file, 'mine'));
    expect(Notice.messages).toEqual([]);
    expect(backups('a.excalidraw')).toEqual([]);
  });

  it('a byte order mark on disk, which Obsidian drops when it reads, is not a change', async () => {
    const plugin = await make();
    const file = app.vault.add('a.excalidraw', '﻿what Obsidian read');
    await plugin.writeDrawing('a.excalidraw', 'mine', 'what Obsidian read', obsidianWrite(file, 'mine'));
    expect(Notice.messages).toEqual([]);
    expect(backups('a.excalidraw')).toEqual([]);
    expect(await app.vault.read(file)).toBe('mine');
  });

  it('keeps the newest 5 backups per drawing, in a folder named after its path', async () => {
    const plugin = await make();
    vi.useFakeTimers({ toFake: ['Date'] });
    for (let i = 0; i < 7; i++) {
      vi.setSystemTime(new Date(2026, 10, 7, 12, 0, i));
      await plugin.backup('a.excalidraw', `v${i}`);
    }
    await plugin.backup('b.excalidraw', 'other');
    expect(backups('a.excalidraw')).toEqual(['v2', 'v3', 'v4', 'v5', 'v6']);
    expect(backups('b.excalidraw')).toEqual(['other']);
  });

  it('two backups in the same millisecond are both kept, in order', async () => {
    const plugin = await make();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 7, 12, 0, 0));
    await plugin.backup('a.excalidraw', 'disk version');
    await plugin.backup('a.excalidraw', 'opened version');
    expect(backups('a.excalidraw')).toEqual(['disk version', 'opened version']);
  });

  it('a failed backup is reported, and does not stop the save', async () => {
    const plugin = await make();
    const file = app.vault.add('a.excalidraw', 'theirs, synced a moment ago');
    adapter().failWrites = /\/backups\//;
    await plugin.writeDrawing('a.excalidraw', 'mine', 'what Obsidian read', obsidianWrite(file, 'mine'));
    expect(Notice.messages).toContain('Could not back up “a.excalidraw” before saving it. The save went ahead.');
    expect(await app.vault.read(file)).toBe('mine');
  });

  it("names a drawing's copy after two hashes of its path", () => {
    expect(copyName('a.excalidraw')).toMatch(/^[0-9a-f]{16}\.excalidraw$/);
    expect(copyName('a.excalidraw')).not.toBe(copyName('b.excalidraw'));
  });

  describe('a drawing cut off by quitting during its write', () => {
    it('gets its copy back, and the cut-off file goes to the session backups', async () => {
      const plugin = await make();
      const cut = EMPTY_SCENE.slice(0, 40);
      const file = app.vault.add('a.excalidraw', cut);
      adapter().files.set(COPY, EMPTY_SCENE);
      expect(await plugin.recover(file as never)).toBe(true);
      expect(await app.vault.read(file)).toBe(EMPTY_SCENE);
      expect(backups('a.excalidraw')).toEqual([cut]);
      expect(adapter().files.has(COPY)).toBe(false);
      expect(Notice.messages.at(-1)).toMatch(/^“a\.excalidraw” was cut off when Obsidian closed during its last save/);
    });

    it('is left as it is without a copy, with a copy that was cut off itself, or while it is being written', async () => {
      const plugin = await make();
      const file = app.vault.add('a.excalidraw', 'not a drawing');
      expect(await plugin.recover(file as never)).toBe(false);
      adapter().files.set(COPY, EMPTY_SCENE.slice(0, 30));
      expect(await plugin.recover(file as never)).toBe(false);
      adapter().files.set(COPY, EMPTY_SCENE);
      let finish = () => {};
      const writing = plugin.writeDrawing(
        'a.excalidraw',
        EMPTY_SCENE,
        'not a drawing',
        () => new Promise((resolve) => (finish = resolve)),
      );
      await vi.waitFor(() => expect(adapter().log).toContain(`write ${COPY}`));
      expect(await plugin.recover(file as never)).toBe(false);
      finish();
      await writing;
      expect(app.vault.writes).toEqual([]);
    });
  });

  it('saves each drawing with an edit waiting when the window loses focus or is hidden, and before a quit', async () => {
    const plugin = await make();
    const saved: string[] = [];
    const drawing = (name: string, unsaved: boolean, fails = false) => {
      const leaf = app.workspace.getLeaf('tab');
      leaf.view = Object.assign(Object.create(ExcalidrawFileView.prototype) as ExcalidrawFileView, {
        hasUnsavedEdit: () => unsaved,
        save: async () => {
          if (fails) throw new Error('EACCES');
          saved.push(name);
        },
      });
    };
    drawing('edited', true);
    drawing('unchanged', false);
    drawing('failing', true, true);
    window.dispatchEvent(new Event('blur'));
    await vi.waitFor(() => expect(saved).toEqual(['edited']));
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    hidden.mockRestore();
    await vi.waitFor(() => expect(saved).toEqual(['edited', 'edited']));
    const tasks: (() => Promise<void>)[] = [];
    app.workspace.trigger('quit', { add: (task: () => Promise<void>) => tasks.push(task) });
    expect(tasks).toHaveLength(1);
    await tasks[0]!(); // a save that fails doesn't keep Obsidian from closing
    expect(saved).toEqual(['edited', 'edited', 'edited']);
    void plugin;
  });
});

describe('MOBILE: read-only on phones and tablets', () => {
  const folderMenu = async () => {
    const menu = new Menu();
    app.workspace.trigger('file-menu', menu, await app.vault.createFolder('Studies'), 'file-explorer');
    return menu.items.map((i) => i.title);
  };

  it.each([
    ['the mobile app', MOBILE_APP],
    ["the desktop app's mobile emulation", MOBILE_EMULATION],
  ])('in %s, drawings open read-only: nothing creates or exports one, and there are no settings', async (_, flags) => {
    Object.assign(Platform, flags);
    const plugin = await make();
    expect(plugin.readOnly).toBe(true);
    expect(plugin.ownsExtension).toBe(true); // .excalidraw files still open in Excaliboard
    expect(plugin.ribbon).toEqual([]);
    expect(plugin.commands).toEqual([]);
    expect(plugin.settingTabs).toEqual([]);
    expect(await folderMenu()).toEqual([]);
  });

  it('in the desktop app, drawings are editable, with the ribbon button, the commands and the settings', async () => {
    const plugin = await make();
    expect(plugin.readOnly).toBe(false);
    expect(plugin.ribbon).toHaveLength(1);
    expect(plugin.commands.map((c) => c.id)).toEqual(['create-drawing', 'export-image']);
    expect(plugin.settingTabs).toHaveLength(1);
    expect(await folderMenu()).toEqual(['New drawing']);
  });

  it('still offers "Open in Excaliboard" while another plugin opens .excalidraw files', async () => {
    Object.assign(Platform, MOBILE_APP);
    await make((p) => (p.extensionsTakenBy = 'obsidian-excalidraw-plugin'));
    const menu = new Menu();
    app.workspace.trigger('file-menu', menu, app.vault.add('Board.excalidraw', EMPTY_SCENE), 'file-explorer');
    expect(menu.items.map((i) => i.title)).toEqual(['Open in Excaliboard']);
  });

  it('writes nothing: no drawing, no backup, no copy put back', async () => {
    Object.assign(Platform, MOBILE_APP);
    const plugin = await make();
    const file = app.vault.add('a.excalidraw', 'not a drawing');
    app.vault.adapter.files.set(`${DIR}/saving/${copyName('a.excalidraw')}`, EMPTY_SCENE);
    await expect(
      plugin.writeDrawing('a.excalidraw', 'mine', 'theirs', () => app.vault.modify(file, 'mine')),
    ).rejects.toThrow("Excaliboard doesn't write drawings on this device");
    await plugin.backup('a.excalidraw', 'the version on disk');
    expect(await plugin.recover(file as never)).toBe(false);
    expect(app.vault.writes).toEqual([]);
    expect(app.vault.adapter.log).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("never uses Node, in the desktop app either: every file goes through Obsidian's vault API", async () => {
    const nodeRequire = vi.spyOn(window as unknown as { require: (id: string) => unknown }, 'require');
    try {
      const plugin = await make();
      const file = app.vault.add('a.excalidraw', 'theirs');
      await plugin.writeDrawing('a.excalidraw', 'mine', 'what Obsidian read', () => app.vault.modify(file, 'mine'));
      await plugin.backup('a.excalidraw', 'mine');
      await plugin.recover(file as never);
      expect(await app.vault.read(file)).toBe('mine');
      expect(nodeRequire).not.toHaveBeenCalled();
    } finally {
      nodeRequire.mockRestore();
    }
  });

  it('keeps scroll and zoom in data.json, as in the desktop app', async () => {
    vi.useFakeTimers();
    Object.assign(Platform, MOBILE_APP);
    const plugin = await make((p) => (p.stored = { folder: 'Drawings' }));
    plugin.rememberView('a.excalidraw', { scrollX: 1, scrollY: 2, zoom: 3 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(plugin.stored).toMatchObject({
      folder: 'Drawings', // the setting from the desktop app is kept
      viewStates: { drawings: { 'a.excalidraw': { view: { scrollX: 1, scrollY: 2, zoom: 3 } } } },
    });
  });

  it("doesn't ask for a newer Obsidian to save safely, as it saves nothing", async () => {
    Object.assign(Platform, MOBILE_APP);
    const proto = TextFileView.prototype as unknown as { writeData?: unknown };
    const writeData = proto.writeData;
    delete proto.writeData;
    try {
      await make();
    } finally {
      proto.writeData = writeData;
    }
    expect(Notice.messages).toEqual([]);
  });
});
