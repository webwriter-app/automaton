import {
	html,
	LitElement,
	type PropertyDeclaration,
	type PropertyValues,
	type TemplateResult,
} from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { computed, signal } from "@webwriter/lit";
import { SceneController } from "@webwriter/lit/scene";
import { Viewport } from "@webwriter/lit/viewport";
import { Scene, sceneElements, webglAvailable } from "@webwriter/widget/scene";
import { PixiScene } from "@webwriter/widget/scene/pixi";

import { styles } from "../components/automaton.styles";
import { shoelaceElements } from "../components/shoelace-elements";

import "@shoelace-style/shoelace/dist/themes/light.css";

import { DFA } from "../components/automata/dfa";
import { Automaton, Node, Transition } from "../components/automata";
import { Graph } from "../components/graph";
import { renderScene } from "../components/diagram-scene";
import { Logger } from "../model/logger";

import { TopMenu } from "../components/top-menu";
import { ToolMenu } from "../components/tool-menu";
import { SimulatorMenu } from "../components/simulator-menu";

import { Settings, drawerActions, optionGroups, options } from "../components/settings";
import { AddSinkstateToDFA } from "../components/transformations/sink-state";

import {
	renderCompactHelp,
	renderHelpOverlay,
	renderModeSwitch,
	renderPrintMachine,
	renderWarnings,
} from "../components/automaton-panels";
import { styleMap } from "lit/directives/style-map.js";

import { guard } from "lit/directives/guard.js";
import { stripNode, stripTransition, transitionsForType } from "../model/updates";
import { emptyMachine, machineBlockSelector, readMachine, writeMachine, type Machine } from "../model/machine-data";
import { NFA } from "../components/automata/nfa";
import { PDA } from "../components/automata/pda";
import { StackExtension } from "../components/automata/stack-extension";

import { localizer } from "@webwriter/lit/localize";
import { sourceLocale, targetLocales } from "../../localization/generated/locale-codes";
import { ATTRIBUTE_CONVERTERS } from "../model/attribute-converters";
import { AutomatonOptions } from "../components/automaton-options";
import { exportJff, exportSvg, exportTable, importJff } from "../components/exports";

const stringListProperty = {
	type: Array,
	attribute: true,
	reflect: true,
	useDefault: true,
	converter: ATTRIBUTE_CONVERTERS.stringArray,
};

export type AutomatonType = "dfa" | "nfa" | "pda";

/**
 * Automaton editor and simulator.
 *
 * Conversions: a JFLAP file (`.jff`, finite and pushdown automata) imports and exports; bends and loop angles are not part of that format and the test for an empty stack becomes an unconditional transition. The diagram exports as `image/svg+xml`, the transitions as a `table`.
 *
 * Signal `accepted`: a boolean that is true while the last simulation run accepted its word and false otherwise, also after a reset.
 *
 * Theme: `--ww-text-color`, `--ww-font-family`, `--ww-theme-accent-1` and `-2`; width limit `--ww-widget-max` (2100px).
 * @part canvas - The diagram surface.
 * @part state - A state of the diagram.
 */
@customElement("webwriter-automaton")
export class AutomatonComponent extends AutomatonOptions {
	static styles = styles;

	static scopedElements = {
		...shoelaceElements,
		...sceneElements,
		// Where the browser has no WebGL the same diagram is drawn with SVG.
		"ww-scene": webglAvailable() ? PixiScene : Scene,
		"webwriter-automaton-toolmenu": ToolMenu,
		"webwriter-automaton-simulatormenu": SimulatorMenu,
		"webwriter-automaton-topmenu": TopMenu,
		"stack-extension": StackExtension,
	};

	/** @internal */
	static shadowRootOptions = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	static override readonly dataType = "application/json";

	static options = options;
	static optionGroups = optionGroups;

	static convertFrom = { ".jff": importJff };
	static convertTo = { ".jff": exportJff, "image/svg+xml": exportSvg, table: exportTable };

	protected localize = localizer(this, {
		sourceLocale,
		targetLocales,
		load: locale => import(`../../localization/generated/${locale}.ts`),
		drawer: true,
	});

	/** @internal */
	public readonly msg = this.localize.msg;

	/** @internal */
	public readonly settings = new Settings(this);

	public override readonly actions = drawerActions(this);

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
	// @ts-expect-error The authored attribute `permissions` predates the editor's `permissions` declaration, which has another type.
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
	@property(stringListProperty)
	public accessor allowedTypes: string[] = ["dfa", "nfa", "pda"];

	/** The modes that are allowed in the editor. */
	@property(stringListProperty)
	public accessor allowedModes: string[] = ["edit", "simulate"];

	/** The transformations that are allowed in the editor. */
	@property(stringListProperty)
	public accessor allowedTransformations: string[] = ["sink"];

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

	/** @internal */
	get forcedAlphabetInput() { return (this.forcedAlphabet ?? []).join(","); }
	set forcedAlphabetInput(value: string | null) {
		const symbols = value?.split(",").filter(symbol => symbol.length === 1) ?? [];
		if (this.canWriteMachine()) this.saveMachine({ ...this._machine, requiredAlphabet: [...new Set(symbols)] });
	}

	readonly #accepted = signal(false);

	/** Published for other widgets. */
	readonly signals = { accepted: computed(() => this.#accepted.get()) };

	@query("#toolMenu") private accessor toolMenu!: ToolMenu;
	@query("#simulatorMenu") private accessor simulatorMenu!: SimulatorMenu;
	@query("#topMenu") private accessor topMenu!: TopMenu;

	@state()
	private accessor _machine: Machine = emptyMachine();

	@state()
	private accessor _invalidMachineData = false;

	private machineText: string | null = null;
	private machineReadPending = false;

	/** @internal */
	public readonly viewport: Viewport = new Viewport(this, {
		bounds: () => this.scene.extent(),
		margin: 400,
		can: () => !this.scene.marquee,
	});

	/** @internal The diagram's scene; `margin` of the viewport is room to pan past it, to see where a new state goes. */
	public readonly scene: SceneController = new SceneController(this, {
		viewport: this.viewport.core,
		can: action => this._graph?.can(action) ?? false,
	});

	@state()
	private accessor _graph: Graph | undefined;
	/** @internal */
	public get graph() { return this._graph; }

	@property({ type: Object, attribute: false })
	private accessor _automaton: Automaton = new DFA([], []);

	@property({ type: Boolean, attribute: false })
	private accessor _helpOverlay: boolean = false;

	@state()
	private accessor _topMenuCollapsed: boolean = false;

	constructor() {
		super();
		Logger.verbose = this.verbose;

		Logger.log("constructor");
	}

	connectedCallback() {
		super.connectedCallback();
		this._graph = new Graph(this.automaton, this);
		this._graph.toggleMode = () => this.toggleMode();
		this._graph.setInteractive(this.mode === "edit" && !this._invalidMachineData);
		if (this.hasUpdated) this.requestUpdate();
	}

	disconnectedCallback() {
		if (this._graph) {
			this.simulatorMenu?.reset();
			if (this.simulatorMenu) this.simulatorMenu.graph = undefined;
			this._graph.destroy();
			this._graph = undefined;
		}
		super.disconnectedCallback();
	}

	/**
	 * This method is called before the component updates. It handles the logic for updating the automaton based on the changed properties.
	 *
	 * @param _changedProperties - A map of changed properties.
	 */
	protected willUpdate(
		_changedProperties: PropertyValues
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
			this.replaceAutomaton(this.createAutomaton(type, nodes, transitions));
		} else if (readGraph) {
			this._graph?.loaded();
			this.automaton.loadAutomaton({ nodes, transitions });
		}
		if (!replace && alphabetChanged && this.automaton instanceof DFA) {
			this.automaton.requiredAlphabet = requiredAlphabet;
		}
		if (_changedProperties.has("showHelp")) this.automaton.showErrors = this.showHelp === "true";
		if (!replace && (alphabetChanged || _changedProperties.has("showHelp"))) {
			this._graph?.invalidate();
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
				if (modeChanged) this._graph?.clearSelection();
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

	protected updated(changedProperties: PropertyValues): void {
		super.updated(changedProperties);
		this.wireMenus();
		if (["_machine", "_invalidMachineData", "mode", "permissions", "allowedTypes", "allowedModes",
			"allowedTransformations", "showHelp", "showFormalDefinition", "showTransitionsTable", "testLanguage", "testWords"]
			.some(property => changedProperties.has(property))) {
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
		this.topMenu?.requestUpdate();
	}

	/** @internal */
	public async completeDfaWithSink() {
		const { automaton } = this;
		if (!this.canWriteMachine() || !(automaton instanceof DFA) || this.settings.sinkDisabledReason || !AddSinkstateToDFA(automaton)) return;
		this.commitGraphEdit();
		this._graph?.invalidate();
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
			transitions: transitionsForType(this.authoredTransitions(), type),
		});
		await this.updateComplete;
	}

	private createAutomaton(type: AutomatonType, nodes: Node[], transitions: Transition[]): Automaton {
		if (type === "pda") return new PDA(nodes, transitions, this.registry);
		return type === "nfa" ? new NFA(nodes, transitions) : new DFA(nodes, transitions);
	}

	private replaceAutomaton(a: Automaton) {
		if (this._graph) this.automaton.simulator.reset();
		if (a instanceof DFA) a.requiredAlphabet = this._machine.requiredAlphabet;
		a.showErrors = this.showHelp === "true";
		this._automaton = a;
		this._graph?.setAutomaton(this._automaton);
		if (this.simulatorMenu) this.simulatorMenu.automaton = this._automaton;
		this._graph?.setInteractive(this.mode === "edit" && !this._invalidMachineData);
		Logger.log("Automaton set", this._automaton.transitions.get());
	}
	/** @internal */
	public get automaton() {
		return this._automaton;
	}

	private wireMenus() {
		const graph = this._graph;
		if (!graph || this.simulatorMenu.graph === graph) return;
		this.topMenu.component = this;
		this.topMenu.setHelpOverlay = (h: boolean) => {
			this._helpOverlay = h;
		};
		this.topMenu.setCollapsed = (c: boolean) => {
			this._topMenuCollapsed = c;
		};
		this.simulatorMenu.automaton = this.automaton;
		this.simulatorMenu.graph = graph;
		if (this.mode === "simulate") this.simulatorMenu.init();
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

	private authoredNodes(a = this.automaton) {
		return a.nodes.get().map(stripNode);
	}

	private authoredTransitions(a = this.automaton) {
		return a.transitions.get().map(stripTransition);
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
		this.writeBlock(text);
		this.machineText = text;
		this._machine = machine;
	}

	private writeBlock(text: string) {
		const existing = this.machineBlock;
		const block = existing ?? this.ownerDocument.createElement("script");
		if (!existing) {
			block.type = AutomatonComponent.dataType;
			block.slot = "data";
		}
		block.textContent = text;
		if (!existing) this.append(block);
	}

	/** The authored machine for an export, or `null` if the data is invalid or there is no state. @internal */
	public machineForExport() {
		this.syncMachine();
		return this._invalidMachineData || !this._machine.nodes.length ? null : this._machine;
	}

	/** Replaces the authored machine and reloads the diagram. @internal */
	public replaceMachine(machine: Machine) {
		if (!this.isConnected) return;
		this.writeBlock(writeMachine(machine));
		this.#accepted.set(false);
		this.syncMachine();
	}

	private setAccepted(event: CustomEvent<boolean>) {
		this.#accepted.set(event.detail);
	}

	private saveStartingStack(event: Event) {
		if (this.mode !== "edit" || !(this.automaton instanceof PDA) ||
			event.target !== this.automaton.extension || !this.canWriteMachine()) return;
		this.saveMachine({ ...this._machine, startingStack: this.automaton.extension.getStack() });
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
						${this._helpOverlay && !this._topMenuCollapsed ? renderHelpOverlay(this.helpArgs()) : ""}
						${this._graph ? renderScene(this._graph) : ""}
						${this.mode === "edit" && this.settings.permissions.node.add &&
							this.automaton.nodes.length === 0 ? html`
								<div class="empty-canvas-hint">${this.msg("Double click / long tap to add a node")}</div>
							` : ""}
						<div class="view-controls" data-ww-viewport-controls></div>
						${renderModeSwitch({
							msg: this.msg,
							mode: this.mode,
							canEdit: this.allowedModes.includes("edit"),
							canSimulate: this.canSimulate(),
							showWarningIndicator: this.showHelp === "true" && !!this._graph?.errors.length,
							setMode: mode => { this.mode = mode; },
						})}
						<webwriter-automaton-topmenu id="topMenu"></webwriter-automaton-topmenu>
						<webwriter-automaton-toolmenu
							id="toolMenu"
							.graph=${this._graph}
							style=${styleMap({
								display: this.mode === "edit" ? "flex" : "none",
							})}
						></webwriter-automaton-toolmenu>
						<webwriter-automaton-simulatormenu
							id="simulatorMenu"
								@simulation-result=${this.setAccepted}
							?hidden=${this.mode !== "simulate" || this._invalidMachineData || this._graph?.errors.length !== 0}
						></webwriter-automaton-simulatormenu>
					</div>
					${guard([this.automaton], () => this.automaton.extension)}
					<div class="workspace-footer">
						${renderWarnings({ msg: this.msg, invalid: this._invalidMachineData, showHelp: this.showHelp === "true", graph: this._graph })}
						${this._graph?.renderEditingBar()}
					</div>
				</div>
				${this._helpOverlay && this._topMenuCollapsed ? renderCompactHelp({
					...this.helpArgs(),
					isPda: this.automaton instanceof PDA,
					canDeleteStackItems: this.mode === "edit" && this.settings.permissions.stack.delete,
				}) : ""}
			</div>
			${renderPrintMachine({
				msg: this.msg,
				type: this.type,
				invalid: this._invalidMachineData,
				startingStack: this.startingStack,
				nodes: this.automaton.nodes.get(),
				layout: this._graph?.layout,
			})}
		`;
	}

	private helpArgs() {
		return {
			msg: this.msg,
			mode: this.mode,
			offersSink: this.automaton instanceof DFA && this.sinkStateEnabled === true,
			canAddNode: this.settings.permissions.node.add,
		};
	}
}
