/**
 * The plugin's names, in one module: `id` (excaliboard) and `name` (Excaliboard) come from the repository's root
 * manifest.json, read at build time; the view type, the plugin folder and every label follow from them. The CSS
 * classes are spelled out in styles.css and must match VIEW_CLASS and the classes below.
 *
 * Changing `id` after a release moves the plugin's folder: its data.json and session backups stay in the old one.
 */
import manifest from '../manifest.json' with { type: 'json' };

/** The plugin id: its folder under <vault>/.obsidian/plugins/, its data and its view type. */
export const PLUGIN_ID: string = manifest.id;
/** The name Obsidian shows (settings, the command palette's prefix) and the prefix of console messages. */
export const PLUGIN_NAME: string = manifest.name;
/** The view type of a drawing's tab (workspace.json keeps it for the tabs that are open). */
export const VIEW_TYPE: string = PLUGIN_ID;
/** What a drawing's `source` names when Excaliboard writes it, as excalidraw.com names its own address. */
export const SOURCE = 'https://github.com/wilsonneto-swe/excaliboard-obsidian';
/** The file extension the plugin opens and creates. */
export const EXTENSION = 'excalidraw';
/** The Lucide icon of the view, the ribbon button and the menu items. */
export const ICON = 'shapes';
/** A new drawing's name before its date and time: `Drawing 2026-11-08 1402.excalidraw`. */
export const NEW_DRAWING_NAME = 'Drawing';
/** The class on the view's content element, the editor's container and the read-only panel. */
export const VIEW_CLASS = 'excaliboard-view';
export const EDITOR_CLASS = 'excaliboard-editor';
export const ERROR_CLASS = 'excaliboard-error';
