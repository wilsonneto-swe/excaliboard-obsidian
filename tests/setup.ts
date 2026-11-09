import { createRequire } from 'node:module';

// jsdom has no canvas; Excalidraw only probes it when the module loads.
HTMLCanvasElement.prototype.getContext = (() => ({})) as never;
// Obsidian's desktop app exposes Node's require as window.require; the plugin uses it for fs.
(window as unknown as { require: NodeJS.Require }).require = createRequire(import.meta.url);
