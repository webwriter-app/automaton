/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-automaton";
import type { Widget } from "./helpers";
import { cleanup, enterEditMode, equal, frames, key, modes, mount, point, pointer, until } from "./helpers";

mocha.setup(getMochaConfig());

const machine = (stack = ["A", "B", "C"]) => JSON.stringify({
	format: "webwriter-automaton", version: 1, type: "pda",
	states: [{ id: 0, label: "q0", x: -100, y: 0, initial: true }, { id: 1, label: "q1", x: 100, y: 0, final: true }],
	transitions: [{ id: 0, from: 0, to: 1, rules: [{ read: "a", stack: { op: "none" } }] }],
	startingStack: stack,
});
const stackOf = (widget: Element) =>
	JSON.parse(widget.querySelector(':scope > script[slot="data"]')!.textContent!).startingStack;

/** Mounts a PDA with a starting stack of three items. */
async function mountPda({ attributes = "", editor = false, lang = "" } = {}) {
	mount().innerHTML = `<div ${lang ? `lang="${lang}"` : ""}><webwriter-automaton style="width: 600px" ${attributes}><script type="application/json" slot="data">${machine()}</script></webwriter-automaton></div>`;
	const widget = document.querySelector("#mount webwriter-automaton") as Widget;
	if (editor) enterEditMode(widget);
	await until(() => widget.shadowRoot?.querySelector("stack-extension")?.shadowRoot?.querySelectorAll(".pda__stack-item").length === 3, "the stack shows three items");
	const stack = widget.shadowRoot!.querySelector("stack-extension") as HTMLElement & { updateComplete: Promise<unknown> };
	await stack.updateComplete;
	const root = stack.shadowRoot!;
	// Synthetic events have no browser pointer to capture.
	for (const grip of root.querySelectorAll<HTMLElement>(".pda__stack-grip")) grip.setPointerCapture = () => {};
	return { widget, stack, root };
}

async function hold(grip: Element, target: Element, fy = 0.5) {
	const start = point(grip);
	pointer(grip, "pointerdown", start);
	pointer(grip, "pointermove", { clientX: start.clientX + 6, clientY: start.clientY + 6 });
	await frames(2);
	pointer(grip, "pointermove", point(target, 0.5, fy));
	await frames(2);
}
const settle = async (stack: { updateComplete: Promise<unknown> }) => { await frames(6); await stack.updateComplete; await frames(2); };
const grips = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>(".pda__stack-grip")];
const items = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>(".pda__stack-item")];

describe("PDA stack", function () {
	afterEach(cleanup);

	for (const mode of modes) {
		const editor = mode === "edit";

		describe(`in ${mode} mode`, function () {
			it("a grip dragged below the last item moves the item there", async function () {
				const { widget, stack, root } = await mountPda({ editor });
				const last = items(root)[2];
				await hold(grips(root)[0], last, 0.9);
				assert.exists(root.querySelector("[data-ww-drop-marker]"), "a drop marker shows");
				assert.isTrue(items(root)[0].hasAttribute("data-ww-dragging"), "the dragged item is marked");
				pointer(grips(root)[0], "pointerup", point(last, 0.5, 0.9));
				await settle(stack);
				equal(stackOf(widget), ["C", "A", "B"]);
				assert.isNotOk(root.querySelector("[data-ww-drop-marker]") || root.querySelector("[data-ww-dragging]"), "no drag state is left");
			});

			it("pointercancel leaves the stack as it is", async function () {
				const { widget, stack, root } = await mountPda({ editor });
				await hold(grips(root)[0], items(root)[2], 0.9);
				pointer(grips(root)[0], "pointercancel", point(items(root)[2]));
				await settle(stack);
				equal(stackOf(widget), ["A", "B", "C"]);
				assert.isNotOk(root.querySelector("[data-ww-drop-marker]"), "the marker is gone");
			});

			it("Escape cancels a drag", async function () {
				const { widget, stack, root } = await mountPda({ editor });
				await hold(grips(root)[0], items(root)[2], 0.9);
				key(window, "Escape");
				await settle(stack);
				equal(stackOf(widget), ["A", "B", "C"]);
				assert.isNotOk(root.querySelector("[data-ww-dragging]"), "no item is dragged");
			});

			it("dropping on the round button removes the item", async function () {
				const { widget, stack, root } = await mountPda({ editor });
				const button = root.querySelector(".pda__stack-button")!;
				assert.isFalse(button.hasAttribute("data-ww-drop-over"));
				await hold(grips(root)[1], button);
				assert.isTrue(button.hasAttribute("data-ww-drop-over"), "the button shows that it takes the item");
				assert.equal(button.getAttribute("aria-label"), "Remove stack item", "the button is the trash while an item is held");
				pointer(grips(root)[1], "pointerup", point(button));
				await settle(stack);
				equal(stackOf(widget), ["A", "C"]);
				assert.equal(button.getAttribute("aria-label"), "Add symbol", "the button adds again");
			});

			it("Space, an arrow key and Enter reorder with the keyboard", async function () {
				const { widget, stack, root } = await mountPda({ editor });
				const grip = grips(root)[0];
				grip.focus();
				key(grip, " ");
				await frames(2);
				assert.isTrue(items(root)[0].hasAttribute("data-ww-dragging"), "Space picks the item up");
				key(grip, "ArrowDown"); await frames(2);
				key(grip, "Enter");
				await settle(stack);
				const result: string[] = stackOf(widget);
				assert.notEqual(result.join(""), "ABC", `the order changed: ${result}`);
				assert.equal(result.slice().sort().join(""), "ABC", `no item was lost: ${result}`);
			});
		});
	}

	describe("permissions and modes", function () {
		it("with only change allowed the round button is no drop target and items still reorder", async function () {
			const { widget, stack, root } = await mountPda({ attributes: 'permissions="771"' });
			await until(() => grips(root).length === 3, "grips show");
			assert.isFalse(root.querySelector(".pda__stack-button")!.hasAttribute("data-ww-drop"), "no trash without delete");
			await hold(grips(root)[0], items(root)[2], 0.9);
			pointer(grips(root)[0], "pointerup", point(items(root)[2], 0.5, 0.9));
			await settle(stack);
			equal(stackOf(widget), ["C", "A", "B"]);
		});

		it("with only delete allowed the list takes no drop and the button still removes", async function () {
			const { widget, stack, root } = await mountPda({ attributes: 'permissions="772"' });
			await until(() => grips(root).length === 3, "grips show");
			assert.isFalse(root.querySelector(".pda__stack-items")!.hasAttribute("data-ww-drop"), "the list is no target without change");
			await hold(grips(root)[0], items(root)[2], 0.9);
			assert.isNotOk(root.querySelector("[data-ww-drop-marker]"), "no marker over the list");
			pointer(grips(root)[0], "pointerup", point(items(root)[2], 0.5, 0.9));
			await settle(stack);
			equal(stackOf(widget), ["A", "B", "C"]);
			const button = root.querySelector(".pda__stack-button")!;
			await hold(grips(root)[0], button);
			pointer(grips(root)[0], "pointerup", point(button));
			await settle(stack);
			equal(stackOf(widget), ["A", "B"], "the top item, the first in the list, is gone");
		});

		it("without stack permissions and in simulate mode there are no grips and nothing drags", async function () {
			let { widget, root } = await mountPda({ attributes: 'permissions="770"' });
			await frames(4);
			equal(grips(root).length, 0);
			cleanup();
			({ widget, root } = await mountPda({}));
			widget.mode = "simulate";
			await widget.updateComplete; await frames(4);
			equal(grips(root).length, 0);
			assert.isFalse(items(root).some(item => item.hasAttribute("data-ww-drag")), "no item is draggable");
		});
	});

	describe("language", function () {
		it("the widget, its stack and its drawer labels follow lang", async function () {
			const { widget, stack, root } = await mountPda({ lang: "de-DE" });
			const label = () => widget.shadowRoot!.querySelector(".mode_switch__label")!.textContent!.trim();
			await until(() => label() === "Bearbeiten", "German labels show");
			assert.equal(root.querySelector(".pda__stack-title")!.textContent, "Stapel");
			const sinkLabel = () => (widget.options as unknown as Record<string, { label: string }>).sinkStateEnabled.label;
			assert.equal(sinkLabel(), "Fangzustand aktivieren");
			let changes = 0;
			widget.addEventListener("optionschange", () => changes++);
			widget.parentElement!.lang = "en-GB";
			await until(() => label() === "Edit", "English labels show");
			await stack.updateComplete;
			assert.equal(root.querySelector(".pda__stack-title")!.textContent, "Stack");
			assert.equal(sinkLabel(), "Enable sink state");
			assert.isAbove(changes, 0, "the editor is told to read the declarations again");
		});
	});
});

mocha.run();
