/**
 * One open .excalidraw file. Obsidian's TextFileView reads it, debounces saves (2 s) and writes; this view decides
 * what text to hand back, so a drawing is rewritten only after a real edit.
 *  - READ-ONLY: a file that doesn't parse (scene.ts PARSE), or that holds elements this Excalidraw would drop
 *    (editor.tsx CHECK), shows a panel and is never written: getViewData() returns the text exactly as read.
 *    On phones and tablets (main.ts MOBILE) every drawing is read-only: Excalidraw locked in view mode, no change
 *    counts as an edit, getViewData() returns the text as read, and writeData() refuses, Obsidian's own write included.
 *    A version that changed on disk always replaces the one shown.
 *  - NO-EDITOR-NO-WRITE: until the editor reports the scene it loaded, getViewData() returns the text as read.
 *  - REAL-CHANGES: scroll, zoom and selection leave the fingerprint unchanged (scene.ts FINGERPRINT): no save. Nor is a
 *    picture that fails to load an edit: Excalidraw marks it failed (a new version of the image), and with no unsaved
 *    edit that mark becomes part of the drawing as read, so opening such a drawing doesn't write it.
 *  - BACKUP: before the first write after a file is opened, its text goes to the session backups (main.ts).
 *  - FLUSH: closing the tab, opening another file in it and quitting save the live scene, then the editor goes.
 *  - OUTSIDE-CHANGE: a version that changed on disk (sync, git, another pane) replaces an unedited drawing in place;
 *    with unsaved edits, those are kept and saved, and the disk version is backed up first.
 *  - SYNC-WRITE: a save is one synchronous write (main.ts writeNow), which also backs up a disk version that
 *    changed behind Obsidian's back since the last read: Obsidian destroys a closing window 3 s into quitting, and
 *    its own write is async and chunked, which once truncated a 3.9 MB drawing.
 *  - VIEW-STATE: scroll and zoom are kept per drawing in the plugin's data (view-state.ts), never in the file.
 *  - FOCUS: the canvas takes the keyboard when its tab becomes the active one, so tool keys work without a click first;
 *    never while another tab is active, and never away from something in this tab the click itself focused.
 *  - WINDOWS: Excalidraw listens for drags on the main window and puts its dialogs there, so a drawing in a separate
 *    window shows a panel instead of the editor (a drag there would leave empty shapes, which would be saved). When the
 *    tab moves between windows, the pending edit is saved first.
 */
import {
  Keymap,
  Notice,
  Scope,
  TextFileView,
  getLinkpath,
  type Menu,
  type Modifier,
  type TFile,
  type WorkspaceLeaf,
} from 'obsidian';
import { EDITOR_CLASS, ERROR_CLASS, EXTENSION, ICON, VIEW_CLASS, VIEW_TYPE } from './constants';
import type { EditorHandle, Scene, Theme } from './editor';
import type { default as ExcaliboardPlugin, EditorModule } from './main';
import { parseScene, sceneFingerprint, serializeScene, type SceneData } from './scene';

const themeOf = (el: HTMLElement): Theme => (el.ownerDocument.body.classList.contains('theme-dark') ? 'dark' : 'light');
const fingerprint = (scene: Scene): string => sceneFingerprint(scene.elements, scene.files, scene.appState);
/** An element's fields by name, to compare two versions of it. */
const fields = (element: unknown): Record<string, unknown> | undefined =>
  element as Record<string, unknown> | undefined;
/** What Excalidraw changes when it marks a picture that failed to load. */
const FAILED_PICTURE_KEYS = new Set(['status', 'version', 'versionNonce', 'updated']);
/**
 * REAL-CHANGES: a report's elements with every picture Excalidraw just marked as failed to load (no picture loads from
 * the web, and a picture's data may be unreadable) put back as it was in the report before; null when there is none.
 * The view then compares fingerprints, so the marks are absorbed only when they explain the whole change.
 */
function withoutFailedMarks(before: Scene['elements'] | null, after: Scene['elements']): Scene['elements'] | null {
  if (!before) return null;
  let marked = false;
  const unmarked = after.map((element, i) => {
    const [was, is] = [fields(before[i]), fields(element)];
    if (!was || !is || was === is || was['id'] !== is['id'] || is['type'] !== 'image') return element;
    if (is['status'] !== 'error' || was['status'] === 'error') return element;
    for (const key of new Set([...Object.keys(was), ...Object.keys(is)]))
      if (!FAILED_PICTURE_KEYS.has(key) && was[key] !== is[key]) return element;
    marked = true;
    return before[i]!;
  });
  return marked ? unmarked : null;
}
/** Obsidian's own write step (vault.modify), kept as the fallback of writeData. Not part of the typed API. */
const obsidianWriteData = (TextFileView.prototype as unknown as { writeData?: (...args: unknown[]) => Promise<void> })
  .writeData;
/**
 * KEYS: Excalidraw's shortcuts that Obsidian 1.15's own hotkeys take from a drawing: group (the graph view), add a link,
 * duplicate, find on canvas (editor commands that do nothing here but still take the key), and Cmd/Ctrl+Enter, which
 * edits a line's points and finishes a text (Obsidian's "open link in new tab"). Ungroup, Cmd/Ctrl+Shift+G, isn't
 * Obsidian's. Send to back and bring to front are Cmd+Option+[ and ] on a Mac, which Obsidian leaves alone, so its
 * Cmd+Shift+[ and ] keep switching tabs.
 */
const EXCALIDRAW_KEYS: [Modifier[], string][] = [
  [['Mod'], 'g'],
  [['Mod'], 'k'],
  [['Mod'], 'd'],
  [['Mod'], 'f'],
  [['Mod'], 'Enter'],
];
/** READ-ONLY on phones and tablets: a button in the tab's header says so, and why. */
const READ_ONLY_ICON = 'pencil-off';
const READ_ONLY_TITLE = 'Read-only on this device';
const READ_ONLY_NOTE =
  'Drawings are read-only on phones and tablets: Excaliboard saves a drawing with a direct write to the file, which ' +
  "only Obsidian's desktop app can make. Edit it on your computer; the changes show up here once they sync.";
/** A link with a scheme (https:, mailto:, obsidian:, ...) opens outside the vault; a dangerous one never opens. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const BLOCKED_SCHEME = /^(about|javascript|data|vbscript|file):/i;
/**
 * A web address typed without https:// (Excalidraw's link field keeps it as typed): www.example.com, example.com/docs,
 * or a bare domain with a common ending. It opens in the browser unless it names a file in the vault.
 */
const WEB_ADDRESS =
  /^(www\.[\w-]+(\.[\w-]+)+|[\w-]+(\.[\w-]+)*\.[a-z]{2,}\/|[\w-]+(\.[\w-]+)*\.(com|org|net|io|dev|app|ai|edu|gov)$)/i;

export class ExcalidrawFileView extends TextFileView {
  private text = ''; // the file's text as last read or written; handed back as-is while there is no real edit
  private original: SceneData | null = null;
  private loadFailed = false;
  private backedUp = false;
  private lib: EditorModule | null = null;
  private handle: EditorHandle | null = null;
  private mountId = 0;
  private savedFp: string | null = null; // fingerprint of `text`; null until the editor reports its scene
  private lastFp: string | null = null;
  private lastElements: Scene['elements'] | null = null; // as last reported, for withoutFailedMarks
  private pending: { fp: string; text: string } | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ExcaliboardPlugin,
  ) {
    super(leaf);
    // Obsidian must never 3-way merge this JSON as text on an outside change: setViewData handles it.
    // Obsidian's own Canvas and Bases views do the same. Not part of the typed API.
    (this as unknown as { isPlaintext: boolean }).isPlaintext = false;
    // KEYS: Obsidian's keymap runs first and would take these from Excalidraw. Claiming them here, without preventing
    // the default, lets the event reach Excalidraw while the drawing is the active tab.
    this.scope = new Scope(this.app.scope);
    for (const [modifiers, key] of EXCALIDRAW_KEYS) this.scope.register(modifiers, key, () => true);
  }

  /** READ-ONLY on phones and tablets (main.ts MOBILE). */
  private get readOnly(): boolean {
    return this.plugin.readOnly;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  override getDisplayText(): string {
    return this.file?.basename ?? 'Drawing';
  }

  override getIcon(): string {
    return ICON;
  }

  override async onOpen(): Promise<void> {
    await super.onOpen();
    this.contentEl.addClass(VIEW_CLASS);
    if (this.readOnly) this.addAction(READ_ONLY_ICON, READ_ONLY_TITLE, () => new Notice(READ_ONLY_NOTE, 10000));
    this.registerEvent(this.app.workspace.on('css-change', () => this.handle?.setTheme(themeOf(this.contentEl))));
    // FOCUS: Obsidian reports the change a moment after the click that made it, which may have focused the tab's title
    // or one of Excalidraw's fields: that focus stays.
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        const focused = this.containerEl.ownerDocument.activeElement;
        if (leaf === this.leaf && !(focused && this.containerEl.contains(focused))) this.handle?.focus();
      }),
    );
    this.register(this.contentEl.onWindowMigrated(() => void this.onWindowMoved())); // WINDOWS
  }

  /** WINDOWS: the tab moved to another window: save the pending edit, then show the drawing as that window allows. */
  private async onWindowMoved(): Promise<void> {
    if (!this.file) return;
    try {
      await this.save();
    } catch (error) {
      // The editor stays as it is, with the edit, until a save works: showing the drawing again would drop it.
      console.error(`${this.getDisplayText()}: could not save before moving to another window`, error);
      new Notice(`Could not save “${this.getDisplayText()}” before it moved to another window. Move it back to save.`);
      return;
    }
    this.setViewData(this.text, true);
  }

  /**
   * FOCUS: whether the canvas may take the keyboard now: this is the active tab, and nothing in its header (the title,
   * which a click focuses to rename the drawing) has the keyboard.
   */
  private mayFocus(): boolean {
    if (this.app.workspace.getActiveViewOfType(ExcalidrawFileView) !== this) return false;
    const focused = this.containerEl.ownerDocument.activeElement;
    return !(focused && this.containerEl.contains(focused) && !this.contentEl.contains(focused));
  }

  /** Another drawing opened from this tab (a link, the file explorer) opens here too, whichever plugin claims it. */
  override canAcceptExtension(extension: string): boolean {
    return extension === EXTENSION;
  }

  // FLUSH: both close paths let Obsidian save the pending edit with the live scene first, then unmount React.
  override async onClose(): Promise<void> {
    await super.onClose();
    this.unmountEditor();
  }

  override async onUnloadFile(file: TFile): Promise<void> {
    await super.onUnloadFile(file);
    this.unmountEditor();
  }

  // Obsidian tells every open file view about every rename in the vault.
  override async onRename(file: TFile): Promise<void> {
    await super.onRename(file);
    if (file === this.file) this.handle?.setName(file.basename); // the default name of image exports
  }

  override onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source);
    if (!this.canExport()) return;
    menu.addItem((item) =>
      item
        .setSection('action')
        .setTitle('Export image')
        .setIcon('image-down')
        .onClick(() => this.exportImage()),
    );
  }

  canExport(): boolean {
    return this.handle !== null && !this.loadFailed && !this.readOnly;
  }

  exportImage(): void {
    if (this.canExport()) this.handle?.exportImage();
  }

  override async save(clear?: boolean): Promise<void> {
    if (!this.backedUp && this.file && this.isDirty()) {
      this.backedUp = true; // BACKUP: the first write since the file was opened
      this.plugin.backup(this.file.path, this.text);
    }
    this.pending = null;
    await super.save(clear); // calls getViewData() and writes the result if it differs from the file
    const written = this.pending as { fp: string; text: string } | null;
    if (written && this.data === written.text) [this.text, this.savedFp] = [written.text, written.fp];
  }

  // SYNC-WRITE: replaces TextFileView's internal write step. If the synchronous write fails, Obsidian's own write
  // runs instead, with its error handling.
  async writeData(file: TFile, data: string, previous: string): Promise<void> {
    if (this.readOnly) throw new Error(`${file.name} is read-only on this device`); // READ-ONLY, never reached
    try {
      this.plugin.writeNow(file.path, data, previous);
    } catch (error) {
      if (!obsidianWriteData) throw error;
      return obsidianWriteData.call(this, file, data, previous);
    }
  }

  getViewData(): string {
    if (this.readOnly) return this.text; // READ-ONLY
    const scene = this.savedFp !== null && !this.loadFailed ? this.handle?.getScene() : null;
    if (!scene || !this.original || !this.lib) return this.text; // NO-EDITOR-NO-WRITE
    const fp = fingerprint(scene);
    if (fp === this.savedFp) return this.text; // REAL-CHANGES: only scroll, zoom or selection changed
    if (this.pending?.fp !== fp) {
      this.pending = {
        fp,
        text: serializeScene(this.original, scene.elements, scene.appState, scene.files, this.lib.serializeAsJSON),
      };
    }
    return this.pending.text;
  }

  setViewData(data: string, clear: boolean): void {
    if (clear) this.clear();
    else if (this.isDirty()) return void this.keepLocalEdits(data);
    this.text = data;
    const parsed = parseScene(data);
    const problem = parsed.ok ? this.lib?.checkScene(parsed.scene) : parsed.error; // lib may still be loading
    if (!parsed.ok || problem) return this.showError(problem ?? 'It cannot be read.');
    this.loadFailed = false;
    this.original = parsed.scene;
    if (this.handle && this.savedFp !== null) {
      // OUTSIDE-CHANGE without local edits: show the new version in place, or from the file again when a picture's
      // data changed (Excalidraw keeps the pictures it has).
      let applied: Scene | null;
      try {
        applied = this.handle.updateScene(parsed.scene);
      } catch (error) {
        return this.showError(`Excalidraw cannot load it: ${(error as Error).message}.`);
      }
      if (!applied) return void this.mountEditor(parsed.scene);
      this.savedFp = this.lastFp = fingerprint(applied);
      this.lastElements = applied.elements;
    } else void this.mountEditor(parsed.scene);
  }

  clear(): void {
    this.unmountEditor();
    [this.text, this.original] = ['', null];
    this.loadFailed = this.backedUp = false;
  }

  private isDirty(): boolean {
    if (this.readOnly) return false; // READ-ONLY: nothing shown here is an edit to keep
    const scene = this.savedFp !== null ? this.handle?.getScene() : null;
    return !!scene && fingerprint(scene) !== this.savedFp;
  }

  private onSceneChange(scene: Scene): void {
    const { scrollX, scrollY, zoom, width, height } = scene.appState;
    // VIEW-STATE: only a canvas that is shown has a view worth keeping (a tab opened in the background has no size yet,
    // and would otherwise keep the drawing from being fitted when it is shown).
    if (this.file && width > 0 && height > 0)
      this.plugin.rememberView(this.file.path, { scrollX, scrollY, zoom: zoom.value });
    const fp = fingerprint(scene);
    if (this.savedFp === null)
      this.savedFp = fp; // the first report is the scene as loaded
    else if (fp !== this.lastFp && this.lastFp === this.savedFp) {
      // REAL-CHANGES: pictures failing to load, with no unsaved edit, and nothing else changed
      const unmarked = withoutFailedMarks(this.lastElements, scene.elements);
      if (unmarked && fingerprint({ ...scene, elements: unmarked }) === this.lastFp) this.savedFp = fp;
    }
    this.lastElements = scene.elements;
    if (fp === this.lastFp) return;
    this.lastFp = fp;
    if (fp !== this.savedFp && !this.readOnly) this.requestSave();
  }

  /** OUTSIDE-CHANGE with unsaved edits: keep them and save them, after backing up the disk version. */
  private async keepLocalEdits(diskText: string): Promise<void> {
    if (this.file) this.plugin.backup(this.file.path, diskText);
    new Notice(
      `“${this.getDisplayText()}” changed on disk while it had unsaved edits. Your edits were kept and saved over it; ` +
        'the version from disk is in the session backups.',
      15000,
    );
    await this.save();
  }

  /** A link on a shape: notes open in Obsidian (a missing one is created, as from a note), web and mail links outside. */
  private openLink(link: string, event: MouseEvent | PointerEvent): void {
    if (SCHEME.test(link)) {
      if (!BLOCKED_SCHEME.test(link)) window.open(link, '_blank');
      return;
    }
    const wikilink = link.startsWith('[[');
    const target = link.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0]?.trim() ?? '';
    if (!target) return;
    const source = this.file?.path ?? '';
    if (
      !wikilink &&
      WEB_ADDRESS.test(target) &&
      !this.app.metadataCache.getFirstLinkpathDest(getLinkpath(target), source)
    )
      window.open(`https://${target}`, '_blank');
    else void this.app.workspace.openLinkText(target, source, Keymap.isModEvent(event));
  }

  private async mountEditor(scene: SceneData): Promise<void> {
    this.unmountEditor();
    const id = this.mountId;
    const lib = await this.plugin.loadEditor().catch((error: Error) => {
      if (id === this.mountId) this.showError(`Could not load the editor: ${error.message}.`);
    });
    if (!lib || id !== this.mountId) return; // failed, closed, or another version arrived while loading
    this.lib = lib;
    const problem = lib.checkScene(scene);
    if (problem) return this.showError(problem);
    if (this.contentEl.win !== window)
      return this.showError(
        "Excaliboard can't edit a drawing in a separate window yet: move this tab back to Obsidian's main window.",
        'Any edits made before are saved.',
      );
    const path = this.file?.path;
    this.handle = lib.mountEditor(this.contentEl.createDiv(EDITOR_CLASS), {
      scene,
      theme: themeOf(this.contentEl),
      name: this.file?.basename ?? 'Drawing',
      autoFocus: this.app.workspace.getActiveViewOfType(ExcalidrawFileView) === this, // FOCUS
      canFocus: () => this.mayFocus(),
      viewMode: this.readOnly,
      viewState: path ? this.plugin.viewStates.get(path) : null,
      onChange: (s) => this.onSceneChange(s),
      onLinkOpen: (link, event) => this.openLink(link, event),
      onWebPicturesLeftOut: () =>
        new Notice(
          "Pasted the text without its pictures: they are on the web, and Excaliboard doesn't go online. To add a " +
            'picture, copy the picture itself, or save it and drag it in.',
          10000,
        ),
    });
  }

  private unmountEditor(): void {
    this.mountId++;
    this.handle?.unmount();
    this.handle = null;
    this.savedFp = this.lastFp = this.pending = this.lastElements = null;
    this.contentEl.empty();
  }

  /** READ-ONLY panel: no editor is mounted, so getViewData() keeps returning the text as read. */
  private showError(reason: string, closing = 'The file has not been changed.'): void {
    this.unmountEditor();
    this.loadFailed = true;
    const panel = this.contentEl.createDiv(ERROR_CLASS);
    panel.createEl('h3', { text: `Can't open ${this.file?.name ?? 'this drawing'}` });
    panel.createEl('p', { text: `${reason} ${closing}` });
  }
}
