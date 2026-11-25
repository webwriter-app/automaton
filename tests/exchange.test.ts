/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-automaton";
import type { Widget } from "./helpers";
import { cleanup, dataOf, enterEditMode, frames, modes, mount, until } from "./helpers";
import { danglingJff, noFromJff, noToJff, dfaJff, nfaJff, notXml, pdaJff, turingJff, unsupportedPdaJff } from "./fixtures/jflap";

mocha.setup(getMochaConfig());

const data = JSON.stringify({
	format: "webwriter-automaton", version: 1, type: "dfa",
	states: [
		{ id: 0, label: "q0", x: -100, y: 0, initial: true },
		{ id: 1, label: "q1", x: 100, y: 0, final: true },
	],
	transitions: [
		{ id: 0, from: 0, to: 1, rules: [{ read: "a" }] },
		{ id: 1, from: 1, to: 1, rules: [{ read: "b" }, { read: "a" }], loopAngle: 90 },
	],
});

async function mountWidget(block = data, editor = false) {
	mount().innerHTML = `<div><webwriter-automaton style="width: 800px">${block ? `<script type="application/json" slot="data">${block}</script>` : ""}</webwriter-automaton></div>`;
	const widget = document.querySelector("#mount webwriter-automaton") as Widget;
	if (editor) enterEditMode(widget);
	await widget.updateComplete; await frames(6);
	return widget;
}
const file = (text: string, name: string) => new File([text], name, { type: "application/xml" });
const apply = async (widget: Widget, text: string) => {
	const run = await (widget.constructor as any).convertFrom[".jff"].call(widget, file(text, "x.jff"));
	run();
	await widget.updateComplete; await frames(4);
};
const exported = (widget: Widget, key: string) => (widget.constructor as any).convertTo[key].call(widget);

describe("Conversions", function () {
	afterEach(cleanup);

	it("declares the JFLAP file and the other targets in both places", async function () {
		const widget = await mountWidget();
		const klass = widget.constructor as any;
		assert.deepEqual(Object.keys(klass.convertFrom), [".jff"]);
		assert.deepEqual(Object.keys(klass.convertTo).sort(), [".jff", "image/svg+xml", "table"]);
	});

	for (const mode of modes) {
		describe(`in ${mode} mode`, function () {
			const editor = mode === "edit";

			it("imports a DFA, centres it and keeps the alphabet", async function () {
				const widget = await mountWidget(data, editor);
				await apply(widget, dfaJff);
				const result = dataOf(widget);
				assert.equal(result.type, "dfa");
				assert.deepEqual(result.states.map((state: any) => [state.label, state.x, state.y, !!state.initial, !!state.final]),
					[["q0", -100, 0, true, false], ["q1", 100, 0, false, true]]);
				assert.deepEqual(result.transitions.map((edge: any) => [edge.from, edge.to, edge.rules.map((rule: any) => rule.read)]),
					[[0, 1, ["a"]], [0, 0, ["b"]], [1, 1, ["a"]], [1, 0, ["b"]]]);
				await until(() => widget.shadowRoot!.querySelectorAll("ww-node.state").length === 2, "the states show");
			});

			it("imports an NFA when a transition reads nothing", async function () {
				const widget = await mountWidget(data, editor);
				await apply(widget, nfaJff);
				assert.equal(dataOf(widget).type, "nfa");
				assert.equal(dataOf(widget).transitions[0].rules[0].read, "");
			});

			it("imports a PDA and maps pop and push to its operations", async function () {
				const widget = await mountWidget(data, editor);
				await apply(widget, pdaJff);
				const result = dataOf(widget);
				assert.equal(result.type, "pda");
				assert.deepEqual(result.transitions.map((edge: any) => edge.rules[0].stack),
					[{ op: "push", symbol: "A" }, { op: "pop", symbol: "A" }, { op: "pop", symbol: "A" }]);
			});

			it("imports into a widget without a data block", async function () {
				const widget = await mountWidget("", editor);
				await apply(widget, dfaJff);
				assert.equal(dataOf(widget).states.length, 2);
				assert.equal(widget.querySelectorAll(':scope > script[slot="data"]').length, 1);
			});

			it("rejects invalid files before it changes anything", async function () {
				const widget = await mountWidget(data, editor);
				const before = widget.querySelector("script")!.textContent;
				for (const text of [notXml, turingJff, unsupportedPdaJff, noFromJff, noToJff, danglingJff, "<structure><type>fa</type><automaton/></structure>"]) {
					let message = "";
					try { await (widget.constructor as any).convertFrom[".jff"].call(widget, file(text, "x.jff")); } catch (error) { message = (error as Error).message; }
					assert.isAbove(message.length, 0, text);
				}
				assert.equal(widget.querySelector("script")!.textContent, before);
			});

			it("declines a machine type the widget does not allow and keeps the accepted signal false after an import", async function () {
				const widget = await mountWidget(data, editor);
				widget.allowedTypes = ["dfa"];
				const before = widget.querySelector("script")!.textContent;
				let message = "";
				try { await (widget.constructor as any).convertFrom[".jff"].call(widget, file(pdaJff, "x.jff")); } catch (error) { message = (error as Error).message; }
				assert.isAbove(message.length, 0);
				assert.equal(widget.querySelector("script")!.textContent, before);
				(widget as any).signals.accepted;
				widget.shadowRoot!.querySelector("#simulatorMenu")!.dispatchEvent(new CustomEvent("simulation-result", { detail: true }));
				assert.isTrue((widget as any).signals.accepted.get());
				await apply(widget, dfaJff);
				assert.isFalse((widget as any).signals.accepted.get());
			});

			it("exports a JFLAP file that imports to the same automaton", async function () {
				const widget = await mountWidget(data, editor);
				const exportedFile: File = exported(widget, ".jff");
				assert.isTrue(exportedFile.name.endsWith(".jff"));
				const text = await exportedFile.text();
				assert.include(text, "<type>fa</type>");
				const other = await mountWidget("", editor);
				await apply(other, text);
				const [a, b] = [dataOf(widget), dataOf(other)];
				assert.deepEqual(b.states, a.states);
				assert.equal(b.type, a.type);
				assert.deepEqual(b.transitions.map((edge: any) => [edge.from, edge.to, edge.rules]), [[0, 1, [{ read: "a" }]], [1, 1, [{ read: "b" }, { read: "a" }]]]);
			});

			it("round-trips a PDA through JFLAP", async function () {
				const widget = await mountWidget("", editor);
				await apply(widget, pdaJff);
				const text = await (exported(widget, ".jff") as File).text();
				assert.include(text, "<type>pda</type>");
				const other = await mountWidget("", editor);
				await apply(other, text);
				assert.deepEqual(dataOf(other).transitions, dataOf(widget).transitions);
			});

			it("exports the transitions as a table", async function () {
				const widget = await mountWidget(data, editor);
				const table = exported(widget, "table") as HTMLTableElement;
				assert.equal(table.localName, "table");
				assert.isNull(table.parentNode);
				const rows = [...table.rows].map(row => [...row.cells].map(cell => cell.textContent));
				assert.deepEqual(rows, [["State", "a", "b"], ["→ q0", "q1", ""], ["* q1", "q1", "q1"]]);
			});

			it("exports a PDA table with one row per rule", async function () {
				const widget = await mountWidget("", editor);
				await apply(widget, pdaJff);
				const table = exported(widget, "table") as HTMLTableElement;
				assert.deepEqual([...table.rows[1].cells].map(cell => cell.textContent), ["q0", "a", "ε", "A", "q0"]);
				assert.equal(table.rows.length, 4);
			});

			it("exports the diagram as an SVG file", async function () {
				const widget = await mountWidget(data, editor);
				const svg: File = await exported(widget, "image/svg+xml");
				assert.isTrue(svg.name.endsWith(".svg"));
				const doc = new DOMParser().parseFromString(await svg.text(), "image/svg+xml");
				assert.isNull(doc.querySelector("parsererror"));
				assert.equal(doc.documentElement.localName, "svg");
				assert.equal(doc.querySelectorAll("circle").length, 3);
			});

			it("exports nothing for an empty automaton", async function () {
				const widget = await mountWidget("", editor);
				assert.isNull(exported(widget, ".jff"));
				assert.isNull(exported(widget, "table"));
			});
		});
	}
});

describe("Options", function () {
	afterEach(cleanup);

	it("an option of the drawer is stored as an attribute and the widget follows it", async function () {
		const widget = await mountWidget(data, true) as any;
		assert.isTrue("allowedTypeOptions" in (widget.constructor as any).options);
		widget.allowedTypeOptions = ["dfa"];
		await widget.updateComplete;
		assert.equal(widget.getAttribute("allowedtypes"), "dfa");
		assert.deepEqual(widget.allowedTypes, ["dfa"]);
	});
});

describe("Signals", function () {
	afterEach(cleanup);

	it("publishes accepted as a stable boolean signal", async function () {
		const widget = await mountWidget();
		const signal = (widget as any).signals.accepted;
		assert.strictEqual((widget as any).signals.accepted, signal);
		assert.isFalse(signal.get());
		const menu = widget.shadowRoot!.querySelector("#simulatorMenu")!;
		menu.dispatchEvent(new CustomEvent("simulation-result", { detail: true }));
		assert.isTrue(signal.get());
		menu.dispatchEvent(new CustomEvent("simulation-result", { detail: false }));
		assert.isFalse(signal.get());
	});

	it("turns true when a simulation accepts the word and false again on reset", async function () {
		const complete = JSON.parse(data);
		complete.transitions.push({ id: 2, from: 0, to: 0, rules: [{ read: "b" }], loopAngle: 90 });
		const widget = await mountWidget(JSON.stringify(complete));
		widget.mode = "simulate";
		await widget.updateComplete; await frames(4);
		const menu = widget.shadowRoot!.querySelector("#simulatorMenu") as any;
		widget.automaton.simulator.word = "a";
		menu.run();
		await until(() => (widget as any).signals.accepted.get(), "the word is accepted");
		menu.reset();
		await until(() => !(widget as any).signals.accepted.get(), "the result is cleared");
	});
});

mocha.run();
