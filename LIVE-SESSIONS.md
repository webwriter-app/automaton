# Live sessions

The automaton widget publishes seven aggregate views for a live session: `custom`, `selection`, `ordering`, `number`, `text`, `spatial`, and `distancemap`. The editor discovers these declarations from the widget. Authors do not need to add an aggregate-view attribute. The live session's per-widget selector lets an instructor choose a view while learners work.

Add a direct JSON data child to the widget. An empty object starts the learner from the authored graph:

```html
<webwriter-automaton type="dfa" nodes="#0(-180|0);1(0|0);2(180|0)"
  transitions="0-1[a];0-2[b];1-2[a];1-1[b];2-2[a,b]">
  <script type="application/json" slot="data">{}</script>
</webwriter-automaton>
```

When learners edit the graph or explanation, their response is stored in the data block as `{graph: {type, nodes, transitions}, explanation}`. The authored `nodes`, `transitions`, and `type` attributes remain the starting graph for the lesson. Changing those authored attributes changes that starting graph.

The views project the same learner responses in different ways:

- `selection` compares IDs of accepting states.
- `ordering` compares state IDs from left to right.
- `number` compares state counts.
- `text` shows explanation responses and word frequencies. Learners enter explanations in the widget textarea.
- `spatial` compares all state positions in common bounds.
- `distancemap` compares graph structure while ignoring layout. It matches states by ID and does not claim formal language equivalence.
- `custom` shows superimposed graph counts with an explicit reference comparison.

An optional reference is authored explicitly with `reference-nodes`, `reference-transitions`, and `reference-type="dfa|nfa|pda"`. These use the existing graph encodings. The authored starting graph does not imply a correct answer. The thumbnail wall is the editor's fallback when it cannot render an aggregate view; it is separate from the seven declared views.

To try this in WebWriter, build the local package in `/Users/fsalmen/Projekte/widgets/automaton` and load that package folder through the local package UI. Start a live host and open the lesson with at least two real learners in the same session. Choose a view in the live session selector and have learners edit their graphs and explanations; the view updates from their actual responses. Use the included **Live session: all views** snippet.
