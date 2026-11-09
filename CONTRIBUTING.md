# Contributing to Excaliboard

Bug reports, ideas and pull requests are all welcome. This page explains how to build the plugin, how to report a
problem so it can be fixed quickly, and what a pull request needs.

## Questions and ideas

Ask in [Discussions](https://github.com/wilsonneto-swe/excaliboard-obsidian/discussions): **Q&A** for help,
**Ideas** for what you would like Excaliboard to do, **Show and tell** for your drawings and setups.
[Issues](https://github.com/wilsonneto-swe/excaliboard-obsidian/issues) are for bugs and concrete feature requests.

## Reporting a bug

Open a [bug report](https://github.com/wilsonneto-swe/excaliboard-obsidian/issues/new?template=bug_report.yml). A
good one has:

- **Versions**: Excaliboard's (Settings > Community plugins) and Obsidian's (Settings > General).
- **Platform**: macOS, Windows or Linux, and how the vault syncs (Obsidian Sync, iCloud, git, another service, or
  not at all).
- **Steps** from opening the drawing to the problem, what you expected, and what happened instead.
- **A small drawing that shows it.** Attach the `.excalidraw` file, after removing anything personal: a drawing can
  hold images and text you wrote. When Excaliboard changed a drawing in a way it shouldn't have, attach it before and
  after; the session backups in `.obsidian/plugins/excaliboard/backups/` hold earlier versions.
- **Errors from the developer console**, if there are any: View > Toggle Developer Tools (Ctrl+Shift+I, or
  Cmd+Option+I on a Mac), then the Console tab.

## Building and testing

You need Node.js 22.22.2 or a later 22.x, 24.15 or a later 24.x, or 26 or later (the versions jsdom, which the
tests use, supports), and npm.

```
npm ci             # the dependencies, exactly as package-lock.json lists them
npm run dev        # main.js and styles.css at the repository root, rebuilt on every change
npm run check      # what every pull request must pass: Obsidian's lint rules, type checks, tests, notices and the build
```

`npm run build`, `npm run lint`, `npm run typecheck` and `npm test` run one step each. `npm run notices` rewrites
`THIRD-PARTY-NOTICES.md` from what the build bundles; `npm run check` fails when it is out of date.

Try your build in a test vault, never in the vault with your real drawings. On macOS and Linux, link the plugin's
files into the test vault once (run this at the repository root):

```sh
mkdir -p "/path/to/test vault/.obsidian/plugins/excaliboard"
for f in main.js manifest.json styles.css; do ln -sf "$PWD/$f" "/path/to/test vault/.obsidian/plugins/excaliboard/$f"; done
```

On Windows, copy the files instead (in PowerShell, at the repository root), and run the `Copy-Item` line again after
each rebuild:

```powershell
$plugin = "C:\path\to\test vault\.obsidian\plugins\excaliboard"
New-Item -ItemType Directory -Force $plugin | Out-Null
Copy-Item main.js, manifest.json, styles.css $plugin
```

Or build straight into the test vault: `TEST_VAULT="/path/to/test vault" npm run dev` (in PowerShell:
`$env:TEST_VAULT = "C:\path\to\test vault"; npm run dev`). Then enable **Excaliboard** in
Settings > Community plugins. After each rebuild, run **Reload app without saving** from the command palette. The
drawings in [`examples/`](examples) are a quick way to fill the test vault.

To see what a phone or tablet shows, run `app.emulateMobile(true)` in the developer console of the test vault
(Cmd+Option+I, or Ctrl+Shift+I): Obsidian reloads with its mobile layout, where Excaliboard opens drawings read-only.
`app.emulateMobile(false)` goes back. Before a release, also try a drawing on a real phone, where Obsidian has no Node
and Excalidraw gets touch.

## Where things are

- `src/`: the plugin. Each file starts with a comment that names its rules in capitals, which the code and the tests
  refer to.
  - `main.ts`: the commands and menus, new drawings, the safe write through Obsidian's vault API and the session
    backups, and where drawings are read-only (phones and tablets).
  - `view.ts`: the drawing view and its data safety rules.
  - `editor.tsx`: React and Excalidraw, which run only when the first drawing opens.
  - `scene.ts`: reading, writing and fingerprinting a drawing file.
  - `view-state.ts`: scroll and zoom per drawing. `settings.ts`: the settings tab. `constants.ts`: every name,
    from `manifest.json`.
- `tests/`: vitest. `tests/obsidian-mock.ts` is a stand-in for Obsidian whose `TextFileView` behaves as Obsidian 1.15's
  does when it saves, loads and takes a change from disk, which the data safety rules depend on.
- `esbuild.config.mjs`: the build. It bundles the editor into `main.js`, embeds Excalidraw's fonts so the editor
  never fetches one, and makes the places where Excalidraw would go online stay offline (`NETWORK_PATCHES`: pictures
  at web addresses, pasted web pages, AI pages, SVG exports, CSS built from drawing data, library previews and
  uploads). It leaves out Excalidraw's translations, which never load here, and its font subsetting (a stand-in puts
  fonts into SVG exports whole), keeps Excalidraw's two localStorage entries in memory, and fails if a font would be
  fetched from Excalidraw's CDN, if a patch doesn't match as often as it should, if `main.js` holds localStorage,
  `eval` or `new Function`, or if it grows past 5 MB, the largest file Obsidian Sync's Standard plan syncs. `main.js`
  ends with `LICENSE` and `THIRD-PARTY-NOTICES.md`, since Obsidian installs no other file with it.
- `scripts/third-party-notices.mjs`: writes `THIRD-PARTY-NOTICES.md` from esbuild's metafile and the licence files
  in `node_modules`; what they don't hold (the fonts, for one) is written in the script, with its sources.
- `stubs/mermaid-to-excalidraw/`: stands in for Excalidraw's Mermaid importer, which Excaliboard leaves out (see
  `overrides` in `package.json`).
- `skills/`: the agent skill, outside the build. `examples/`: drawings to try.

## Sending a pull request

Pull requests are reviewed here and ship with the next release.

- Keep each pull request to one change, and say what it fixes or adds and how you tested it (Obsidian version and
  platform).
- `npm run check` passes.
- A change in behaviour comes with a test.
- Drawings are people's work. Opening a drawing never writes it, a save happens only after a real change, and nothing
  anyone drew is lost, not even when the file changes on disk while the drawing is open (the rules at the top of
  `src/view.ts`). Keep it that way, with tests that show it.
- When you add or update a dependency, use npm 11 or later (Node 24 or 26: npm 10 rewrites parts of
  `package-lock.json`), then run `npm run notices`. It stops when a bundled version, a font or a package
  without a licence file isn't described in the script yet: check its licence and add it there.
- When you update Excalidraw: run `npm run check`, which also fails if a font is no longer embedded or a
  `NETWORK_PATCHES` entry no longer matches. A patch that no longer matches means that code changed: look again at
  every way the new version could go online (fetch, picture and iframe sources, CSS url() built from drawing data,
  uploads) and update the patches. Check that `stubs/mermaid-to-excalidraw` still exports what Excalidraw imports.
- Update the README when something a user sees changes.
- No network requests and no telemetry: Excaliboard works offline, including what Excalidraw itself would fetch or
  upload (the NO-NETWORK rule at the top of `src/editor.tsx`, and [Privacy](README.md#privacy)).

By sending a pull request, you agree that your contribution is licensed under the [MIT License](LICENSE).
