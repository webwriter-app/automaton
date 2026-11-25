# Automaton (`@webwriter/automaton@4.1.0`)
[License: MIT](LICENSE) | Version: 4.1.0

Design, visualize, and test finite automata and pushdown automata.

## Snippets
[Snippets](https://webwriter.app/docs/snippets/snippets/) are examples and templates using the package's widgets.

| Name | Import Path |
| :--: | :---------: |
| Dfa Simple | `@webwriter/automaton/snippets/dfa-simple.html` |
| Dfa Complex | `@webwriter/automaton/snippets/dfa-complex.html` |
| Nfa Simple | `@webwriter/automaton/snippets/nfa-simple.html` |
| Nfa Complex | `@webwriter/automaton/snippets/nfa-complex.html` |
| Pda Simple | `@webwriter/automaton/snippets/pda-simple.html` |
| Pda Complex | `@webwriter/automaton/snippets/pda-complex.html` |



## `AutomatonComponent` (`<webwriter-automaton>`)
Automaton editor and simulator.

Conversions: a JFLAP file (`.jff`, finite and pushdown automata) imports and exports; bends and loop angles are not part of that format and the test for an empty stack becomes an unconditional transition. The diagram exports as `image/svg+xml`, the transitions as a `table`.

Signal `accepted`: a boolean that is true while the last simulation run accepted its word and false otherwise, also after a reset.

Theme: `--ww-text-color`, `--ww-font-family`, `--ww-theme-accent-1` and `-2`; width limit `--ww-widget-max` (2100px).

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
| `AutomatonComponent.scopedElements` | `object` | - | `{ ...shoelaceElements, ...sceneElements, // Where the browser has no WebGL the same diagram is drawn with SVG. "ww-scene": webglAvailable() ? PixiScene : Scene, "webwriter-automaton-toolmenu": ToolMenu, "webwriter-automaton-simulatormenu": SimulatorMenu, "webwriter-automaton-topmenu": TopMenu, "stack-extension": StackExtension, }` | ✗ |
| `AutomatonComponent.dataType` | `string` | - | `"application/json"` | ✗ |
| `AutomatonComponent.options` | - | - | `options` | ✗ |
| `AutomatonComponent.optionGroups` | - | - | `optionGroups` | ✗ |
| `AutomatonComponent.convertFrom` | `object` | - | `{ ".jff": importJff }` | ✗ |
| `AutomatonComponent.convertTo` | `object` | - | `{ ".jff": exportJff, "image/svg+xml": exportSvg, table: exportTable }` | ✗ |
| `actions` | - | - | - | ✗ |
| `mode` (`mode`) | `"edit" \| "simulate"` | The current mode. Can be `'edit'`, or `'simulate'`. | `"edit"` | ✓ |
| `testLanguage` (`testLanguage`) | `string` | A regular expression to check the language of the automaton against. | `""` | ✓ |
| `testWords` (`testWords`) | `string[]` | Words used for automatically testing the automaton as a string separated by spaces. | `[]` | ✓ |
| `verbose` (`verbose`) | `boolean` | Enables logging of numerous events to the console. | - | ✓ |
| `permissions` (`permissions`) | `string` | The encoded permissions for the editor. | `"777"` | ✓ |
| `showHelp` (`showHelp`) | `string` | If true, the widget displays automaton error messages. | `"true"` | ✓ |
| `showFormalDefinition` (`showFormalDefinition`) | `string` | If true, the widget allows viewing the automaton's formal definition. | `"true"` | ✓ |
| `showTransitionsTable` (`showTransitionsTable`) | `string` | If true, the widget allows viewing the automaton's transition table. | `"true"` | ✓ |
| `allowedTypes` (`allowedTypes`) | `string[]` | The types of automata that are allowed in the editor. | `["dfa", "nfa", "pda"]` | ✗ |
| `allowedModes` (`allowedModes`) | `string[]` | The modes that are allowed in the editor. | `["edit", "simulate"]` | ✗ |
| `allowedTransformations` (`allowedTransformations`) | `string[]` | The transformations that are allowed in the editor. | `["sink"]` | ✗ |
| `nodes` | `readonly Node[]` | The authored states from the JSON data block. | - | ✗ |
| `transitions` | `readonly Transition[]` | The authored transitions from the JSON data block. | - | ✗ |
| `startingStack` | `readonly string[]` | The authored PDA starting stack, ordered from bottom to top. | - | ✗ |
| `type` | `AutomatonType` | The authored automaton type. | - | ✗ |
| `forcedAlphabet` | `readonly string[]` | The explicitly configured alphabet from the JSON data block. | - | ✗ |
| `forcedAlphabetInput` | - | - | - | ✗ |
| `signals` | `object` | Published for other widgets. | `{ accepted: computed(() => this.#accepted.get()) }` | ✗ |
| `settings` | `Settings` | - | - | ✗ |
| `selectedPermissions` | - | - | - | ✗ |
| `allowedTypeOptions` | - | - | - | ✗ |
| `sinkStateEnabled` | - | - | - | ✗ |
| `allowedModeOptions` | - | - | - | ✗ |
| `helpEnabled` | - | - | - | ✗ |
| `formalDefinitionEnabled` | - | - | - | ✗ |
| `transitionsTableEnabled` | - | - | - | ✗ |
| `testWordsInput` | - | - | - | ✗ |

*Fields including [properties](https://developer.mozilla.org/en-US/docs/Glossary/Property/JavaScript) and [attributes](https://developer.mozilla.org/en-US/docs/Glossary/Attribute) define the current state of the widget and offer customization options.*

## Events
| Name | Description |
| :--: | :---------: |
| optionschange | - |

*[Events](https://developer.mozilla.org/en-US/docs/Web/Events) are dispatched by the widget after certain triggers.*

## CSS parts
| Name | Description |
| :--: | :---------: |
| canvas | The diagram surface. |
| state | A state of the diagram. |

*[CSS parts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_shadow_parts) allow freely styling internals of the widget with CSS.*

## Editing config
| Name | Value |
| :--: | :---------: |


*The [editing config](https://webwriter.app/docs/packages/configuring/#editingconfig) defines how explorable authoring tools such as [WebWriter](https://webwriter.app) treat the widget.*

*No public methods, slots, or custom CSS properties.*


---
*Generated with @webwriter/build@1.15.0*
