import "mocha/mocha.js";
import { getMochaConfig } from "@webwriter/build/test";
import { assert } from "chai";
import "../src";
import { AutomatonComponent } from "../src";
import type { StackExtension } from "../src/automata/pda";
import type { Graph } from "../src/graph";
import type SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import type SlTooltip from "@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js";
import { machineBlockSelector, type MachineData } from "../src/utils/machineData";
import LOCALIZE from "../localization/generated/index.js";
import { sourceLocale, targetLocales } from "../localization/generated/locale-codes.js";

mocha.setup(getMochaConfig());

type Rule = MachineData["transitions"][number]["rules"][number];

const state = (id: number, x: number, y: number, flags: { initial?: boolean; final?: boolean } = {}) =>
	({ id, label: `q${id}`, x, y, ...flags });
const edge = (id: number, from: number, to: number, ...rules: (string | Rule)[]) =>
	({ id, from, to, rules: rules.map(rule => typeof rule === "string" ? { read: rule } : rule) });
const machineText = (widget: AutomatonComponent) => widget.querySelector(machineBlockSelector)?.textContent ?? "";
const machineData = (widget: AutomatonComponent): MachineData => {
	const text = machineText(widget);
	return text ? JSON.parse(text) : { format: "webwriter-automaton", version: 1, type: "dfa", states: [], transitions: [] };
};
const setMachine = (widget: AutomatonComponent, patch: Partial<MachineData>) =>
	widget.setData("application/json", JSON.stringify({ ...machineData(widget), ...patch }), { slot: "data" });

describe("Simulation Tests", () => {
	let automaton: AutomatonComponent | null;

	const createConfiguredDFA = async () => {
		const element = document.createElement("webwriter-automaton") as AutomatonComponent;
		document.body.appendChild(element);

		// Configure the DFA
		setMachine(element, { type: "dfa" });
		setMachine(element, { states: [
			state(0, -300, 0, { initial: true }),
			state(1, -100, 0),
			state(2, -300, 200, { final: true }),
			state(3, -100, 200, { final: true }),
		] });
		setMachine(element, { transitions: [
			edge(0, 0, 1, "a"),
			edge(1, 1, 3, "a"),
			edge(2, 3, 2, "a"),
			edge(3, 1, 2, "b"),
			edge(4, 2, 0, "a", "b"),
			{ ...edge(5, 3, 3, "b"), loopAngle: 135 },
			{ ...edge(6, 0, 0, "b"), loopAngle: 0 },
		] });

		await element.updateComplete;
		return element;
	};

	const createConfiguredNFA = async () => {
		const element = document.createElement("webwriter-automaton") as AutomatonComponent;
		document.body.appendChild(element);

		// Configure the NFA
		setMachine(element, { type: "nfa" });
		setMachine(element, { states: [
			state(0, 0, 0, { initial: true }),
			state(1, 170, 0, { final: true }),
			state(2, 0, -170),
			state(3, 170, -170),
			state(4, 0, 170),
			state(5, 170, 170),
		] });
		setMachine(element, { transitions: [
			edge(0, 0, 1, ""),
			edge(1, 1, 1, "b"),
			edge(2, 0, 2, "a"),
			edge(3, 2, 3, "a"),
			edge(4, 3, 0, "b"),
			edge(5, 1, 4, "a"),
			edge(6, 4, 5, "b"),
			edge(7, 5, 1, "a"),
		] });

		await element.updateComplete;
		return element;
	};

	const createConfiguredPDA = async () => {
		const element = document.createElement("webwriter-automaton") as AutomatonComponent;
		document.body.appendChild(element);

		// Configure the PDA
		setMachine(element, { type: "pda" });
		setMachine(element, { states: [
			state(0, 0, 0, { initial: true }),
			state(1, 200, 0),
			state(2, 200, 200),
			state(3, 0, 200, { final: true }),
		] });
		setMachine(element, { transitions: [
			edge(0, 0, 1, { read: "", stack: { op: "push", symbol: "$" } }),
			edge(1, 1, 1, { read: "0", stack: { op: "push", symbol: "0" } }, { read: "1", stack: { op: "push", symbol: "1" } }),
			edge(2, 1, 2, { read: "", stack: { op: "none" } }),
			{ ...edge(3, 2, 2, { read: "0", stack: { op: "pop", symbol: "0" } }, { read: "1", stack: { op: "pop", symbol: "1" } }), loopAngle: 135 },
			edge(4, 2, 3, { read: "", stack: { op: "pop", symbol: "$" } }),
		] });

		await element.updateComplete;
		return element;
	};

	// Clean up after each test
	afterEach(() => {
		// Remove all automaton elements
		document
			.querySelectorAll("webwriter-automaton")
			.forEach((el) => el.remove());
	});

	const menuChoice = async (widget: AutomatonComponent, label: string, choice: string) => {
		await widget.updateComplete;
		const menu = widget.shadowRoot!.querySelector("#topMenu") as HTMLElement & { updateComplete: Promise<unknown> };
		await menu.updateComplete;
		const root = menu.shadowRoot!;
		if (!root.querySelector(`sl-button[title="${label}"]`)) {
			root.querySelector<HTMLElement>(".topmenu--hamburger > sl-button")!.click();
			await menu.updateComplete;
		}
		const anchor = root.querySelector<HTMLElement>(`sl-button[title="${label}"]`)!;
		anchor.click();
		await menu.updateComplete;
		const popup = anchor.closest("sl-popup")!;
		assert.isTrue(popup.hasAttribute("active"));
		const button = [...popup.querySelectorAll<HTMLElement>(".topmenu__choices sl-button")]
			.find(option => option.textContent?.trim() === choice)!;
		button.click();
		await widget.updateComplete;
		await menu.updateComplete;
	};

	describe("Automaton tools", () => {
		it("switches types with an empty graph and preserves live edits and edge geometry", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			widget.style.width = "600px";
			document.body.append(widget);
			await menuChoice(widget, "Automaton Type", "NFA");
			assert.equal(widget.automaton.type, "nfa");
			assert.isEmpty(widget.nodes);
			await menuChoice(widget, "Automaton Type", "PDA");
			assert.equal(widget.automaton.type, "pda");
			assert.exists(widget.shadowRoot!.querySelector("stack-extension"));
			setMachine(widget, { states: [state(0, 0, 0, { initial: true }), state(1, 150, 0, { final: true })] });
			setMachine(widget, { transitions: [
				{ ...edge(0, 0, 1, { read: "a", stack: { op: "push", symbol: "X" } }), bend: 0.2 },
				{ ...edge(1, 1, 1, { read: "b", stack: { op: "none" } }), loopAngle: 135 },
			] });
			await widget.updateComplete;
			widget.automaton.updateNode(1, { label: "accept" });
			await menuChoice(widget, "Automaton Type", "DFA");
			assert.equal(widget.automaton.type, "dfa");
			assert.isNull(widget.shadowRoot!.querySelector("stack-extension"));
			assert.equal(widget.automaton.getNode(1)?.label, "accept");
			assert.isTrue(widget.automaton.getNode(1)?.final);
			assert.equal(widget.automaton.getInitialNode().id, 0);
			assert.deepEqual(machineData(widget).transitions, [
				{ ...edge(0, 0, 1, "a"), bend: 0.2 },
				{ ...edge(1, 1, 1, "b"), loopAngle: 135 },
			]);
			await menuChoice(widget, "Automaton Type", "PDA");
			assert.equal(widget.automaton.getTransition(0)?.stackOperations?.[0].operation, "none");
			assert.deepEqual(machineData(widget).transitions, [
				{ ...edge(0, 0, 1, { read: "a", stack: { op: "none" } }), bend: 0.2 },
				{ ...edge(1, 1, 1, { read: "b", stack: { op: "none" } }), loopAngle: 135 },
			]);
		});

		it("completes missing DFA transitions and reuses the sink as the alphabet grows", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			widget.style.width = "300px";
			widget.style.height = "300px";
			document.body.append(widget);
			await widget.updateComplete;
			await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			const root = widget.shadowRoot!;
			const toolbar = root.querySelector("#toolMenu")!.shadowRoot!;
			const sinkButton = () => toolbar.querySelector<SlButton>(".toolmenu__sink");
			const addSink = async () => {
				const button = sinkButton()!;
				await button.updateComplete;
				button.click();
				await widget.updateComplete;
			};
			const sinkRect = sinkButton()!.getBoundingClientRect();
			const plusRect = toolbar.querySelector(".toolmenu__node")!.getBoundingClientRect();
			assert.isBelow(sinkRect.height, plusRect.height);
			assert.isBelow(sinkRect.bottom, plusRect.top);
			assert.closeTo(sinkRect.x + sinkRect.width / 2, plusRect.x + plusRect.width / 2, 1);
			assert.isNull(sinkButton()!.querySelector(".bi-plus"));
			await addSink();
			assert.isEmpty(widget.nodes, "An empty graph cannot gain a sink");
			setMachine(widget, { states: [state(0, 0, 0, { initial: true, final: true })] });
			await addSink();
			assert.isEmpty(widget.automaton.getTransitionsFromNode(widget.automaton.getInitialNode()),
				"An empty alphabet cannot produce an empty-symbol transition");
			setMachine(widget, { requiredAlphabet: ["a", "b"] });
			widget.sinkStateEnabled = false;
			await widget.updateComplete;
			assert.isNull(sinkButton());
			assert.isTrue(widget.actions.completeDfaWithSink.disabled);
			widget.sinkStateEnabled = true;
			await widget.updateComplete;
			await addSink();
			const { automaton } = widget;
			const sink = automaton.getNode(1)!;
			assert.isFalse(sink.final);
			assert.isFalse(sink.initial);
			assert.deepEqual(automaton.getTransitionsFromNode(sink).map(edge => [edge.to, edge.symbols]), [[1, ["a", "b"]]]);
			assert.isEmpty(automaton.checkAutomaton());
			await addSink();
			assert.lengthOf(automaton.nodes.get().filter(node => node.id >= 0), 2);
			setMachine(widget, { requiredAlphabet: ["a", "b", "c"] });
			await widget.updateComplete;
			await addSink();
			assert.lengthOf(automaton.nodes.get().filter(node => node.id >= 0), 2);
			assert.deepEqual(automaton.getTransitionsFromNode(sink).map(edge => [edge.to, edge.symbols]), [[1, ["a", "b", "c"]]]);
			assert.isEmpty(automaton.checkAutomaton());
		});
	});

	describe("Component Initialization", () => {
		it("should initialize the automaton component", async () => {
			const automaton = await createConfiguredDFA();
			assert.isNotNull(automaton, "Automaton component should exist");
			assert.equal(
				machineData(automaton).type,
				"dfa",
				"Should be configured as DFA"
			);
		});

		it("creates a machine block on the first edit and preserves unrelated light DOM", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			widget.setAttribute("nodes", "#7(0|0)");
			widget.setAttribute("type", "pda");
			const unrelated = document.createElement("script");
			unrelated.type = "application/json";
			unrelated.textContent = '{"notes":"keep"}';
			widget.append(unrelated);
			document.body.append(widget);
			await widget.updateComplete;
			assert.equal(widget.automaton.type, "dfa");
			assert.isEmpty(widget.nodes);
			assert.isNull(widget.querySelector(machineBlockSelector));

			const { graph } = widget as unknown as { graph: Graph };
			graph.insertNodeFromButton();
			const block = widget.querySelector<HTMLScriptElement>(machineBlockSelector)!;
			assert.deepEqual(machineData(widget).states.map(node => [node.id, node.initial]), [[0, true]]);
			const label = "</script><b>q0</b>";
			widget.automaton.updateNode(0, { label });
			widget.commitGraphEdit();
			assert.strictEqual(widget.querySelector(machineBlockSelector), block);
			assert.equal(unrelated.textContent, '{"notes":"keep"}');
			assert.notInclude(block.textContent, "</script>");

			const container = document.createElement("div");
			container.innerHTML = widget.outerHTML;
			const reopened = container.firstElementChild as AutomatonComponent;
			document.body.append(reopened);
			await reopened.updateComplete;
			assert.equal(reopened.automaton.getNode(0)?.label, label);
			assert.lengthOf(reopened.querySelectorAll("script"), 2);
			assert.isNull(reopened.querySelector("b"));
			reopened.remove();
		});

		it("accepts direct snapshot updates and protects an invalid block from edits", async () => {
			const widget = await createConfiguredDFA();
			const block = widget.querySelector<HTMLScriptElement>(machineBlockSelector)!;
			const original = block.textContent!;
			const next = { ...machineData(widget), states: [state(5, 10, 15, { initial: true })], transitions: [] };
			block.textContent = JSON.stringify(next);
			// A graph edit cannot overwrite a new snapshot before the observer delivers it.
			widget.automaton.updateNode(0, { label: "outdated edit" });
			widget.commitGraphEdit();
			await widget.updateComplete;
			assert.deepEqual(machineData(widget), next);
			assert.isNull(widget.automaton.getNode(0));
			assert.equal(widget.automaton.getNode(5)?.x, 10);

			block.textContent = "invalid";
			widget.requestUpdate();
			await widget.updateComplete;
			assert.include(widget.shadowRoot!.querySelector(".warning-panel")?.textContent, "data block is invalid");
			widget.forcedAlphabetInput = "a";
			await widget.switchToPda();
			assert.equal(block.textContent, "invalid");
			block.textContent = original;
			widget.requestUpdate();
			await widget.updateComplete;
			assert.isNull(widget.automaton.getNode(5));
			assert.exists(widget.automaton.getNode(0));
		});
	});

	describe("Printing", () => {
		it("prints the authored diagram and starting stack independently of the canvas viewport", async () => {
			const widget = await createConfiguredPDA();
			widget.style.width = "300px";
			setMachine(widget, { startingStack: ["Z"] });
			await widget.updateComplete;
			const { network } = (widget as unknown as { graph: Graph }).graph;
			network.selectNodes([1]);
			const figure = widget.shadowRoot!.querySelector<HTMLElement>(".print-machine")!;
			const canvas = figure.querySelector("canvas")!;
			const saved = machineText(widget);
			assert.equal(getComputedStyle(figure).display, "none");

			window.dispatchEvent(new Event("beforeprint"));
			assert.isAbove(canvas.width, 0);
			assert.isAbove(canvas.height, 0);
			const ctx = canvas.getContext("2d")!;
			const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
			assert.isTrue(pixels.some((value, index) => index % 4 === 3 && value > 0));
			const fitted = canvas.toDataURL();

			network.moveTo({ scale: 2, position: { x: 2000, y: 1000 } });
			(widget.automaton.extension as StackExtension).setStack(["runtime"]);
			window.dispatchEvent(new Event("beforeprint"));
			assert.equal(canvas.toDataURL(), fitted);
			assert.include(figure.querySelector("figcaption")!.textContent, "[Z]");
			assert.notInclude(figure.textContent, "runtime");
			assert.equal(machineText(widget), saved);
			assert.equal(network.getScale(), 2);
			assert.deepEqual(network.getSelectedNodes(), [1]);

			window.dispatchEvent(new Event("afterprint"));
			assert.equal(canvas.width, 0);
			widget.remove();
			window.dispatchEvent(new Event("beforeprint"));
			assert.equal(canvas.width, 0, "Disconnected widgets no longer handle print events");
		});
	});

	describe("Widget options", () => {
		it("uses defaults for omitted settings and restores them when overrides are cleared", async () => {
			const widget = await createConfiguredDFA();
			const overrides = {
				mode: "simulate",
				testlanguage: "a+",
				testwords: '["a"]',
				permissions: "000",
				showhelp: "false",
				showformaldefinition: "false",
				showtransitionstable: "false",
				allowedtypes: "",
				allowedmodes: "simulate",
				allowedtransformations: "",
			};
			const assertDefaults = () => {
				for (const name of Object.keys(overrides)) assert.isFalse(widget.hasAttribute(name), name);
				assert.equal(widget.mode, "edit");
				assert.equal(widget.testLanguage, "");
				assert.deepEqual(widget.testWords, []);
				assert.lengthOf(widget.selectedPermissions, 9);
				assert.isTrue(widget.helpEnabled);
				assert.isTrue(widget.automaton.showErrors);
				assert.isTrue(widget.formalDefinitionEnabled);
				assert.isTrue(widget.transitionsTableEnabled);
				assert.deepEqual(widget.allowedTypeOptions, ["dfa", "nfa", "pda"]);
				assert.deepEqual(widget.allowedModeOptions, ["edit", "simulate"]);
				assert.isTrue(widget.sinkStateEnabled);
			};
			assertDefaults();
			for (const [name, value] of Object.entries(overrides)) widget.setAttribute(name, value);
			await widget.updateComplete;
			assert.isEmpty(widget.allowedTypeOptions, "An explicit empty list is preserved");
			assert.isFalse(widget.sinkStateEnabled);
			assert.isFalse(widget.automaton.showErrors);
			assert.isEmpty(widget.selectedPermissions);

			let refreshes = 0;
			widget.addEventListener("optionschange", () => { refreshes++; });
			for (const name of Object.keys(overrides)) widget.removeAttribute(name);
			await widget.updateComplete;
			assertDefaults();
			assert.isAbove(refreshes, 0);
		});

		it("treats null option values as resets while preserving explicit overrides", async () => {
			const widget = await createConfiguredDFA();
			widget.selectedPermissions = [];
			widget.allowedTypeOptions = [];
			widget.allowedModeOptions = ["edit"];
			widget.sinkStateEnabled = false;
			widget.helpEnabled = false;
			widget.formalDefinitionEnabled = false;
			widget.transitionsTableEnabled = false;
			widget.testWordsInput = "a";
			assert.equal(widget.getAttribute("permissions"), "000");
			assert.equal(widget.getAttribute("allowedtypes"), "");
			assert.equal(widget.getAttribute("showhelp"), "false");

			widget.selectedPermissions = null;
			widget.allowedTypeOptions = null;
			widget.allowedModeOptions = null;
			widget.sinkStateEnabled = null;
			widget.helpEnabled = null;
			widget.formalDefinitionEnabled = null;
			widget.transitionsTableEnabled = null;
			widget.testWordsInput = null;
			await widget.updateComplete;
			assert.lengthOf(widget.selectedPermissions, 9);
			assert.deepEqual(widget.allowedTypeOptions, ["dfa", "nfa", "pda"]);
			assert.deepEqual(widget.allowedModeOptions, ["edit", "simulate"]);
			assert.isTrue(widget.sinkStateEnabled);
			assert.isTrue(widget.helpEnabled);
			assert.isTrue(widget.formalDefinitionEnabled);
			assert.isTrue(widget.transitionsTableEnabled);
			assert.equal(widget.testWordsInput, "");
		});

		it("reads existing settings and keeps controls outside the widget in both modes", async () => {
			const widget = await createConfiguredDFA();
			widget.setAttribute("permissions", "251");
			widget.setAttribute("allowedtypes", "dfa nfa");
			widget.setAttribute("allowedmodes", "edit simulate");
			widget.setAttribute("allowedtransformations", "sink");
			widget.setAttribute("showhelp", "false");
			widget.setAttribute("testwords", '["a","ab"]');
			setMachine(widget, { requiredAlphabet: ["a", "b"] });
			widget.setAttribute("verbose", "");
			await widget.updateComplete;

			assert.deepEqual(widget.selectedPermissions, ["node-delete", "edge-add", "edge-change", "stack-change"]);
			assert.deepEqual(widget.allowedTypeOptions, ["dfa", "nfa"]);
			assert.deepEqual(widget.allowedModeOptions, ["edit", "simulate"]);
			assert.isTrue(widget.sinkStateEnabled);
			assert.equal(AutomatonComponent.options.sinkStateEnabled.type, Boolean);
			assert.isFalse(widget.helpEnabled);
			assert.equal(widget.testWordsInput, "a,ab");
			assert.equal(widget.forcedAlphabetInput, "a,b");
			assert.containsAllKeys(AutomatonComponent.options, [
				"selectedPermissions", "allowedTypeOptions", "sinkStateEnabled",
				"allowedModeOptions", "helpEnabled", "formalDefinitionEnabled", "transitionsTableEnabled",
				"testLanguage", "testWordsInput", "forcedAlphabetInput",
			]);
			assert.notProperty(AutomatonComponent.options, "verbose");
			assert.isTrue(widget.verbose);
			widget.removeAttribute("verbose");

			for (const editable of ["true", "false"]) {
				widget.setAttribute("contenteditable", editable);
				await widget.updateComplete;
				assert.isNotNull(widget.shadowRoot!.querySelector("#graphCanvas"));
				assert.isNull(widget.shadowRoot!.querySelector('[part~="options"]'));
			}
		});

		it("persists machine and display options in their respective stores", async () => {
			const widget = await createConfiguredPDA();
			await widget.updateComplete;
			widget.selectedPermissions = ["node-add", "edge-delete", "stack-change"];
			widget.allowedTypeOptions = ["pda", "dfa"];
			widget.allowedModeOptions = ["simulate"];
			widget.sinkStateEnabled = false;
			widget.helpEnabled = false;
			widget.formalDefinitionEnabled = false;
			widget.transitionsTableEnabled = false;
			widget.setAttribute("testlanguage", "a+");
			widget.testWordsInput = "a,aa";
			widget.forcedAlphabetInput = "a,b,a,invalid";
			await widget.updateComplete;

			assert.equal(widget.getAttribute("permissions"), "421");
			assert.equal(widget.getAttribute("allowedtypes"), "pda dfa");
			assert.equal(widget.getAttribute("allowedmodes"), "simulate");
			assert.equal(widget.mode, "simulate");
			assert.equal(widget.getAttribute("allowedtransformations"), "");
			assert.isFalse(widget.sinkStateEnabled);
			assert.equal(widget.getAttribute("showhelp"), "false");
			assert.isFalse(widget.automaton.showErrors);
			assert.equal(widget.getAttribute("showformaldefinition"), "false");
			assert.equal(widget.getAttribute("showtransitionstable"), "false");
			assert.equal(widget.testLanguage, "a+");
			assert.equal(widget.getAttribute("testwords"), '["a","aa"]');
			assert.deepEqual(machineData(widget).requiredAlphabet, ["a", "b"]);
			widget.removeAttribute("testlanguage");
			assert.equal(widget.testLanguage, "");

			widget.setAttribute("permissions", "004");
			await widget.updateComplete;
			assert.deepEqual(widget.selectedPermissions, ["stack-add"]);
			assert.isFalse(widget.settings.permissions.node.add);
		});

		it("refreshes drawer actions and reflects sink completion before the action finishes", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			document.body.append(widget);
			await widget.updateComplete;
			assert.isTrue(widget.actions.completeDfaWithSink.disabled);
			assert.include(widget.actions.completeDfaWithSink.disabledReason?._, "Add a state");
			setMachine(widget, { states: [state(0, 0, 0, { initial: true })] });
			await widget.updateComplete;
			assert.include(widget.actions.completeDfaWithSink.disabledReason?._, "Define an alphabet");
			let refreshes = 0;
			widget.addEventListener("optionschange", () => { refreshes++; });
			setMachine(widget, { requiredAlphabet: ["a"] });
			await widget.updateComplete;
			assert.isAbove(refreshes, 0);
			assert.isFalse(widget.actions.completeDfaWithSink.disabled);
			await widget.completeDfaWithSink();
			assert.equal(machineData(widget).states[1].label, "sink");
			assert.deepEqual(machineData(widget).transitions, [edge(0, 1, 1, "a"), edge(1, 0, 1, "a")]);
			assert.isTrue(widget.actions.completeDfaWithSink.disabled);
			assert.include(widget.actions.completeDfaWithSink.disabledReason?._, "already has a transition");
		});

		it("declares confirmation only for allowed type switches that discard PDA stack operations", async () => {
			const widget = await createConfiguredPDA();
			await widget.updateComplete;
			const switches = [widget.actions.switchToDfa, widget.actions.switchToNfa, widget.actions.switchToPda];
			assert.deepEqual(switches.map(action => action.buttonGroup), Array(3).fill("automaton-type"));
			assert.notProperty(widget.actions.completeDfaWithSink, "buttonGroup");
			assert.exists(widget.actions.switchToDfa.confirm);
			assert.exists(widget.actions.switchToNfa.confirm);
			assert.isTrue(widget.actions.switchToPda.hidden);
			widget.allowedTypes = ["pda", "nfa"];
			await widget.updateComplete;
			assert.isTrue(widget.actions.switchToDfa.hidden);
			await widget.switchToDfa();
			assert.equal(widget.type, "pda");
			setMachine(widget, { transitions: [edge(0, 0, 1, { read: "a", stack: { op: "none", ifTop: "X" } })] });
			await widget.updateComplete;
			assert.exists(widget.actions.switchToNfa.confirm, "A stack condition affects even a no-op transition");
			setMachine(widget, { transitions: [edge(0, 0, 1, { read: "a", stack: { op: "none" } })] });
			await widget.updateComplete;
			assert.isUndefined(widget.actions.switchToNfa.confirm);
			await widget.switchToNfa();
			assert.equal(machineData(widget).type, "nfa");
			assert.deepEqual(machineData(widget).transitions, [edge(0, 0, 1, "a")]);
		});
	});

	describe("Responsive layout", () => {
		it("shows the empty hint and connection points only when insertion is available", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			document.body.append(widget);
			await widget.updateComplete;
			await widget.updateComplete;
			const root = widget.shadowRoot!;
			assert.equal(root.querySelector(".empty-canvas-hint")?.textContent, "Double click / long tap to add a node");
			widget.permissions = "377";
			await widget.updateComplete;
			assert.isNull(root.querySelector(".empty-canvas-hint"));

			widget.permissions = "777";
			setMachine(widget, { states: [state(0, 0, 0, { initial: true }), state(1, 180, 0, { final: true })] });
			await widget.updateComplete;
			assert.isNull(root.querySelector(".empty-canvas-hint"));
			const { network } = (widget as unknown as { graph: Graph }).graph;
			network.selectNodes([0]);
			network.redraw();
			const visiblePoints = () => [...root.querySelectorAll<HTMLElement>(".connection-point:not([hidden])")];
			assert.deepEqual(visiblePoints().map(point => point.dataset.side), ["top", "left", "bottom", "right"]);
			visiblePoints()[0].click();
			assert.exists(root.querySelector(".connection-point--active"));
			const canvas = root.querySelector("canvas")!;
			assert.equal(getComputedStyle(canvas).cursor, "none");
			const preview = network as unknown as {
				manipulation: { temporaryIds: { nodes: string[]; edges: string[] } };
				body: {
					emitter: { emit(event: "click", data: { pointer: { DOM: { x: number; y: number } } }): void };
					nodes: Record<string, { x: number; y: number; options: { opacity: number } }>;
					edges: Record<string, {
						toId: number | string;
						hover: boolean;
						options: {
							label: string; hidden: boolean; smooth: { roundness: number };
							color: { opacity: number }; selfReference: { angle: number; size: number };
						};
					}>;
				};
			};
			const { nodes: [endpointId], edges: [edgeId] } = preview.manipulation.temporaryIds;
			const canvasBounds = canvas.getBoundingClientRect();
			const hover = (point: { x: number; y: number }) => {
				canvas.dispatchEvent(new PointerEvent("pointermove", {
					bubbles: true,
					clientX: canvasBounds.left + point.x,
					clientY: canvasBounds.top + point.y,
				}));
			};
			const target = network.canvasToDOM(network.getPositions([1])[1]);
			hover(target);
			assert.equal(preview.body.edges[edgeId].toId, 1, "The preview attaches to the destination node");
			assert.equal(preview.body.edges[edgeId].options.label, "a");
			assert.equal(preview.body.edges[edgeId].options.smooth.roundness, 0);
			assert.isBelow(preview.body.edges[edgeId].options.color.opacity, 1);
			const besideTarget = { x: target.x + 6, y: target.y };
			hover(besideTarget);
			assert.equal(preview.body.edges[edgeId].toId, 1, "The preview stays snapped");
			const endpoint = preview.body.nodes[endpointId];
			assert.isAbove(endpoint.options.opacity, 0, "The blue cursor remains visible while snapped");
			assert.closeTo(endpoint.x, network.DOMtoCanvas(besideTarget).x, 1);
			assert.closeTo(endpoint.y, network.DOMtoCanvas(besideTarget).y, 1);
			assert.isEmpty(widget.transitions, "Hovering leaves the authored graph unchanged");
			hover({ x: target.x, y: target.y + 80 });
			assert.equal(preview.body.edges[edgeId].toId, endpointId, "Leaving the node restores the free endpoint");
			assert.isBelow(preview.body.edges[edgeId].options.color.opacity, 1);
			hover(target);
			root.querySelector("#graphCanvas")!.dispatchEvent(new PointerEvent("pointerleave"));
			assert.equal(preview.body.edges[edgeId].toId, endpointId, "Leaving the canvas also clears the target");
			widget.requestUpdate();
			await widget.updateComplete;
			network.redraw();
			assert.equal(getComputedStyle(canvas).cursor, "none", "Rendering preserves the preview");
			widget.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
			network.redraw();
			assert.isEmpty(visiblePoints());
			assert.notEqual(getComputedStyle(canvas).cursor, "none");
			assert.isEmpty(widget.transitions);

			network.selectNodes([0]);
			network.redraw();
			visiblePoints()[0].click();
			const origin = network.canvasToDOM(network.getPositions([0])[0]);
			hover(origin);
			const loopPreview = preview.body.edges[preview.manipulation.temporaryIds.edges[0]];
			assert.equal(loopPreview.toId, 0, "The source node is a valid destination");
			assert.equal(loopPreview.options.label, "a");
			assert.isBelow(loopPreview.options.color.opacity, 1);
			assert.isAbove(preview.body.nodes[preview.manipulation.temporaryIds.nodes[0]].options.opacity, 0);
			assert.isEmpty(widget.transitions);
			preview.body.emitter.emit("click", { pointer: { DOM: origin } });
			assert.deepEqual(machineData(widget).transitions, [edge(0, 0, 0, "a")]);
			const savedLoop = preview.body.edges[0];
			assert.equal(savedLoop.options.selfReference.angle, loopPreview.options.selfReference.angle);
			assert.equal(savedLoop.options.selfReference.size, loopPreview.options.selfReference.size);

			setMachine(widget, { transitions: [{ ...edge(0, 0, 0, "b"), loopAngle: 180 }] });
			await widget.updateComplete;
			network.selectNodes([0]);
			network.redraw();
			visiblePoints()[0].click();
			let highlightsLoop = false;
			network.once("beforeDrawing", () => { highlightsLoop = preview.body.edges[0].hover; });
			hover(origin);
			assert.isTrue(highlightsLoop);
			assert.isTrue(preview.body.edges[preview.manipulation.temporaryIds.edges[0]].options.hidden);
			assert.deepEqual(machineData(widget).transitions, [{ ...edge(0, 0, 0, "b"), loopAngle: 180 }]);
			preview.body.emitter.emit("click", { pointer: { DOM: origin } });
			assert.deepEqual(machineData(widget).transitions, [{ ...edge(0, 0, 0, "b", "a"), loopAngle: 180 }], "Extending a loop preserves its placement");

			setMachine(widget, { transitions: [edge(0, 1, 0, "b")] });
			await widget.updateComplete;
			network.selectNodes([0]);
			network.redraw();
			visiblePoints()[0].click();
			const reversePreviewId = preview.manipulation.temporaryIds.edges[0];
			let reverseBend = 0;
			network.once("beforeDrawing", () => { reverseBend = preview.body.edges[0].options.smooth.roundness; });
			hover(target);
			assert.equal(reverseBend, 0.2, "The existing reverse edge bends during the preview");
			assert.equal(preview.body.edges[reversePreviewId].options.smooth.roundness, 0.2);
			assert.equal(preview.body.edges[0].options.smooth.roundness, 0, "Preview styling is removed after drawing");
			assert.deepEqual(machineData(widget).transitions, [edge(0, 1, 0, "b")]);

			widget.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
			setMachine(widget, { transitions: [edge(0, 0, 1, "b"), edge(1, 1, 0, "b")] });
			await widget.updateComplete;
			network.selectNodes([0]);
			network.redraw();
			visiblePoints()[0].click();
			const existingPreviewId = preview.manipulation.temporaryIds.edges[0];
			let highlightsExisting = false;
			network.once("beforeDrawing", () => { highlightsExisting = preview.body.edges[0].hover; });
			hover(target);
			assert.isTrue(highlightsExisting);
			assert.isTrue(preview.body.edges[existingPreviewId].options.hidden, "An existing edge takes the place of the preview");
			assert.deepEqual(machineData(widget).transitions, [edge(0, 0, 1, "b"), edge(1, 1, 0, "b")]);
			widget.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

			widget.permissions = "757";
			await widget.updateComplete;
			network.selectEdges([0]);
			widget.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
			assert.exists(widget.automaton.getTransition(0), "Delete permissions still apply");
			widget.permissions = "777";
			await widget.updateComplete;
			network.selectEdges([0]);
			widget.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
			assert.isNull(widget.automaton.getTransition(0));
			network.selectEdges([1]);
			widget.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
			assert.isNull(widget.automaton.getTransition(1));
			assert.exists(widget.automaton.getNode(0));
			assert.exists(widget.automaton.getNode(1));

			network.selectNodes([0]);
			widget.permissions = "737";
			await widget.updateComplete;
			assert.isEmpty(visiblePoints());
			widget.permissions = "777";
			await widget.updateComplete;
			assert.lengthOf(visiblePoints(), 4);
			widget.mode = "simulate";
			await widget.updateComplete;
			assert.isEmpty(visiblePoints());
		});

		it("adds and selects a node at the center of the visible canvas from the plus button", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			document.body.append(widget);
			await widget.updateComplete;
			await widget.updateComplete;
			const { network } = (widget as unknown as { graph: Graph }).graph;
			const root = widget.shadowRoot!;
			const canvas = root.querySelector<HTMLElement>("#graphCanvas")!;
			const plus = root.querySelector("#toolMenu")!.shadowRoot!.querySelector<HTMLElement>(".toolmenu__node")!;
			network.moveTo({ position: { x: 130, y: -85 }, scale: 1.7 });
			const center = network.DOMtoCanvas({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });
			plus.click();
			await widget.updateComplete;
			const [selected] = network.getSelectedNodes();
			const node = widget.automaton.getNode(Number(selected));
			assert.exists(node);
			assert.isTrue(node!.initial, "The first added node is initial");
			assert.equal(widget.automaton.getTransition(-1)?.to, selected, "The initial arrow points to the new node");
			assert.closeTo(node!.x!, center.x, 1);
			assert.closeTo(node!.y!, center.y, 1);
			const bar = root.querySelector(".editing-bar")!.getBoundingClientRect();
			const button = plus.getBoundingClientRect();
			assert.closeTo(bar.height, button.height, 1);
			assert.closeTo(bar.bottom, button.bottom, 1);
			plus.click();
			await widget.updateComplete;
			const [second] = network.getSelectedNodes();
			assert.isFalse(widget.automaton.getNode(Number(second))!.initial);
			assert.equal(widget.automaton.getInitialNode().id, selected);

			widget.permissions = "377";
			await widget.updateComplete;
			plus.click();
			assert.lengthOf(widget.automaton.nodes.getIds().filter(id => id !== -1), 2, "Insertion observes current permissions");
		});

		it("edits the selected node or transition in the bottom bar", async () => {
			const widget = await createConfiguredPDA();
			widget.style.width = "300px";
			widget.style.height = "300px";
			await widget.updateComplete;
			await widget.updateComplete;
			const { network } = (widget as unknown as { graph: Graph }).graph;
			const root = widget.shadowRoot!;
			const bar = () => root.querySelector<HTMLElement>(".editing-bar");
			const select = async (type: "node" | "edge", id: number) => {
				if (type === "node") network.selectNodes([id]);
				else network.selectEdges([id]);
				widget.requestUpdate();
				await widget.updateComplete;
			};
			const edit = (field: Element, property: "value" | "checked", value: string | boolean, event: string) => {
				Object.assign(field, { [property]: value });
				field.dispatchEvent(new Event(event, { bubbles: true, composed: true }));
			};
			assert.isNull(bar());
			await select("node", 1);
			const label = bar()!.querySelector("sl-input")!;
			const final = bar()!.querySelector("sl-checkbox[name=final]")!;
			const initial = bar()!.querySelector("sl-checkbox[name=initial]")!;
			const barBounds = bar()!.getBoundingClientRect();
			const plusBounds = root.querySelector("#toolMenu")!.shadowRoot!
				.querySelector(".toolmenu__node")!.getBoundingClientRect();
			const graphBounds = root.querySelector(".graph")!.getBoundingClientRect();
			assert.closeTo(barBounds.right, graphBounds.right - 10, 1);
			assert.closeTo(barBounds.bottom, plusBounds.bottom, 1);
			assert.isAbove(barBounds.left, plusBounds.right);
			assert.isAtMost(label.getBoundingClientRect().width, 88);
			assert.isAtLeast(initial.getBoundingClientRect().left, label.getBoundingClientRect().right);
			const centerY = (element: Element) => {
				const rect = element.getBoundingClientRect();
				return rect.top + rect.height / 2;
			};
			assert.closeTo(initial.getBoundingClientRect().left, final.getBoundingClientRect().left, 1);
			assert.isAtLeast(final.getBoundingClientRect().top, initial.getBoundingClientRect().bottom);
			assert.closeTo(initial.getBoundingClientRect().top, label.getBoundingClientRect().top, 1);
			assert.closeTo(final.getBoundingClientRect().bottom, label.getBoundingClientRect().bottom, 1);
			assert.isBelow(bar()!.querySelector(".editing-bar__delete")!.getBoundingClientRect().height,
				label.getBoundingClientRect().height);
			label.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, composed: true }));
			assert.exists(widget.automaton.getNode(1));
			edit(label, "value", "middle", "sl-input");
			edit(final, "checked", true, "sl-change");
			edit(initial, "checked", true, "sl-change");
			await widget.updateComplete;
			assert.equal(widget.automaton.getNode(1)?.label, "middle");
			assert.isTrue(widget.automaton.getNode(1)?.final);
			assert.equal(widget.automaton.getInitialNode().id, 1);
			assert.equal(machineData(widget).states.find(node => node.id === 1)?.label, "middle");
			assert.strictEqual(bar()!.querySelector("sl-input"), label, "Editing preserves the focused field");

			await select("edge", 0);
			assert.equal(bar()!.getAttribute("aria-label"), "Edge");
			assert.isNull(bar()!.querySelector("sl-checkbox"));
			const fields = bar()!.querySelector<HTMLElement>(".editing-bar__edge-fields")!;
			const symbol = fields.querySelector("sl-input[placeholder=Symbol]")!;
			edit(symbol, "value", "b", "sl-input");
			await widget.updateComplete;
			assert.equal(widget.automaton.getTransition(0)?.symbols[0], "b");
			assert.isNull(bar()!.querySelector("details"));
			assert.isAbove(fields.scrollWidth, fields.clientWidth, "Long rows scroll within the compact bar");
			assert.closeTo(centerY(fields.querySelector("input[type=range]")!), centerY(symbol), 2);
			assert.deepEqual(machineData(widget).transitions[0].rules, [{ read: "b", stack: { op: "push", symbol: "$" } }]);
			edit(fields.querySelector("sl-input[placeholder=If]")!, "value", "X", "sl-input");
			assert.deepEqual(machineData(widget).transitions[0].rules, [{ read: "b", stack: { op: "push", symbol: "$", ifTop: "X" } }]);
			bar()!.querySelector<HTMLElement>(".editing-bar__delete")!.click();
			await widget.updateComplete;
			assert.isNull(widget.automaton.getTransition(0));
			assert.equal(widget.automaton.getTransition(widget.transitions[0].id)?.from, widget.transitions[0].from,
				"Remaining transition IDs still identify the live edges");
			assert.isNull(bar());
			widget.style.width = "900px";
			await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			await select("node", 1);
			assert.closeTo(bar()!.getBoundingClientRect().right, widget.getBoundingClientRect().right - 10, 1,
				"The bar remains aligned with the widget's edge on a wide PDA");
			widget.permissions = "077";
			await widget.updateComplete;
			assert.isNull(bar()!.querySelector(".editing-bar__delete"));
			assert.isTrue((bar()!.querySelector("sl-input") as HTMLElement & { disabled: boolean }).disabled);
			widget.mode = "simulate";
			await widget.updateComplete;
			assert.isNull(bar());
		});

		it("commits a bend on release and restores its default when the authored bend is undone", async () => {
			const widget = await createConfiguredDFA();
			await widget.updateComplete;
			const { network } = (widget as unknown as { graph: Graph }).graph;
			const original = machineData(widget).transitions;
			network.selectEdges([0]);
			widget.requestUpdate();
			await widget.updateComplete;
			const range = widget.shadowRoot!.querySelector<HTMLInputElement>(".editing-bar__range input")!;
			range.value = "40";
			range.dispatchEvent(new Event("input"));
			assert.deepEqual(machineData(widget).transitions, original, "Dragging previews the curve");
			range.dispatchEvent(new Event("change"));
			const bent = machineData(widget).transitions;
			assert.equal(bent[0].bend, 0.4);
			setMachine(widget, { transitions: original });
			await widget.updateComplete;
			assert.isUndefined(widget.automaton.getTransition(0)?.smooth);
			assert.deepEqual(machineData(widget).transitions, original);
			setMachine(widget, { transitions: bent });
			await widget.updateComplete;
			assert.deepInclude(widget.automaton.getTransition(0)?.smooth as object, { roundness: 0.4 });
		});

		it("saves the authored PDA starting stack and reopens without the simulation stack", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			setMachine(widget, { type: "pda" });
			setMachine(widget, { states: [state(0, 0, 0, { initial: true }), state(1, 150, 0, { final: true })] });
			setMachine(widget, { transitions: [edge(0, 0, 1, { read: "a", stack: { op: "push", symbol: "X" } })] });
			setMachine(widget, { startingStack: ["Z"] });
			document.body.append(widget);
			await widget.updateComplete;
			const stack = widget.shadowRoot!.querySelector<StackExtension>("stack-extension")!;
			await stack.updateComplete;
			assert.deepEqual(stack.getStack(), ["Z"]);
			stack.shadowRoot!.querySelector<HTMLElement>(".pda__stack-button")!.click();
			assert.deepEqual(machineData(widget).startingStack, ["Z", "a"]);
			widget.mode = "simulate";
			await widget.updateComplete;
			const simulator = widget.automaton.simulator;
			simulator.word = "a";
			simulator.simulate();
			assert.deepEqual(stack.getStack(), ["Z", "a", "X"]);
			assert.deepEqual(machineData(widget).startingStack, ["Z", "a"]);
			simulator.init();
			simulator.simulate();
			assert.deepEqual(stack.getStack(), ["Z", "a", "X"], "Another run starts from the same authored stack");

			const saved = widget.outerHTML;
			const container = document.createElement("div");
			container.innerHTML = saved;
			const reopened = container.firstElementChild as AutomatonComponent;
			document.body.append(reopened);
			await reopened.updateComplete;
			const reopenedStack = reopened.shadowRoot!.querySelector<StackExtension>("stack-extension")!;
			assert.deepEqual(reopenedStack.getStack(), ["Z", "a"]);
			setMachine(widget, { startingStack: ["Z"] });
			await widget.updateComplete;
			assert.deepEqual(stack.getStack(), ["Z"], "An authored undo replaces the simulation display");
			setMachine(widget, { startingStack: ["Z", "a"] });
			await widget.updateComplete;
			assert.deepEqual(stack.getStack(), ["Z", "a"]);
		});

		it("moves the initial arrow clear of a nearby node or transition", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			setMachine(widget, { states: [state(0, 0, 0, { initial: true }), state(1, -220, 0)] });
			setMachine(widget, { transitions: [edge(0, 1, 0, "a")] });
			document.body.append(widget);
			await widget.updateComplete;
			await widget.updateComplete;
			const { network } = (widget as unknown as { graph: Graph }).graph;
			const position = () => network.getPositions([-1])[-1];
			assert.isAbove(Math.abs(position().y), 20, "The arrow avoids the incoming transition");
			setMachine(widget, { transitions: [] });
			await widget.updateComplete;
			assert.isBelow(position().x, 0);
			assert.closeTo(position().y, 0, 1, "The arrow points from the left when clear");
			setMachine(widget, { states: [state(0, 0, 0, { initial: true }), state(1, -65, 0)] });
			await widget.updateComplete;
			assert.isAbove(Math.abs(position().y), 20, "The arrow moves when a node obstructs it");
			assert.deepEqual(machineData(widget).states, [state(0, 0, 0, { initial: true }), state(1, -65, 0)]);
		});

		it("explains invalid graphs and enables simulation once they are valid", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			document.body.append(widget);
			await widget.updateComplete;
			await widget.updateComplete;
			const root = widget.shadowRoot!;
			const simulate = root.querySelector<HTMLButtonElement>(".mode_switch__buttons button:last-child")!;
			const shortcut = () => widget.dispatchEvent(new KeyboardEvent("keydown", { key: "m", ctrlKey: true }));
			assert.isTrue(simulate.disabled);
			simulate.click();
			shortcut();
			assert.equal(widget.mode, "edit");

			const indicator = root.querySelector<HTMLButtonElement>(".mode_switch__error_indicator")!;
			const indicatorBounds = indicator.getBoundingClientRect();
			const simulateBounds = simulate.getBoundingClientRect();
			assert.isBelow(indicatorBounds.top, simulateBounds.bottom);
			assert.isBelow(indicatorBounds.left, simulateBounds.right);
			const warning = root.querySelector<HTMLElement>(".warning-panel--all")!;
			assert.equal(indicator.getAttribute("aria-describedby"), warning.id);
			assert.include(warning.textContent, "No initial state defined");

			setMachine(widget, { states: [state(0, 0, 0, { initial: true })] });
			setMachine(widget, { transitions: [edge(0, 0, 0, "")] });
			await widget.updateComplete;
			assert.isTrue(simulate.disabled, "An invalid transition blocks simulation");
			setMachine(widget, { transitions: [edge(0, 0, 0, "a")] });
			await widget.updateComplete;
			assert.isFalse(simulate.disabled);
			assert.isNull(root.querySelector(".warning-panel--all"));
			shortcut();
			await widget.updateComplete;
			assert.equal(widget.mode, "simulate");

			setMachine(widget, { states: [state(0, 0, 0)] });
			await widget.updateComplete;
			assert.isTrue(simulate.disabled, "Removing the initial flag blocks simulation");
			assert.isTrue(root.querySelector<HTMLElement>("#simulatorMenu")!.hidden);
			setMachine(widget, { states: [state(0, 0, 0, { initial: true })] });
			await widget.updateComplete;
			assert.isFalse(simulate.disabled);
			setMachine(widget, { states: [], transitions: [] });
			await widget.updateComplete;
			assert.isTrue(simulate.disabled, "Removing the graph blocks simulation again");
		});

		it("loads every locale and resolves inherited language tags", async function () {
			this.timeout(10000);
			const widget = await createConfiguredDFA();
			try {
				for (const locale of targetLocales) {
					await LOCALIZE.setLocale(locale);
					assert.equal(LOCALIZE.getLocale(), locale);
				}
				const parent = document.createElement("div");
				parent.lang = "HR-hr";
				document.body.append(parent);
				try {
					parent.append(widget);
					await LOCALIZE.setLocale(widget.lang);
					await widget.updateComplete;
					assert.equal(LOCALIZE.getLocale(), "hr");
					assert.include(widget.shadowRoot!.querySelector(".mode_switch__buttons")!.textContent, "Uredi");
				} finally {
					parent.remove();
				}
				await LOCALIZE.setLocale("PT-br");
				assert.equal(LOCALIZE.getLocale(), "pt");
				await LOCALIZE.setLocale("zh-Hant");
				assert.equal(LOCALIZE.getLocale(), "zh");
				await LOCALIZE.setLocale("en-US");
				assert.equal(LOCALIZE.getLocale(), sourceLocale);
			} finally {
				await LOCALIZE.setLocale(sourceLocale);
			}
		});

		it("fits the compact menu, German help and mode buttons at 300 by 300 pixels", async () => {
			const widget = await createConfiguredDFA();
			widget.style.width = "300px";
			widget.style.height = "300px";
			widget.lang = "de";
			await LOCALIZE.setLocale("de");
			try {
				const layout = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				await layout();
				const root = widget.shadowRoot!;
				const menu = root.querySelector("#topMenu")!.shadowRoot!;
				const bounds = widget.getBoundingClientRect();
				const assertInside = (element: Element) => {
					const rect = element.getBoundingClientRect();
					assert.isAbove(rect.height, 0);
					assert.isAtLeast(rect.top, bounds.top);
					assert.isAtLeast(rect.left, bounds.left);
					assert.isAtMost(rect.bottom, bounds.bottom);
					assert.isAtMost(rect.right, bounds.right);
				};

				menu.querySelector<HTMLElement>(".topmenu--hamburger > sl-button")!.click();
				await layout();
				const panel = menu.querySelector(".topmenu__collapsed_panel")!;
				assertInside(panel);
				panel.querySelector<HTMLElement>("sl-button:has(.bi-question-lg)")!.click();
				await layout();
				const help = root.querySelector(".compact-help")!;
				assertInside(help);
				assert.include(help.textContent, "Übergänge");
				assert.include(help.textContent, "Fangzustand hinzufügen");
				assert.equal(help.scrollWidth, help.clientWidth, "German help text wraps");
				panel.querySelector<HTMLElement>("sl-button:has(.bi-question-lg)")!.click();
				panel.querySelector<SlButton>(".definition-trigger")!.click();
				await layout();
				assertInside(menu.querySelector(".definition-pane")!);
				menu.querySelector<HTMLButtonElement>(".definition-pane__close")!.click();
				await layout();
				menu.querySelector<HTMLElement>(".topmenu--hamburger > sl-button")!.click();
				await layout();

				const tooltip = root.querySelector<SlTooltip>(".mode_switch sl-tooltip")!;
				const group = root.querySelector<HTMLElement>(".mode_switch__buttons")!;
				const [edit, simulate] = group.querySelectorAll<HTMLButtonElement>("button");
				assertInside(group);
				assert.equal(edit.textContent!.trim(), "Bearbeiten");
				assert.equal(simulate.textContent!.trim(), "Simulieren");
				assert.exists(edit.querySelector(".bi-pencil"));
				assert.exists(simulate.querySelector(".bi-boxes"));
				assert.equal(edit.getAttribute("aria-pressed"), "true");
				await tooltip.show();
				assertInside(tooltip.body);
				await tooltip.hide();
				simulate.click();
				await layout();
				assert.equal(widget.mode, "simulate");
				assert.equal(simulate.getAttribute("aria-pressed"), "true");
				assert.equal(edit.getAttribute("aria-pressed"), "false");
				widget.allowedModes = ["simulate"];
				await widget.updateComplete;
				assert.isTrue(edit.disabled);
				edit.click();
				assert.equal(widget.mode, "simulate");
				const playbackTooltips = root.querySelector("#simulatorMenu")!.shadowRoot!
					.querySelectorAll<SlTooltip>(".simulator_buttons sl-tooltip");
				const lastVisibleTooltip = Array.from(playbackTooltips)
					.filter(tip => tip.firstElementChild?.getClientRects().length).at(-1)!;
				await lastVisibleTooltip.show();
				assertInside(lastVisibleTooltip.body);
			} finally {
				widget.remove();
				await LOCALIZE.setLocale("en");
			}
		});

		it("shows PDA definitions and the transition table in a scrollable bottom sheet", async () => {
			const widget = await createConfiguredPDA();
			widget.style.width = "300px";
			widget.style.height = "300px";
			setMachine(widget, { startingStack: ["Z", "X"] });
			const transitions = [
				edge(0, 0, 2, { read: "b", stack: { op: "pop", symbol: "X" } }, { read: "a", stack: { op: "none", ifTop: "Z" } }),
				edge(1, 0, 1, { read: "", stack: { op: "push", symbol: "A", ifTop: "X" } }),
				edge(2, 1, 2, { read: "b", stack: { op: "pop", symbol: "A" } }),
				edge(3, 2, 3, { read: "", stack: { op: "empty" } }),
			];
			setMachine(widget, { transitions });
			const layout = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			await layout();

			const menu = widget.shadowRoot!.querySelector("#topMenu")!.shadowRoot!;
			menu.querySelector<SlButton>(".topmenu--hamburger > sl-button")!.click();
			await layout();
			menu.querySelector<SlButton>(".definition-trigger")!.click();
			await layout();
			const pane = menu.querySelector<HTMLElement>(".definition-pane")!;
			const bounds = widget.getBoundingClientRect();
			const sheet = pane.getBoundingClientRect();
			assert.closeTo(sheet.left, bounds.left + 8, 1);
			assert.closeTo(sheet.right, bounds.right - 8, 1);
			assert.closeTo(sheet.bottom, bounds.bottom - 8, 1);
			assert.isAbove(sheet.top, bounds.top + 50, "The toolbar remains visible");
			assert.isNull(menu.querySelector(".topmenu__collapsed_panel"));

			const summary = [...pane.querySelectorAll("dd")].map(value => value.textContent!.trim());
			assert.deepEqual(summary, ["{ q0, q1, q2, q3 }", "{ a, b }", "q0", "{ q3 }", "{ A, X, Z }", "[Z, X]"]);
			const groups = [...pane.querySelectorAll(".definition-transitions")];
			assert.deepEqual(groups.map(group => group.querySelector("h4")!.textContent), ["q0", "q1", "q2"]);
			assert.deepEqual([...groups[0].querySelectorAll("li > code")].map(row => row.textContent), ["ε → q1", "a → q2", "b → q2"]);
			const operations = [...pane.querySelectorAll(".definition-stack-operation")].map(row => row.textContent!.trim());
			assert.deepEqual(operations, ["Push A · Top is X", "Leave stack unchanged · Top is Z", "Pop X", "Pop A", "Require an empty stack"]);
			assert.deepEqual(machineData(widget).transitions, transitions, "Sorting the list preserves authored transitions");
			const firstGroup = groups[0];
			const firstRule = firstGroup.querySelector("li > code")!.getBoundingClientRect();
			assert.closeTo(firstGroup.querySelector("h4 > code")!.getBoundingClientRect().top, firstRule.top, 1);
			assert.isAbove(firstGroup.querySelector("li .definition-stack-operation")!.getBoundingClientRect().left, firstRule.right);

			const tabs = pane.querySelector("sl-tab-group")!;
			const viewport = tabs.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
			const header = tabs.shadowRoot!.querySelector('[part="nav"]')!;
			const headerTop = header.getBoundingClientRect().top;
			assert.isAbove(viewport.scrollHeight, viewport.clientHeight);
			assert.equal(viewport.scrollWidth, viewport.clientWidth, "The definition wraps within the sheet");
			viewport.scrollTop = viewport.scrollHeight;
			assert.isAbove(viewport.scrollTop, 0);
			assert.equal(header.getBoundingClientRect().top, headerTop, "Scrolling keeps the tabs in place");

			pane.querySelector<HTMLElement>('sl-tab[panel="table"]')!.click();
			await layout();
			assert.exists(pane.querySelector('sl-tab-panel[name="table"][active]'));
			assert.equal(header.getBoundingClientRect().top, headerTop, "Switching tabs keeps the sheet in place");
			assert.deepEqual([...pane.querySelectorAll("thead th")].map(th => th.textContent), ["State", "a", "b", "ε"]);
			assert.equal(pane.querySelector("tbody tr td:last-child")!.textContent!.trim(), "q1");

			widget.style.width = "640px";
			await layout();
			assert.equal(menu.querySelector(".definition-pane"), pane, "Resizing keeps the open pane");
			assert.exists(pane.querySelector('sl-tab-panel[name="table"][active]'));
			assert.closeTo(pane.getBoundingClientRect().top, bounds.top + 58, 1);

			widget.transitionsTableEnabled = false;
			await layout();
			assert.exists(pane.querySelector('sl-tab-panel[name="def"][active]'));
			assert.exists(pane.querySelector('sl-tab[panel="table"][disabled]'));
			setMachine(widget, { startingStack: ["Y"] });
			await layout();
			assert.equal(pane.querySelector(".definition-summary > div:last-child dd")?.textContent, "[Y]");
			const { network } = (widget as unknown as { graph: Graph }).graph;
			network.selectNodes([0]);
			pane.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, composed: true }));
			assert.exists(widget.automaton.getNode(0), "Reading the pane does not trigger canvas editing shortcuts");
			pane.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
			await layout();
			assert.isNull(menu.querySelector(".definition-pane"));
			assert.equal(menu.activeElement, menu.querySelector(".definition-trigger"));
			widget.formalDefinitionEnabled = false;
			await layout();
			assert.isTrue(menu.querySelector<SlButton>(".definition-trigger")!.disabled);
			widget.transitionsTableEnabled = true;
			await layout();
			menu.querySelector<SlButton>(".definition-trigger")!.click();
			await layout();
			assert.exists(menu.querySelector('sl-tab-panel[name="table"][active]'));
			assert.isNull(menu.querySelector(".definition-summary"));
		});

		it("enforces embedded size limits and defaults to 500 pixels tall", async () => {
			const widget = await createConfiguredDFA();
			await widget.updateComplete;
			widget.style.width = "250px";
			assert.equal(widget.getBoundingClientRect().width, 300);
			assert.equal(widget.getBoundingClientRect().height, 500);
			widget.style.height = "250px";
			assert.equal(widget.getBoundingClientRect().height, 300);
			widget.style.height = "640px";
			assert.equal(widget.getBoundingClientRect().height, 640);
			widget.style.height = "1400px";
			assert.equal(widget.getBoundingClientRect().height, 1200);
		});

		it("allows canvas focus without drawing a widget focus outline", async () => {
			const widget = await createConfiguredDFA();
			await widget.updateComplete;
			const frame = widget.shadowRoot!.querySelector<HTMLElement>(".vis-network")!;
			frame.focus();
			assert.equal(widget.shadowRoot!.activeElement, frame);
			assert.equal(getComputedStyle(frame).outlineStyle, "none");
			assert.equal(getComputedStyle(widget).outlineStyle, "none");
		});

		it("shows stack removal and help within the widget at compact and wide widths", async () => {
			const widget = await createConfiguredPDA();
			widget.style.width = "300px";
			widget.style.height = "300px";
			const layout = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			await layout();
			const root = widget.shadowRoot!;
			const stack = root.querySelector<StackExtension>("stack-extension")!;
			const stackRoot = stack.shadowRoot!;
			const removeButtons = () => stackRoot.querySelectorAll<HTMLButtonElement>(".pda__stack-remove");
			const assertInside = (element: Element) => {
				const rect = element.getBoundingClientRect();
				const widgetRect = widget.getBoundingClientRect();
				assert.isAbove(rect.width, 0);
				assert.isAtLeast(rect.left, widgetRect.left);
				assert.isAtMost(rect.right, widgetRect.right);
				assert.isAtLeast(rect.top, widgetRect.top);
				assert.isAtMost(rect.bottom, widgetRect.bottom);
			};
			stack.setStack(["A", "B", "C"]);
			stackRoot.querySelector<HTMLButtonElement>(".pda__stack-toggle")!.click();
			await layout();
			assert.lengthOf(removeButtons(), 3);
			assertInside(removeButtons()[1]);
			const field = removeButtons()[1].parentElement!.querySelector("sl-input")!;
			assertInside(field);
			assert.isAtMost(field.getBoundingClientRect().right, removeButtons()[1].getBoundingClientRect().left);
			removeButtons()[1].click();
			await stack.updateComplete;
			assert.deepEqual(stack.getStack(), ["A", "C"]);

			const menu = root.querySelector("#topMenu")!.shadowRoot!;
			menu.querySelector<HTMLElement>(".topmenu--hamburger > sl-button")!.click();
			await layout();
			menu.querySelector<HTMLElement>("sl-button:has(.bi-question-lg)")!.click();
			await layout();
			const compactHelp = root.querySelector(".compact-help")!;
			const stackHelp = [...compactHelp.children].find(item => item.textContent?.includes("Remove stack items with ×"))!;
			assertInside(compactHelp);
			assert.isAtMost(stackHelp.getBoundingClientRect().bottom, compactHelp.getBoundingClientRect().bottom);
			for (const width of [500, 800]) {
				widget.style.width = `${width}px`;
				await layout();
				const help = stackRoot.querySelector(".pda__stack-help")!;
				assert.include(help.textContent, "Remove stack items with ×");
				assertInside(help);
			}
			widget.permissions = "775";
			await widget.updateComplete;
			await stack.updateComplete;
			assert.lengthOf(removeButtons(), 0);
			widget.permissions = "777";
			await widget.updateComplete;
			await stack.updateComplete;
			assert.lengthOf(removeButtons(), 2);
			widget.mode = "simulate";
			await widget.updateComplete;
			await stack.updateComplete;
			assert.lengthOf(removeButtons(), 0);
			assert.equal(stackRoot.querySelector(".pda__stack-help")!.textContent?.trim(), "Stack");
		});

		it("adapts the menus, graph and PDA stack to the widget width", async () => {
			const widget = await createConfiguredPDA();
			widget.style.height = "300px";
			await widget.updateComplete;
			const root = widget.shadowRoot!;
			const plus = root.querySelector("#toolMenu")!.shadowRoot!.querySelector(".toolmenu__node")!;
			const plusBounds = plus.getBoundingClientRect();
			widget.mode = "simulate";
			await widget.updateComplete;
			const graph = root.querySelector("#graphCanvas")!;
			const topMenu = root.querySelector("#topMenu")!.shadowRoot!;
			const simulator = root.querySelector("#simulatorMenu")!.shadowRoot!;
			const stack = root.querySelector<StackExtension>("stack-extension")!;
			stack.setStack(Array(16).fill("X"));
			await stack.updateComplete;
			const panel = stack.shadowRoot!.querySelector(".pda__stack")!;
			const toggle = stack.shadowRoot!.querySelector<HTMLButtonElement>(".pda__stack-toggle")!;
			const items = () => stack.shadowRoot!.querySelector(".pda__stack-items")!;

			for (const width of [300, 499, 500, 799, 800, 2100]) {
				widget.style.width = `${width}px`;
				// Let the top menu's ResizeObserver react to the new container width.
				await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				const compact = width < 500;
				assert.equal(!!topMenu.querySelector(".topmenu--hamburger"), compact, `${width}px top menu`);
				const modeButtons = root.querySelector(".mode_switch__buttons")!.getBoundingClientRect();
				const circleButton = topMenu.querySelector("sl-button")!.getBoundingClientRect();
				assert.closeTo(modeButtons.top, circleButton.top, 1, `${width}px mode buttons align`);
				assert.closeTo(modeButtons.height, circleButton.height, 1, `${width}px mode buttons match toolbar height`);
				assert.isAtMost(modeButtons.right, topMenu.querySelector(".topmenu")!.getBoundingClientRect().left);
				const input = simulator.querySelector("#wordInput")!.getBoundingClientRect();
				const buttons = Array.from(simulator.querySelectorAll(".simulator_buttons"))
					.find(group => group.getClientRects().length)!.getBoundingClientRect();
				assert.closeTo(input.top, buttons.top, 1, `${width}px single simulator row`);
				assert.closeTo(input.top + input.height / 2, plusBounds.top + plusBounds.height / 2,
					1, `${width}px simulator bar aligns with the add button`);
				assert.isBelow(input.height, plusBounds.height, `${width}px simulator bar is shorter than the add button`);
				assert.isAbove(input.width, 75, `${width}px word input has room`);
				assert.isAtMost(buttons.right, widget.getBoundingClientRect().right, `${width}px playback controls fit`);
				const canvas = graph.getBoundingClientRect();
				const stackPanel = panel.getBoundingClientRect();
				assert.closeTo(graph.querySelector("canvas")!.getBoundingClientRect().width, canvas.width, 1);
				assert.isBelow(input.top, canvas.bottom, `${width}px simulator overlays the canvas`);
				assert.isAtMost(input.bottom, canvas.bottom);
				assert.isAtMost(stackPanel.bottom, input.top, `${width}px stack clears the simulator bar`);
				assert.isBelow(stackPanel.left, canvas.right, `${width}px stack overlays the canvas`);
				assert.isAtMost(stackPanel.right, canvas.right);
				assert.closeTo(canvas.width, widget.getBoundingClientRect().width, 1, `${width}px canvas fills the widget`);
				assert.equal(getComputedStyle(toggle).display !== "none", compact, `${width}px stack toggle`);
				assert.equal(getComputedStyle(items()).display === "none", compact, `${width}px stack visibility`);
			}

			widget.style.width = "300px";
			toggle.click();
			await new Promise(resolve => requestAnimationFrame(resolve));
			assert.equal(toggle.getAttribute("aria-expanded"), "true");
			assert.isAbove(items().getBoundingClientRect().height, 0);
			assert.isAbove(items().scrollHeight, items().clientHeight);
			assert.isAtMost(panel.getBoundingClientRect().bottom, graph.getBoundingClientRect().bottom);
		});

		it("preserves the canvas zoom and center through width and height changes", async () => {
			const widget = await createConfiguredPDA();
			widget.style.width = "800px";
			await widget.updateComplete;
			const afterResize = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			await afterResize();

			const { network } = (widget as unknown as { graph: Graph }).graph;
			const position = { x: 90, y: -40 };
			const scale = 1.75;
			network.moveTo({ scale, position });
			for (const [width, height] of [[300, 500], [300, 300], [1000, 600]]) {
				widget.style.width = `${width}px`;
				widget.style.height = `${height}px`;
				await afterResize();
				assert.equal(network.getScale(), scale, `${width} × ${height} zoom`);
				assert.closeTo(network.getViewPosition().x, position.x, 0.01);
				assert.closeTo(network.getViewPosition().y, position.y, 0.01);
			}
		});
	});

	describe("DFA Configuration", () => {
		it("should load and configure the test DFA", async () => {
			const automaton = await createConfiguredDFA();

			// Verify nodes are set
			const nodes = automaton.nodes;
			assert.equal(nodes.length, 4, "Should have 4 nodes");

			// Verify transitions are set
			const transitions = automaton.transitions;
			assert.equal(transitions.length, 7, "Should have 7 transitions");

			// Verify initial state exists
			const initialNode = nodes.find((n) => n.initial);
			assert.isNotNull(initialNode, "Should have an initial state");

			// Verify final states exist
			const finalNodes = nodes.filter((n) => n.final);
			assert.equal(finalNodes.length, 2, "Should have 2 final states");
		});
	});

	describe("NFA Configuration", () => {
		it("should load and configure the test NFA", async () => {
			const automaton = await createConfiguredNFA();

			// Verify nodes are set
			const nodes = automaton.nodes;
			assert.equal(nodes.length, 6, "Should have 6 nodes");

			// Verify transitions are set
			const transitions = automaton.transitions;
			assert.equal(transitions.length, 8, "Should have 8 transitions");

			// Verify initial state exists
			const initialNode = nodes.find((n) => n.initial);
			assert.isNotNull(initialNode, "Should have an initial state");

			// Verify final state exists
			const finalNodes = nodes.filter((n) => n.final);
			assert.equal(finalNodes.length, 1, "Should have 1 final state");
		});
	});

	describe("PDA Configuration", () => {
		it("should load and configure the test PDA", async () => {
			const automaton = await createConfiguredPDA();

			// Verify nodes are set
			const nodes = automaton.nodes;
			assert.equal(nodes.length, 4, "Should have 4 nodes");

			// Verify transitions are set
			const transitions = automaton.transitions;
			assert.equal(transitions.length, 5, "Should have 5 transitions");

			// Verify initial state exists
			const initialNode = nodes.find((n) => n.initial);
			assert.isNotNull(initialNode, "Should have an initial state");

			// Verify final state exists
			const finalNodes = nodes.filter((n) => n.final);
			assert.equal(finalNodes.length, 1, "Should have 1 final state");
		});
	});

	describe("DFA Simulation", () => {
		beforeEach(async () => {
			automaton = await createConfiguredDFA();
		});

		const testCases = [
			{
				word: "aa",
				expected: "accepted",
				description: "should accept 'aa'",
			},
			{
				word: "ababab",
				expected: "accepted",
				description: "should accept 'ababab'",
			},
			{
				word: "a",
				expected: "rejected",
				description: "should reject 'a'",
			},
			{
				word: "aba",
				expected: "rejected",
				description: "should reject 'aba'",
			},
		];

		testCases.forEach(({ word, expected, description }) => {
			it(description, () => {
				automaton!.automaton.simulator.word = word;

				const result = automaton!.automaton.simulator.simulate();

				assert.equal(
					result!.status,
					expected,
					`Word '${word}' should be ${expected}`
				);
				assert.equal(
					result!.simulationResult?.accepted,
					expected === "accepted",
					`Word '${word}' should be ${expected}`
				);
				assert.isNotOk(
					result!.simulationResult?.errors,
					`Word '${word}' should be ${expected} without errors`
				);
			});
		});
	});

	describe("NFA Simulation", () => {
		beforeEach(async () => {
			automaton = await createConfiguredNFA();
		});

		const testCases = [
			{
				word: "",
				expected: "accepted",
				description: "should accept ''",
			},
			{
				word: "aabb",
				expected: "accepted",
				description: "should accept 'aabb'",
			},
			{
				word: "a",
				expected: "no_path",
				description: "should reject 'a'",
			},
			{
				word: "ba",
				expected: "no_path",
				description: "should reject 'ba'",
			},
		];

		testCases.forEach(({ word, expected, description }) => {
			it(description, () => {
				automaton!.automaton.simulator.word = word;

				const result = automaton!.automaton.simulator.simulate();

				assert.equal(
					result!.status,
					expected,
					`Word '${word}' should be ${expected}`
				);
				assert.equal(
					result!.simulationResult?.accepted,
					expected === "accepted",
					`Word '${word}' should be ${expected}`
				);
				assert.isNotOk(
					result!.simulationResult?.errors,
					`Word '${word}' should be ${expected} without errors`
				);
			});
		});
	});

	describe("PDA Simulation", () => {
		beforeEach(async () => {
			automaton = await createConfiguredPDA();
		});

		const testCases = [
			{
				word: "",
				expected: "accepted",
				description: "should accept ''",
			},
			{
				word: "0110",
				expected: "accepted",
				description: "should accept '0110'",
			},
			{
				word: "01",
				expected: "no_path",
				description: "should reject '01'",
			},
			{
				word: "1100",
				expected: "no_path",
				description: "should reject '1100'",
			},
		];

		testCases.forEach(({ word, expected, description }) => {
			it(description, () => {
				automaton!.automaton.simulator.word = word;

				const result = automaton!.automaton.simulator.simulate();

				assert.equal(
					result!.status,
					expected,
					`Word '${word}' should be ${expected}`
				);
				assert.equal(
					result!.simulationResult?.accepted,
					expected === "accepted",
					`Word '${word}' should be ${expected}`
				);
				assert.isNotOk(
					result!.simulationResult?.errors,
					`Word '${word}' should be ${expected} without errors`
				);
			});
		});
	});
});

mocha.run();
