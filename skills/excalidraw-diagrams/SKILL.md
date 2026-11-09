---
name: excalidraw-diagrams
description: Writes and edits Excalidraw drawings, .excalidraw files (one JSON scene), that open in Excaliboard, the Obsidian plugin that edits them with the Excalidraw 0.18.1 editor, and on excalidraw.com. A bundled generator lays out boxes, labels and arrows bound to them from a short JSON description (top-down, left to right, or placed by hand), and a bundled checker reads a drawing the way Excaliboard does and reports what would open read-only, be dropped when it loads or be drawn wrong. Use when the user asks for an Excalidraw drawing or a .excalidraw file; a hand-drawn or whiteboard-style diagram, flowchart, architecture or system-design diagram, process, pipeline, board or sketch for Obsidian or Excaliboard; or wants an existing .excalidraw file read, checked, extended or fixed.
---

# Excalidraw drawings (Excaliboard)

A drawing is ONE JSON file named `<Name>.excalidraw`: a list of elements (boxes, text, arrows, lines, pictures)
plus the canvas settings and the pictures' data. Excaliboard opens it in Obsidian with the Excalidraw editor and
saves it back as the same JSON; excalidraw.com opens it too. There is no Markdown wrapper: the Obsidian Excalidraw
plugin's `.excalidraw.md` notes are a different format, which this skill does not write.

`scripts/`, `reference/` and `examples/` are in this skill's folder (`<skill folder>` below: the folder that holds
this SKILL.md). Two scripts, Node 18 or later, nothing to install:

- `make-drawing.mjs` builds a drawing from a short JSON description of boxes and arrows, with the layout done.
- `check-drawing.mjs` reads a drawing as Excaliboard does and lists its elements and its problems. It never writes.

Many agent tools start a new shell for every command, so begin every command that runs a script by setting its full
path, then call it as `node "${MD:?}"` or `node "${CD:?}"`, for example
`CD="$HOME/.claude/skills/excalidraw-diagrams/scripts/check-drawing.mjs"; node "${CD:?}" "/path/to/vault/Plan.excalidraw"`
(use the real folder). With the variable empty, `${CD:?}` stops the command with a message; a bare `node ""` reads a
program from standard input instead. Give drawings by their full path, and never write drawings into the skill
folder.

## 30-second example

The user asks for a diagram of their web stack in their vault's `Diagrams` folder. Write the description, then let
the generator write the drawing and the checker read it:

```bash
MD="<skill folder>/scripts/make-drawing.mjs"; node "${MD:?}" - -o "/path/to/vault/Diagrams/Web stack.excalidraw" <<'EOF'
{"title": "Web stack", "layout": "right",
 "nodes": [
   {"id": "browser", "label": "Browser", "shape": "ellipse"},
   {"id": "api", "label": "API server", "color": "blue"},
   {"id": "db", "label": "Postgres", "color": "green"},
   {"id": "cache", "label": "Redis\n60 s TTL", "color": "yellow"}],
 "edges": [
   {"from": "browser", "to": "api", "label": "HTTPS"},
   {"from": "api", "to": "db", "label": "SQL"},
   {"from": "api", "to": "cache", "style": "dashed"}]}
EOF
CD="<skill folder>/scripts/check-drawing.mjs"; node "${CD:?}" "/path/to/vault/Diagrams/Web stack.excalidraw"
```

```text
Wrote /path/to/vault/Diagrams/Web stack.excalidraw: 14 elements (4 boxes, 3 arrows), 800 x 300 px.
/path/to/vault/Diagrams/Web stack.excalidraw: 14 elements (7 text, 3 arrow, 3 rectangle, 1 ellipse), 0 files, 800 x 300 px, 13.3 KB
OK: 1 drawing, 14 elements, no errors, no warnings.
```

Keep the quotes in `<<'EOF'`: without them the shell expands `$` and backticks inside labels. Three complete pairs
are in `examples/`: `login-flow` (a flowchart top-down: decisions, yes and no labels, a loop back), `deploy-pipeline`
(left to right, with groups drawn as tinted areas) and `web-request` (a request and its response between the same
two boxes, a link on a box, a note), each a `.json` description and the `.excalidraw` drawing made from it.

## Workflow

1. **Plan the diagram** before you write anything: what it shows, the boxes (one idea each, 5 to 15 of them), what
   connects to what, and which way it reads (see "What makes a readable diagram").
2. **Write the description** for `make-drawing.mjs` ("The diagram description"). That covers boxes and arrows,
   flowcharts, system designs, pipelines and boards. For anything else (a free sketch, a timeline, a table, a
   picture), write the elements yourself ("The file format", and `reference/FORMAT.md`), or generate the boxes and
   add the rest.
3. **Generate it**: `node "${MD:?}" - -o "<folder>/<Name>.excalidraw"` with the description on standard input (in
   PowerShell or cmd, write it to a file and pass the file's path instead of `-`). Write it where the user said
   (their Obsidian vault, a project folder), else ask or use the current folder; the folder must exist (`mkdir -p`
   first). Name the file after the drawing, leaving out `/ \ : * ? " < > | # ^ [ ]`. The generator never replaces a
   file unless you add `--force`: when the file exists, ask the user or use `<Name> 2.excalidraw`, and use `--force`
   only on a file you wrote in this task. A description file goes in a temporary folder and is deleted afterwards:
   never leave it in the vault. Read the warnings it prints (a label too wide for its arrow, an arrow through a
   box, overlapping areas) and change the description until there are none.
4. **Check it**: `node "${CD:?}" "<folder>/<Name>.excalidraw"`. Exit 0 = no errors; 1 = errors (fix every one);
   2 = a bad command line or an unreadable path. Fix the warnings too, unless one is intended.
5. **Tell the user** the file's path, how to open it ("How the user opens the result") and anything you were unsure
   of. Describe the drawing in a sentence: you cannot show it in the conversation.

Other entry points:

- **Reading a drawing**: `node "${CD:?}" --elements "<file>"` lists every element with its index, id, type,
  position, size, text and bindings, so you can find "the Postgres box" by its label. A drawing with pictures can be
  megabytes of base64: read it with the checker or a script, not by printing the file.
- **Text sizes for elements you write yourself**: `node "${MD:?}" --measure "Two lines\nof text"` prints the width
  and height Excalidraw gives that text (`--font hand|normal|code`, `--size 16|20|28|36`) and the smallest
  rectangle, ellipse and diamond that hold it as a label.

## The diagram description

One JSON object. Only `nodes` is required; every key not listed here is an error (a typo, or a `"colour"`).
`reference/DESCRIPTION.md` has the details: sizes, ids, how the layout works, and every warning.

| Key | Value |
| --- | --- |
| `title`, `subtitle` | text above the diagram: 36 px, and 20 px in grey |
| `layout` | `"down"` (default: layers top to bottom), `"right"` (left to right), or `"manual"` (you give each box's `x` and `y`) |
| `font` | `"hand"` (default: Excalifont, Excalidraw's hand-drawn font), `"normal"` (Nunito) or `"code"` (Comic Shanns) |
| `fill` | `"solid"` (default), `"hachure"` or `"cross-hatch"`: how coloured boxes are filled |
| `nodes` | boxes: `{"id", "label"}` and optionally `shape`, `color`, `group`, `link`, `fontSize`, `x`, `y`, `width`, `height` |
| `edges` | arrows: `{"from", "to"}` and optionally `label`, `style`, `arrow`, `color` |
| `groups` | tinted areas behind some nodes: `{"id"}` and optionally `label` (the area's title), `color`, `fontSize` |
| `notes` | lines of text under the diagram, 16 px |

- **A node** has an `id` (1-64 letters, digits, `_`, `-` or `.`, unique) and a `label`; `\n` in a label is a line
  break. `shape`: `"rectangle"` (default), `"ellipse"` or `"diamond"` (a decision). `color`: a name from the palette
  below; the box gets that colour's light fill and dark outline, and the label stays black; `"white"` is a white box,
  and no colour is an outline only. `group`: a group's id. `link`: what a click on the box's link icon opens
  (`[[Note]]` for a note in the vault, or a web address with its `https://`). `fontSize`: 16, 20 (default), 28 or
  36. `width` and `height` (pixels) override the size the label needs; they cannot be smaller.
- **An edge** joins two node ids. `label`: text on the arrow, 16 px, kept short (Excalidraw keeps about 176 px on
  one line on a short arrow). `style`: `"solid"` (default), `"dashed"` or `"dotted"`. `arrow`: where the heads go,
  `"end"` (default), `"start"`, `"both"` or `"none"`. `color`: the arrow's colour. Two edges between the same two
  nodes in opposite directions are drawn as two arcs; the same edge twice is an error (merge them).
- **The layered layouts** (`down`, `right`) put each node one layer after the nodes that point to it, order each
  layer to avoid crossings, keep a group's nodes together, give boxes in a layer one height (one width in `right`),
  and leave room between layers for arrow labels and group titles. An arrow that skips layers curves through the
  layers between, beside the boxes there; an edge that closes a loop runs back against the flow.
- **`"layout": "manual"`**: every node needs `x` and `y`, its top-left corner in pixels (use multiples of 20).
  Arrows run straight between the boxes' centres, and an edge may also end at a group (its area), for boards where a
  line from the topic reaches a whole area. The drawing is moved so that it starts under the title.
- **What it writes**: every element with all its fields, each label bound to its box and each arrow bound to both
  boxes (so they move together in the editor), ids made from yours (`node-api`, `label-api`, `edge-3`,
  `group-backend`), indexes `a0`, `a1`, ... and seeds taken from the ids: the same description always gives the same
  file. Never pass a drawing the user has edited back through the generator; it starts from the description.

## What makes a readable diagram

- **One idea per box, labels of 1-5 words.** A second line is for a detail ("Redis\n60 s TTL"). Over about 15 boxes,
  split the drawing or group the boxes.
- **One direction of flow**: top-down for hierarchies, decisions and processes (`down`); left to right for
  pipelines, requests and timelines (`right`). Arrows go from cause to effect, caller to callee, earlier to later.
- **Few colours, with a meaning**: 2-4 colours from the palette, each for a kind of thing (blue for services, green
  for stores, yellow for decisions), and no colour for the rest. Dashed arrows for what is optional, asynchronous or
  occasional. Groups (tinted areas with a title) for what belongs together.
- **Sizes**: 20 px for box labels, 16 px for arrow labels and notes, 36 px for a title. Excalidraw's sizes are 16,
  20, 28 and 36. Boxes on a 20 px grid, 40 px or more apart, arrows 80 px or longer.
- **Readable when it fits a screen**: keep a drawing within about 1,600 x 1,000 px, landscape. At 960 px wide, a
  drawing 1,600 px across shows its 20 px text at 12 px.
- **Text the font has**: Excalifont covers Latin (with accents), Greek and Cyrillic; Nunito has no Greek, Comic
  Shanns only Latin. Write Chinese, Japanese and Korean as the user does, in Excalifont: Excaliboard draws them in a
  system font, excalidraw.com in its hand-drawn one. Other characters, such as `→`, `✓` or emoji, come from a
  fallback font and look out of place: write "to" instead of an arrow. The generator and the checker name them.

Excalidraw's palette (its colour picker), as the generator uses it:

| Colour | Box fill | Outline, arrow, text | Area tint |
| --- | --- | --- | --- |
| `gray` | `#e9ecef` | `#343a40` | `#f8f9fa` |
| `red` | `#ffc9c9` | `#e03131` | `#fff5f5` |
| `pink` | `#fcc2d7` | `#c2255c` | `#fff0f6` |
| `grape` | `#eebefa` | `#9c36b5` | `#f8f0fc` |
| `violet` | `#d0bfff` | `#6741d9` | `#f3f0ff` |
| `blue` | `#a5d8ff` | `#1971c2` | `#e7f5ff` |
| `cyan` | `#99e9f2` | `#0c8599` | `#e3fafc` |
| `teal` | `#96f2d7` | `#099268` | `#e6fcf5` |
| `green` | `#b2f2bb` | `#2f9e44` | `#ebfbee` |
| `yellow` | `#ffec99` | `#f08c00` | `#fff9db` |
| `orange` | `#ffd8a8` | `#e8590c` | `#fff4e6` |
| `bronze` | `#eaddd7` | `#846358` | `#f8f1ee` |

Black is `#1e1e1e` (the default stroke and text), white `#ffffff` (the canvas), and `"transparent"` is no fill.

## The file format

Excaliboard opens a file when it is JSON with `"type": "excalidraw"`, an `elements` array whose every item has a
string `id` and `type`, and `files` an object (or absent); an empty file is a new drawing. Then Excalidraw 0.18.1
loads the elements; if it would drop one (a type it does not know), Excaliboard opens the drawing read-only instead,
so the next save cannot lose it. The checker reports both. `reference/FORMAT.md` has every field of every element
type, with a complete drawing to copy from.

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/wilsonneto-swe/excaliboard-obsidian",
  "elements": [],
  "appState": { "gridSize": 20, "gridStep": 5, "gridModeEnabled": false, "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

- **Every element** has `id`, `type`, `x`, `y`, `width`, `height`, `angle` (radians, 0), `strokeColor`,
  `backgroundColor`, `fillStyle` (`"solid"`, `"hachure"`, `"cross-hatch"`), `strokeWidth` (1, 2, 4),
  `strokeStyle` (`"solid"`, `"dashed"`, `"dotted"`), `roughness` (0 clean, 1 hand-drawn, 2 sketchy), `opacity`
  (0-100), `groupIds` (`[]`), `frameId` (`null`), `roundness` (`{"type": 3}` for rounded rectangles, `{"type": 2}`
  for diamonds, ellipses and arrows, `null` for text and sharp corners), `seed` (an integer: the shape of the
  hand-drawn strokes), `version` (1 for a new element), `versionNonce` (an integer), `isDeleted` (`false`),
  `boundElements` (`[]`, or the labels and arrows attached to it), `updated` (milliseconds), `link` (`null` or a
  string), `locked` (`false`) and `index` (see below). Element types: `rectangle`, `ellipse`, `diamond`, `text`,
  `arrow`, `line`, `freedraw`, `image`, `frame`, and three you will rarely write: `embeddable` (a web page, which
  Excaliboard shows as its link without loading it), `iframe` and `magicframe` (from Excalidraw's AI tools; Excaliboard
  shows a note in place of the web page an `iframe` holds). The
  array's order is the drawing order: later elements are drawn on top.
- **Text** adds `text`, `originalText` (the same, unless Excalidraw wrapped it), `fontSize`, `fontFamily` (5
  Excalifont, 6 Nunito, 8 Comic Shanns), `textAlign` (`"left"`, `"center"`, `"right"`), `verticalAlign` (`"top"`,
  `"middle"`, `"bottom"`), `containerId` (`null`, or the box or arrow it labels), `lineHeight` (1.25 for
  Excalifont and Comic Shanns, 1.35 for Nunito) and `autoResize` (`true`). `width` is the widest line's width and
  `height` is lines x `fontSize` x `lineHeight`: use `--measure`.
- **A label inside a box** is a text element with `containerId` set to the box's id, and the box's `boundElements`
  lists `{"type": "text", "id": "<the text's id>"}`. Both sides, always. The label comes right after its box in the
  array. Excalidraw centres it: in a rectangle at `x = box.x + (box.width - text.width) / 2`, `y = box.y +
  (box.height - text.height) / 2`; ellipses and diamonds have smaller text areas (`reference/FORMAT.md`).
- **An arrow** adds `points` (`[[0, 0], [dx, dy], ...]`, relative to the arrow's `x` and `y`, which are its first
  point; `width` and `height` are the points' extent), `startArrowhead` (`null`), `endArrowhead` (`"arrow"`),
  `startBinding` and `endBinding` (`null`, or `{"elementId": "<box id>", "focus": 0, "gap": 8}`: the box it is
  attached to, `focus` 0 aiming at the box's centre, `gap` the pixels between the arrow's end and the box),
  `lastCommittedPoint` (`null`) and `elbowed` (`false`). A bound box lists the arrow too:
  `{"type": "arrow", "id": "<arrow id>"}` in its `boundElements`. Put each end on the line between the two boxes'
  centres, `gap` px outside the outline; a label on an arrow is a text with the arrow as its `containerId`, centred
  on the arrow's middle point. A `line` is the same without heads and bindings.
- **`index`** orders the elements: `"a0"`, `"a1"`, ... `"a9"`, `"aA"` ... `"aZ"`, `"aa"` ... `"az"`, then `"b00"`,
  `"b01"`, ..., growing with the array order. Either give every element one, or leave `index` out of all of them:
  Excalidraw then numbers them when it loads the drawing. A new element goes after the last one with the next index
  (after `"az"` comes `"b00"`).
- **Pictures**: an `image` element has `fileId`, `status` (`"saved"`), `scale` (`[1, 1]`) and `crop` (`null`); the
  picture is in `files["<fileId>"]` = `{"mimeType": "image/png", "id": "<fileId>", "dataURL":
  "data:image/png;base64,...", "created": <milliseconds>}`. The key and `id` are the same; one file can serve several
  images.

## What never to write

- **Element types Excalidraw 0.18.1 does not have**: `"stickynote"` (how excalidraw.com saves sticky notes in
  November 2026) and any other. Excaliboard opens such a drawing read-only, unchanged. Draw a sticky note as a yellow
  rectangle with a label.
- **Fonts other than 5, 6 and 8**, the three of Excalidraw's font buttons: never 4 (not a font in 0.18.1: drawn in a
  fallback font), 7 (Lilita One, a heavy display font) or 9 (Liberation Sans, which Excalidraw keeps for exports and
  does not offer), and not 1, 2 or 3 (older fonts it lists only in drawings that already use them).
- **An arrow, line or freedraw without `points`**, a `link` that is not a string or `null`, `boundElements` that is
  not an array: Excalidraw fails to load the drawing. A malformed `index` (`"1"`, `"a10"`) makes it fail as soon as
  it has to number an element next to it.
- **Two elements with the same id**: Excalidraw renames one when it loads the drawing, and the labels and arrows
  that point to it lose it.
- **One side of a pair**: a label whose box does not list it, an arrow bound to a box that does not list it, an
  image whose file is missing, a file whose `id` differs from its key.
- **`isDeleted` as anything but `true` or `false`**: the string `"false"` counts as deleted, and the next save drops
  the element.

## Editing an existing drawing

- Read it first: `node "${CD:?}" --elements "<file>"` (its elements, labels and problems). Find what the user names
  by its label; if two match, or none quite does, say which one you changed.
- Edit the JSON with a short script (Node or Python), not by retyping it: parse the file, change what you need,
  write it back with 2-space indentation (`JSON.stringify(data, null, 2)`, as Excalidraw writes it). Keep the key
  order; Excalidraw writes no newline at the end.
- Keep everything you do not change: top-level keys you do not know (Excaliboard keeps them when it saves; they
  can be Excalidraw+ data), unknown fields on elements (`customData` and others), `appState`, other elements'
  ids, indexes and order, and every entry in `files`.
- For each element you change: `version` + 1, a new random `versionNonce`, and `updated` = now. Leave the others as
  they are: their versions tell Excaliboard and Excalidraw what changed.
- New elements: new unique ids (Excalidraw uses 21 random letters, digits, `_` and `-`), all fields
  ("The file format"), an `index` after the last element's (or none, if no element has one), a random `seed`.
- Moving a box: move its label by the same amount, and move the end of each arrow bound to it, keeping the end on
  the line between the boxes' centres. Renaming: change `text` and `originalText`, then the text's `width`, `height`,
  `x` and `y` (`--measure`), and widen the box if the label no longer fits.
- Deleting: remove the element, its label, its id from other elements' `boundElements`, and bindings that name it
  (set them to `null`). A picture no image uses any more can stay in `files`: Excalidraw leaves it out at the next
  save.
- Check before and after: the checker must report nothing new.
- A drawing open in Excaliboard shows a change saved to its file in place. If the user has unsaved edits in it, those
  win: Excaliboard saves them over your version and puts yours in its session backups. Ask the user to close the
  drawing, or to stop editing for a few seconds, before you change the file.

## The checker

```bash
CD="<skill folder>/scripts/check-drawing.mjs"; node "${CD:?}" "<drawing.excalidraw or a folder>" [--elements] [--json]
```

It reads the drawing with Excaliboard's rules and Excalidraw 0.18.1's, and prints a summary (elements by type,
pictures, size in pixels and kilobytes) and every problem, naming the element as `#<position> "<id>" (<type>)`.
`--elements` lists the elements; `--json` prints one JSON object. A folder is searched for `.excalidraw` files.
Exit status: 0 no errors, 1 errors (or a folder without drawings), 2 a bad argument or an unreadable path.

| Level | Code | Meaning |
| --- | --- | --- |
| error | `invalid-json`, `not-a-scene`, `elements-not-array`, `element-without-id-or-type`, `files-not-object` | Excaliboard opens the file read-only (its own message) |
| error | `unsupported-type` | element types Excalidraw 0.18.1 drops, such as `"stickynote"`: read-only |
| error | `load-error` | Excalidraw fails to load the drawing (a line without points, a link that is not a string ...) |
| error | `bad-index`, `duplicate-id` | a malformed fractional index; two elements with one id |
| error | `missing-field`, `bad-field` | a field the element cannot do without (`x`, `text` ...) or with the wrong kind of value |
| error | `bound-text`, `arrow-binding` | a label or arrow whose two sides disagree: never drawn, or left behind when the box moves |
| error | `missing-file`, `bad-file`, `font` | an image without its picture; a `files` entry under the wrong key or without its data; a font 0.18.1 does not have |
| warning | `missing-field` | fields Excalidraw fills with its defaults when it loads the drawing |
| warning | `web-picture` | a picture stored as a web address instead of the picture itself: it shows as a picture that failed to load, since Excaliboard loads nothing from the web |
| warning | `bom` | the file starts with a byte order mark, which Obsidian and excalidraw.com ignore |
| warning | `index-order`, `index-missing` | indexes out of order, or on some elements only: renumbered on load |
| warning | `label-position`, `label-fit`, `label-order`, `text-size`, `text-mismatch` | a label not where Excalidraw puts it, too big for its box or before it in the order; a text's size not its text's |
| warning | `arrow-end`, `arrow-binding`, `stale-binding`, `bound-text` | an arrow end far from its box; a half-written binding Excalidraw repairs |
| warning | `points`, `negative-size`, `dropped-on-load` | what Excalidraw changes or drops when it loads the drawing |
| warning | `style`, `font`, `fallback-font` | an unknown fill or stroke style, an opacity outside 0-100; fonts 1, 2, 3, 7, 9; characters the font lacks |
| warning | `unused-file`, `bad-file`, `frame`, `embed`, `empty-file`, `scene-version`, `app-state` | a picture no image uses, a file without its type; the rest |

Without Node, check by hand against "The file format" and "What never to write".

## How the user opens the result

- **Obsidian with Excaliboard.** The vault is the folder (the drawing's, or one above it) that holds `.obsidian/`;
  Excaliboard is installed if `.obsidian/plugins/excaliboard/` exists, and on if `.obsidian/community-plugins.json`
  lists `"excaliboard"` (else tell the user to turn it on in Settings > Community plugins; never edit `.obsidian/`
  yourself). A click on a `.excalidraw` file in the file explorer opens it in the editor; edits are saved into the
  file 2 seconds after a change. If another plugin (such as the community Excalidraw plugin) opens `.excalidraw`
  files first, the file's menu has **Open in Excaliboard**. Excaliboard runs on Obsidian's desktop app.
- **Links on boxes**: in Excaliboard a `[[Note]]` link opens the note (Cmd or Ctrl + click: in a new tab), and a web
  address opens in the browser: write it with its `https://`, as Excaliboard can take a bare address (`example.de`)
  for a note's name. Point note links at notes that exist: Obsidian creates a missing one when the link is clicked.
- **excalidraw.com**: the menu's **Open** (Cmd or Ctrl + O), or drag the file onto the page. Changes stay in the
  browser until the file is saved back into the vault (menu > **Save to...**).

## Before you finish

- The file is where the user wanted it, named `<Name>.excalidraw`, and no description file was left in the vault.
- The generator printed no warnings, or you know why each one is there.
- The checker reports no errors and no warnings (or you know why each warning is there).
- Every label is in its box, every arrow is bound at both ends, and the drawing reads in one direction.
- In an existing drawing, only the elements you meant to change changed.
