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
import { stripNode, stripTransition } from "./utils/updates";
import { emptyMachine, machineBlockSelector, readMachine, writeMachine, type Machine } from "./utils/machineData";
import { NFA } from "./automata/nfa";
import { PDA, StackExtension } from "./automata/pda";


// @ts-ignore
import LOCALIZE from "../localization/generated";
import { localized, msg } from "@lit/localize";
import { ATTRIBUTE_CONVERTERS } from "@u/attributeConverters";

export type AutomatonType = "dfa" | "nfa" | "pda";
const automatonClasses = { dfa: DFA, nfa: NFA, pda: PDA };

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

	static override readonly dataType = "application/json";

	@state()
	private accessor _machine: Machine = emptyMachine();

	@state()
	private accessor _invalidMachineData = false;

	private machineText: string | null = null;
	private machineReadPending = false;
	private printWindow?: Window;

	/** The authored states from the JSON data block. */
	public get nodes(): readonly Node[] { return this._machine.nodes; }

	/** The authored transitions from the JSON data block. */
	public get transitions(): readonly Transition[] { return this._machine.transitions; }

	/** The authored PDA starting stack, ordered from bottom to top. */
	public get startingStack(): readonly string[] { return this._machine.startingStack; }

	/** The authored automaton type. */
	public get type(): AutomatonType { return this._machine.type; }

	/** The explicitly configured alphabet from the JSON data block. */
	public get forcedAlphabet(): readonly string[] { return this._machine.requiredAlphabet; }

	/** The current mode. Can be `'edit'`, or `'simulate'`. */
	@property({ type: String, attribute: true, reflect: true, useDefault: true })
	public accessor mode: "edit" | "simulate" = "edit";

	/** A regular expression to check the language of the automaton against. */
	@property({ type: String, attribute: true, reflect: true, useDefault: true })
	public accessor testLanguage: string = "";

	/** Words used for automatically testing the automaton as a string separated by spaces. */
	@property({ type: Array, attribute: true, reflect: true, useDefault: true })
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
	@property({ type: String, attribute: true, reflect: true, useDefault: true })
	public accessor permissions: string = "777";

	/** If true, the widget displays automaton error messages. */
	@property({ type: String, attribute: true, reflect: true, useDefault: true })
	public accessor showHelp: string = "true";

	/** If true, the widget allows viewing the automaton's formal definition. */
	@property({ type: String, attribute: true, reflect: true, useDefault: true })
	public accessor showFormalDefinition: string = "true";

	/** If true, the widget allows viewing the automaton's transition table. */
	@property({ type: String, attribute: true, reflect: true, useDefault: true })
	public accessor showTransitionsTable: string = "true";

	/** The types of automata that are allowed in the editor. */
	@property({
		type: Array,
		attribute: true,
		reflect: true,
		useDefault: true,
		converter: ATTRIBUTE_CONVERTERS.stringArray,
	})
	public accessor allowedTypes: string[] = ["dfa", "nfa", "pda"];

	/** The modes that are allowed in the editor. */
	@property({
		type: Array,
		attribute: true,
		reflect: true,
		useDefault: true,
		converter: ATTRIBUTE_CONVERTERS.stringArray,
	})
	public accessor allowedModes: string[] = ["edit", "simulate"];

	/** The transformations that are allowed in the editor. */
	@property({
		type: Array,
		attribute: true,
		reflect: true,
		useDefault: true,
		converter: ATTRIBUTE_CONVERTERS.stringArray,
	})
	public accessor allowedTransformations: string[] = ["sink"];

	@state()
	private accessor _graph: Graph | undefined;
	protected set graph(g: Graph) {
		this._graph = g;
	}
	protected get graph(): Graph | undefined {
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
		this.writeSetting("allowedtypes", ATTRIBUTE_CONVERTERS.stringArray.toAttribute(value));
	}

	/** @internal */
	get sinkStateEnabled() { return this.allowedTransformations.includes("sink"); }
	set sinkStateEnabled(value: boolean | null) {
		const transformations = this.allowedTransformations.filter(transformation => transformation !== "sink");
		if (value === null && !transformations.length) {
			this.removeAttribute("allowedtransformations");
			return;
		}
		const enabled = value ?? true;
		if (this.sinkStateEnabled === enabled) return;
		if (enabled) transformations.push("sink");
		this.writeSetting("allowedtransformations", ATTRIBUTE_CONVERTERS.stringArray.toAttribute(transformations));
	}

	/** @internal */
	get allowedModeOptions() { return this.allowedModes; }
	set allowedModeOptions(value: string[] | null) {
		this.writeSetting("allowedmodes", ATTRIBUTE_CONVERTERS.stringArray.toAttribute(value));
	}

	/** @internal */
	get helpEnabled() { return this.showHelp === "true"; }
	set helpEnabled(value: boolean | null) { this.writeSetting("showhelp", value === null ? null : String(value)); }

	/** @internal */
	get formalDefinitionEnabled() { return this.showFormalDefinition === "true"; }
	set formalDefinitionEnabled(value: boolean | null) { this.writeSetting("showformaldefinition", value === null ? null : String(value)); }

	/** @internal */
	get transitionsTableEnabled() { return this.showTransitionsTable === "true"; }
	set transitionsTableEnabled(value: boolean | null) { this.writeSetting("showtransitionstable", value === null ? null : String(value)); }

	/** @internal */
	get testWordsInput() { return (this.testWords ?? []).join(","); }
	set testWordsInput(value: string | null) {
		this.writeSetting("testwords", value === null ? null : JSON.stringify(value ? value.split(",") : []));
	}

	private writeSetting(attribute: string, value: string | null) {
		if (value === null) this.removeAttribute(attribute);
		else this.setAttribute(attribute, value);
	}

	/** @internal */
	get forcedAlphabetInput() { return (this.forcedAlphabet ?? []).join(","); }
	set forcedAlphabetInput(value: string | null) {
		const symbols = value?.split(",").filter(symbol => symbol.length === 1) ?? [];
		if (this.canWriteMachine()) this.saveMachine({ ...this._machine, requiredAlphabet: [...new Set(symbols)] });
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


	private replaceAutomaton(a: Automaton) {
		if (this._graph) this.automaton.simulator.reset();
		if (a instanceof DFA) a.requiredAlphabet = this._machine.requiredAlphabet;
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

	connectedCallback() {
		super.connectedCallback();
		this.printWindow = this.ownerDocument.defaultView ?? undefined;
		this.printWindow?.addEventListener("beforeprint", this.preparePrint);
		this.printWindow?.addEventListener("afterprint", this.clearPrint);
		if (this.hasUpdated) this.requestUpdate();
	}

	disconnectedCallback() {
		this.printWindow?.removeEventListener("beforeprint", this.preparePrint);
		this.printWindow?.removeEventListener("afterprint", this.clearPrint);
		this.printWindow = undefined;
		this.clearPrint();
		if (this._graph) {
			this.simulatorMenu.reset();
			this.simulatorMenu.graph = undefined;
			this._graph.destroy();
			this.toolMenu.graph = undefined;
			this._graph = undefined;
		}
		super.disconnectedCallback();
	}

	private preparePrint = () => {
		this.syncMachine();
		this.performUpdate();
		const canvas = this.renderRoot.querySelector<HTMLCanvasElement>(".print-machine canvas");
		if (!canvas) return;
		const AutomatonClass = automatonClasses[this.type];
		const { nodes, transitions } = this._machine;
		Graph.drawForPrint(canvas, new AutomatonClass(structuredClone(nodes), structuredClone(transitions)));
	};

	private clearPrint = () => {
		const canvas = this.renderRoot.querySelector<HTMLCanvasElement>(".print-machine canvas");
		if (canvas) {
			canvas.width = 0;
			canvas.height = 0;
		}
	};

	private connectGraph() {
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
		this._graph.setInteractive(this.mode === "edit" && !this._invalidMachineData);
		if (this.mode === "simulate") this.simulatorMenu.init();
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

		this.syncMachine();
		const { type, nodes, transitions, startingStack, requiredAlphabet } = this._machine;
		const previous = _changedProperties.get("_machine") as Machine | undefined;
		const machineChanged = _changedProperties.has("_machine");
		const alphabetChanged = machineChanged && previous?.requiredAlphabet !== requiredAlphabet;
		const readGraph = this.machineReadPending;
		this.machineReadPending = false;
		const replace = type !== this.automaton.type;
		if (replace) {
			const AutomatonClass = automatonClasses[type];
			this.replaceAutomaton(new AutomatonClass(nodes, transitions));
		} else if (readGraph) {
			this._graph?.cancelConnection();
			this._graph?.network.unselectAll();
			this.automaton.loadAutomaton({ nodes, transitions });
		}
		if (!replace && alphabetChanged && this.automaton instanceof DFA) {
			this.automaton.requiredAlphabet = requiredAlphabet;
		}
		if (_changedProperties.has("showHelp")) this.automaton.showErrors = this.showHelp === "true";
		if (!replace && (readGraph || alphabetChanged || _changedProperties.has("showHelp"))) {
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
		const stackChanged = machineChanged && previous?.startingStack !== startingStack;
		if (this.automaton instanceof PDA) {
			const stack = this.automaton.extension;
			const permissions = this.settings.permissions.stack;
			const editable = String(this.mode === "edit" && !this._invalidMachineData);
			if (stack.contentEditable !== editable) stack.contentEditable = editable;
			stack.add = permissions.add;
			stack.delete = permissions.delete;
			stack.change = permissions.change;
			stack.showHelp = this._helpOverlay && !this._topMenuCollapsed;
			if (replace || stackChanged || modeChanged || readGraph) this.automaton.setStartingStack(startingStack);
		}

		if (modeChanged || replace || readGraph || (stackChanged && this.mode === "simulate")) {
			if (this.allowedModes.includes(this.mode)) {
				if (modeChanged) this._graph?.network.unselectAll();
				this.automaton.clearHighlights();
				this.simulatorMenu?.reset();
				if (this.mode === "simulate") this.simulatorMenu?.init();
				this._graph?.setInteractive(this.mode === "edit" && !this._invalidMachineData);
			} else if (modeChanged && this.allowedModes.length > 0) {
				this.mode = this.allowedModes[0] as "edit" | "simulate";
			}
		}

		Logger.log("will update");
	}

	protected updated(changedProperties: PropertyValueMap<this>): void {
		super.updated(changedProperties);
		if (this.isConnected && !this._graph) this.connectGraph();
		if (changedProperties.has("permissions") || changedProperties.has("mode")) {
			this._graph?.network.redraw();
		}
		if (["_machine", "_invalidMachineData", "mode", "permissions", "allowedTypes", "allowedModes",
			"allowedTransformations", "showHelp", "showFormalDefinition", "showTransitionsTable", "testLanguage", "testWords"]
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
							?hidden=${this.mode !== "simulate" || this._invalidMachineData || this._graph?.errors.length !== 0}
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
			${this.renderPrintMachine()}
		`;
	}

	private renderPrintMachine() {
		const type = this.type === "dfa" ? msg("DFA") : this.type === "nfa" ? msg("NFA") : msg("PDA");
		return html`
			<figure class="print-machine">
				<figcaption>
					<strong>${type}</strong>
					${this.type === "pda" && !this._invalidMachineData ? html`
						<span>${msg("Starting stack")} <code>[${this.startingStack.join(", ")}]</code></span>
					` : ""}
				</figcaption>
				${this._invalidMachineData
					? html`<p>${msg("The automaton data block is invalid or uses an unsupported format.")}</p>`
					: this.nodes.length
						? html`<canvas width="0" height="0" role="img" aria-label=${msg("State diagram")}></canvas>`
						: html`<p>${msg("No states yet")}</p>`}
			</figure>
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
		if (this._invalidMachineData) return html`
			<sl-alert class="warning-panel" variant="warning" open>
				${msg("The automaton data block is invalid or uses an unsupported format.")}
			</sl-alert>
		`;
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
		if (!this.canWriteMachine() || !(automaton instanceof DFA) || this.settings.sinkDisabledReason || !AddSinkstateToDFA(automaton)) return;
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
		if (this.mode !== "edit" || !this.allowedTypes.includes(type) || this.type === type || !this.canWriteMachine()) return;
		this.saveMachine({
			...this._machine, type, nodes: this.authoredNodes(),
			transitions: this.transitionsForType(this.authoredTransitions(), type),
		});
		await this.updateComplete;
	}

	private canSimulate() {
		return !this._invalidMachineData && this.allowedModes.includes("simulate") && this._graph?.errors.length === 0;
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

	private get machineBlock() {
		return this.querySelector<HTMLScriptElement>(machineBlockSelector);
	}

	protected override dataChanged() {
		this.syncMachine();
	}

	private syncMachine() {
		const text = this.machineBlock?.textContent ?? null;
		if (text === this.machineText) return;
		this.machineText = text;
		this.machineReadPending = true;
		try {
			this._machine = readMachine(text);
			this._invalidMachineData = false;
		} catch {
			this._invalidMachineData = true;
		}
		this.requestUpdate();
	}

	private canWriteMachine() {
		// The authored DOM may have changed before its mutation observer runs.
		this.syncMachine();
		return this.isConnected && !this.machineReadPending && !this._invalidMachineData;
	}

	/** @internal */
	public commitGraphEdit() {
		if (this.canWriteMachine()) {
			this.saveMachine({ ...this._machine, nodes: this.authoredNodes(), transitions: this.authoredTransitions() });
		}
	}

	private saveMachine(machine: Machine) {
		const text = writeMachine(machine);
		if (text === writeMachine(this._machine)) return;

		const existing = this.machineBlock;
		const block = existing ?? this.ownerDocument.createElement("script");
		if (!existing) {
			block.type = AutomatonComponent.dataType;
			block.slot = "data";
		}
		block.textContent = text;
		if (!existing) this.append(block);
		this.machineText = text;
		this._machine = machine;
	}

	private saveStartingStack(event: Event) {
		if (this.mode !== "edit" || !(this.automaton instanceof PDA) ||
			event.target !== this.automaton.extension || !this.canWriteMachine()) return;
		this.saveMachine({ ...this._machine, startingStack: this.automaton.extension.getStack() });
	}
}
