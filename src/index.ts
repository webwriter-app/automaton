import {
	html,
	LitElement,
	PropertyDeclaration,
	PropertyValueMap,
	TemplateResult,
} from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { LitElementWw, type OptionDeclaration } from "@webwriter/lit";

import { styles } from "./styles/styles";

import SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
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

import { Settings, drawerActions, optionGroups, options } from "./components/Settings";
import { AddSinkstateToDFA } from "./utils/transformations/Sinkstate";

import { biBoxes, biExclamationTriangle, biPencil } from "./styles/icons";

import { styleMap } from "lit/directives/style-map.js";

import { guard } from "lit/directives/guard.js";
import {
	checkIfNodesUpdated,
	checkIfTransitionsUpdated,
	stripNode,
	stripTransition,
} from "./utils/updates";
import { NFA } from "./automata/nfa";
import { PDA, StackExtension } from "./automata/pda";


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

	private _transitions: Transition[] = [];

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
	public set transitions(value: Transition[]) { this._transitions = value; }
	public get transitions() { return this._transitions; }

	/** The authored PDA starting stack, stored as a JSON array from bottom to top. */
	@property({
		attribute: "startingstack",
		reflect: true,
		useDefault: true,
		converter: ATTRIBUTE_CONVERTERS.stackArray,
	})
	public accessor startingStack: string[] = [];

	/** The type of the automaton. Can be `'dfa'`, `'nfa'`, or `'pda'`. */
	@property({ type: String, attribute: true, reflect: true })
	public accessor type: AutomatonType = "dfa";

	/** The current mode. Can be `'edit'`, or `'simulate'`. */
	@property({ type: String, attribute: true, reflect: true })
	public accessor mode: "edit" | "simulate" = "edit";

	/** A regular expression to check the language of the automaton against. */
	@property({ type: String, attribute: true, reflect: true, useDefault: true })
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
	public readonly settings = new Settings(this);

	// WebWriter supports the tree control before the installed Lit helper types do.
	static get options() { return options() as unknown as Record<string, OptionDeclaration>; }
	static get optionGroups() { return optionGroups(); }
	public override readonly actions = drawerActions(this);

	// The drawer's values differ from these settings' authored attribute formats.
	/** @internal */
	get selectedPermissions() { return this.settings.selectedPermissions; }
	set selectedPermissions(value: string[] | null) { this.settings.selectedPermissions = value; }

	/** @internal */
	get allowedTypeOptions() { return this.allowedTypes; }
	set allowedTypeOptions(value: string[] | null) {
		this.setAttribute("allowedtypes", ATTRIBUTE_CONVERTERS.stringArray.toAttribute(value) ?? "");
	}

	/** @internal */
	get sinkStateEnabled() { return this.allowedTransformations.includes("sink"); }
	set sinkStateEnabled(value: boolean) {
		if (this.sinkStateEnabled === (value === true)) return;
		const transformations = this.allowedTransformations.filter(transformation => transformation !== "sink");
		if (value === true) transformations.push("sink");
		this.setAttribute("allowedtransformations", ATTRIBUTE_CONVERTERS.stringArray.toAttribute(transformations) ?? "");
	}

	/** @internal */
	get allowedModeOptions() { return this.allowedModes; }
	set allowedModeOptions(value: string[] | null) {
		this.setAttribute("allowedmodes", ATTRIBUTE_CONVERTERS.stringArray.toAttribute(value) ?? "");
	}

	/** @internal */
	get helpEnabled() { return this.showHelp === "true"; }
	set helpEnabled(value: boolean) { this.setAttribute("showhelp", String(value === true)); }

	/** @internal */
	get formalDefinitionEnabled() { return this.showFormalDefinition === "true"; }
	set formalDefinitionEnabled(value: boolean) { this.setAttribute("showformaldefinition", String(value === true)); }

	/** @internal */
	get transitionsTableEnabled() { return this.showTransitionsTable === "true"; }
	set transitionsTableEnabled(value: boolean) { this.setAttribute("showtransitionstable", String(value === true)); }

	/** @internal */
	get testWordsInput() { return (this.testWords ?? []).join(","); }
	set testWordsInput(value: string | null) {
		this.setAttribute("testwords", JSON.stringify(value ? value.split(",") : []));
	}

	/** @internal */
	get forcedAlphabetInput() { return (this.forcedAlphabet ?? []).join(","); }
	set forcedAlphabetInput(value: string | null) {
		const symbols = value?.split(",").filter(symbol => symbol.length === 1) ?? [];
		this.setAttribute("forcedalphabet", JSON.stringify([...new Set(symbols)]));
	}

	/** @internal */
	static shadowRootOptions = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	@property({ type: Object, attribute: false })
	private accessor _automaton: Automaton = new DFA([], []);

	@property({ type: Boolean, attribute: false })
	private accessor _helpOverlay: boolean = false;

	@state()
	private accessor _topMenuCollapsed: boolean = false;

	private set helpOverlay(h: boolean) {
		this._helpOverlay = h;
	}

	private writtenNodes?: Node[];
	private writtenTransitions?: Transition[];

	private replaceAutomaton(a: Automaton) {
		if (this._graph) this.automaton.simulator.reset();
		if (a instanceof DFA) a.requiredAlphabet = this.forcedAlphabet ?? [];
		a.showErrors = this.showHelp === "true";
		this._automaton = a;
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

	static get scopedElements() {
		return {
			"sl-button": SlButton,
			"sl-button-group": SlButtonGroup,
			// Shoelace's autocorrect property predates the native HTMLElement property.
			"sl-input": SlInput as unknown as CustomElementConstructor,
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
		this.topMenu.setHelpOverlay = (h: boolean) => {
			this.helpOverlay = h;
		};
		this.topMenu.setCollapsed = (c: boolean) => {
			this._topMenuCollapsed = c;
		};
		this.simulatorMenu.automaton = this.automaton;
		this.simulatorMenu.graph = this._graph;
		this._graph.setInteractive(this.mode === "edit");
		if (this.mode === "simulate") this.simulatorMenu.init();

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

		const type = this.type === "dfa" || this.type === "nfa" || this.type === "pda"
			? this.type : this.automaton.type;
		const replace = _changedProperties.has("type") &&
			(!this._graph || type !== this.automaton.type);
		// A local edit has already been applied to the graph. Undo, redo and remote
		// edits instead replace the graph from the complete authored snapshot.
		const readGraph = (_changedProperties.has("nodes") && this.nodes !== this.writtenNodes) ||
			(_changedProperties.has("transitions") && this.transitions !== this.writtenTransitions);
		this.writtenNodes = undefined;
		this.writtenTransitions = undefined;
		const readTransitions = () => {
			const nodeIds = new Set(this.nodes.map(node => node.id));
			return this.transitionsForType(
				this.transitions.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to)), type);
		};
		if (replace) {
			const AutomatonClass = { dfa: DFA, nfa: NFA, pda: PDA }[type];
			this.replaceAutomaton(new AutomatonClass(this.nodes, readTransitions()));
		} else if (readGraph) {
			this._graph?.cancelConnection();
			this._graph?.network.unselectAll();
			this.automaton.loadAutomaton({
				nodes: this.nodes,
				transitions: readTransitions(),
			});
		}
		if (!replace && _changedProperties.has("forcedAlphabet") && this.automaton instanceof DFA) {
			this.automaton.requiredAlphabet = this.forcedAlphabet ?? [];
		}
		if (_changedProperties.has("showHelp")) this.automaton.showErrors = this.showHelp === "true";
		if (!replace && (readGraph || _changedProperties.has("forcedAlphabet") || _changedProperties.has("showHelp"))) {
			this._graph?.requestUpdate();
		}

		if (_changedProperties.has("allowedModes")) {
			if (
				!this.allowedModes.includes(this.mode) &&
				this.allowedModes.length > 0
			) {
				this.mode = this.allowedModes[0] as "edit" | "simulate";
			}
		}

		const modeChanged = _changedProperties.has("mode");
		const stackChanged = _changedProperties.has("startingStack");
		if (this.automaton instanceof PDA) {
			const stack = this.automaton.extension;
			const permissions = this.settings.permissions.stack;
			const editable = String(this.mode === "edit");
			if (stack.contentEditable !== editable) stack.contentEditable = editable;
			stack.add = permissions.add;
			stack.delete = permissions.delete;
			stack.change = permissions.change;
			stack.showHelp = this._helpOverlay && !this._topMenuCollapsed;
			if (replace || stackChanged || modeChanged) this.automaton.setStartingStack(this.startingStack);
		}

		if (modeChanged || replace || readGraph || (stackChanged && this.mode === "simulate")) {
			if (this.allowedModes.includes(this.mode)) {
				if (modeChanged) this._graph?.network.unselectAll();
				this.automaton.clearHighlights();
				this.simulatorMenu?.reset();
				if (this.mode === "simulate") this.simulatorMenu?.init();
				this._graph?.setInteractive(this.mode === "edit");
			} else if (modeChanged && this.allowedModes.length > 0) {
				this.mode = this.allowedModes[0] as "edit" | "simulate";
			}
		}

		Logger.log("will update");
	}

	protected updated(changedProperties: PropertyValueMap<this>): void {
		super.updated(changedProperties);
		if (changedProperties.has("permissions") || changedProperties.has("mode")) {
			this._graph?.network.redraw();
		}
		if (["type", "mode", "allowedTypes", "allowedTransformations", "forcedAlphabet", "nodes", "transitions"]
			.some(property => changedProperties.has(property as keyof this))) {
			this.dispatchEvent(new Event("optionschange", { bubbles: true }));
		}
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
			<div class=${this._topMenuCollapsed ? "editor editor--compact" : "editor"}>
				<div class="workspace" data-mode=${this.mode} @starting-stack-change=${this.saveStartingStack}>
					<div class="graph">
						${this._helpOverlay && !this._topMenuCollapsed ? this.renderHelpOverlay() : ""}
						<div id="graphCanvas"></div>
						${this.mode === "edit" && this.settings.permissions.node.add &&
							this.automaton.nodes.getIds().every(id => id === Graph.initialGhostNode.id) ? html`
								<div class="empty-canvas-hint">${msg("Double click / long tap to add a node")}</div>
							` : ""}
						${this._graph ? html`<div class="connection-points">${this._graph.renderConnectionPoints()}</div>` : ""}
						${this.renderModeSwitch()}
						<webwriter-automaton-topmenu id="topMenu"></webwriter-automaton-topmenu>
						<webwriter-automaton-toolmenu
							id="toolMenu"
							style=${styleMap({
								display: this.mode === "edit" ? "flex" : "none",
							})}
						></webwriter-automaton-toolmenu>
						<webwriter-automaton-simulatormenu
							id="simulatorMenu"
							?hidden=${this.mode !== "simulate" || this._graph?.errors.length !== 0}
						></webwriter-automaton-simulatormenu>
					</div>
					${guard([this.automaton], () => this.automaton.extension)}
					<div class="workspace-footer">
						${this.renderWarnings()}
						${this._graph?.renderEditingBar()}
					</div>
				</div>
				${this._helpOverlay && this._topMenuCollapsed ? this.renderCompactHelp() : ""}
			</div>
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

				<sl-tag size="small" class="help-overlay__fullscreen"
					>${msg("Fullscreen")}</sl-tag
				>
				<div
					class="line"
					style="top: 55px;right: 30px;height: 164px;"
				></div>

				<sl-tag size="small" style="top:18px;right:275px"
					>${msg("Type")}</sl-tag
				>
				<div class="line" style="top:28px;right:260px;width:10px"></div>

				<sl-tag size="small" style="top: 186px;right: 275px;"
					>${msg("Help")}</sl-tag
				>
				<div
					class="line"
					style="top: 55px;right: 80px;width: 190px;height: 141px;"
				></div>

				<sl-tag size="small" style="top: 144px;right: 275px;"
					>${msg("Test Cases")}</sl-tag
				>
				<div
					class="line"
					style="top: 55px;right: 130px;width: 140px;height: 99px;"
				></div>

				<sl-tag size="small" style="top: 102px;right: 275px;"
					>${msg("Definition")}</sl-tag
				>
				<div
					class="line"
					style="top: 55px;right: 180px;width: 90px;height: 57px;"
				></div>
			</div>

			<div
				class="help-overlay edit-help"
				style=${styleMap({
					display: this.mode === "edit" ? "block" : "none",
				})}
			>
				${this.automaton instanceof DFA && this.sinkStateEnabled ? html`
					<sl-tag size="small" class="edit-help__sink">${msg("Add sink state")}</sl-tag>
				` : ""}
				${this.settings.permissions.node.add ? html`<sl-tag size="small" style="bottom: 26px;left: 70px;"
					>${msg("Click or drag + to add a node")}</sl-tag
				>` : ""}
				<sl-tag size="small" class="edit-help__transition"
					>${msg("Add Transition by drag and drop")}</sl-tag
				>

				<sl-tag size="small" style="bottom: 110px;right: 30px;"
					>${msg("Move the elements by drag and drop")}</sl-tag
				>
				<sl-tag size="small" style="bottom: 70px;right: 30px;"
					>${msg("Select a node or transition to edit it")}</sl-tag
				>
			</div>

			${this.mode === "simulate" ? html`
				<div class="help-overlay simulator-help">
					<sl-tag size="small">${msg("Input word")}</sl-tag>
					<sl-tag size="small">${msg("Simulation Controls")}</sl-tag>
				</div>
			` : ""}
		`;
	}

	private renderCompactHelp(): TemplateResult {
		return html`
			<div class="help-backdrop"></div>
			<div class="compact-help" role="region" aria-label=${msg("Help")} tabindex="0">
				<span>${msg("Mode Switch")}</span>
				<span>${msg("Menu")}</span>
				${this.automaton instanceof PDA ? html`
					<span>${this.mode === "edit" && this.settings.permissions.stack.delete
						? msg("Remove stack items with ×") : msg("Stack")}</span>
				` : ""}
				${this.mode === "edit" ? html`
					${this.automaton instanceof DFA && this.sinkStateEnabled ? html`<span>${msg("Add sink state")}</span>` : ""}
					${this.settings.permissions.node.add ? html`<span>${msg("Click or drag + to add a node")}</span>` : ""}
					<span>${msg("Add Transition by drag and drop")}</span>
					<span>${msg("Select a node or transition to edit it")}</span>
				` : html`
					<span>${msg("Input word")}</span>
					<span>${msg("Simulation Controls")}</span>
				`}
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
				placement="bottom-start"
			>
				<div class="mode_switch__buttons" role="group" aria-label=${msg("Mode Switch")} contenteditable="false">
					<button
						type="button"
						aria-pressed=${this.mode === "edit"}
						?disabled=${!this.allowedModes.includes("edit")}
						@click=${() => { this.mode = "edit"; }}
					>
						<span aria-hidden="true">${biPencil}</span>
						<span class="mode_switch__label">${msg("Edit")}</span>
					</button>
					<button
						type="button"
						aria-pressed=${this.mode === "simulate"}
						?disabled=${!this.canSimulate()}
						@click=${() => { this.mode = "simulate"; }}
					>
						<span aria-hidden="true">${biBoxes}</span>
						<span class="mode_switch__label">${msg("Simulate")}</span>
					</button>
				</div>
			</sl-tooltip>
			${this.showHelp === "true" && this._graph?.errors.length ? html`
				<button type="button" class="mode_switch__error_indicator" aria-label=${msg("Warnings")}
					aria-describedby="automaton-warnings" contenteditable="false">
					<span aria-hidden="true">${biExclamationTriangle}</span>
				</button>
			` : ""}
		</div>`;
	}

	private renderWarnings() {
		if (this.showHelp !== "true" || !this._graph?.errors.length) return;
		const { errors, nodeWarnings } = this._graph;
		return html`
			<sl-alert id="automaton-warnings" class="warning-panel warning-panel--all" variant="warning" open>
				<ul>
					${errors.map(error => html`
						<li>${error.node ? html`<b>${error.node.label}:</b> ` : ""}${error.message}</li>
					`)}
				</ul>
			</sl-alert>
			${nodeWarnings.length ? html`
				<sl-alert class="warning-panel warning-panel--node" variant="warning" open>
					<ul>${nodeWarnings.map(error => html`<li>${error.message}</li>`)}</ul>
				</sl-alert>
			` : ""}
		`;
	}

	/** @internal */
	public async completeDfaWithSink() {
		const { automaton } = this;
		if (!(automaton instanceof DFA) || this.settings.sinkDisabledReason || !AddSinkstateToDFA(automaton)) return;
		this.commitGraphEdit();
		this._graph?.requestUpdate();
		await this.updateComplete;
	}

	/** @internal */
	public switchToDfa() { return this.switchType("dfa"); }
	/** @internal */
	public switchToNfa() { return this.switchType("nfa"); }
	/** @internal */
	public switchToPda() { return this.switchType("pda"); }

	/** @internal */
	public async switchType(type: AutomatonType) {
		if (this.mode !== "edit" || !this.allowedTypes.includes(type) || this.type === type) return;
		this.writeGraphAttributes(this.authoredNodes(), this.transitionsForType(this.authoredTransitions(), type));
		this.setAttribute("type", type);
		await this.updateComplete;
	}

	private canSimulate() {
		return this.allowedModes.includes("simulate") && this._graph?.errors.length === 0;
	}

	private toggleMode() {
		if (this.mode === "edit") {
			if (this.canSimulate()) this.mode = "simulate";
		} else if (this.allowedModes.includes("edit")) {
			this.mode = "edit";
		}
	}

	private transitionsForType(transitions: Transition[], type = this.automaton.type): Transition[] {
		return transitions.map(({ stackOperations, ...edge }) => type === "pda"
			? {
				...edge,
				stackOperations: edge.symbols.map((_, index) =>
					stackOperations?.[index] ?? { operation: "none", symbol: "", condition: "" }),
			}
			: { ...edge, stackOperations: undefined });
	}

	private authoredNodes(a = this.automaton) {
		return a.nodes.get().filter(node => node.id !== Graph.initialGhostNode.id).map(stripNode);
	}

	private authoredTransitions(a = this.automaton) {
		return a.transitions.get().filter(edge => edge.from !== Graph.initialGhostNode.id).map(stripTransition);
	}

	/** @internal */
	public commitGraphEdit() {
		this.writeGraphAttributes(this.authoredNodes(), this.authoredTransitions());
	}

	private writeGraphAttributes(nodes: Node[], transitions: Transition[]) {
		const { nodeArray, transitionArray } = ATTRIBUTE_CONVERTERS;
		const encodedNodes = nodeArray.toAttribute(nodes);
		const encodedTransitions = transitionArray.toAttribute(transitions);
		if (encodedNodes !== nodeArray.toAttribute(this.nodes)) {
			this.setAttribute("nodes", encodedNodes ?? "");
			this.writtenNodes = this.nodes;
		}
		if (encodedTransitions !== transitionArray.toAttribute(this.transitions)) {
			this.setAttribute("transitions", encodedTransitions ?? "");
			// The HTML format omits edge IDs. Keep the live IDs after our own write
			// so a selection still refers to the same edge after deleting a neighbor.
			this._transitions = transitions;
			this.writtenTransitions = transitions;
		}
	}

	private saveStartingStack(event: Event) {
		if (this.mode !== "edit" || !(this.automaton instanceof PDA) || event.target !== this.automaton.extension) return;
		const stack = this.automaton.extension.getStack();
		const encoded = JSON.stringify(stack);
		if (encoded === JSON.stringify(this.startingStack)) return;
		if (stack.length) this.setAttribute("startingstack", encoded);
		else this.removeAttribute("startingstack");
	}
}
