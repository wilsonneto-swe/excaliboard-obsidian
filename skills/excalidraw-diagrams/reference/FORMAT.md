# The .excalidraw format: every field

SKILL.md has the short version. This is the format as Excalidraw 0.18.1 (the version Excaliboard bundles) writes
and reads it, with what it does to a field that is missing or wrong. The complete drawing in section 11 passes
`check-drawing.mjs`, and Excalidraw loads and saves it without changing a field.

## 1. The file

- One JSON object, UTF-8 without a byte order mark. Excalidraw writes it with 2-space indentation and no newline at
  the end; any valid JSON layout opens.
- Top-level keys: `type` (`"excalidraw"`), `version` (2), `source` (the address of the app that wrote it; nothing
  reads it), `elements` (an array), `appState` (an object), `files` (an object). When Excaliboard saves, it writes
  these six and keeps any other top-level key the file had, such as Excalidraw+'s.
- `appState` keeps four settings: `viewBackgroundColor` (the canvas colour, `"#ffffff"`), `gridSize` (20),
  `gridStep` (5: a heavier line every 5 cells) and `gridModeEnabled` (`false`: whether moving snaps to the grid).
  Excaliboard and excalidraw.com read only these four when they open a drawing, and save only these four: write only
  these four. Scroll and zoom are not in the file:
  Excaliboard keeps them per drawing in its own data.
- Excaliboard opens a drawing read-only, and never writes it, when the text is not JSON (`Invalid JSON: ...`), when
  `type` is not `"excalidraw"` (`Not an Excalidraw scene: "type" is not "excalidraw".`), when `elements` is not an
  array, when an element has no string `id` or `type` (`An element has no id or type.`), when `files` is not an
  object, and when Excalidraw would drop an element or cannot load the drawing (section 12). An empty file opens as a
  new drawing. A picture in `files` stored as a web address rather than a `data:` URL shows as a picture that failed
  to load: Excaliboard loads nothing from the web.

## 2. Fields of every element

| Field | Write | When it is missing |
| --- | --- | --- |
| `id` | a unique string; Excalidraw makes 21 characters from `A-Z a-z 0-9 _ -` | read-only |
| `type` | `rectangle`, `ellipse`, `diamond`, `text`, `arrow`, `line`, `freedraw`, `image`, `frame`, `embeddable`, `iframe`, `magicframe` | read-only |
| `x`, `y` | the top-left corner, in pixels (for arrows, lines and freedraw: the first point) | 0 |
| `width`, `height` | the size in pixels; for arrows, lines and freedraw, the extent of the points | 0 (a shape of size 0 is dropped) |
| `angle` | rotation in radians, clockwise, around the centre | 0 |
| `strokeColor` | the outline (and text) colour, `"#1e1e1e"` | `"#1e1e1e"` |
| `backgroundColor` | the fill, `"transparent"` or a colour | `"transparent"` |
| `fillStyle` | `"solid"`, `"hachure"`, `"cross-hatch"` or `"zigzag"` | `"solid"` |
| `strokeWidth` | 1, 2 or 4 (Excalidraw's thin, bold, extra bold) | 2 |
| `strokeStyle` | `"solid"`, `"dashed"` or `"dotted"` | `"solid"` |
| `roughness` | 0 (architect: clean lines), 1 (artist: hand-drawn), 2 (cartoonist) | 1 |
| `opacity` | 0 to 100 | 100 |
| `groupIds` | the groups it belongs to, innermost first (section 10) | `[]` |
| `frameId` | `null`, or the id of the frame it is in | `null` |
| `index` | its place in the drawing order (section 9) | given on load |
| `roundness` | `null` (sharp), `{"type": 3}` (rounded rectangle), `{"type": 2}` (diamonds, ellipses, curved arrows) | `null` |
| `seed` | an integer that fixes the hand-drawn strokes | 1 (every element then wobbles alike) |
| `version` | 1 for a new element, + 1 at each change | 1 |
| `versionNonce` | an integer, new at each change | 0 |
| `isDeleted` | `false` (`true` hides it, and the next save drops it) | `false` |
| `boundElements` | `[]`, or `{"type": "text" or "arrow", "id"}` for its label and the arrows bound to it | `[]` (Excalidraw also turns `null` into `[]`) |
| `updated` | when it last changed, in milliseconds since 1970 | the time of loading |
| `link` | `null`, or a link opened from the element's link icon | `null` |
| `locked` | `false` (`true`: cannot be selected or moved) | `false` |

Excalidraw keeps fields it does not know (`customData` and others), and the order of the keys does not matter.

## 3. Shapes: rectangle, ellipse, diamond

No fields of their own. A rectangle with `"roundness": {"type": 3}` has corners of radius 25% of its shorter side,
32 px at most. A diamond's corners touch the middle of each side of its box; `{"type": 2}` rounds them. An ellipse
fills its box.

## 4. Text

| Field | Write |
| --- | --- |
| `text` | what is shown; `\n` between lines |
| `originalText` | the same as `text`, unless Excalidraw wrapped the text to fit its box: then the text before wrapping |
| `fontSize` | 16, 20, 28 or 36 (Excalidraw's S, M, L, XL) |
| `fontFamily` | 5 (Excalifont, hand-drawn), 6 (Nunito), 8 (Comic Shanns, code) |
| `textAlign` | `"left"`, `"center"` or `"right"` |
| `verticalAlign` | `"top"`, `"middle"` or `"bottom"` (it matters for a label in a box) |
| `containerId` | `null`, or the id of the box or arrow it labels (section 5) |
| `lineHeight` | 1.25 for Excalifont and Comic Shanns, 1.35 for Nunito |
| `autoResize` | `true` (the element grows with its text); `false` keeps `width` and wraps the text to it |

- `width` is the width of the widest line and `height` is (number of lines) x `fontSize` x `lineHeight`.
  Excalidraw does not measure the text when it loads a drawing: it draws it at `x`, `y` and centres it by `width`, so
  a wrong width shows. `make-drawing.mjs --measure "<text>"` prints both for Excalidraw's own fonts.
- Fonts in Excalidraw 0.18.1: 1 Virgil, 2 Helvetica, 3 Cascadia (older, kept for old drawings), 5 Excalifont, 6
  Nunito, 7 Lilita One, 8 Comic Shanns, 9 Liberation Sans (Excalidraw's stand-in for Helvetica in exports). Write 5,
  6 or 8. Any other number, 4 included, is drawn in a fallback font.
- Excalifont has Latin (with accents), Greek and Cyrillic; Nunito has Latin and Cyrillic, Comic Shanns Latin. Other
  characters (arrows such as `→`, emoji, `Δ` and `Ω`, which Excalifont leaves out) come from a fallback font.
  Excalidraw draws Chinese, Japanese and Korean in Xiaolai, a hand-drawn font it pairs with Excalifont only;
  Excaliboard leaves Xiaolai out (12 MB), so there they come from a system font, about 1 em wide.
- An empty `text` is deleted when the drawing loads.

## 5. Labels in boxes and on arrows

A label is a text element whose `containerId` is a rectangle, ellipse, diamond or arrow, and the container's
`boundElements` lists `{"type": "text", "id": "<the text's id>"}`. One label per container. Put the label right after
its container in the array (its index after the container's). Write `textAlign` `"center"` and `verticalAlign`
`"middle"` for a centred label.

When the box moves, is resized or the text is edited, Excalidraw places the label in the box's text area and wraps
`originalText` to its width. Write the label where Excalidraw would put it, so nothing jumps at the first edit. The
text area, with `P` = 5 (Excalidraw's padding):

| Container | Text area's left, top | Width, height |
| --- | --- | --- |
| rectangle | `x + P`, `y + P` | `width - 2P`, `height - 2P` |
| ellipse | `x + P + (width / 2)(1 - √2/2)`, `y + P + (height / 2)(1 - √2/2)` | `round(width / 2 x √2) - 2P`, `round(height / 2 x √2) - 2P` |
| diamond | `x + P + width / 4`, `y + P + height / 4` | `round(width / 2) - 2P`, `round(height / 2) - 2P` |

A centred label is at `left + (areaWidth - text.width) / 2`, `top + (areaHeight - text.height) / 2`. A label wider
than the area is wrapped onto more lines at the next edit, and the box grows to fit.

A label on an arrow is centred on the arrow's middle: the middle point when the arrow has an odd number of points, the
midpoint of the middle segment when it has two (on a curved arrow with 4, 6 ... points, the middle of the curve).
Excalidraw keeps it on one line up to `max(0.7 x the arrow's width, 11 x fontSize)` px (176 px at 16 px) and wraps the
rest when the arrow changes.

## 6. Arrows and lines

| Field | Write |
| --- | --- |
| `points` | `[[0, 0], [dx, dy], ...]`: at least two points, relative to `x` and `y`; the first is `[0, 0]` |
| `startArrowhead`, `endArrowhead` | `null` or `"arrow"`, `"bar"`, `"dot"`, `"circle"`, `"circle_outline"`, `"triangle"`, `"triangle_outline"`, `"diamond"`, `"diamond_outline"`, `"crowfoot_one"`, `"crowfoot_many"`, `"crowfoot_one_or_many"` |
| `startBinding`, `endBinding` | `null`, or `{"elementId", "focus", "gap"}` (arrows only) |
| `lastCommittedPoint` | `null` |
| `elbowed` | `false` (arrows only) |

- `width` and `height` are the extent of the points. With `"roundness": {"type": 2}`, an arrow with three or more
  points is a smooth curve through them; with `null`, straight segments. A `line` is the same element without
  bindings (and usually without heads); a line whose last point is its first, with a `backgroundColor`, is a filled
  shape.
- **Bindings** attach an arrow's end to a shape (a rectangle, ellipse, diamond, image, frame or free text):
  `elementId` names it, `focus` is where the arrow aims (0: through the centre; -1 to 1: towards a side) and `gap` is
  the distance in pixels between the end and the outline. The shape lists the arrow: `{"type": "arrow", "id"}` in
  its `boundElements`. When the shape moves, Excalidraw moves the end: it draws a line from the point next to that
  end through the focus point and puts the end where that line meets the outline pushed out by `gap`. So write the
  end on the line from the next point to the shape's centre (`focus` 0), `gap` px outside the outline. A rounded
  rectangle's sides are pushed out along its corners' diagonals, so by less than `gap`: on a 160 x 60 box with
  `gap` 8, about 3 px at the top and bottom and 7 px at the sides. An end written 8 px out moves closer by the
  difference (5 px at the top or bottom there) the first time the box moves, which does no harm; `make-drawing.mjs`
  writes Excalidraw's exact places.
- An arrow's binding to a shape that does not list it is kept, but the arrow stays put when the shape moves. A
  binding to an element that is not in the drawing is removed when the drawing loads.
- excalidraw.com writes newer bindings, `{"elementId", "mode", "fixedPoint"}` without `focus` and `gap`; Excalidraw
  0.18.1 treats them as `focus` 0.
- Elbow arrows (`"elbowed": true`, right angles only) bind with `"fixedPoint": [x, y]` (the end's place on the shape,
  0 to 1 across and down) and carry `fixedSegments`; draw straight or curved arrows instead.

## 7. Freedraw

`points` (relative to `x`, `y`, the first `[0, 0]`), `pressures` (`[]`, or one number from 0 to 1 per point),
`simulatePressure` (`true` when `pressures` is empty) and `lastCommittedPoint` (`null`). The stroke is filled with
`strokeColor`; `strokeWidth` sets its thickness.

## 8. Images and files

An `image` element has `fileId`, `status` (`"saved"`), `scale` (`[1, 1]`; -1 flips) and `crop` (`null`). Its
picture is in `files`:

```json
"files": {
  "4f2c9d0a": {
    "mimeType": "image/png",
    "id": "4f2c9d0a",
    "dataURL": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "created": 1794096000000
  }
}
```

- The key and `id` are the same; Excalidraw files each picture under its `id`, so a different key leaves the image
  empty. Several images can share one file.
- Types: `image/png`, `image/jpeg`, `image/svg+xml`, `image/gif`, `image/webp`, `image/bmp`, `image/x-icon`,
  `image/avif`, `image/jfif`. The data is in the file, base64: a 1 MB picture adds about 1.3 MB.
- An image whose file is missing shows an empty placeholder. A file no image uses is left out at the next save.

## 9. The drawing order: `index`

Elements are drawn in array order, later ones on top. `index` records that order as fractional-indexing keys that
sort as plain strings: `"a0"` ... `"a9"`, `"aA"` ... `"aZ"`, `"aa"` ... `"az"` (62 keys), then `"b00"` ... `"bzz"`
(3,844 keys), then `"c000"` ... Excalidraw gives a new element a key between its neighbours' (`"a1V"` between `"a1"`
and `"a2"`). A key never ends in `0` after its first part (`"a10"` is invalid, `"a1V"` is valid).

- Give every element an index, growing with the array, or leave `index` out of all of them: Excalidraw then numbers
  them `a0`, `a1`, ... when the drawing loads.
- Indexes out of order are replaced when the drawing loads. A malformed one (`"1"`, `"a10"`) can make Excalidraw fail,
  and Excaliboard then opens the drawing read-only.

## 10. Groups and frames

- **Groups**: elements whose `groupIds` share an id are selected and moved together. `groupIds` lists the
  innermost group first: `["inner", "outer"]`. A label is not grouped with its box: `containerId` binds it.
- **Frames**: a `frame` element is a titled area (`"name": "Sketch"`, or `null` for "Frame") that clips what is in
  it. An element in a frame has `frameId` set to the frame's id and comes before the frame in the array (Excalidraw
  inserts it there). Frames are drawn with a thin grey outline whatever their colours (`strokeColor` `"#bbb"`,
  `roughness` 0, `roundness` `null`, as Excalidraw writes them). For coloured areas with a title, use a rectangle and
  a text instead, as `make-drawing.mjs` does.

## 11. A complete drawing

A rectangle and a diamond, each with a label, and an arrow between them with a label, as `make-drawing.mjs` writes
them (laid out compactly here; the arrow comes first so that it is drawn under the boxes):

```json
{
  "type": "excalidraw", "version": 2, "source": "https://github.com/wilsonneto-swe/excaliboard-obsidian",
  "elements": [
    {"id": "edge-1", "type": "arrow", "x": 126.98, "y": 50, "width": 110.28, "height": 0, "angle": 0,
     "strokeColor": "#1e1e1e", "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
     "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [], "frameId": null, "index": "a0",
     "roundness": {"type": 2}, "seed": 1504477563, "version": 1, "versionNonce": 353352359, "isDeleted": false,
     "boundElements": [{"type": "text", "id": "edge-1-label"}], "updated": 1794096000000, "link": null,
     "locked": false, "points": [[0, 0], [110.28, 0]], "lastCommittedPoint": null,
     "startBinding": {"elementId": "node-order", "focus": 0, "gap": 8},
     "endBinding": {"elementId": "node-paid", "focus": 0, "gap": 8}, "startArrowhead": null,
     "endArrowhead": "arrow", "elbowed": false},
    {"id": "edge-1-label", "type": "text", "x": 160.96, "y": 40, "width": 42.32, "height": 20, "angle": 0,
     "strokeColor": "#1e1e1e", "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
     "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [], "frameId": null, "index": "a1",
     "roundness": null, "seed": 1965830468, "version": 1, "versionNonce": 1234282703, "isDeleted": false,
     "boundElements": [], "updated": 1794096000000, "link": null, "locked": false, "text": "check", "fontSize": 16,
     "fontFamily": 5, "textAlign": "center", "verticalAlign": "middle", "containerId": "edge-1",
     "originalText": "check", "autoResize": true, "lineHeight": 1.25},
    {"id": "node-order", "type": "rectangle", "x": 0, "y": 20, "width": 120, "height": 60, "angle": 0,
     "strokeColor": "#1971c2", "backgroundColor": "#a5d8ff", "fillStyle": "solid", "strokeWidth": 2,
     "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [], "frameId": null, "index": "a2",
     "roundness": {"type": 3}, "seed": 1186627580, "version": 1, "versionNonce": 1159160544, "isDeleted": false,
     "boundElements": [{"type": "text", "id": "label-order"}, {"type": "arrow", "id": "edge-1"}],
     "updated": 1794096000000, "link": null, "locked": false},
    {"id": "label-order", "type": "text", "x": 32.67, "y": 37.5, "width": 54.66, "height": 25, "angle": 0,
     "strokeColor": "#1e1e1e", "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
     "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [], "frameId": null, "index": "a3",
     "roundness": null, "seed": 100548980, "version": 1, "versionNonce": 1421931208, "isDeleted": false,
     "boundElements": [], "updated": 1794096000000, "link": null, "locked": false, "text": "Order", "fontSize": 20,
     "fontFamily": 5, "textAlign": "center", "verticalAlign": "middle", "containerId": "node-order",
     "originalText": "Order", "autoResize": true, "lineHeight": 1.25},
    {"id": "node-paid", "type": "diamond", "x": 240, "y": 0, "width": 160, "height": 100, "angle": 0,
     "strokeColor": "#f08c00", "backgroundColor": "#ffec99", "fillStyle": "solid", "strokeWidth": 2,
     "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [], "frameId": null, "index": "a4",
     "roundness": {"type": 2}, "seed": 2002315431, "version": 1, "versionNonce": 393631563, "isDeleted": false,
     "boundElements": [{"type": "text", "id": "label-paid"}, {"type": "arrow", "id": "edge-1"}],
     "updated": 1794096000000, "link": null, "locked": false},
    {"id": "label-paid", "type": "text", "x": 294.11, "y": 37.5, "width": 51.78, "height": 25, "angle": 0,
     "strokeColor": "#1e1e1e", "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
     "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [], "frameId": null, "index": "a5",
     "roundness": null, "seed": 1726512831, "version": 1, "versionNonce": 780102835, "isDeleted": false,
     "boundElements": [], "updated": 1794096000000, "link": null, "locked": false, "text": "Paid?", "fontSize": 20,
     "fontFamily": 5, "textAlign": "center", "verticalAlign": "middle", "containerId": "node-paid",
     "originalText": "Paid?", "autoResize": true, "lineHeight": 1.25}
  ],
  "appState": {"gridSize": 20, "gridStep": 5, "gridModeEnabled": false, "viewBackgroundColor": "#ffffff"},
  "files": {}
}
```

The other element types differ only in their own fields. A free text (`containerId` `null`), a line under it, a
freedraw squiggle and an image, each with the fields of section 2 as above:

```json
{"type": "text", "text": "Notes", "originalText": "Notes", "fontSize": 28, "fontFamily": 5, "textAlign": "left",
 "verticalAlign": "top", "containerId": null, "lineHeight": 1.25, "autoResize": true, "width": 80.22, "height": 35}
{"type": "line", "points": [[0, 0], [200, 0]], "width": 200, "height": 0, "roundness": {"type": 2},
 "startArrowhead": null, "endArrowhead": null, "startBinding": null, "endBinding": null, "lastCommittedPoint": null}
{"type": "freedraw", "points": [[0, 0], [12, -6], [24, 0], [36, 6], [48, 0]], "width": 48, "height": 12,
 "pressures": [], "simulatePressure": true, "lastCommittedPoint": null}
{"type": "image", "fileId": "4f2c9d0a", "status": "saved", "scale": [1, 1], "crop": null, "width": 120, "height": 80}
```

## 12. What Excalidraw changes when it loads a drawing

Excalidraw 0.18.1 repairs a drawing as it loads it (its `restore`), and the next save writes the result. The checker
reports each of these:

- **Read-only in Excaliboard**: an element of a type it does not have (`"stickynote"` from excalidraw.com, or any
  other) that is not deleted and not of size 0; an arrow, line or freedraw without `points`; an arrow or line with a
  `null` point; a text without `text` and `lineHeight`; a `link` or `boundElementIds` of the wrong kind; a
  malformed `index` next to one that must be replaced. Excaliboard shows why and never writes the file.
- **Dropped**: `"selection"` elements, shapes of size 0, arrows, lines and freedraws with fewer than 2 points, empty
  texts (deleted).
- **Renamed**: the second of two elements with the same id gets a new random id.
- **Renumbered**: indexes out of order, missing next to others, or malformed.
- **Normalised**: points shifted so the first is `[0, 0]` (moving `x`, `y`); negative widths and heights made
  positive; `"draw"` elements become `line`; missing fields get the defaults of section 2; `boundElements` `null`
  becomes `[]`.
- **Repaired**: a label whose box does not list it is added to the box's `boundElements`; a box that lists a text
  whose `containerId` is `null` becomes its container; bindings and `boundElements` entries that name missing
  elements are removed; a `frameId` naming a missing frame is cleared; a line's bindings are removed.
- **Left out at the next save**: deleted elements, files no image uses, and `appState` keys other than the four of
  section 1.
