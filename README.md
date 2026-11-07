# Automaton (`@webwriter/automaton@3.0.2`)
[License: MIT](LICENSE) | Version: 3.0.2

Build, visualize, and interact with different kinds of automata (DFA, NFA, PDA).

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| DFA (simple) | `@webwriter/automaton/snippets/dfa-simple.html` |
| DFA (complex) | `@webwriter/automaton/snippets/dfa-complex.html` |
| NFA (simple) | `@webwriter/automaton/snippets/nfa-simple.html` |
| NFA (complex) | `@webwriter/automaton/snippets/nfa-complex.html` |
| PDA (simple) | `@webwriter/automaton/snippets/pda-simple.html` |
| PDA (complex) | `@webwriter/automaton/snippets/pda-complex.html` |



## `AutomatonComponent` (`<webwriter-automaton>`)
Represents an Automaton Component.
This component is responsible for rendering and managing the automaton editor and simulator.

### Usage

Use with a CDN (e.g. [jsdelivr](https://jsdelivr.com)):
```html
<link href="https://cdn.jsdelivr.net/npm/@webwriter/automaton/widgets/webwriter-automaton.css" rel="stylesheet">
<script type="module" src="https://cdn.jsdelivr.net/npm/@webwriter/automaton/widgets/webwriter-automaton.js"></script>
<webwriter-automaton></webwriter-automaton>
```

Or use with a bundler (e.g. [Vite](https://vite.dev)):

```
npm install @webwriter/automaton
```

```html
<link href="@webwriter/automaton/widgets/webwriter-automaton.css" rel="stylesheet">
<script type="module" src="@webwriter/automaton/widgets/webwriter-automaton.js"></script>
<webwriter-automaton></webwriter-automaton>
```

### Machine data

Put the authored machine in a direct JSON data block.

```html
<webwriter-automaton>
  <script type="application/json" slot="data">
    {
      "format": "webwriter-automaton",
      "version": 1,
      "type": "nfa",
      "states": [
        { "id": 0, "label": "q0", "x": 0, "y": 0, "initial": true },
        { "id": 1, "label": "q1", "x": 180, "y": 0, "final": true }
      ],
      "transitions": [
        { "id": 0, "from": 0, "to": 1, "rules": [{ "read": "" }, { "read": "a" }] }
      ]
    }
  </script>
</webwriter-automaton>
```

- `type` is `dfa`, `nfa`, or `pda`. An empty widget starts as a DFA.
- State and transition IDs are unique non-negative integers within their respective lists. Transition endpoints refer to state IDs. State flags default to false.
- Each transition describes one edge. Each rule has a `read` string, with `""` for ε. Optional `bend` is signed curvature. Optional `loopAngle` is measured clockwise from the top in degrees.
- PDA rules can include `stack` with `op` set to `push`, `pop`, `empty`, or `none`, plus a `symbol` and `ifTop` condition where applicable. An omitted stack operation leaves the stack unchanged. Optional `startingStack` lists symbols from bottom to top. The live simulation stack stays in memory.
- Optional `requiredAlphabet` lists the DFA's predefined input symbols.

The JSON block is the authored machine saved with the document. Earlier graph attributes are ignored.

## Settings

Omitted settings use the defaults below. Removing an attribute restores its default. An empty allowed list is an explicit override.

| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `mode` (`mode`) | `"edit" \| "simulate"` | The current mode. Can be `'edit'`, or `'simulate'`. | `"edit"` | ✓ |
| `testLanguage` (`testLanguage`) | `string` | A regular expression to check the language of the automaton against. | `""` | ✓ |
| `testWords` (`testWords`) | `string[]` | Words used for automatically testing the automaton as a string separated by spaces. | `[]` | ✓ |
| `verbose` (`verbose`) | `boolean` | Enables logging of numerous events to the console. | - | ✓ |
| `permissions` (`permissions`) | `string` | The encoded permissions for the editor. | `"777"` | ✓ |
| `showHelp` (`showHelp`) | `string` | If true, the widget displays automaton error messages. | `"true"` | ✓ |
| `showFormalDefinition` (`showFormalDefinition`) | `string` | If true, the widget allows viewing the automaton's formal definition. | `"true"` | ✓ |
| `showTransitionsTable` (`showTransitionsTable`) | `string` | If true, the widget allows viewing the automaton's transition table. | `"true"` | ✓ |
| `allowedTypes` (`allowedTypes`) | `string[]` | The types of automata that are allowed in the editor. | `["dfa", "nfa", "pda"]` | ✓ |
| `allowedModes` (`allowedModes`) | `string[]` | The modes that are allowed in the editor. | `["edit", "simulate"]` | ✓ |
| `allowedTransformations` (`allowedTransformations`) | `string[]` | The transformations that are allowed in the editor. | `["sink"]` | ✓ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, slots, events, custom CSS properties, or CSS parts.*


---
*Generated with @webwriter/build@1.9.0*
