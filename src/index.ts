import {
	html,
	LitElement,
	PropertyDeclaration,
	PropertyValueMap,
	TemplateResult,
} from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { LitElementWw } from "@webwriter/lit";

import { styles } from "./styles/styles";

import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import SlDetails from "@shoelace-style/shoelace/dist/components/details/details.component.js";
import SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import SlCheckbox from "@shoelace-style/shoelace/dist/components/checkbox/checkbox.component.js";
import SlTooltip from "@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js";
import SlButtonGroup from "@shoelace-style/shoelace/dist/components/button-group/button-group.component.js";
import SlAlert from "@shoelace-style/shoelace/dist/components/alert/alert.component.js";
import SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import SlOption from "@shoelace-style/shoelace/dist/components/option/option.component.js";

import SlIcon from "@shoelace-style/shoelace/dist/components/icon/icon.component.js";
import SlIconButton from "@shoelace-style/shoelace/dist/components/icon-button/icon-button.component.js";
import SlPopup from "@shoelace-style/shoelace/dist/components/popup/popup.component.js";
import SlTag from "@shoelace-style/shoelace/dist/components/tag/tag.component.js";
import SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.component.js";
import SlRange from "@shoelace-style/shoelace/dist/components/range/range.component.js";
import SlSwitch from "@shoelace-style/shoelace/dist/components/switch/switch.component.js";
import SlDivider from "@shoelace-style/shoelace/dist/components/divider/divider.component.js";

import "@shoelace-style/shoelace/dist/themes/light.css";

import { DFA } from "./automata/dfa";
import { Automaton, Node, Transition } from "./automata";
import { Graph } from "./graph";
import { Logger } from "./utils/logger";

import { TopMenu } from "./components/TopMenu";
import { ToolMenu } from "./components/ToolMenu";
import { InfoMenu } from "./components/InfoMenu";
import { SimulatorMenu } from "./components/SimulatorMenu";

import { Settings } from "./components/Settings";

import { biBoxes, biExclamationTriangle, biPencil } from "./styles/icons";

import { styleMap } from "lit/directives/style-map.js";

import { guard } from "lit/directives/guard.js";
import { SlChangeEvent } from "@shoelace-style/shoelace";
import {
	checkIfNodesUpdated,
	checkIfTransitionsUpdated,
	stripNode,
	stripTransition,
} from "./utils/updates";
import { NFA } from "./automata/nfa";
import { PDA, StackExtension } from "./automata/pda";

import { debounce } from "lodash";

// @ts-ignore
import LOCALIZE from "../localization/generated";
import { localized, msg } from "@lit/localize";
import { ATTRIBUTE_CONVERTERS } from "@u/attributeConverters";

export type AutomatonType = "dfa" | "nfa" | "pda";

/**
 * Represents an Automaton Component.
 * This component is responsible for rendering and managing the automaton editor and simulator.
 */
@customElement("webwriter-automaton")
@localized()
export class AutomatonComponent extends LitElementWw {
	@query("#graphCanvas") private accessor graphCanvas!: HTMLElement;
	@query("#toolMenu") private accessor toolMenu!: ToolMenu;
	@query("#simulatorMenu") private accessor simulatorMenu!: SimulatorMenu;
	@query("#infoMenu") private accessor infoMenu!: InfoMenu;
	@query("#topMenu") private accessor topMenu!: TopMenu;

	protected localize = LOCALIZE;

	/**
     * Each automaton state is encoded as a string using the following format:<br>`[#][%]<id>[<label>](<x>|<y>)`<br><br>Regex:<br>`^(#)?(%)?(\d+)(?:\[([^\]]*(?:\\.[^\]]*)*)\])?\((-?\d+)\|(-?\d+)\)$`<br><br>Explanation:<br>`#`: Optional - marks the initial state.<br>`%`: Optional - marks the final (accepting) state.<br>`<id>`: Required non-negative integer - unique state ID.<br>`[<label>]`: Optional - URI-encoded label. Defaults to `q<id>` if omitted.<br>`(<x>|<y>)`: Required coordinates - signed integers representing the node's position.<br><br>Multiple nodes are separated by semicolons (`;`). Example:<br>`#0(-150|0);%1[accept](0|0);2[sink](150|0)`<br><br>Requirements:<br>Coordinates are mandatory, and there must be at least 150 units of distance between any two nodes.<br>In the case of DFAs, the automaton MUST be complete, i.e. every node MUST have EXACTLY one transition for every input symbol. Correspondingly, a sink should be non-final and have self-loops on all inputs. Implicit sinks are NOT allowed.
     */
	@property({
		type: Array,
		attribute: true,
		reflect: true,
		converter: ATTRIBUTE_CONVERTERS.nodeArray,
		hasChanged: checkIfNodesUpdated,
	})
	public accessor nodes: Node[] = [];

	/**
	 * Each automaton transition is encoded as:<br>`<from>-<to>[<symbolsOrStackOps>][~<roundness>][@<angle>]`<br>Multiple transitions are separated by semicolons (`;`).<br><br>Regex:<br>`^(?:;\d+-\d+(?:\[(?:[^,\{\]\|]+(?:,[^,\{\]\|]+)*|[^,\{\]\|]*\{(?:p|o|e|n)\|[^,\{\]\|]*\|[^,\{\]\|]*\}(?:,[^,\{\]\|]*\{(?:p|o|e|n)\|[^,\{\]\|]*\|[^,\{\]\|]*\})*)\])?(?:~(-?)(\d+(?:\.\d+)?))?(?:@(-?\d+))?)*$`<br><br>Explanation:<br>`<from>-<to>`: Required - origin and destination state IDs (non-negative integers).<br>`[<symbolsOrStackOps>]`: Required - DFA or NFA -> Symbols only: one or more URI-encoded symbols, separated by commas. PDA -> Stack operations: <symbol>{<op>|<stackSymbol>|<condition>}, with <op> one of: p (push), o (pop), e (empty check), or n (no-op); <stackSymbol> being the optional symbol to push or pop, and <condition> being an optional symbol the stack must have on top.<br>`~<roundness>`: Optional - curvature of the arc, negative sign means counter-clockwise. 0.2 is recommended if there is a circle between two states.<br>`@<angle>`: Optional - integer degrees for self-loop placement. Defaults to 45°.<br><br>Multiple transitions must be separated by semicolons, no trailing `;`.<br><br>Examples:<br>`0-1[a]`<br>`1-2[a,b]~0.5`<br>`2-2[a{p|X|},b{o||}]@45;0-1[c]~1.2`
	 */
	@property({
		type: Array,
		attribute: true,
		reflect: true,
		converter: ATTRIBUTE_CONVERTERS.transitionArray,
		hasChanged: checkIfTransitionsUpdated,
	})
	public accessor transitions: Transition[] = [];

	/** The type of the automaton. Can be `'dfa'`, `'nfa'`, or `'pda'`. */
	@property({ type: String, attribute: true, reflect: true })
	public accessor type: AutomatonType = "dfa";

	/** The current mode. Can be `'edit'`, or `'simulate'`. */
	@property({ type: String, attribute: true, reflect: true })
	public accessor mode: "edit" | "simulate" = "edit";

	/** A regular expression to check the language of the automaton against. */
	@property({ type: String, attribute: true, reflect: true })
	public accessor testLanguage: string = "";

	/** The alphabet that the automaton is forced to use as characters separated by spaces. */
	@property({ type: Array, attribute: true, reflect: true })
	public accessor forcedAlphabet: string[] = [];

	/** Words used for automatically testing the automaton as a string separated by spaces. */
	@property({ type: Array, attribute: true, reflect: true })
	public accessor testWords: string[] = [];

	private _verbose: boolean = false;

	/** Enables logging of numerous events to the console. */
	@property({ type: Boolean, attribute: true, reflect: true })
	public set verbose(v: boolean) {
		this._verbose = v;
		Logger.verbose = v;
	}
	public get verbose(): boolean {
		return this._verbose;
	}

	/** The encoded permissions for the editor. */
	@property({ type: String, attribute: true, reflect: true })
	public accessor permissions: string = "777";

	/** If true, the widget displays automaton error messages. */
	@property({ type: String, attribute: true, reflect: true })
	public accessor showHelp: string = "true";

	/** If true, the widget allows viewing the automaton's formal definition. */
	@property({ type: String, attribute: true, reflect: true })
	public accessor showFormalDefinition: string = "true";

	/** If true, the widget allows viewing the automaton's transition table. */
	@property({ type: String, attribute: true, reflect: true })
	public accessor showTransitionsTable: string = "true";

	/** The types of automata that are allowed in the editor. */
	@property({
		type: Array,
		attribute: true,
		reflect: true,
		converter: ATTRIBUTE_CONVERTERS.stringArray,
	})
	public accessor allowedTypes: string[] = ["dfa", "nfa", "pda"];

	/** The modes that are allowed in the editor. */
	@property({
		type: Array,
		attribute: true,
		reflect: true,
		converter: ATTRIBUTE_CONVERTERS.stringArray,
	})
	public accessor allowedModes: string[] = ["edit", "simulate"];

	/** The transformations that are allowed in the editor. */
	@property({
		type: Array,
		attribute: true,
		reflect: true,
		converter: ATTRIBUTE_CONVERTERS.stringArray,
	})
	public accessor allowedTransformations: string[] = ["sink"];

	@state()
	private accessor _graph!: Graph;
	protected set graph(g: Graph) {
		this._graph = g;
	}
	protected get graph() {
		return this._graph;
	}

	/** @internal */
	public settings = new Settings(this);

	/** @internal */
	static shadowRootOptions = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	@property({ type: Object, attribute: false })
	private accessor _automaton: Automaton = new DFA([], []);

	@property({ type: Boolean, attribute: false })
	private accessor _helpOverlay: boolean = false;

	private set helpOverlay(h: boolean) {
		this._helpOverlay = h;
		this.toolMenu.visible = h ? true : this.toolMenu.visible;
	}

	/** @internal */
	public set automaton(a: Automaton) {
		this._automaton = a;
		this.type = a.type;
		this.setUpListeners(this._automaton);
		this._graph?.setAutomaton(this._automaton);
		if (this.simulatorMenu) this.simulatorMenu.automaton = this._automaton;
		Logger.log("Automaton set", this._automaton.transitions.get());
	}
	/** @internal */
	public get automaton() {
		return this._automaton;
	}

	public static get styles() {
		return styles;
	}

	protected static get scopedElements() {
		return {
			"sl-button": SlButton,
			"sl-button-group": SlButtonGroup,
			"sl-details": SlDetails,
			"sl-input": SlInput,
			"sl-checkbox": SlCheckbox,
			"sl-tooltip": SlTooltip,
			"sl-alert": SlAlert,
			"sl-select": SlSelect,
			"sl-option": SlOption,
			"sl-dialog": SlDialog,
			"webwriter-automaton-toolmenu": ToolMenu,
			"webwriter-automaton-simulatormenu": SimulatorMenu,
			"webwriter-automaton-infomenu": InfoMenu,
			"webwriter-automaton-topmenu": TopMenu,
			"stack-extension": StackExtension,
			"sl-icon": SlIcon,
			"sl-icon-button": SlIconButton,
			"sl-popup": SlPopup,
			"sl-tag": SlTag,
			"sl-range": SlRange,
			"sl-switch": SlSwitch,
			"sl-divider": SlDivider,
		};
	}

	constructor() {
		super();
		Logger.verbose = this.verbose;

		Logger.log("constructor");
	}

	/**
	 * Lifecycle callback called after the element's first update.
	 * @param _changedProperties - Map of properties that have changed with their previous values.
	 */
	protected firstUpdated(
		_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
	): void {
		super.firstUpdated(_changedProperties);

		this._graph = new Graph(
			this.graphCanvas,
			this.automaton,
			this.toolMenu,
			this
		);
		this._graph.requestUpdate = () => this.requestUpdate();
		this._graph.toggleMode = () => this.toggleMode();
		this.toolMenu.graph = this._graph;
		this.topMenu.component = this;
		this.topMenu.graph = this._graph;
		this.topMenu.setHelpOverlay = (h: boolean) => {
			this.helpOverlay = h;
		};
		this.simulatorMenu.automaton = this.automaton;
		this.simulatorMenu.graph = this._graph;

		this.settings = new Settings(this);
		this.settings.numberStringToPermissions(this.permissions);

		if (this.automaton.extension) {
			this.automaton.extension.contentEditable = "true";
			(this.automaton.extension as StackExtension).add =
				this.settings.permissions.stack.add;
			(this.automaton.extension as StackExtension).delete =
				this.settings.permissions.stack.delete;
			(this.automaton.extension as StackExtension).change =
				this.settings.permissions.stack.change;
		}

		Logger.log("first updated");
	}

	/**
	 * This method is called before the component updates. It handles the logic for updating the automaton based on the changed properties.
	 *
	 * @param _changedProperties - A map of changed properties.
	 */
	protected willUpdate(
		_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
	): void {
		super.willUpdate(_changedProperties);

		if (_changedProperties.has("type")) {
			if (this.type === "dfa")
				this.automaton = new DFA(this.nodes, this.transitions);
			if (this.type === "nfa")
				this.automaton = new NFA(this.nodes, this.transitions);
			if (this.type === "pda")
				this.automaton = new PDA(this.nodes, this.transitions);
		}

		if (_changedProperties.has("allowedModes")) {
			if (
				!this.allowedModes.includes(this.mode) &&
				this.allowedModes.length > 0
			) {
				this.mode = this.allowedModes[0] as "edit" | "simulate";
			}
		}

		if (_changedProperties.has("mode")) {
			if (this.allowedModes.includes(this.mode)) {
				this._graph?.network.unselectAll();
				this.automaton?.clearHighlights();
				this._graph?.contextMenu.hide();

				if (this.mode === "edit") {
					this.simulatorMenu?.reset();
					this._graph?.requestUpdate();
					this._graph?.setInteractive(true);
					if (this.automaton?.extension)
						this.automaton.extension.contentEditable = "true";
				} else if (this.mode === "simulate") {
					this.automaton?.redrawNodes();
					this.simulatorMenu?.init();
					this._graph?.setInteractive(false);
					if (this.automaton?.extension)
						this.automaton.extension.contentEditable = "false";
				}
			} else {
				Logger.warn(
					`Mode ${
						this.mode
					} is not allowed. Allowed modes are: ${this.allowedModes.join(
						", "
					)}`
				);
				if (this.allowedModes.length > 0) {
					Logger.warn(
						`Switching to first allowed mode: ${this.allowedModes[0]}`
					);
					this.mode = this.allowedModes[0] as "edit" | "simulate";
				}
			}
		}

		if (
			_changedProperties.has("nodes") ||
			_changedProperties.has("transitions")
		) {
			this.automaton.updateAutomaton(this.nodes, this.transitions);
			if (this._graph) this._graph.updateGhostNodePosition();
		}

		if (this.automaton && this.automaton.extension) {
			(this.automaton.extension as StackExtension).add =
				this.settings.permissions.stack.add;
			(this.automaton.extension as StackExtension).delete =
				this.settings.permissions.stack.delete;
			(this.automaton.extension as StackExtension).change =
				this.settings.permissions.stack.change;
		}

		if (_changedProperties.has("showHelp")) {
			this.automaton.showErrors = this.showHelp === "true";
		}

		Logger.log("will update");
	}

	requestUpdate(
		name?: PropertyKey | undefined,
		oldValue?: unknown,
		options?: PropertyDeclaration<unknown, unknown> | undefined
	): void {
		super.requestUpdate(name, oldValue, options);
		this.toolMenu?.requestUpdate();
		this.simulatorMenu?.requestUpdate();
		this.infoMenu?.requestUpdate();
		this.topMenu?.requestUpdate();
	}

	/**
	 * Renders the component and returns a TemplateResult.
	 * @returns {TemplateResult} The rendered TemplateResult.
	 */
	public render(): TemplateResult {
		return html`
			${this.renderEditor()}
			${this.isContentEditable
				? guard([this.settings], () => this.renderSettings())
				: ""}
		`;
	}

	private renderEditor(): TemplateResult {
		return html`
			<div class="editor">
				${this._helpOverlay ? this.renderHelpOverlay() : ""}
				<div id="graphCanvas"></div>
				${this._graph?.contextMenu.render()} ${this.renderModeSwitch()}
				${this._graph?.renderErrorDisplay()}
				<!-- <webwriter-automaton-infomenu id="infoMenu"></webwriter-automaton-infomenu> -->
				<webwriter-automaton-topmenu
					id="topMenu"
				></webwriter-automaton-topmenu>
				<webwriter-automaton-simulatormenu
					id="simulatorMenu"
					style=${styleMap({
						display: this.mode === "simulate" ? "flex" : "none",
					})}
				></webwriter-automaton-simulatormenu>
				<webwriter-automaton-toolmenu
					id="toolMenu"
					style=${styleMap({
						display: this.mode === "edit" ? "flex" : "none",
					})}
				></webwriter-automaton-toolmenu>
				${guard(
					[this.permissions, this.automaton],
					() => this.automaton.extension
				)}
			</div>
		`;
	}

	/**
	 * Renders the settings section of the component.
	 * @returns {TemplateResult} The rendered settings section.
	 */
	private renderSettings(): TemplateResult {
		return html`
			<aside class="settings" part="options">
				${this.settings.render()}
			</aside>
		`;
	}

	/**
	 * Renders the help overlay.
	 * @returns {TemplateResult} The rendered help overlay.
	 */
	private renderHelpOverlay(): TemplateResult {
		return html`
			<div class="help-backdrop"></div>
			<div class="help-overlay">
				<sl-tag size="small" style="top:50px;left:10px"
					>${msg("Mode Switch")}</sl-tag
				>

				<sl-tag size="small" style="top: 228px;right:10px"
					>${msg("Fullscreen")}</sl-tag
				>
				<div
					class="line"
					style="top: 55px;right: 30px;height: 164px;"
				></div>

				<sl-tag size="small" style="top:18px;right:325px"
					>${msg("Type")}</sl-tag
				>
				<div class="line" style="top:28px;right:310px;width:10px"></div>

				<sl-tag size="small" style="top:60px;right:325px"
					>${msg("Transformations")}</sl-tag
				>
				<div
					class="line"
					style="top:55px;right:230px;width:90px;height:15px"
				></div>

				<sl-tag size="small" style="top: 186px;right: 325px;"
					>${msg("Help")}</sl-tag
				>
				<div
					class="line"
					style="top: 55px;right: 80px;width: 240px;height: 141px;"
				></div>

				<sl-tag size="small" style="top: 144px;right: 325px;"
					>${msg("Test Cases")}</sl-tag
				>
				<div
					class="line"
					style="top: 55px;right: 130px;width: 190px;height: 99px;"
				></div>

				<sl-tag size="small" style="top: 102px;right: 325px;"
					>${msg("Definition")}</sl-tag
				>
				<div
					class="line"
					style="top: 55px;right: 180px;width: 140px;height: 57px;"
				></div>
			</div>

			<div
				class="help-overlay"
				style=${styleMap({
					display: this.mode === "edit" ? "block" : "none",
				})}
			>
				<sl-tag size="small" style="bottom: 77px;left: 80px;"
					>${msg("Add Node by click")}</sl-tag
				>
				<sl-tag size="small" style="bottom: 128px;left: 80px;"
					>${msg("Add Transition by drag and drop")}</sl-tag
				>

				<sl-tag size="small" style="bottom: 110px;right: 30px;"
					>${msg("Move the elements by drag and drop")}</sl-tag
				>
				<sl-tag size="small" style="bottom: 70px;right: 30px;"
					>${msg("To edit a node right click the node")}</sl-tag
				>
				<sl-tag size="small" style="bottom: 30px;right: 30px;"
					>${msg(
						"To edit a transition right click the transition"
					)}</sl-tag
				>
			</div>

			<div
				class="help-overlay"
				style=${styleMap({
					display: this.mode === "simulate" ? "block" : "none",
				})}
			>
				<sl-tag size="small" style="bottom: 60px;left: 10px;"
					>${msg("Input word")}</sl-tag
				>
				<sl-tag size="small" style="bottom: 60px;left: 10px;"
					>${msg("Simulation Controls")}</sl-tag
				>
			</div>
		`;
	}

	/**
	 * Renders the mode switch component.
	 * @returns {TemplateResult} The rendered mode switch component.
	 */
	private renderModeSwitch(): TemplateResult {
		return html`<div class="mode_switch">
			<sl-tooltip
				content=${msg("Switch mode (Ctrl+M)")}
				placement="right"
			>
				<sl-select
					size="small"
					class="mode_switch__select"
					value=${this.mode}
					.value=${this.mode}
					defaultValue="${this.mode}"
					?disabled=${this.allowedModes.length <= 1}
					@sl-change=${(e: SlChangeEvent) => {
						this.mode = (e.target as SlSelect).value as
							| "edit"
							| "simulate";
					}}
					name="mode"
				>
					<span slot="prefix"
						>${this.mode === "edit" ? biPencil : biBoxes}</span
					>
					<sl-option value=${"edit"} selected>
						<span slot="prefix">${biPencil}</span> ${msg("Edit")}
					</sl-option>
					<sl-option value=${"simulate"}>
						<span slot="prefix">${biBoxes}</span> ${msg("Simulate")}
					</sl-option>
				</sl-select>
			</sl-tooltip>
			<div
				class="mode_switch__error_indicator"
				style=${this._graph?.errors.length > 0
					? "display: block"
					: "display: none"}
			>
				${biExclamationTriangle}
			</div>
		</div>`;
	}

	/**
	 * Toggles the mode between 'edit' and 'simulate'.
	 */
	private toggleMode() {
		this.mode = this.mode === "edit" ? "simulate" : "edit";
	}

	/**
	 * Sets up the listeners for the automaton.
	 * @param a The automaton object.
	 */
	private setUpListeners(a: Automaton) {
		/**
		 * Updates the attributes of the graph by filtering and mapping the nodes and transitions
		 * based on certain conditions.
		 */
		const updateAttributes = () => {
			this.nodes = this.automaton.nodes
				.get()
				.filter((n) => n.id !== Graph.initialGhostNode.id)
				.map(stripNode);
			this.nodes = [...this.nodes];
			this.transitions = this.automaton.transitions
				.get()
				.filter((t) => t.from !== Graph.initialGhostNode.id)
				.map(stripTransition);
			this.transitions = [...this.transitions];
		};

		a.nodes.on("*", debounce(updateAttributes, 200));
		a.transitions.on("*", debounce(updateAttributes, 200));
	}
}
