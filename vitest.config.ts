import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: { alias: { obsidian: fileURLToPath(new URL("tests/obsidian-mock.ts", import.meta.url)) } },
	test: {
		environment: "jsdom",
		setupFiles: ["tests/setup.ts"],
		// The library ships ESM that imports JSON without import attributes; let Vite transform it.
		server: { deps: { inline: ["@excalidraw/excalidraw"] } },
	},
});
