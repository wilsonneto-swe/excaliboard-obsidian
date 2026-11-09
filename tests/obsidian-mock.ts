// Stand-ins for the parts of Obsidian the plugin uses. TextFileView models how Obsidian 1.15's text file views save,
// load and take outside changes, as observed in the app, because the data safety rules depend on exactly that.

type Listener = (...args: never[]) => unknown;

// Obsidian's DOM helpers.
Object.assign(HTMLElement.prototype, {
  empty(this: HTMLElement) {
    this.replaceChildren();
  },
  addClass(this: HTMLElement, cls: string) {
    this.classList.add(cls);
  },
  createEl(this: HTMLElement, tag: string, opts?: { text?: string; cls?: string }) {
    const el = this.ownerDocument.createElement(tag);
    if (opts?.text) el.textContent = opts.text;
    if (opts?.cls) el.className = opts.cls;
    return this.appendChild(el);
  },
  createDiv(this: HTMLElement, cls?: string) {
    const el = this.ownerDocument.createElement('div');
    if (cls) el.className = cls;
    return this.appendChild(el);
  },
  /** Obsidian calls these when an element moves to another window (a tab dragged out); tests call them via moved(). */
  onWindowMigrated(
    this: HTMLElement & { migrated?: ((win: Window) => unknown)[] },
    listener: (win: Window) => unknown,
  ) {
    (this.migrated ??= []).push(listener);
    return () => {
      this.migrated = (this.migrated ?? []).filter((l) => l !== listener);
    };
  },
});
/** Obsidian's el.win: the window an element is in. A test moves an element by defining its own `win`. */
Object.defineProperty(HTMLElement.prototype, 'win', {
  configurable: true,
  get(this: HTMLElement) {
    return this.ownerDocument.defaultView;
  },
});
/** Moves an element to another window (or back to `window`), as dragging its tab out does. */
export function moved(el: HTMLElement, win: object): void {
  Object.defineProperty(el, 'win', { configurable: true, value: win });
  for (const listener of (el as HTMLElement & { migrated?: ((w: unknown) => unknown)[] }).migrated ?? []) listener(win);
}
/** Obsidian defines createDiv as a global too. */
const newDiv = (): HTMLDivElement => window.document.createElement('div');

export function normalizePath(path: string): string {
  return path.replace(/[\\/]+/g, '/').replace(/^\/+|\/+$/g, '') || '/';
}

/** A link's path, without its #heading or #^block. */
export function getLinkpath(linktext: string): string {
  return linktext.split('#')[0] ?? '';
}

export class Notice {
  static messages: string[] = [];
  constructor(message: string) {
    Notice.messages.push(message);
  }
}

export const Keymap = {
  isModEvent(evt?: { metaKey?: boolean; ctrlKey?: boolean } | null): 'tab' | false {
    return evt?.metaKey === true || evt?.ctrlKey === true ? 'tab' : false;
  },
};

const DESKTOP_APP = {
  isDesktopApp: true,
  isDesktop: true,
  isMobileApp: false,
  isMobile: false,
  isPhone: false,
  isTablet: false,
};
/** Obsidian's mobile app on a phone: no Node, the mobile layout. */
export const MOBILE_APP = {
  ...DESKTOP_APP,
  isDesktopApp: false,
  isDesktop: false,
  isMobileApp: true,
  isMobile: true,
  isPhone: true,
};
/** The desktop app with app.emulateMobile(true): Node, but the mobile layout. */
export const MOBILE_EMULATION = { ...DESKTOP_APP, isDesktop: false, isMobile: true, isPhone: true };
/** Obsidian's platform flags, as in the desktop app until a test changes them; tests/setup.ts puts them back. */
export const Platform = { ...DESKTOP_APP };
export function resetPlatform(): void {
  Object.assign(Platform, DESKTOP_APP);
}

export class Scope {
  keys: { modifiers: string[] | null; key: string | null; func: () => unknown }[] = [];
  constructor(public parent?: Scope) {}
  register(modifiers: string[] | null, key: string | null, func: () => unknown) {
    const handler = { modifiers, key, func };
    this.keys.push(handler);
    return handler;
  }
}

export class MenuItem {
  section = '';
  title = '';
  icon = '';
  click: (() => unknown) | null = null;
  setSection(section: string) {
    this.section = section;
    return this;
  }
  setTitle(title: string) {
    this.title = title;
    return this;
  }
  setIcon(icon: string) {
    this.icon = icon;
    return this;
  }
  onClick(cb: () => unknown) {
    this.click = cb;
    return this;
  }
}

export class Menu {
  items: MenuItem[] = [];
  addItem(cb: (item: MenuItem) => unknown) {
    const item = new MenuItem();
    cb(item);
    this.items.push(item);
    return this;
  }
}

export abstract class TAbstractFile {
  constructor(public path: string) {}
  get name() {
    return this.path.split('/').pop() ?? this.path;
  }
}

export class TFile extends TAbstractFile {
  deleted = false;
  saving = false;
  get basename() {
    return this.name.replace(/\.[^.]+$/, '');
  }
  get extension() {
    return this.name.split('.').pop() ?? '';
  }
}

export class TFolder extends TAbstractFile {
  isRoot() {
    return this.path === '/';
  }
}

export class FileSystemAdapter {
  basePath = '/vault';
  getFullPath(path: string) {
    return `${this.basePath}/${path}`;
  }
}

class Events {
  private handlers = new Map<string, Listener[]>();
  on(name: string, cb: Listener) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), cb]);
    return { name, cb };
  }
  offref(ref: { name: string; cb: Listener }) {
    this.handlers.set(
      ref.name,
      (this.handlers.get(ref.name) ?? []).filter((h) => h !== ref.cb),
    );
  }
  trigger(name: string, ...args: unknown[]) {
    for (const h of this.handlers.get(name) ?? []) (h as (...a: unknown[]) => unknown)(...args);
  }
}

export class Vault extends Events {
  adapter = new FileSystemAdapter();
  configDir = '.obsidian';
  contents = new Map<TFile, string>();
  folders = new Map<string, TFolder>([['/', new TFolder('/')]]);
  writes: { path: string; data: string }[] = [];
  add(path: string, data: string) {
    const file = new TFile(path);
    this.contents.set(file, data);
    return file;
  }
  getAbstractFileByPath(path: string): TAbstractFile | null {
    return [...this.contents.keys()].find((f) => f.path === path) ?? this.folders.get(path) ?? null;
  }
  getAllLoadedFiles(): TAbstractFile[] {
    return [...this.folders.values(), ...this.contents.keys()];
  }
  getRoot() {
    return this.folders.get('/')!;
  }
  async create(path: string, data: string) {
    if (this.getAbstractFileByPath(path)) throw new Error('File already exists.');
    return this.add(path, data);
  }
  /** As on macOS and Windows, a folder whose path differs only in case already exists. */
  async createFolder(path: string) {
    if ([...this.folders.keys()].some((p) => p.toLowerCase() === path.toLowerCase()))
      throw new Error('Folder already exists.');
    const folder = new TFolder(path);
    this.folders.set(path, folder);
    return folder;
  }
  /** Like Obsidian's, drops a leading byte order mark. */
  async read(file: TFile) {
    const text = this.contents.get(file)!;
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }
  cachedRead(file: TFile) {
    return this.read(file);
  }
  /** Obsidian's own write: async (queued behind the adapter, written in chunks), then a modify event. */
  async modify(file: TFile, data: string) {
    await new Promise((resolve) => window.setTimeout(resolve, 5));
    this.writes.push({ path: file.path, data });
    this.contents.set(file, data);
    this.trigger('modify', file);
  }
  /** A direct, synchronous write to disk; the vault hears about it later, from its file watcher. */
  diskWrite(path: string, data: string) {
    const file = [...this.contents.keys()].find((f) => f.path === path)!;
    this.writes.push({ path, data });
    this.contents.set(file, data);
    window.setTimeout(() => this.trigger('modify', file), 0);
  }
  /** A change made outside this app (sync, git). */
  externalWrite(file: TFile, data: string) {
    this.contents.set(file, data);
    this.trigger('modify', file);
  }
}

export class WorkspaceLeaf {
  opened: { file?: TFile; state?: unknown }[] = [];
  view: unknown = null;
  constructor(public kind: unknown = false) {}
  async openFile(file: TFile) {
    this.opened.push({ file });
  }
  async setViewState(state: unknown) {
    this.opened.push({ state });
  }
}

export class Workspace extends Events {
  layoutReady = true;
  layoutCallbacks: (() => unknown)[] = [];
  leaves: WorkspaceLeaf[] = [];
  links: { linktext: string; sourcePath: string; newLeaf: unknown }[] = [];
  activeView: unknown = null;
  activeFile: TFile | null = null;
  getLeaf(kind?: unknown) {
    const leaf = new WorkspaceLeaf(kind);
    this.leaves.push(leaf);
    return leaf;
  }
  onLayoutReady(callback: () => unknown) {
    if (this.layoutReady) callback();
    else this.layoutCallbacks.push(callback);
  }
  /** Obsidian has loaded the plugins enabled at startup and restored the tabs. */
  finishLayout() {
    this.layoutReady = true;
    for (const callback of this.layoutCallbacks.splice(0)) callback();
  }
  /** Like Obsidian: the leaf is active at once (on pointerdown); 'active-leaf-change' fires a moment later. */
  setActiveLeaf(leaf: unknown, view: unknown) {
    this.activeView = view;
    window.setTimeout(() => this.trigger('active-leaf-change', leaf), 0);
  }
  getActiveViewOfType<T>(type: abstract new (...args: never[]) => T): T | null {
    return this.activeView instanceof type ? this.activeView : null;
  }
  getActiveFile() {
    return this.activeFile;
  }
  async openLinkText(linktext: string, sourcePath: string, newLeaf?: unknown) {
    this.links.push({ linktext, sourcePath, newLeaf });
  }
}

export class FileManager {
  newFileParent: TFolder | null = null;
  parentCalls: unknown[][] = [];
  constructor(private vault: Vault) {}
  getNewFileParent(...args: [sourcePath: string, newFilePath?: string]) {
    this.parentCalls.push(args);
    return this.newFileParent ?? this.vault.getRoot();
  }
}

export class MetadataCache {
  constructor(private vault: Vault) {}
  /** The file a link points to: by path, else by name, each with or without .md. */
  getFirstLinkpathDest(linkpath: string, _sourcePath: string): TFile | null {
    const files = [...this.vault.contents.keys()];
    const is = (name: string) => name === linkpath || name === `${linkpath}.md`;
    return files.find((f) => is(f.path)) ?? files.find((f) => is(f.name)) ?? null;
  }
}

/** Obsidian's view registry (internal): which extensions a view type has, and an event when that changes. */
export class ViewRegistry extends Events {
  registered = new Set<string>();
  isExtensionRegistered(extension: string) {
    return this.registered.has(extension);
  }
}

export class App {
  vault = new Vault();
  viewRegistry = new ViewRegistry();
  scope = new Scope();
  workspace = new Workspace();
  fileManager = new FileManager(this.vault);
  metadataCache = new MetadataCache(this.vault);
  /** The community plugins installed in the vault, by id (internal to Obsidian). */
  plugins = { manifests: {} as Record<string, unknown>, enabledPlugins: new Set<string>() };
}

export class Plugin {
  settings?: unknown;
  stored: unknown = null;
  views = new Map<string, unknown>();
  commands: { id: string; name: string; callback?: () => unknown; checkCallback?: (checking: boolean) => boolean }[] =
    [];
  ribbon: { icon: string; title: string; cb: () => unknown }[] = [];
  refs: unknown[] = [];
  extensionsTakenBy: string | null = null; // another plugin already registered the extension
  constructor(
    public app: App,
    public manifest: { id: string; dir?: string },
  ) {}
  async loadData() {
    return this.stored;
  }
  async saveData(data: unknown) {
    this.stored = JSON.parse(JSON.stringify(data));
  }
  registerView(type: string, factory: unknown) {
    this.views.set(type, factory);
  }
  extensionCalls: string[][] = [];
  registerExtensions(extensions: string[], _type: string) {
    this.extensionCalls.push(extensions);
    if (this.extensionsTakenBy) throw new Error(`Attempting to register an existing file extension "${extensions[0]}"`);
    for (const extension of extensions) this.app.viewRegistry.registered.add(extension);
  }
  onUserEnable() {}
  addRibbonIcon(icon: string, title: string, cb: () => unknown) {
    this.ribbon.push({ icon, title, cb });
  }
  addCommand(command: Plugin['commands'][number]) {
    this.commands.push(command);
  }
  settingTabs: unknown[] = [];
  addSettingTab(tab: unknown) {
    this.settingTabs.push(tab);
  }
  registerEvent(ref: unknown) {
    this.refs.push(ref);
  }
}

export class PluginSettingTab {
  containerEl = newDiv();
  constructor(
    public app: App,
    public plugin: Plugin,
  ) {}
}
export class Setting {}

/**
 * A text file view as Obsidian 1.15 behaves:
 * - A change asks for a save (requestSave), which runs 2 s after the first request; later requests don't move it.
 * - A save hands the view's text to writeData when it differs from the text last read or written, one save at a time;
 *   saving to close the view, or to load another file in it, then clears the view.
 * - A change on disk is read unless a save is running. It reaches setViewData unless the disk holds the text already
 *   known or, with unsaved edits, the text the view shows; with other unsaved edits, a plain text view would be merged.
 */
export abstract class TextFileView {
  app: App;
  file: TFile | null = null;
  scope: Scope | null = null;
  containerEl = newDiv();
  /** The tab's header, with its title (which a click focuses, to rename the file). */
  titleEl = this.containerEl.createDiv('view-header').createEl('input', { cls: 'view-header-title' });
  contentEl = this.containerEl.createDiv('view-content');
  /** The text the view was last given. */
  data: string | null = null;
  /** The text on disk, as last read or written. */
  lastSavedData: string | null = null;
  savePromise: Promise<void> | null = null;
  isPlaintext = true;
  dirty = false;
  requestSave: () => void;
  private unsubscribe: (() => void)[] = [];

  constructor(public leaf: { app: App }) {
    this.app = leaf.app;
    let timer: number | null = null;
    this.requestSave = () => {
      this.dirty = true;
      timer ??= window.setTimeout(() => {
        timer = null;
        void this.save();
      }, 2000);
    };
    const { vault } = this.app;
    const modified = vault.on('modify', (file: TFile) => this.onModify(file));
    const renamed = vault.on('rename', (file: TFile) => void this.onRename(file)); // every file view hears every rename
    this.unsubscribe.push(
      () => vault.offref(modified),
      () => vault.offref(renamed),
    );
  }

  abstract getViewData(): string;
  abstract setViewData(data: string, clear: boolean): void;
  abstract clear(): void;
  getDisplayText() {
    return this.file?.basename ?? 'No file';
  }
  getIcon() {
    return 'document';
  }
  registerEvent(ref: unknown) {
    void ref;
  }
  register(cleanup: () => unknown) {
    this.unsubscribe.push(() => void cleanup());
  }
  onPaneMenu(_menu: Menu, _source: string) {}
  /** The buttons in the tab's header (ItemView.addAction). */
  actions: { icon: string; title: string; callback: (evt: MouseEvent) => unknown }[] = [];
  addAction(icon: string, title: string, callback: (evt: MouseEvent) => unknown) {
    this.actions.push({ icon, title, callback });
    return this.containerEl.createDiv('view-action');
  }
  async onRename(_file: TFile) {}
  canAcceptExtension(_extension: string) {
    return false;
  }
  get saving() {
    return this.savePromise !== null;
  }

  async onOpen() {}
  async onClose() {
    this.contentEl.empty();
    await this.loadFile(null);
    for (const off of this.unsubscribe.splice(0)) off();
  }
  async loadFile(file: TFile | null) {
    if (file === this.file) return;
    if (this.file) await this.onUnloadFile(this.file);
    this.file = file;
    if (file) await this.onLoadFile(file);
  }
  async onUnloadFile(_file: TFile) {
    await this.save(true);
  }
  async onLoadFile(file: TFile) {
    await this.loadFileInternal(file, true);
  }
  async save(clear?: boolean) {
    this.dirty = false;
    while (this.savePromise) await this.savePromise.catch(() => undefined);
    const file = this.file;
    if (!file || file.deleted || this.lastSavedData === null) return;
    const text = this.getViewData();
    if (text === this.lastSavedData) return;
    const before = this.lastSavedData;
    this.data = this.lastSavedData = text;
    this.savePromise = this.writeData(file, text, before);
    try {
      await this.savePromise;
    } finally {
      this.savePromise = null;
    }
    if (clear) {
      this.data = this.lastSavedData = null;
      this.clear();
    }
  }
  /** The write itself: the vault's async write. If it fails, the disk still holds the text from before. */
  async writeData(file: TFile, text: string, before: string) {
    try {
      await this.app.vault.modify(file, text);
    } catch (error) {
      this.lastSavedData = before;
      throw error;
    }
  }
  onModify(file: TFile) {
    if (file === this.file && !this.saving) void this.loadFileInternal(file, false);
  }
  async loadFileInternal(file: TFile, clear: boolean) {
    const text = await this.app.vault.read(file);
    const known = this.lastSavedData;
    this.lastSavedData = text;
    if (!clear && known) {
      if (text === known) return;
      if (this.dirty) {
        const shown = this.getViewData();
        if (shown === text) return;
        if (shown !== known && this.isPlaintext) throw new Error('Obsidian would merge this file as text');
      }
    }
    this.setData(text, clear);
  }
  setData(text: string, clear: boolean) {
    if (text === this.data && !clear) return;
    this.data = text;
    this.setViewData(text, clear);
  }
}
