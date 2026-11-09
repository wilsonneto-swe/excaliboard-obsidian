# The diagram description: every key

`make-drawing.mjs` turns one JSON object, the description, into a drawing. SKILL.md has the short version; this
file has every key, the sizes and spacing the generator uses, and what each of its warnings means.

```bash
MD="<skill folder>/scripts/make-drawing.mjs"; node "${MD:?}" "<description.json or ->" -o "<folder>/<Name>.excalidraw" [--force]
MD="<skill folder>/scripts/make-drawing.mjs"; node "${MD:?}" "<description.json or ->" --stdout
MD="<skill folder>/scripts/make-drawing.mjs"; node "${MD:?}" --measure "<text>" [--font hand|normal|code] [--size 16|20|28|36]
```

Exit status: 0 the drawing was written (read the warnings it printed), 1 a problem in the description (all of
them are listed; nothing is written), 2 a bad command line, or a path that cannot be read or written.

## 1. The top level

| Key | Value | Default |
| --- | --- | --- |
| `title` | a heading above the diagram, 36 px | none |
| `subtitle` | a line under the title, 20 px, grey (`#868e96`) | none |
| `layout` | `"down"`, `"right"` or `"manual"` (section 5) | `"down"` |
| `font` | `"hand"` (fontFamily 5, Excalifont), `"normal"` (6, Nunito), `"code"` (8, Comic Shanns), for every text | `"hand"` |
| `fill` | `"solid"`, `"hachure"` or `"cross-hatch"`: how coloured boxes are filled | `"solid"` |
| `nodes` | the boxes (section 2); at least one | required |
| `edges` | the arrows (section 3) | `[]` |
| `groups` | tinted areas behind some of the boxes (section 4) | `[]` |
| `notes` | lines of text under the diagram, 16 px, dark grey (`#343a40`), one text element each | `[]` |

Any other key is an error, at every level: a typo (`"colour"`, `"note"`) does not pass silently.

## 2. Nodes

| Key | Value |
| --- | --- |
| `id` | 1-64 letters, digits, `_`, `-` or `.`; unique among nodes |
| `label` | the text in the box; `\n` breaks the line |
| `shape` | `"rectangle"` (default, rounded corners), `"ellipse"` or `"diamond"` |
| `color` | a palette colour: `gray`, `red`, `pink`, `grape`, `violet`, `blue`, `cyan`, `teal`, `green`, `yellow`, `orange`, `bronze`, or `white` |
| `group` | the id of a group (section 4) |
| `link` | a link opened from the box's link icon: `[[Note]]` (a note in the vault), `https://...` (with the scheme: Excaliboard can take a bare address for a note's name) |
| `fontSize` | 16, 20 (default), 28 or 36 |
| `x`, `y` | the box's top-left corner in pixels; with `"layout": "manual"` only, and then on every node |
| `width`, `height` | the box's size in pixels, instead of the size the label needs; never smaller than that |

- **Colours**: a colour gives the box the colour's light fill and dark outline (SKILL.md's palette table); `white`
  is a white box with a black outline; no colour is a black outline with no fill. Labels are always black
  (`#1e1e1e`), centred.
- **Sizes**, from the label measured in the description's font: a rectangle is the label plus 25 px on the left and
  right and 15 px above and below, at least 120 x 60; an ellipse holds the label in its inner rectangle, at least
  160 x 80; a diamond is twice the label plus padding, at least 160 x 100. Every size is rounded up to the 20 px grid.
  `--measure` prints the smallest box of each shape that holds a text.
- In the layered layouts, boxes of one shape in one layer get one height (`down`) or one width (`right`), unless
  `width` or `height` is given.

## 3. Edges

| Key | Value |
| --- | --- |
| `from`, `to` | node ids (with `"layout": "manual"`, a group id too: the arrow then ends at the group's area; when a node and a group share an id, the node is meant) |
| `label` | text on the arrow, 16 px |
| `style` | `"solid"` (default), `"dashed"` or `"dotted"` |
| `arrow` | where the heads are: `"end"` (default), `"start"`, `"both"` or `"none"` |
| `color` | a palette colour: the arrow is drawn in its dark shade (default black) |

- **Every arrow is bound at both ends**: `startBinding` and `endBinding` name the boxes, with `focus` 0 and `gap`
  8, and both boxes list the arrow in `boundElements`, so the arrow follows when a box moves in Excalidraw. Its ends
  sit on the line between the two boxes' centres, where Excalidraw itself would put them.
- **Labels** sit in the middle of the arrow. A straight arrow that enters or leaves a group's area has its label in
  the middle of its stretch outside the area, clear of the area's title (the arrow then has a third point there, on
  the same line). Excalidraw keeps an arrow label on one line up to `max(0.7 x the arrow's width, 176)` px at 16 px;
  a longer label gets a warning, because it wraps as soon as a connected box moves.
- **Two edges in opposite directions** between the same two ends are drawn as two arcs, one each side of the line
  between the boxes, at least 20 px out and far enough apart for their labels. The same edge twice is an error:
  merge the two into one edge (and one label), or use `"arrow": "both"`.
- An edge from a node to itself, and between a node and its own group, is an error.

## 4. Groups

| Key | Value |
| --- | --- |
| `id` | 1-64 letters, digits, `_`, `-` or `.`; unique among groups, and not another group's id followed by `-title` (`group-<id>-title` is that group's title) |
| `label` | the area's title, in the group's colour |
| `color` | a palette colour (default `gray`) |
| `fontSize` | the title's size: 16, 20 (default), 28 or 36 |

- A group's area is a rectangle 20 px around its nodes, with room at the top for the title (60 px for a 20 px
  title, 80 px for 28 px), filled with the colour's lightest shade and outlined in a dashed, thin line. The title is
  at the top left, or at the top right when an arrow crosses the top left. The area and its title share a `groupIds`
  entry, so they are selected and moved together; the nodes are not in it, and keep moving on their own.
- A group needs at least one node. Every node belongs to at most one group; groups do not nest.

## 5. Layouts

- **`"down"` and `"right"`** place the nodes in layers: a node goes one layer after the nodes that point to it (top to
  bottom, or left to right), and a node that nothing points to goes just before the first node it points to. An edge
  that would close a loop is drawn back against the flow. Each layer is ordered to cut crossings (16 passes of
  barycentre sorting, keeping the best), with a group's nodes kept side by side. Positions are then chosen so each
  node sits between the nodes it connects to and, in the end, is centred over the nodes it points to; centres are on
  the 20 px grid, so a chain of boxes lines up and its arrows run straight.
- **Spacing**: 40 px between boxes in a layer, more between boxes of different groups (room for the areas); 100 px
  between layers in `down` and 120 px in `right`, more where an arrow label or a group's title has to fit, and more
  where arrows fan out far to the side, so that each stays clear of the boxes next to the one it reaches. An arrow
  that skips layers curves through points in the layers between, with room beside its label.
- **`"manual"`**: every node has `x` and `y`, and the generator places nothing; arrows run straight between the
  boxes' centres (and areas' centres, for an edge that ends at a group). Use multiples of 20 and leave 40 px or more
  between boxes; the generator warns about boxes that overlap, arrows through boxes and labels that touch.
- In every layout the drawing is then moved so that it starts at the left edge under the title (whole steps of 20
  px), with the notes 40 px under it.

## 6. What it writes

- **Elements, in drawing order**: title and subtitle, group areas, group titles, arrows each followed by its
  label, boxes each followed by its label, notes. Arrows come before the boxes so that they are drawn under them.
- **Ids**: `title`, `subtitle`, `group-<id>` and `group-<id>-title`, `edge-<n>` and `edge-<n>-label` (n counts the
  edges from 1, in the description's order), `node-<id>` and `label-<id>`, `note-<n>`.
- **Style**: roughness 1 (hand-drawn), strokeWidth 2 for boxes and arrows and 1 for areas, rounded rectangles
  (`roundness` type 3), round diamonds, ellipses and arrows (type 2).
- **Fixed values**: `version` 1; `seed` and `versionNonce` from a hash of the id; `updated` 1794096000000
  (2026-11-08); indexes `a0`, `a1`, ...; `source` this project's address; `appState` grid 20, white canvas;
  `files` empty. The same description always gives the same bytes.
- The JSON is indented by 2 spaces, as Excalidraw writes it, with no newline at the end.

## 7. Warnings

The drawing is written; each warning names what to change in the description.

| Warning | What to do |
| --- | --- |
| `<what>: Excalifont has no →; Excalidraw draws it in another font.` | write a word instead of the character (`to`, `and`) |
| `<what>: Nunito has no Chinese, Japanese or Korean (...)` | leave `font` out: Excalifont is the best font for them (never a reason to change the user's words) |
| `the label is wider than Excalidraw keeps on one line on this arrow` | shorten the label, or put `\n` in it |
| `the two boxes are too close to draw an arrow between them` | move them apart (manual layout) |
| `The boxes "a" and "b" overlap or are less than 10 px apart.` | move one (manual layout) |
| `edges[i] (a -> b) passes through the box "c".` | change the order of the nodes or edges, or place them by hand |
| `edges[i] (a -> b) crosses the title of the group "g".` | move the group or the nodes the arrow joins |
| `The label of edges[i] touches the box "c".`, `The labels of edges[i] and edges[j] overlap.` | shorten the labels, or label fewer arrows |
| `The label of edges[i] touches the title of the group "g".` | shorten the label or the title |
| `The area of the group "g" covers the box "c", which is not in the group.` | put "c" in the group, or give it edges that keep it outside |
| `The areas of the groups "g" and "h" overlap.` | in `down` and `right`, give the groups fewer shared layers; in `manual`, move them apart |
