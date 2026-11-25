/// <reference types="mocha" />
import "mocha/mocha.js";
import { assert } from "chai";
import { getMochaConfig } from "@webwriter/build/test";
import "../src/widgets/webwriter-automaton";
import type { Widget } from "./helpers";
import { cleanup, dataOf, drag, enterEditMode, equal, frames, key, modes, mount, point, pointer, shifted, until } from "./helpers";

mocha.setup(getMochaConfig());

const diagramData = (extra = {}) => JSON.stringify({
	format: "webwriter-automaton", version: 1, type: "dfa",
	states: [
		{ id: 0, label: "q0", x: -100, y: 0, initial: true },
		{ id: 1, label: "q1", x: 100, y: 0, final: true },
		{ id: 2, label: "q2", x: 0, y: 130 },
	],
	transitions: [
		{ id: 0, from: 0, to: 1, rules: [{ read: "a" }] },
		{ id: 1, from: 1, to: 1, rules: [{ read: "b" }], loopAngle: 90 },
	],
	...extra,
});

async function mountDiagram({ editor = false, attributes = "", data = diagramData() } = {}) {
	mount().innerHTML = `<div><webwriter-automaton style="width: 800px" ${attributes}><script type="application/json" slot="data">${data}</script></webwriter-automaton></div>`;
	const widget = document.querySelector("#mount webwriter-automaton") as Widget;
	if (editor) enterEditMode(widget);
	await until(() => widget.shadowRoot?.querySelectorAll("ww-node.state").length === JSON.parse(data).states.length, "the states show");
	await widget.updateComplete; await frames(8);
	const scene = widget.shadowRoot!.querySelector("ww-scene") as HTMLElement;
	return { widget, scene, root: widget.shadowRoot! };
}
const states = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>("ww-node.state")];
const stateOf = (root: ParentNode, id: number) => root.querySelector<HTMLElement>(`ww-node[data-ww-key="n${id}"]`)!;
const edgesOf = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>("ww-path[data-ww-key]")];
const settle = async (widget: Widget) => { await widget.updateComplete; await frames(6); await widget.updateComplete; await frames(3); };
async function select(widget: Widget, root: ParentNode, id: number) {
	const node = stateOf(root, id);
	const at = point(node);
	pointer(node, "pointerdown", at);
	pointer(node, "pointerup", at);
	await settle(widget);
	return node;
}
const transitionsOf = (widget: Widget): { from: number; to: number; rules: unknown[]; bend?: number }[] => dataOf(widget).transitions;
const statesOf = (widget: Widget): { id: number; x: number; y: number; label: string; initial?: boolean }[] => dataOf(widget).states;
/** A press and release, twice in a row: the scene reports a double click on the background from these. */
async function dblclick(target: EventTarget, at: { clientX: number; clientY: number }) {
	for (let i = 0; i < 2; i++) {
		pointer(target, "pointerdown", at);
		pointer(target, "pointerup", at);
		await frames(2);
	}
}

describe("Diagram on Scene", function () {
	afterEach(cleanup);

	for (const mode of modes) {
		const editor = mode === "edit";

		describe(`in ${mode} mode`, function () {
			it("states, arrows, labels and the initial arrow are drawn from the data block", async function () {
				const { widget, scene, root } = await mountDiagram({ editor });
				equal(states(root).map(state => state.getAttribute("aria-label")), ["q0", "q1", "q2"]);
				equal(states(root).map(state => state.classList.contains("final")), [false, true, false]);
				assert.equal(edgesOf(root).length, 2, "one path per transition");
				assert.equal(root.querySelectorAll("ww-text.label").length, 2, "one label per transition");
				assert.exists(root.querySelector("ww-path:not([data-ww-key])"), "the initial arrow is drawn");
				// A state is centred on its stored position: the scene position is the top-left corner.
				equal([stateOf(root, 0).getAttribute("x"), stateOf(root, 0).getAttribute("y")], ["-125", "-25"]);
				assert.isTrue(scene.matches('[data-ww-viewport="canvas"]'), "the scene is the window of a canvas viewport");
				assert.isTrue(!root.querySelector("canvas") || !!scene.shadowRoot, "no second canvas of another library");
				equal(Object.keys(dataOf(widget)).sort(), ["format", "states", "transitions", "type", "version"], "the data block keeps its format");
			});

			it("dragging a state moves it and writes its position as one undo step", async function () {
				const { widget, root } = await mountDiagram({ editor });
				const log: string[] = [];
				widget.addEventListener("ww-transactionstart", () => log.push("start"));
				widget.addEventListener("ww-transactionend", () => log.push("end"));
				const node = stateOf(root, 2);
				const at = point(node);
				const scale = widget.viewport!.scale;
				await drag(node, at, shifted(at, 60, 30));
				await settle(widget);
				const moved = statesOf(widget).find(state => state.id === 2)!;
				assert.isTrue(Math.abs(moved.x - 60 / scale) <= 1 && Math.abs(moved.y - (130 + 30 / scale)) <= 1, `q2 moved by the drag: ${JSON.stringify(moved)}`);
				assert.equal(statesOf(widget).find(state => state.id === 0)!.x, -100, "other states stay");
				equal(log, ["start", "end"], "one transaction around the change");
				assert.equal(stateOf(root, 2).getAttribute("x"), String(moved.x - 25), "the template follows the model");
			});

			it("a drag from a connection point to another state adds a transition", async function () {
				const { widget, root } = await mountDiagram({ editor });
				assert.equal(root.querySelectorAll(".state__port").length, 0, "no connection points while nothing is selected");
				await select(widget, root, 0);
				const ports = [...root.querySelectorAll<HTMLElement>(".state__port")];
				equal(ports.map(port => port.dataset.wwPort), ["top", "right", "bottom", "left"]);
				const from = ports.find(port => port.dataset.wwPort === "bottom")!;
				await drag(from, point(from), point(stateOf(root, 2)));
				await settle(widget);
				const added = transitionsOf(widget).find(edge => edge.from === 0 && edge.to === 2);
				assert.exists(added, "a transition from q0 to q2 was added");
				equal(added!.rules, [{ read: "a" }]);
				assert.equal(edgesOf(root).length, 3);
				// Once more: the symbol is added to the same transition.
				await select(widget, root, 0);
				const again = root.querySelector<HTMLElement>('.state__port[data-ww-port="bottom"]')!;
				await drag(again, point(again), point(stateOf(root, 2)));
				await settle(widget);
				assert.equal(transitionsOf(widget).filter(edge => edge.from === 0 && edge.to === 2).length, 1);
				assert.equal(transitionsOf(widget).find(edge => edge.from === 0 && edge.to === 2)!.rules.length, 2);
			});

			it("connecting to the same state makes a loop, and the reverse of an arrow bends both", async function () {
				const { widget, root } = await mountDiagram({ editor });
				await select(widget, root, 2);
				const port = root.querySelector<HTMLElement>('.state__port[data-ww-port="right"]')!;
				await drag(port, point(port), point(stateOf(root, 2)));
				await settle(widget);
				assert.isTrue(transitionsOf(widget).some(edge => edge.from === 2 && edge.to === 2), "a loop on q2");

				await select(widget, root, 1);
				const left = root.querySelector<HTMLElement>('.state__port[data-ww-port="left"]')!;
				await drag(left, point(left), point(stateOf(root, 0)));
				await settle(widget);
				const forward = transitionsOf(widget).find(edge => edge.from === 0 && edge.to === 1)!;
				const backward = transitionsOf(widget).find(edge => edge.from === 1 && edge.to === 0)!;
				equal([forward.bend, backward.bend], [0.2, 0.2], "both arrows are bent apart");
			});

			it("Delete removes the selected state with its transitions", async function () {
				const { widget, root } = await mountDiagram({ editor });
				await select(widget, root, 1);
				assert.isTrue(stateOf(root, 1).hasAttribute("selected"), "the state shows as selected");
				assert.exists(root.querySelector(".editing-bar"), "the editing bar shows");
				widget.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, composed: true, cancelable: true }));
				await settle(widget);
				equal(statesOf(widget).map(state => state.id), [0, 2]);
				equal(transitionsOf(widget), [], "both transitions of q1 went with it");
				assert.isNotOk(stateOf(root, 1), "the state is gone from the scene");
			});

			it("a double click on the background adds a state, one on a state does not", async function () {
				const { widget, scene, root } = await mountDiagram({ editor });
				const box = scene.getBoundingClientRect();
				await dblclick(scene, { clientX: box.left + 100, clientY: box.top + 60 });
				await settle(widget);
				assert.equal(statesOf(widget).length, 4);
				assert.equal(statesOf(widget)[3].label, "q3");
				assert.isNotOk(statesOf(widget)[3].initial, "only the first state is initial");
				await dblclick(stateOf(root, 0), point(stateOf(root, 0)));
				await settle(widget);
				assert.equal(statesOf(widget).length, 4, "a double click on a state adds nothing");
			});
		});
	}

	describe("without permissions", function () {
		it("without the permission to add or change nothing moves, connects or is added", async function () {
			const { widget, scene, root } = await mountDiagram({ attributes: 'permissions="000"' });
			assert.isFalse(stateOf(root, 0).hasAttribute("movable"), "states are not movable");
			const node = stateOf(root, 2);
			const at = point(node);
			await drag(node, at, shifted(at, 50, 50));
			assert.equal(statesOf(widget).find(state => state.id === 2)!.y, 130);
			await select(widget, root, 0);
			assert.equal(root.querySelectorAll(".state__port").length, 0, "no connection points without edge-add");
			const box = scene.getBoundingClientRect();
			await dblclick(scene, { clientX: box.left + 100, clientY: box.top + 60 });
			await settle(widget);
			assert.equal(statesOf(widget).length, 3);
		});
	});

	describe("simulation", function () {
		it("in simulate mode states are fixed and a click on a transition is reported", async function () {
			const { widget, root } = await mountDiagram();
			widget.mode = "simulate";
			await settle(widget);
			assert.isFalse(stateOf(root, 0).hasAttribute("movable") || stateOf(root, 0).hasAttribute("selectable"), "states take no editing");
			const selected: unknown[] = [];
			widget.graph!.addEventListener("edge-select", event => selected.push((event as CustomEvent).detail));
			const path = edgesOf(root)[0];
			assert.isTrue(path.hasAttribute("selectable"), "transitions can be clicked");
			path.dispatchEvent(new CustomEvent("ww-select", { detail: { keys: ["e0"], items: [path] }, bubbles: true, composed: true, cancelable: true }));
			equal(selected, [0], "the click is reported as the transition's id");
			assert.equal(root.querySelectorAll("[selected]").length, 0, "nothing stays selected");
		});

		it("the simulation highlights a state and a transition", async function () {
			const { widget, root } = await mountDiagram();
			widget.automaton!.highlightNode(widget.automaton!.getNode(1)!);
			widget.automaton!.highlightTransition(widget.automaton!.getTransition(0)!);
			await settle(widget);
			assert.isTrue(stateOf(root, 1).classList.contains("active"), "the state is marked");
			assert.isTrue(edgesOf(root)[0].classList.contains("active"), "the transition is marked");
			widget.automaton!.clearHighlights();
			await settle(widget);
			assert.isFalse(stateOf(root, 1).classList.contains("active"), "cleared");
		});
	});

	describe("what the scene does for the editor", function () {
		afterEach(cleanup);

		const drawn = (scene: HTMLElement, path: Element) =>
			(scene as unknown as { drawingOf(item: Element): { points: { x: number; y: number }[] } | null }).drawingOf(path)!;
		const centre = (widget: Widget) => {
			const box = widget.shadowRoot!.querySelector("ww-scene")!.getBoundingClientRect();
			return widget.viewport.toWorld(box.left + box.width / 2, box.top + box.height / 2);
		};

		it("arrows follow a state while it is dragged, and the initial arrow does too", async function () {
			const { widget, scene, root } = await mountDiagram({ editor: true });
			const incoming = edgesOf(root).find(path => path.getAttribute("data-ww-key") === "e0")!;
			const initial = root.querySelector<HTMLElement>("ww-path:not([data-ww-key])") as HTMLElement & { points: { x: number; y: number }[] };
			const end = () => drawn(scene, incoming).points.at(-1)!;
			const tail = () => initial.points[0];
			const [endBefore, tailBefore] = [end(), tail()];
			const lead = stateOf(root, 1);
			const at = point(lead);
			pointer(lead, "pointerdown", at);
			pointer(lead, "pointermove", shifted(at, 6, 6));
			await frames(2);
			pointer(lead, "pointermove", shifted(at, 40, 40));
			await frames(3);
			assert.isAbove(Math.hypot(end().x - endBefore.x, end().y - endBefore.y), 10, "the arrow into q1 moves with it before the release");
			assert.equal(statesOf(widget).find(state => state.id === 1)!.x, 100, "the data is untouched until the release");
			pointer(lead, "pointerup", shifted(at, 40, 40));
			await frames(3);

			const first = stateOf(root, 0);
			const from = point(first);
			pointer(first, "pointerdown", from);
			pointer(first, "pointermove", shifted(from, 6, 6));
			await frames(2);
			pointer(first, "pointermove", shifted(from, 0, 50));
			await frames(3);
			assert.isAbove(Math.abs(tail().y - tailBefore.y), 10, "the arrow into the initial state moves with it");
			pointer(first, "pointerup", shifted(from, 0, 50));
			await settle(widget);
		});

		it("a wire held over a state shows the transition it would make, and the reverse arrow bends", async function () {
			const { widget, root } = await mountDiagram({ editor: true });
			await select(widget, root, 1);
			const port = root.querySelector<HTMLElement>('.state__port[data-ww-port="left"]')!;
			const from = point(port);
			pointer(port, "pointerdown", from);
			pointer(port, "pointermove", shifted(from, -6, 0));
			await frames(2);
			const over = point(stateOf(root, 0));
			pointer(port, "pointermove", over);
			await frames(3);
			await widget.updateComplete;
			assert.exists(root.querySelector("ww-path.planned:not([data-ww-key])"), "the new transition is drawn while the wire is held");
			assert.isTrue(edgesOf(root).find(path => path.getAttribute("data-ww-key") === "e0")!.hasAttribute("bend"), "the opposite arrow already bends");
			assert.equal(transitionsOf(widget).length, 2, "nothing is stored yet");
			pointer(port, "pointerup", over);
			await settle(widget);
			assert.isNull(root.querySelector("ww-path.planned"), "the preview is gone after the drop");
			assert.equal(transitionsOf(widget).length, 3);
		});

		it("a click on a connection point and then on the target connects", async function () {
			const { widget, root } = await mountDiagram({ editor: true });
			await select(widget, root, 0);
			const port = root.querySelector<HTMLElement>('.state__port[data-ww-port="bottom"]')!;
			const from = point(port);
			pointer(port, "pointerdown", from);
			pointer(port, "pointerup", from);
			await frames(3);
			assert.equal(transitionsOf(widget).length, 2, "the first click only picks the wire up");
			const target = stateOf(root, 2);
			const over = point(target);
			pointer(target, "pointermove", over);
			await frames(2);
			pointer(target, "pointerdown", over);
			pointer(target, "pointerup", over);
			await settle(widget);
			assert.isTrue(transitionsOf(widget).some(edge => edge.from === 0 && edge.to === 2), "the second click on q2 added the transition");
		});

		for (const mode of modes) {
			it(`the plain wheel zooms in ${mode} mode`, async function () {
				const { widget, scene } = await mountDiagram({ editor: mode === "edit" });
				const before = widget.viewport.scale;
				const box = scene.getBoundingClientRect();
				scene.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, clientX: box.left + 200, clientY: box.top + 150, bubbles: true, composed: true, cancelable: true }));
				await frames(3);
				assert.isAbove(widget.viewport.scale, before, "a turn forward zooms in");
				scene.dispatchEvent(new WheelEvent("wheel", { deltaY: 240, clientX: box.left + 200, clientY: box.top + 150, bubbles: true, composed: true, cancelable: true }));
				await frames(3);
				assert.isBelow(widget.viewport.scale, before * 1.5, "and a turn back zooms out");
			});
		}

		it("the centre of the view stays on the same place of the diagram when the widget is resized", async function () {
			const { widget } = await mountDiagram();
			widget.viewport.zoomTo(1.5);
			widget.viewport.panBy(40, 25);
			await frames(3);
			const before = centre(widget);
			widget.style.width = "560px";
			await frames(6);
			const after = centre(widget);
			assert.closeTo(after.x, before.x, 2);
			assert.closeTo(after.y, before.y, 2);
		});

		it("the first view shows the whole diagram at most at full size, and adding a state does not move it", async function () {
			const { widget, scene } = await mountDiagram({ editor: true });
			const { scale, x, y } = widget.viewport;
			assert.isAtMost(scale, 1);
			const box = scene.getBoundingClientRect();
			await dblclick(scene, { clientX: box.left + 60, clientY: box.top + 40 });
			await settle(widget);
			assert.equal(statesOf(widget).length, 4);
			equal([widget.viewport.scale, widget.viewport.x, widget.viewport.y], [scale, x, y], "the view stays");
		});

		it("an arrow key moves a selected state by 10 and writes it as one step", async function () {
			const { widget, root } = await mountDiagram({ editor: true });
			const node = await select(widget, root, 2);
			node.focus();
			const log: string[] = [];
			widget.addEventListener("ww-transactionstart", () => log.push("start"));
			widget.addEventListener("ww-transactionend", () => log.push("end"));
			key(node, "ArrowRight");
			key(node, "ArrowRight");
			node.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true, composed: true }));
			await until(() => statesOf(widget).find(state => state.id === 2)!.x === 20, "two presses moved it by 20");
			equal(log, ["start", "end"]);
		});

		it("a long press by touch on the background adds a state and a held mouse button does not", async function () {
			const query = window.matchMedia;
			window.matchMedia = (text: string) => {
				const list = query.call(window, text);
				if (text.includes("coarse")) Object.defineProperty(list, "matches", { value: true });
				return list;
			};
			try {
				const { widget, scene } = await mountDiagram({ editor: true });
				const box = scene.getBoundingClientRect();
				const press = async (pointerType: string, pointerId: number) => {
					const at = { clientX: box.left + 80, clientY: box.top + 50 };
					const init = { ...at, bubbles: true, composed: true, isPrimary: true, pointerId, pointerType, button: 0 };
					scene.dispatchEvent(new PointerEvent("pointerdown", init));
					await new Promise(resolve => setTimeout(resolve, 650));
					scene.dispatchEvent(new PointerEvent("pointerup", init));
					await settle(widget);
				};
				await press("mouse", 7);
				assert.equal(statesOf(widget).length, 3, "a held mouse button adds nothing");
				await press("touch", 8);
				assert.equal(statesOf(widget).length, 4, "a held finger does");
			} finally {
				window.matchMedia = query;
			}
		});
	});

	describe("printing and lifecycle", function () {
		it("the print figure shows the whole diagram as SVG and the view does not matter", async function () {
			const { widget, root } = await mountDiagram();
			const figure = root.querySelector(".print-machine")!;
			assert.equal(figure.querySelectorAll("svg circle").length, 4, "three states and the inner ring of the final one");
			assert.equal(figure.querySelectorAll("svg polyline[marker-end]").length, 3, "a line with an arrowhead per transition and the initial arrow");
			const before = figure.querySelector("svg")!.outerHTML;
			widget.viewport!.zoomBy(2);
			await settle(widget);
			assert.equal(figure.querySelector("svg")!.outerHTML, before);
		});

		it("a removed widget releases its editor and a reconnected one shows the authored data again", async function () {
			const { widget } = await mountDiagram();
			const parent = widget.parentElement!;
			widget.remove();
			const data = dataOf(widget);
			data.states[0].x = -150;
			widget.querySelector('script[slot="data"]')!.textContent = JSON.stringify(data);
			parent.append(widget);
			await settle(widget);
			assert.equal(states(widget.shadowRoot!).length, 3);
			assert.equal(stateOf(widget.shadowRoot!, 0).getAttribute("x"), "-175");
			equal(widget.getAttributeNames().filter(name => name !== "style"), [], "no attribute was added to the authored element");
			equal([...widget.children].map(child => child.localName), ["script"], "only the data block is authored content");
		});
	});
	describe("touch and theme", function () {
		it("a state is dragged by a finger", async function () {
			const { widget, root } = await mountDiagram({ editor: true });
			const node = stateOf(root, 2);
			const at = point(node);
			const touch = (type: string, to: { clientX: number; clientY: number }) => node.dispatchEvent(new PointerEvent(type, {
				...to, bubbles: true, composed: true, cancelable: true, isPrimary: true, pointerId: 11, pointerType: "touch", button: 0,
			}));
			touch("pointerdown", at);
			touch("pointermove", shifted(at, 6, 6));
			await frames(2);
			touch("pointermove", shifted(at, 60, 30));
			await frames(2);
			touch("pointerup", shifted(at, 60, 30));
			await settle(widget);
			assert.notEqual(statesOf(widget).find(state => state.id === 2)!.x, 0, "q2 moved by touch");
		});

		it("text color, font and accent colors come from the page theme and fall back to today's look", async function () {
			const { root, widget } = await mountDiagram({ editor: true, attributes: 'showhelp="false"' });
			assert.equal(getComputedStyle(widget).color, "rgb(0, 0, 0)", "no theme: black");
			const wrapper = widget.parentElement!;
			wrapper.setAttribute("style", "--ww-text-color: rgb(10, 20, 30); --ww-font-family: Georgia, serif; --ww-theme-accent-1: rgb(1, 2, 3)");
			await select(widget, root, 1);
			assert.equal(getComputedStyle(widget).color, "rgb(10, 20, 30)");
			assert.include(getComputedStyle(widget).fontFamily, "Georgia");
			assert.equal(getComputedStyle(stateOf(root, 1).querySelector(".state__ring")!).borderTopColor, "rgb(1, 2, 3)", "selected state takes accent 1");
			assert.equal(getComputedStyle(stateOf(root, 1).querySelector(".state__label")!).color, "rgb(10, 20, 30)", "state text takes the text color");
			assert.equal(root.querySelector("ww-scene")!.getAttribute("part"), "canvas");
		});
	});
});

mocha.run();
