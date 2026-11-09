import { createRequire } from 'node:module';
import { beforeEach } from 'vitest';
import { resetPlatform } from './obsidian-mock';

// jsdom has no canvas; Excalidraw only probes it when the module loads.
HTMLCanvasElement.prototype.getContext = (() => ({})) as never;
// Obsidian's desktop app exposes Node's require as window.require; the plugin uses it for fs.
(window as unknown as { require: NodeJS.Require }).require = createRequire(import.meta.url);
// Every test starts in the desktop app; a test of the mobile app changes the flags itself.
beforeEach(resetPlatform);
