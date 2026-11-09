# Example drawings

Drawings that Excaliboard opens. Copy this folder (or one drawing) into your vault and click a drawing: it opens in
the Excalidraw editor. They are plain `.excalidraw` files, so excalidraw.com opens them too (menu > Open).

| Drawing | What it is | What it shows |
| --- | --- | --- |
| [Getting started](Getting%20started.excalidraw) | Excaliboard in seven boxes | a decision, labelled arrows, a box with a link that opens Sharding |
| [Sharding](Sharding.excalidraw) | database sharding: a routing tier, three shards, each a leader and two followers | hash ranges on arrows, dashed replication, tinted areas for the shards |
| [Weekend in Lisbon](Weekend%20in%20Lisbon.excalidraw) | a trip plan, as a board | five coloured areas around the topic, with cards in them |

Every text is in Excalifont, Excalidraw's hand-drawn font, and every label is bound to its box, so a box takes its
label along when you move it, and arrows follow the boxes they join. The link in Getting started opens
`Sharding.excalidraw`: keep the two in the same vault.

The drawings were made with the agent skill's generator ([skills/excalidraw-diagrams](../skills/excalidraw-diagrams))
from short descriptions: Sharding with its top-down layout, Getting started and Weekend in Lisbon with boxes placed by
hand. An AI agent with the skill makes drawings like these from a request.
