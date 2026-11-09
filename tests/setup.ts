import { createRequire } from 'node:module';
import { beforeEach } from 'vitest';
import { resetPlatform } from './obsidian-mock';

// jsdom has no canvas; Excalidraw only probes it when the module loads.
HTMLCanvasElement.prototype.getContext = (() => ({})) as never;
// Obsidian's desktop app exposes Node's require as window.require, which the plugin never uses (tests check that).
(window as unknown as { require: NodeJS.Require }).require = createRequire(import.meta.url);
// Obsidian's globals for the window that has the focus: here, always this one.
Object.assign(globalThis, { activeDocument: document, activeWindow: window });
// Every test starts in the desktop app; a test of the mobile app changes the flags itself.
beforeEach(resetPlatform);
