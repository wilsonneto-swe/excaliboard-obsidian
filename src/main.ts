/**
 * Excaliboard for Obsidian (names: constants.ts): .excalidraw files open in the official Excalidraw editor and stay
 * plain Excalidraw JSON. The editor (editor.tsx: React and Excalidraw) is bundled into main.js but runs only when the
 * first drawing opens (LAZY); the view (view.ts) keeps the data safety rules. This module connects them to Obsidian:
 *  - OPEN: the view opens .excalidraw files, claimed once the plugins enabled at startup have loaded: only one plugin
 *    can claim an extension, and other plugins that open these files (the community Excalidraw plugin, Just Simple
 *    Excalidraw) fail to load when it is already taken. Excaliboard leaves them to such a plugin while it is turned on,
 *    even before it has loaded (Obsidian loads plugins after the layout when community plugins are first turned on),
 *    but not while it is only installed: then no plugin would open them, and Obsidian would hide the drawings. When
 *    another plugin has the files, "Open in Excaliboard" in a file's menu opens one here.
 *  - NEW: "Create new drawing" (command and ribbon) makes `Drawing YYYY-MM-DD HHmm.excalidraw` in the folder from the
 *    settings, or where Obsidian puts new notes; "New drawing" in a folder's menu makes it in that folder. It opens in
 *    Excaliboard even when another plugin claims .excalidraw files.
 *  - EXPORT: "Export image" (command, and the tab's menu in view.ts) opens Excalidraw's export dialog.
 *  - SYNC-WRITE and BACKUP: Node's fs, synchronously (writeNow, backup); the reasons are in view.ts.
 *  - MOBILE: Node's fs exists only in Obsidian's desktop app, so on phones and tablets drawings open read-only
 *    (view.ts READ-ONLY): Excalidraw in view mode, and no new drawings, export or settings. Node is never reached there.
 *  - VIEW-STATE: scroll and zoom per drawing in data.json (view-state.ts), following renames and deletes, written
 *    1.5 s after a change, or when Obsidian quits with a change still waiting. A data.json changed by sync is read again.
 */
import './styles.css';
import {
  FileSystemAdapter,
  Notice,
  Platform,
  Plugin,
  TFile,
  TFolder,
  TextFileView,
  normalizePath,
  type EventRef,
  type Menu,
  type TAbstractFile,
} from 'obsidian';
import { EXTENSION, ICON, NEW_DRAWING_NAME, PLUGIN_NAME, VIEW_TYPE } from './constants';
import type * as Editor from './editor';
import type { ViewState } from './editor';
import { EMPTY_SCENE } from './scene';
import { DEFAULT_SETTINGS, SettingsTab, type Settings } from './settings';
import { ExcalidrawFileView } from './view';
import { ViewStateStore } from './view-state';

/** OPEN: plugins that open .excalidraw files and fail to load when the extension is already taken. */
const OTHER_OPENERS = ['obsidian-excalidraw-plugin', 'just-simple-excalidraw'];
/** Obsidian's plugin list and view registry, not part of the typed API. */
type Internals = {
  plugins?: { enabledPlugins?: Set<string>; manifests?: Record<string, unknown> };
  viewRegistry?: {
    on(name: 'extensions-updated', callback: () => unknown): EventRef;
    isExtensionRegistered(extension: string): boolean;
  };
};

export type EditorModule = typeof Editor;

type NodeFs = {
  readFileSync(path: string, encoding: 'utf8'): string;
  writeFileSync(path: string, data: string): void;
  mkdirSync(path: string, options: { recursive: boolean }): void;
  readdirSync(path: string): string[];
  unlinkSync(path: string): void;
};
/** Node's fs, which Obsidian's desktop app exposes to plugins, and only it (MOBILE). */
const nodeFs = (): NodeFs => {
  if (!Platform.isDesktopApp) throw new Error(`${PLUGIN_NAME} writes files only in Obsidian's desktop app`);
  return (window as unknown as { require: (id: string) => NodeFs }).require('fs');
};

/**
 * MOBILE: whether drawings open read-only here. They do in Obsidian's mobile app, which has no Node, and in the
 * desktop app's mobile emulation (app.emulateMobile), which shows what a phone shows.
 */
export const isReadOnlyApp = (): boolean => !Platform.isDesktopApp || Platform.isMobile;

/** How long view-state changes gather before data.json is written. */
const DATA_SAVE_MS = 1500;
/** Session backups kept per drawing. */
const BACKUPS_PER_FILE = 5;

/** What the plugin keeps in its data.json. */
type PluginData = Partial<Settings> & { viewStates?: unknown };

/** FNV-1a of a drawing's path: the name of its backup folder. */
export function hashPath(path: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < path.length; i++) hash = Math.imul(hash ^ path.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** NEW: `Drawing 2026-11-08 1402`, in local time. */
export function newDrawingName(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${NEW_DRAWING_NAME} ${date} ${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export default class ExcaliboardPlugin extends Plugin {
  override settings: Settings = { ...DEFAULT_SETTINGS };
  viewStates: ViewStateStore = new ViewStateStore(null);
  /** OPEN: whether .excalidraw files open in Excaliboard (another plugin may have claimed them first). */
  ownsExtension = false;
  /** MOBILE: drawings open read-only, and nothing creates, exports or writes one. */
  readonly readOnly = isReadOnlyApp();
  private unloaded = false;
  private layoutClaimed = false;
  private editor: Promise<EditorModule> | null = null;
  private lastBackupTime = 0;
  private dataTimer: number | null = null;

  override async onload(): Promise<void> {
    await this.readData();
    // minAppVersion is 1.15.0, the first Obsidian whose save the data safety rules can rely on (view.ts).
    if (
      !this.readOnly &&
      typeof (TextFileView.prototype as unknown as { writeData?: unknown }).writeData !== 'function'
    ) {
      console.warn(`${PLUGIN_NAME}: this Obsidian version has no TextFileView.writeData`);
      new Notice(`${PLUGIN_NAME} needs Obsidian 1.15 or later to save drawings safely. Please update Obsidian.`, 15000);
    }

    this.registerView(VIEW_TYPE, (leaf) => new ExcalidrawFileView(leaf, this));
    this.app.workspace.onLayoutReady(() => {
      this.layoutClaimed = true;
      this.claimExtension();
    });
    // OPEN: when the plugin that had .excalidraw files is turned off, Obsidian lets them go: take them then. Only after
    // the claim at layout ready (other plugins' files change the registry while they load), and later, as the event
    // also comes while Excaliboard itself unloads.
    const registry = (this.app as unknown as Internals).viewRegistry;
    if (registry)
      this.registerEvent(
        registry.on('extensions-updated', () => {
          if (this.layoutClaimed && !this.ownsExtension)
            window.setTimeout(() => {
              if (!this.unloaded && !this.ownsExtension && !registry.isExtensionRegistered(EXTENSION))
                this.claimExtension();
            }, 0);
        }),
      );

    // MOBILE: where drawings are read-only, there is nothing to create or export, and the one setting is for new drawings.
    if (!this.readOnly) {
      this.addRibbonIcon(ICON, 'Create new drawing', () => void this.createDrawing());
      this.addCommand({
        id: 'create-drawing',
        name: 'Create new drawing',
        icon: ICON,
        callback: () => void this.createDrawing(),
      });
      this.addCommand({
        id: 'export-image',
        name: 'Export image',
        icon: 'image-down',
        checkCallback: (checking) => {
          const view = this.app.workspace.getActiveViewOfType(ExcalidrawFileView);
          if (!view?.canExport()) return false;
          if (!checking) view.exportImage();
          return true;
        },
      });
      this.addSettingTab(new SettingsTab(this));
    }

    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => this.onFileMenu(menu, file)));
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => this.viewStates.rename(oldPath, file.path) && this.scheduleData()),
    );
    this.registerEvent(this.app.vault.on('delete', (file) => this.viewStates.delete(file.path) && this.scheduleData()));
    this.registerEvent(
      this.app.workspace.on('quit', (tasks) => {
        if (this.dataTimer !== null) tasks.add(() => this.flushData()); // otherwise quitting writes nothing
      }),
    );
  }

  override onunload(): void {
    this.unloaded = true;
    if (this.dataTimer !== null) void this.flushData();
  }

  /** data.json changed on disk (Obsidian Sync, another device): its settings and view states replace these. */
  override async onExternalSettingsChange(): Promise<void> {
    if (this.dataTimer !== null) window.clearTimeout(this.dataTimer);
    this.dataTimer = null;
    await this.readData();
  }

  private async readData(): Promise<void> {
    const data = ((await this.loadData()) ?? {}) as PluginData;
    this.settings = { ...DEFAULT_SETTINGS, ...(typeof data.folder === 'string' ? { folder: data.folder } : {}) };
    this.viewStates = new ViewStateStore(data.viewStates);
  }

  /** OPEN: .excalidraw files open in Excaliboard, unless a plugin that loaded at startup already opens them. */
  private claimExtension(): void {
    // A plugin turned on but not installed here (synced settings) never loads: then no plugin would open the files.
    const plugins = (this.app as unknown as Internals).plugins;
    if (OTHER_OPENERS.some((id) => plugins?.enabledPlugins?.has(id) && plugins.manifests?.[id] !== undefined)) return;
    try {
      this.registerExtensions([EXTENSION], VIEW_TYPE);
      this.ownsExtension = true;
    } catch {
      // another plugin claimed them first: "Open in Excaliboard" in a file's menu opens one here
    }
  }

  /** Turned on in the settings: say where .excalidraw files open when another plugin keeps them. */
  override onUserEnable(): void {
    if (this.ownsExtension) return;
    new Notice(
      `Another plugin opens .${EXTENSION} files, so they keep opening there. To open one in ${PLUGIN_NAME}, choose ` +
        `“Open in ${PLUGIN_NAME}” in its menu. New drawings open in ${PLUGIN_NAME}.`,
      15000,
    );
  }

  /** LAZY: the editor (React and Excalidraw), evaluated on the first drawing open, cached afterwards. */
  loadEditor(): Promise<EditorModule> {
    return (this.editor ??= import('./editor').catch((error: unknown) => {
      this.editor = null; // let the next drawing open retry
      throw error;
    }));
  }

  private onFileMenu(menu: Menu, file: TAbstractFile): void {
    if (file instanceof TFolder) {
      if (this.readOnly) return; // MOBILE
      menu.addItem((item) =>
        item
          .setSection('action-primary')
          .setTitle('New drawing')
          .setIcon(ICON)
          .onClick(() => void this.createDrawing(file)),
      );
    } else if (file instanceof TFile && file.extension === EXTENSION && !this.ownsExtension) {
      menu.addItem((item) =>
        item
          .setSection('open')
          .setTitle(`Open in ${PLUGIN_NAME}`)
          .setIcon(ICON)
          .onClick(() => void this.openInView(file)),
      );
    }
  }

  /** Opens a drawing in Excaliboard's view, whichever plugin claims .excalidraw files. */
  private async openInView(file: TFile, leaf = this.app.workspace.getLeaf(false)): Promise<void> {
    await leaf.setViewState({ type: VIEW_TYPE, state: { file: file.path }, active: true });
  }

  /** NEW: in `folder` (a folder's menu), else in the settings' folder, else where Obsidian puts new notes. */
  async createDrawing(folder?: TFolder): Promise<void> {
    try {
      const { vault, workspace, fileManager } = this.app;
      const name = newDrawingName(new Date());
      // Without the new file's name, which Obsidian 1.15 would look up among the file types it creates itself.
      const parent =
        folder ??
        (this.settings.folder.trim() ? await this.settingsFolder() : null) ??
        fileManager.getNewFileParent(workspace.getActiveFile()?.path ?? '');
      const base = parent.isRoot() ? name : `${parent.path}/${name}`;
      let path = `${base}.${EXTENSION}`;
      for (let i = 1; vault.getAbstractFileByPath(path); i++) path = `${base} ${i}.${EXTENSION}`;
      const file = await vault.create(path, EMPTY_SCENE);
      await this.openInView(file, workspace.getLeaf('tab'));
    } catch (error) {
      console.error(`${PLUGIN_NAME}: could not create a drawing`, error);
      new Notice(`Could not create a new drawing: ${(error as Error).message.replace(/\.+$/, '')}.`);
    }
  }

  /** NEW: the folder from the settings, created when it doesn't exist yet. */
  private async settingsFolder(): Promise<TFolder> {
    const { vault } = this.app;
    const path = normalizePath(this.settings.folder);
    if (path.split('/').some((name) => name.startsWith('.')))
      throw new Error(`the folder “${path}” in the settings is hidden (a name in it starts with a dot)`);
    // As written, else as macOS and Windows see it, where "Drawings" and "drawings" are the same folder.
    const existing =
      vault.getAbstractFileByPath(path) ??
      vault.getAllLoadedFiles().find((file) => file.path.toLowerCase() === path.toLowerCase());
    if (existing instanceof TFolder) return existing;
    if (existing) throw new Error(`“${existing.path}” in the settings is a file, not a folder`);
    const created = await vault.createFolder(path);
    if (!(created instanceof TFolder)) throw new Error(`Obsidian could not create the folder “${path}”`);
    return created;
  }

  async setFolder(folder: string): Promise<void> {
    this.settings.folder = folder.trim();
    await this.flushData();
  }

  /** VIEW-STATE: the drawing's scroll and zoom, kept in data.json shortly after they change. */
  rememberView(path: string, view: ViewState): void {
    if (this.viewStates.set(path, view)) this.scheduleData();
  }

  private scheduleData(): void {
    if (this.dataTimer !== null) window.clearTimeout(this.dataTimer);
    this.dataTimer = window.setTimeout(() => void this.flushData(), DATA_SAVE_MS);
  }

  async flushData(): Promise<void> {
    if (this.dataTimer !== null) window.clearTimeout(this.dataTimer);
    this.dataTimer = null;
    const data: PluginData = { ...this.settings, viewStates: this.viewStates.toJSON() };
    await this.saveData(data);
  }

  private fullPath(path: string): string {
    const adapter = this.app.vault.adapter;
    // MOBILE: Platform first, as the mobile app may not define FileSystemAdapter at all.
    if (!Platform.isDesktopApp || !(adapter instanceof FileSystemAdapter))
      throw new Error(`${PLUGIN_NAME} needs Obsidian's desktop app`);
    return adapter.getFullPath(normalizePath(path));
  }

  /**
   * SYNC-WRITE: one synchronous write. Obsidian's own write is async and chunked: in a hidden window it can take
   * seconds, and Obsidian destroys a closing window 3 s into quitting, which once truncated a 3.9 MB drawing.
   * `expected` is what Obsidian last read or wrote: if the file on disk differs from it (a sync or git change that
   * Obsidian hasn't reported yet), that version is backed up before it is overwritten.
   */
  writeNow(path: string, text: string, expected?: string): void {
    if (this.readOnly) throw new Error(`${PLUGIN_NAME} doesn't write drawings on this device`); // MOBILE
    const fs = nodeFs();
    const full = this.fullPath(path);
    if (expected !== undefined) {
      let current: string | null = null;
      try {
        current = fs.readFileSync(full, 'utf8');
      } catch {
        // gone or unreadable: nothing on disk to keep
      }
      // Obsidian's read drops a leading byte order mark, so `expected` never has one.
      const disk = current?.charCodeAt(0) === 0xfeff ? current.slice(1) : current;
      if (current !== null && disk !== expected && disk !== text) {
        this.backup(path, current);
        new Notice(
          `“${path.split('/').pop() ?? path}” changed on disk just before it was saved. Your version was saved; the ` +
            'version from disk is in the session backups.',
          15000,
        );
      }
    }
    fs.writeFileSync(full, text);
  }

  /**
   * BACKUP: copies text that is about to be overwritten to `<plugin folder>/backups/<hash of path>/<UTC time>.excalidraw`,
   * keeping the newest five per drawing. Names are unique and in order, even for two backups in one millisecond.
   */
  backup(filePath: string, text: string): void {
    if (this.readOnly) return; // MOBILE: nothing is written, so nothing needs a backup
    try {
      const fs = nodeFs();
      const dir = this.fullPath(`${this.manifest.dir ?? ''}/backups/${hashPath(filePath)}`);
      fs.mkdirSync(dir, { recursive: true });
      const time = (this.lastBackupTime = Math.max(Date.now(), this.lastBackupTime + 1));
      fs.writeFileSync(`${dir}/${new Date(time).toISOString().replace(/[:.]/g, '-')}.${EXTENSION}`, text);
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(`.${EXTENSION}`))
        .sort();
      for (const old of files.slice(0, -BACKUPS_PER_FILE)) fs.unlinkSync(`${dir}/${old}`);
    } catch (error) {
      console.error(`${PLUGIN_NAME}: session backup failed`, error);
      new Notice(`Could not back up “${filePath}” before saving it. The save went ahead.`, 15000);
    }
  }
}
