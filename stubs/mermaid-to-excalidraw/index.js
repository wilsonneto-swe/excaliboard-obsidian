// Replaces @excalidraw/mermaid-to-excalidraw (see "overrides" in the root package.json), so Mermaid and its
// dependencies are neither installed nor bundled. Excalidraw imports this lazily and catches the rejection: the
// Mermaid dialog shows the message, and pasted Mermaid text is pasted as plain text. It must not throw on import.
export async function parseMermaidToExcalidraw() {
  throw new Error('Mermaid import is not available in Excaliboard');
}
