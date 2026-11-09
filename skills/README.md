# Agent skill: excalidraw-diagrams

This skill teaches an AI agent (Claude Code, the Claude apps, or any agent that reads instructions) to write
Excalidraw drawings that Excaliboard opens: `.excalidraw` files, plain Excalidraw JSON that excalidraw.com opens too.
With it, an agent can turn a request, notes or a document into a diagram in your vault (a flowchart, a system design,
a pipeline, a board), check a drawing, or add to one without breaking it.

Every label is bound to its box and every arrow to the boxes it joins, so in the editor they move together, as they do
when you draw them. Before it hands a drawing over, the agent checks it with Excaliboard's own rules.

```
excalidraw-diagrams/
  SKILL.md                    the instructions the agent reads (workflow, file format, what makes a readable diagram)
  scripts/make-drawing.mjs    the generator: a short JSON description in, a laid-out drawing out (Node 18 or later, no dependencies)
  scripts/check-drawing.mjs   the checker: reads a drawing as Excaliboard does and lists its problems (Node 18 or later, no dependencies)
  reference/FORMAT.md         every field of every element type, and what Excalidraw changes when it loads a drawing
  reference/DESCRIPTION.md    every key of the generator's description, its layout and its warnings
  examples/                   three drawings and the description each was made from
```

The checker follows Excaliboard's own rules (`src/scene.ts` and `src/editor.tsx`) and Excalidraw 0.18.1's, the
version Excaliboard bundles: what opens read-only, what Excalidraw drops, renames or repairs when it loads a drawing.
The generator places arrow ends and labels where Excalidraw's own code puts them and sizes labels with the widths of
Excalidraw's fonts, so nothing moves the first time you edit a drawing. The skill is not part of the plugin: Obsidian
never loads it, and the plugin's releases (`main.js`, `manifest.json`, `styles.css`) do not include it.

## Install in Claude Code

Claude Code loads skills from `~/.claude/skills/` (every project) and from `.claude/skills/` inside a project (that
project only). Get this repository and copy the folder there:

```
git clone --depth 1 https://github.com/wilsonneto-swe/excaliboard-obsidian.git
mkdir -p ~/.claude/skills && cp -R excaliboard-obsidian/skills/excalidraw-diagrams ~/.claude/skills/
```

(Or download the repository as a ZIP from GitHub, under **Code**, and copy `skills/excalidraw-diagrams` from it.)
Start a new session. Claude uses the skill when a request matches it (an Excalidraw drawing, a diagram, a flowchart,
a whiteboard sketch for Obsidian); you can also name it: "use the excalidraw-diagrams skill".

## Install in the Claude apps

Zip the folder (here into your home folder):

```
cd excaliboard-obsidian/skills && zip -r ~/excalidraw-diagrams.zip excalidraw-diagrams -x '*.DS_Store'
```

Skills in the Claude apps need code execution: turn on **Code execution and file creation** in **Settings >
Capabilities** (on a Team or Enterprise plan, an owner allows it for the organization). Then upload the zip under
**Customize > Skills** ([Use Skills in Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude)).
A drawing made there is a file to download and put in your vault. Without code execution there are no skills: paste
`SKILL.md` into the conversation instead, and Claude writes the drawing by hand, following it.

## Any other agent

Give the agent `SKILL.md` as instructions (paste it, or point the agent's rules file at it) and keep `reference/` next
to it, and `scripts/` too if the agent can run commands. The scripts need Node 18 or later.

## Example prompts

- "Draw the architecture of our checkout service as an Excalidraw diagram in my vault's Diagrams folder."
- "Turn these meeting notes into a flowchart I can edit in Obsidian." (then paste the notes)
- "Make a board for planning a weekend in Porto: what to book, see, eat and pack."
- "Add a cache between the API and the database in `Web stack.excalidraw`."
- "Check `Roadmap.excalidraw`: why does Excaliboard open it read-only?"

## Changes

The skill is developed with the plugin in this repository and changes with it: when Excaliboard moves to a newer
Excalidraw, the checker's list of element types, fonts and repairs moves with it. A pull request is welcome;
[CONTRIBUTING.md](../CONTRIBUTING.md) explains how.

- **1.0.0** (November 2026): the first version, for Excaliboard 0.1.0 and Excalidraw 0.18.1.
