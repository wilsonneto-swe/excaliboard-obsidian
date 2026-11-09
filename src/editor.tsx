/**
 * The heavy half: React and Excalidraw. main.ts loads this module with a dynamic import, which esbuild bundles into
 * main.js as code that runs only when the first drawing opens (LAZY), so Obsidian's startup doesn't evaluate it.
 *  - CHECK: checkScene() refuses a drawing that loading would silently shrink (element types this Excalidraw version
 *    doesn't know), so the next save can't lose them; view.ts then opens it read-only.
 *  - NO-NETWORK: the build embeds the fonts and makes Excalidraw's own ways online stay offline (NETWORK_PATCHES in
 *    esbuild.config.mjs), and remote embeds are refused. Excalidraw gets only the drawing's elements, pictures and saved
 *    settings (SCENE), never the rest of a file's appState or its library items. Here, a Cmd/Ctrl+V from a web page goes
 *    in as its text, with a word on why its pictures are left out. The library's Publish item is hidden in styles.css.
 *  - SCENE: what Excalidraw gets of a drawing file: its elements, its pictures and the appState keys a save writes
 *    (scene.ts SAVED_APP_STATE), plus the scroll and zoom Excaliboard keeps. Excalidraw's own file loading drops the
 *    rest too; a file's other appState keys (the active tool, an open sidebar, collaborators...) and libraryItems could
 *    otherwise set up the editor, and some reach the page as CSS. KEEP-UNKNOWN still writes libraryItems and other
 *    top-level keys back unchanged; appState keys other than the four are left out at the next save, as Excalidraw's
 *    own save leaves them out.
 *  - LINKS: every link on a shape is handled here or by the view, never by Excalidraw's window.open, which would
 *    navigate Obsidian's own window for a local-looking link. A link to an element of the drawing scrolls to it,
 *    whether Excaliboard or excalidraw.com made it; new ones use excalidraw.com's form, so they work there too.
 */
import '@excalidraw/excalidraw/index.css';
import {
  CaptureUpdateAction,
  Excalidraw,
  isInvisiblySmallElement,
  restore,
  restoreElements,
  serializeAsJSON,
} from '@excalidraw/excalidraw';
import type { ExcalidrawElement, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, UIOptions } from '@excalidraw/excalidraw/types';
import { createRoot } from 'react-dom/client';
import { SAVED_APP_STATE, type SceneData } from './scene';

export { serializeAsJSON };
export type Theme = 'light' | 'dark';
export type Scene = { elements: readonly ExcalidrawElement[]; appState: AppState; files: BinaryFiles };
/** Where the canvas looks: kept per drawing in the plugin's data (view-state.ts), never in the drawing. */
export type ViewState = { scrollX: number; scrollY: number; zoom: number };

export interface EditorProps {
  scene: SceneData;
  theme: Theme;
  /** The default file name of image exports. */
  name: string;
  /** Whether the canvas takes the keyboard once it is ready: only when its tab is the active one. */
  autoFocus: boolean;
  /** Asked again when a focus that had to wait for the canvas is applied: the tab may no longer be the active one. */
  canFocus: () => boolean;
  /** Scroll and zoom to start at; null fits the drawing into the canvas. */
  viewState: ViewState | null;
  /** Every change, including scroll and selection; the first is the scene as loaded. */
  onChange: (scene: Scene) => void;
  /** A link on a shape was opened (not a link to another element of the drawing, which scrolls there). */
  onLinkOpen: (link: string, event: MouseEvent | PointerEvent) => void;
  /** A paste from a web page went in as text, without the pictures that Excalidraw would have downloaded. */
  onWebPicturesLeftOut: () => void;
}

export type EditorHandle = {
  getScene(): Scene | null;
  /**
   * Shows a version of the drawing that changed on disk; returns the scene as it will be once React renders, or null
   * when the editor has to be mounted again (a picture's data changed: Excalidraw keeps the pictures it has).
   */
  updateScene(scene: SceneData): Scene | null;
  getViewState(): ViewState | null;
  setTheme(theme: Theme): void;
  setName(name: string): void;
  /** Gives the keyboard to the canvas, so tool keys work without a click first; once it exists, if it doesn't yet. */
  focus(): void;
  /** Opens Excalidraw's own image export dialog. */
  exportImage(): void;
  unmount(): void;
};

/**
 * CHECK: why this scene can't be edited safely, or null: Excalidraw can't load it, or would drop an element when loading
 * it (so the next save would lose it).
 */
export function checkScene(scene: SceneData): string | null {
  try {
    restore(scene as never, null, null, { repairBindings: true }); // as Excalidraw loads it: throws when it can't
    // Element by element: one Excalidraw drops may share its id with one it keeps.
    const lost = scene.elements.filter(
      (el) =>
        el.isDeleted !== true &&
        el.type !== 'selection' &&
        !isInvisiblySmallElement(el as never) &&
        restoreElements([el] as never, null).length === 0,
    );
    const types = [...new Set(lost.map((el) => `"${el.type}"`))].join(', ');
    return lost.length
      ? `It has ${lost.length} element(s) of type ${types} that this Excalidraw version does not support.`
      : null;
  } catch (error) {
    return `Excalidraw cannot load it: ${(error as Error).message}.`;
  }
}

/** NO-NETWORK: HTML, as pasted from a web page, with pictures Excalidraw would download (an <img> with a web address). */
export function hasWebPictures(html: string): boolean {
  if (!/<img/i.test(html)) return false;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('img')].some((img) => /^\s*https?:/i.test(img.getAttribute('src') ?? ''));
}

/** Where a paste goes in as typed text, which Excalidraw leaves to the field. */
const isTextField = (target: EventTarget | null): boolean =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'range', 'color'].includes(target.type)) ||
  (target instanceof HTMLElement && target.isContentEditable);

// Obsidian owns the file, so Excalidraw's own open and save are hidden; image export stays.
const UI_OPTIONS: Partial<UIOptions> = { canvasActions: { loadScene: false, saveToActiveFile: false } };
const rejectAllEmbeds = (): boolean => false; // NO-NETWORK: a drawing never loads a remote iframe

/** Excalidraw's element links: `?element=<id of an element or group>`. */
const ELEMENT_LINK_KEY = 'element';
/** excalidraw.com's address, which in an element link names no scene: the link points into the drawing it is in. */
const EXCALIDRAW_COM = 'https://excalidraw.com/';

/**
 * LINKS: the element or group a link points to, when it points into the drawing it is in: a link made here (this app's
 * address, as Excalidraw makes them, or excalidraw.com's) or on excalidraw.com. A link into another scene, on
 * Excalidraw+ (`/s/...`) or shared from excalidraw.com (`#json=...`), isn't one: it opens in the browser, as it does on
 * excalidraw.com.
 */
export function linkedElementId(link: string): string | null {
  try {
    const url = new URL(link);
    const own = url.host === window.location.host || (url.href.startsWith(`${EXCALIDRAW_COM}?`) && !url.hash);
    return own ? url.searchParams.get(ELEMENT_LINK_KEY) : null;
  } catch {
    return null; // not a URL: a note link
  }
}

/**
 * The canvas area Excalidraw's toolbar and panels leave free, as its own "Zoom to fit" measures it, but relative to the
 * editor rather than the window, which also holds Obsidian's tabs.
 */
function freeArea(container: HTMLElement): { top: number; right: number; bottom: number; left: number } {
  const box = container.getBoundingClientRect();
  const edge = (selector: string, side: 'top' | 'bottom' | 'left' | 'right'): number | null =>
    container.querySelector(selector)?.getBoundingClientRect()[side] ?? null;
  const toolbar = edge('.App-toolbar', 'bottom');
  const footer = edge('.layer-ui__wrapper__footer-left', 'top'); // zoom, undo and redo
  const sidebar = edge('.sidebar', 'left');
  const menu = edge('.App-menu__left', 'right');
  const margin = 16;
  return {
    top: (toolbar === null ? 0 : toolbar - box.top) + margin,
    right: (sidebar === null ? 0 : box.right - sidebar) + margin,
    bottom: (footer === null ? 0 : box.bottom - footer) + margin,
    left: (menu === null ? 0 : menu - box.left) + margin,
  };
}

/** LINKS: "Copy link to object" makes excalidraw.com's form, which works here and on excalidraw.com. */
export function elementLink(id: string): string {
  const url = new URL(EXCALIDRAW_COM);
  url.searchParams.set(ELEMENT_LINK_KEY, id);
  return url.toString();
}

export function mountEditor(container: HTMLElement, props: EditorProps): EditorHandle {
  let api: ExcalidrawImperativeAPI | null = null;
  let theme = props.theme;
  let name = props.name;
  const root = createRoot(container);
  const { viewState } = props;
  // SCENE: the drawing's elements and pictures, its saved appState keys, and the view.
  const fileState = props.scene.appState ?? {};
  const appState = {
    ...Object.fromEntries(SAVED_APP_STATE.filter((key) => fileState[key] !== undefined).map((k) => [k, fileState[k]])),
    ...(viewState ? { scrollX: viewState.scrollX, scrollY: viewState.scrollY, zoom: { value: viewState.zoom } } : {}),
  };
  const initialData = {
    elements: props.scene.elements,
    files: props.scene.files ?? {},
    appState,
    scrollToContent: false,
  } as never;
  const setApi = (value: ExcalidrawImperativeAPI): void => {
    api = value;
  };
  // A drawing without a saved view is fitted into the canvas (at most 100%), as Excalidraw's "Zoom to fit" does, once
  // the canvas has a size: a tab restored in the background has none until it is shown. Excalidraw's own centring
  // shows only the element nearest the top left of a drawing larger than the canvas.
  let fitPending = viewState === null;
  // React renders Excalidraw a moment after the mount, so a focus waits for the canvas (the first change report means
  // there is one), and is applied only if the view still wants it then.
  let focusPending = props.autoFocus;
  const canvasEl = (): HTMLElement | null => container.querySelector<HTMLElement>('.excalidraw');
  const onChange = (elements: readonly ExcalidrawElement[], state: AppState, files: BinaryFiles): void => {
    const canvas = focusPending ? canvasEl() : null;
    if (canvas) {
      focusPending = false;
      if (props.canFocus()) canvas.focus({ preventScroll: true });
    }
    if (fitPending && api && state.width > 0 && state.height > 0) {
      fitPending = false;
      const visible = elements.filter((el) => !el.isDeleted);
      if (visible.length) api.scrollToContent(visible, { fitToContent: true, canvasOffsets: freeArea(container) });
    }
    props.onChange({ elements, appState: state, files });
  };
  // LINKS: preventDefault() stops Excalidraw's window.open in every case.
  const onLinkOpen = (
    element: NonDeletedExcalidrawElement,
    event: CustomEvent<{ nativeEvent: MouseEvent | PointerEvent }>,
  ): void => {
    event.preventDefault();
    const link = element.link;
    if (!link || !api) return;
    const id = linkedElementId(link);
    if (id === null) return props.onLinkOpen(link, event.detail.nativeEvent);
    if (api.getSceneElements().some((el) => el.id === id || el.groupIds.includes(id)))
      api.scrollToContent(id, { fitToContent: true, animate: true });
    else api.setToast({ message: "Linked object wasn't found on canvas.", closable: true, duration: 3000 });
  };
  // NO-NETWORK: with no picture file on the clipboard, Excalidraw downloads the pictures of pasted HTML. Such a paste is
  // stopped before Excalidraw sees it and passed on as its plain text, as Cmd/Ctrl+Shift+V would.
  let plainPasteUntil = 0;
  const onKeyDown = (event: KeyboardEvent): void => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v')
      plainPasteUntil = event.shiftKey ? performance.now() + 100 : 0; // Excalidraw's own window for a plain paste
  };
  const passedOn = new WeakSet<Event>();
  const onPaste = (event: ClipboardEvent): void => {
    const data = event.clipboardData;
    if (passedOn.has(event) || performance.now() < plainPasteUntil || isTextField(event.target) || !data) return;
    if (data.files.length > 0 || !hasWebPictures(data.getData('text/html'))) return;
    event.preventDefault();
    event.stopPropagation();
    const text = data.getData('text/plain');
    if (text && typeof DataTransfer === 'function' && typeof ClipboardEvent === 'function') {
      const plain = new DataTransfer();
      plain.setData('text/plain', text);
      const copy = new ClipboardEvent('paste', { clipboardData: plain, bubbles: true, cancelable: true });
      passedOn.add(copy);
      event.target?.dispatchEvent(copy);
    }
    props.onWebPicturesLeftOut();
  };
  container.addEventListener('keydown', onKeyDown, true);
  container.addEventListener('paste', onPaste, true);
  const render = (): void =>
    root.render(
      <Excalidraw
        initialData={initialData}
        theme={theme}
        name={name}
        onChange={onChange}
        excalidrawAPI={setApi}
        UIOptions={UI_OPTIONS}
        validateEmbeddable={rejectAllEmbeds}
        onLinkOpen={onLinkOpen as never}
        generateLinkForSelection={elementLink}
        aiEnabled={false}
        autoFocus={false}
      />,
    );
  render();

  return {
    getScene: () =>
      api && { elements: api.getSceneElementsIncludingDeleted(), appState: api.getAppState(), files: api.getFiles() },
    updateScene(scene) {
      if (!api) return null;
      const restored = restore(scene as never, null, null, { repairBindings: true });
      const current = api.getFiles();
      if (Object.values(restored.files).some((file) => current[file.id] && current[file.id]?.dataURL !== file.dataURL))
        return null;
      const { viewBackgroundColor, gridSize, gridStep, gridModeEnabled } = restored.appState;
      api.addFiles(Object.values(restored.files));
      const saved = { viewBackgroundColor, gridSize, gridStep, gridModeEnabled };
      api.updateScene({ elements: restored.elements, appState: saved, captureUpdate: CaptureUpdateAction.NEVER });
      // Undo can't go back to the version before the reload. history.clear is typed loosely in 0.18.1.
      (api.history.clear as () => void)();
      // React applies appState on its next render, so getAppState() is still the old one here.
      return {
        elements: api.getSceneElementsIncludingDeleted(),
        appState: { ...api.getAppState(), ...saved },
        files: api.getFiles(),
      };
    },
    getViewState() {
      if (!api) return null;
      const { scrollX, scrollY, zoom } = api.getAppState();
      return { scrollX, scrollY, zoom: zoom.value };
    },
    setTheme(next) {
      theme = next;
      render();
    },
    setName(next) {
      // Excalidraw reads its name prop only once, when it mounts; afterwards the name lives in its appState.
      name = next;
      api?.updateScene({ appState: { name }, captureUpdate: CaptureUpdateAction.NEVER });
    },
    focus() {
      const canvas = canvasEl();
      if (canvas) canvas.focus({ preventScroll: true });
      else focusPending = true;
    },
    exportImage() {
      api?.updateScene({ appState: { openDialog: { name: 'imageExport' } } });
    },
    unmount() {
      api = null; // an unmounted Excalidraw reports an empty scene; never let that be saved
      container.removeEventListener('keydown', onKeyDown, true);
      container.removeEventListener('paste', onPaste, true);
      root.unmount();
    },
  };
}
