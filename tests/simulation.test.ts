import "mocha/mocha.js";
import { getMochaConfig } from "@webwriter/build/test";
import { assert } from "chai";
import "../src";
import { AutomatonComponent } from "../src";
import type { StackExtension } from "../src/automata/pda";
import type { Graph } from "../src/graph";

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
	});

	describe("Responsive layout", () => {
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
			widget.style.height = "1200px";
			assert.equal(widget.getBoundingClientRect().height, 900);
		});

		it("adapts the menus, graph and PDA stack to the widget width", async () => {
			const widget = await createConfiguredPDA();
			widget.style.height = "300px";
			widget.mode = "simulate";
			await widget.updateComplete;
			const root = widget.shadowRoot!;
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
				const input = simulator.querySelector("#wordInput")!.getBoundingClientRect();
				const buttons = Array.from(simulator.querySelectorAll(".simulator_buttons"))
					.find(group => group.getClientRects().length)!.getBoundingClientRect();
				assert.equal(buttons.top >= input.bottom, compact, `${width}px simulator rows`);
				assert.isAtMost(buttons.right, widget.getBoundingClientRect().right, `${width}px playback controls fit`);
				const canvas = graph.getBoundingClientRect();
				const stackPanel = panel.getBoundingClientRect();
				assert.closeTo(graph.querySelector("canvas")!.getBoundingClientRect().width, canvas.width, 1);
				assert.isAtLeast(input.top, canvas.bottom, `${width}px input clears the canvas`);
				assert.equal(stackPanel.left >= canvas.right, width >= 800, `${width}px stack docking`);
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
