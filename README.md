# Automaton (`@webwriter/automaton@3.0.0`)
[License: MIT](LICENSE) | Version: 3.0.0

Build, visualize, and interact with different kinds of automata (DFA, NFA, PDA).

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| Dfa Simple | @webwriter/automaton/snippets/dfa-simple.html |
| Dfa Complex | @webwriter/automaton/snippets/dfa-complex.html |
| Nfa Simple | @webwriter/automaton/snippets/nfa-simple.html |
| Nfa Complex | @webwriter/automaton/snippets/nfa-complex.html |
| Pda Simple | @webwriter/automaton/snippets/pda-simple.html |
| Pda Complex | @webwriter/automaton/snippets/pda-complex.html |



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

## Fields
| Name (Attribute Name) | Type | Description | Default | Reflects |
| :-------------------: | :--: | :---------: | :-----: | :------: |
| `nodes` (`nodes`) | `Node[]` | Each automaton state is encoded as a string using the following format:<br>`[#][%]<id>[<label>](<x>\|<y>)`<br><br>Regex:<br>`^(#)?(%)?(\d+)(?:\[([^\]]*(?:\\.[^\]]*)*)\])?\((-?\d+)\\|(-?\d+)\)$`<br><br>Explanation:<br>`#`: Optional - marks the initial state.<br>`%`: Optional - marks the final (accepting) state.<br>`<id>`: Required non-negative integer - unique state ID.<br>`[<label>]`: Optional - URI-encoded label. Defaults to `q<id>` if omitted.<br>`(<x>\|<y>)`: Required coordinates - signed integers representing the node's position.<br><br>Multiple nodes are separated by semicolons (`;`). Example:<br>`#0(-150\|0);%1[accept](0\|0);2[sink](150\|0)`<br><br>Requirements:<br>Coordinates are mandatory, and there must be at least 150 units of distance between any two nodes.<br>In the case of DFAs, the automaton MUST be complete, i.e. every node MUST have EXACTLY one transition for every input symbol. Correspondingly, a sink should be non-final and have self-loops on all inputs. Implicit sinks are NOT allowed. | `[]` | ✓ |
| `transitions` (`transitions`) | `Transition[]` | Each automaton transition is encoded as:<br>`<from>-<to>[<symbolsOrStackOps>][~<roundness>][@<angle>]`<br>Multiple transitions are separated by semicolons (`;`).<br><br>Regex:<br>`^(?:;\d+-\d+(?:\[(?:[^,\{\]\\|]+(?:,[^,\{\]\\|]+)*\|[^,\{\]\\|]*\{(?:p\|o\|e\|n)\\|[^,\{\]\\|]*\\|[^,\{\]\\|]*\}(?:,[^,\{\]\\|]*\{(?:p\|o\|e\|n)\\|[^,\{\]\\|]*\\|[^,\{\]\\|]*\})*)\])?(?:~(-?)(\d+(?:\.\d+)?))?(?:@(-?\d+))?)*$`<br><br>Explanation:<br>`<from>-<to>`: Required - origin and destination state IDs (non-negative integers).<br>`[<symbolsOrStackOps>]`: Required - DFA or NFA -> Symbols only: one or more URI-encoded symbols, separated by commas. PDA -> Stack operations: <symbol>{<op>\|<stackSymbol>\|<condition>}, with <op> one of: p (push), o (pop), e (empty check), or n (no-op); <stackSymbol> being the optional symbol to push or pop, and <condition> being an optional symbol the stack must have on top.<br>`~<roundness>`: Optional - curvature of the arc, negative sign means counter-clockwise. 0.2 is recommended if there is a circle between two states.<br>`@<angle>`: Optional - integer degrees for self-loop placement. Defaults to 45°.<br><br>Multiple transitions must be separated by semicolons, no trailing `;`.<br><br>Examples:<br>`0-1[a]`<br>`1-2[a,b]~0.5`<br>`2-2[a{p\|X\|},b{o\|\|}]@45;0-1[c]~1.2` | `[]` | ✓ |
| `type` (`type`) | `AutomatonType` | The type of the automaton. Can be `'dfa'`, `'nfa'`, or `'pda'`. | `"dfa"` | ✓ |
| `mode` (`mode`) | `"edit" \| "simulate"` | The current mode. Can be `'edit'`, or `'simulate'`. | `"edit"` | ✓ |
| `testLanguage` (`testLanguage`) | `string` | A regular expression to check the language of the automaton against. | `""` | ✓ |
| `forcedAlphabet` (`forcedAlphabet`) | `string[]` | The alphabet that the automaton is forced to use as characters separated by spaces. | `[]` | ✓ |
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
*Generated with @webwriter/build@1.6.0*