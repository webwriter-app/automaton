import "mocha/mocha.js";
import { getMochaConfig } from "@webwriter/build/test";
import { assert } from "chai";
import "../src";
import { AutomatonComponent } from "../src";
import type { StackExtension } from "../src/automata/pda";
import type { Graph } from "../src/graph";
import type SlTooltip from "@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js";
import LOCALIZE from "../localization/generated/index.js";

mocha.setup(getMochaConfig());

describe("Simulation Tests", () => {
	let automaton: AutomatonComponent | null;

	const createConfiguredDFA = async () => {
		const element = document.createElement("webwriter-automaton");
		document.body.appendChild(element);

		// Configure the DFA
		element.setAttribute("type", "dfa");
		element.setAttribute(
			"nodes",
			"#0(-300|0);1(-100|0);%2(-300|200);%3(-100|200)"
		);
		element.setAttribute(
			"transitions",
			"0-1[a];1-3[a];3-2[a];1-2[b];2-0[a,b];3-3[b]@135;0-0[b]@0"
		);

		return element as AutomatonComponent;
	};

	const createConfiguredNFA = async () => {
		const element = document.createElement("webwriter-automaton");
		document.body.appendChild(element);

		// Configure the NFA
		element.setAttribute("type", "nfa");
		element.setAttribute(
			"nodes",
			"#0(0|0);%1(170|0);2(0|-170);3(170|-170);4(0|170);5(170|170)"
		);
		element.setAttribute(
			"transitions",
			"0-1[];1-1[b];0-2[a];2-3[a];3-0[b];1-4[a];4-5[b];5-1[a]"
		);

		return element as AutomatonComponent;
	};

	const createConfiguredPDA = async () => {
		const element = document.createElement("webwriter-automaton");
		document.body.appendChild(element);

		// Configure the PDA
		element.setAttribute("type", "pda");
		element.setAttribute("nodes", "#0(0|0);1(200|0);2(200|200);%3(0|200)");
		element.setAttribute(
			"transitions",
			"0-1[{p|%24|}];1-1[0{p|0|},1{p|1|}];1-2[{n||}];2-2[0{o|0|},1{o|1|}]@135;2-3[{o|%24|}]"
		);

		return element as AutomatonComponent;
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
			widget.setAttribute("nodes", "#0(0|0);%1(150|0)");
			widget.setAttribute("transitions", "0-1[a{p|X|}]~0.2;1-1[b{n||}]@135");
			await widget.updateComplete;
			widget.automaton.updateNode(1, { label: "accept" });
			await menuChoice(widget, "Automaton Type", "DFA");
			assert.equal(widget.automaton.type, "dfa");
			assert.isNull(widget.shadowRoot!.querySelector("stack-extension"));
			assert.equal(widget.automaton.getNode(1)?.label, "accept");
			assert.isTrue(widget.automaton.getNode(1)?.final);
			assert.equal(widget.automaton.getInitialNode().id, 0);
			assert.equal(widget.getAttribute("transitions"), "0-1[a]~0.2;1-1[b]@135");
			await menuChoice(widget, "Automaton Type", "PDA");
			assert.equal(widget.automaton.getTransition(0)?.stackOperations?.[0].operation, "none");
			assert.equal(widget.getAttribute("transitions"), "0-1[a{n||}]~0.2;1-1[b{n||}]@135");
		});

		it("completes missing DFA transitions and reuses the sink as the alphabet grows", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			widget.style.width = "600px";
			document.body.append(widget);
			await menuChoice(widget, "Transformations", "Add Sinkstate");
			assert.isEmpty(widget.nodes, "An empty graph cannot gain a sink");
			widget.setAttribute("nodes", "#%0(0|0)");
			await menuChoice(widget, "Transformations", "Add Sinkstate");
			assert.isEmpty(widget.automaton.getTransitionsFromNode(widget.automaton.getInitialNode()),
				"An empty alphabet cannot produce an empty-symbol transition");
			widget.forcedAlphabet = ["a", "b"];
			await widget.updateComplete;
			await menuChoice(widget, "Transformations", "Add Sinkstate");
			const { automaton } = widget;
			const sink = automaton.getNode(1)!;
			assert.isFalse(sink.final);
			assert.isFalse(sink.initial);
			assert.deepEqual(automaton.getTransitionsFromNode(sink).map(edge => [edge.to, edge.symbols]), [[1, ["a", "b"]]]);
			assert.isEmpty(automaton.checkAutomaton());
			await menuChoice(widget, "Transformations", "Add Sinkstate");
			assert.lengthOf(automaton.nodes.get().filter(node => node.id >= 0), 2);
			widget.forcedAlphabet = ["a", "b", "c"];
			await widget.updateComplete;
			await menuChoice(widget, "Transformations", "Add Sinkstate");
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
				automaton.getAttribute("type"),
				"dfa",
				"Should be configured as DFA"
			);
		});
	});

	describe("Widget options", () => {
		it("reads existing settings and keeps controls outside the widget in both modes", async () => {
			const widget = await createConfiguredDFA();
			widget.setAttribute("permissions", "251");
			widget.setAttribute("allowedtypes", "dfa nfa");
			widget.setAttribute("allowedmodes", "edit simulate");
			widget.setAttribute("allowedtransformations", "sink");
			widget.setAttribute("showhelp", "false");
			widget.setAttribute("testwords", '["a","ab"]');
			widget.setAttribute("forcedalphabet", '["a","b"]');
			widget.setAttribute("verbose", "");

			assert.deepEqual(widget.selectedPermissions, ["node-delete", "edge-add", "edge-change", "stack-change"]);
			assert.deepEqual(widget.allowedTypeOptions, ["dfa", "nfa"]);
			assert.deepEqual(widget.allowedModeOptions, ["edit", "simulate"]);
			assert.deepEqual(widget.allowedTransformationOptions, ["sink"]);
			assert.isFalse(widget.helpEnabled);
			assert.equal(widget.testWordsInput, "a,ab");
			assert.equal(widget.forcedAlphabetInput, "a,b");
			assert.containsAllKeys(AutomatonComponent.options, [
				"selectedPermissions", "allowedTypeOptions", "allowedTransformationOptions",
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

		it("writes option changes to the existing authored attributes", async () => {
			const widget = await createConfiguredPDA();
			await widget.updateComplete;
			widget.selectedPermissions = ["node-add", "edge-delete", "stack-change"];
			widget.allowedTypeOptions = ["pda", "dfa"];
			widget.allowedModeOptions = ["simulate"];
			widget.allowedTransformationOptions = [];
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
			assert.deepEqual(widget.allowedTransformations, []);
			assert.equal(widget.getAttribute("showhelp"), "false");
			assert.isFalse(widget.automaton.showErrors);
			assert.equal(widget.getAttribute("showformaldefinition"), "false");
			assert.equal(widget.getAttribute("showtransitionstable"), "false");
			assert.equal(widget.testLanguage, "a+");
			assert.equal(widget.getAttribute("testwords"), '["a","aa"]');
			assert.equal(widget.getAttribute("forcedalphabet"), '["a","b"]');
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
			widget.setAttribute("nodes", "#0(0|0)");
			await widget.updateComplete;
			assert.include(widget.actions.completeDfaWithSink.disabledReason?._, "Define an alphabet");
			let refreshes = 0;
			widget.addEventListener("optionschange", () => { refreshes++; });
			widget.forcedAlphabet = ["a"];
			await widget.updateComplete;
			assert.isAbove(refreshes, 0);
			assert.isFalse(widget.actions.completeDfaWithSink.disabled);
			await widget.completeDfaWithSink();
			assert.include(widget.getAttribute("nodes"), "[sink]");
			assert.equal(widget.getAttribute("transitions"), "1-1[a];0-1[a]");
			assert.isTrue(widget.actions.completeDfaWithSink.disabled);
			assert.include(widget.actions.completeDfaWithSink.disabledReason?._, "already has a transition");
		});

		it("declares confirmation only for allowed type switches that discard PDA stack operations", async () => {
			const widget = await createConfiguredPDA();
			await widget.updateComplete;
			assert.exists(widget.actions.switchToDfa.confirm);
			assert.exists(widget.actions.switchToNfa.confirm);
			assert.isTrue(widget.actions.switchToPda.hidden);
			widget.allowedTypes = ["pda", "nfa"];
			await widget.updateComplete;
			assert.isTrue(widget.actions.switchToDfa.hidden);
			await widget.switchToDfa();
			assert.equal(widget.type, "pda");
			widget.setAttribute("transitions", "0-1[a{n||X}]");
			await widget.updateComplete;
			assert.exists(widget.actions.switchToNfa.confirm, "A stack condition affects even a no-op transition");
			widget.setAttribute("transitions", "0-1[a{n||}]");
			await widget.updateComplete;
			assert.isUndefined(widget.actions.switchToNfa.confirm);
			await widget.switchToNfa();
			assert.equal(widget.getAttribute("type"), "nfa");
			assert.equal(widget.getAttribute("transitions"), "0-1[a]");
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
			widget.setAttribute("nodes", "#0(0|0);%1(180|0)");
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
				body: { nodes: Record<string, { x: number; y: number; options: { opacity: number } }>; edges: Record<string, {
					toId: number | string;
					hover: boolean;
					options: { label: string; hidden: boolean; smooth: { roundness: number }; color: { opacity: number } };
				}> };
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

			widget.setAttribute("transitions", "1-0[b]");
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
			assert.equal(widget.getAttribute("transitions"), "1-0[b]");

			widget.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
			widget.setAttribute("transitions", "0-1[b];1-0[b]");
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
			assert.equal(widget.getAttribute("transitions"), "0-1[b];1-0[b]");
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
			const plus = root.querySelector("#toolMenu")!.shadowRoot!.querySelector<HTMLElement>("sl-button")!;
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
				.querySelector(".toolmenu > sl-button")!.getBoundingClientRect();
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
			assert.include(widget.getAttribute("nodes"), "middle");
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
			assert.include(widget.getAttribute("transitions"), "0-1[b{p|");
			edit(fields.querySelector("sl-input[placeholder=If]")!, "value", "X", "sl-input");
			assert.include(widget.getAttribute("transitions"), "0-1[b{p|%24|X}]");
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
			const original = widget.getAttribute("transitions")!;
			network.selectEdges([0]);
			widget.requestUpdate();
			await widget.updateComplete;
			const range = widget.shadowRoot!.querySelector<HTMLInputElement>(".editing-bar__range input")!;
			range.value = "40";
			range.dispatchEvent(new Event("input"));
			assert.equal(widget.getAttribute("transitions"), original, "Dragging previews the curve");
			range.dispatchEvent(new Event("change"));
			const bent = widget.getAttribute("transitions")!;
			assert.include(bent, "0-1[a]~0.4");
			widget.setAttribute("transitions", original);
			await widget.updateComplete;
			assert.isUndefined(widget.automaton.getTransition(0)?.smooth);
			assert.equal(widget.getAttribute("transitions"), original);
			widget.setAttribute("transitions", bent);
			await widget.updateComplete;
			assert.deepInclude(widget.automaton.getTransition(0)?.smooth as object, { roundness: 0.4 });
		});

		it("saves the authored PDA starting stack and reopens without the simulation stack", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			widget.setAttribute("type", "pda");
			widget.setAttribute("nodes", "#0(0|0);%1(150|0)");
			widget.setAttribute("transitions", "0-1[a{p|X|}]");
			widget.setAttribute("startingstack", '["Z"]');
			document.body.append(widget);
			await widget.updateComplete;
			const stack = widget.shadowRoot!.querySelector<StackExtension>("stack-extension")!;
			await stack.updateComplete;
			assert.deepEqual(stack.getStack(), ["Z"]);
			stack.shadowRoot!.querySelector<HTMLElement>(".pda__stack-button")!.click();
			assert.equal(widget.getAttribute("startingstack"), '["Z","a"]');
			widget.mode = "simulate";
			await widget.updateComplete;
			const simulator = widget.automaton.simulator;
			simulator.word = "a";
			simulator.simulate();
			assert.deepEqual(stack.getStack(), ["Z", "a", "X"]);
			assert.equal(widget.getAttribute("startingstack"), '["Z","a"]');
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
			widget.setAttribute("startingstack", '["Z"]');
			await widget.updateComplete;
			assert.deepEqual(stack.getStack(), ["Z"], "An authored undo replaces the simulation display");
			widget.setAttribute("startingstack", '["Z","a"]');
			await widget.updateComplete;
			assert.deepEqual(stack.getStack(), ["Z", "a"]);
		});

		it("moves the initial arrow clear of a nearby node or transition", async () => {
			const widget = document.createElement("webwriter-automaton") as AutomatonComponent;
			widget.setAttribute("nodes", "#0(0|0);1(-220|0)");
			widget.setAttribute("transitions", "1-0[a]");
			document.body.append(widget);
			await widget.updateComplete;
			await widget.updateComplete;
			const { network } = (widget as unknown as { graph: Graph }).graph;
			const position = () => network.getPositions([-1])[-1];
			assert.isAbove(Math.abs(position().y), 20, "The arrow avoids the incoming transition");
			widget.removeAttribute("transitions");
			await widget.updateComplete;
			assert.isBelow(position().x, 0);
			assert.closeTo(position().y, 0, 1, "The arrow points from the left when clear");
			widget.setAttribute("nodes", "#0(0|0);1(-65|0)");
			await widget.updateComplete;
			assert.isAbove(Math.abs(position().y), 20, "The arrow moves when a node obstructs it");
			assert.equal(widget.getAttribute("nodes"), "#0(0|0);1(-65|0)");
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

			widget.setAttribute("nodes", "#0(0|0)");
			widget.setAttribute("transitions", "0-0[]");
			await widget.updateComplete;
			assert.isTrue(simulate.disabled, "An invalid transition blocks simulation");
			widget.setAttribute("transitions", "0-0[a]");
			await widget.updateComplete;
			assert.isFalse(simulate.disabled);
			assert.isNull(root.querySelector(".warning-panel--all"));
			shortcut();
			await widget.updateComplete;
			assert.equal(widget.mode, "simulate");

			widget.setAttribute("nodes", "0(0|0)");
			await widget.updateComplete;
			assert.isTrue(simulate.disabled, "Removing the initial flag blocks simulation");
			assert.isTrue(root.querySelector<HTMLElement>("#simulatorMenu")!.hidden);
			widget.setAttribute("nodes", "#0(0|0)");
			await widget.updateComplete;
			assert.isFalse(simulate.disabled);
			widget.removeAttribute("nodes");
			await widget.updateComplete;
			assert.isTrue(simulate.disabled, "Removing the graph blocks simulation again");
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
				assert.equal(help.scrollWidth, help.clientWidth, "German help text wraps");
				panel.querySelector<HTMLElement>("sl-button:has(.bi-question-lg)")!.click();
				const definition = panel.querySelector("sl-popup:has(.bi-code-slash)")!;
				definition.querySelector<HTMLElement>("sl-button")!.click();
				await layout();
				assertInside(definition.querySelector(".topmenu__popup")!);
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
			const plus = root.querySelector("#toolMenu")!.shadowRoot!.querySelector("sl-button")!;
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
