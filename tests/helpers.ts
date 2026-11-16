import { assert } from "chai";
import type { AutomatonComponent } from "../src/widgets/webwriter-automaton";

export type Point = { clientX: number; clientY: number };
export type Mode = "read" | "edit";
export const modes: Mode[] = ["read", "edit"];

export const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
export const frames = async (count = 3) => { for (let i = 0; i < count; i++) await frame(); };

/** Waits until `fn` returns something truthy, one animation frame at a time. */
export async function until<T>(fn: () => T, message: string, timeout = 5000): Promise<NonNullable<T>> {
	const end = performance.now() + timeout;
	for (;;) {
		const value = fn();
		if (value) return value as NonNullable<T>;
		if (performance.now() > end) throw new Error(message);
		await frame();
	}
}

export const mount = () => {
	const element = document.createElement("div");
	element.id = "mount";
	document.body.append(element);
	return element;
};

/** Removes everything a test mounted and leaves edit mode. */
export const cleanup = () => {
	document.querySelectorAll("#mount").forEach(element => element.remove());
	document.designMode = "off";
};

/** Makes the widget look the way WebWriter's editor makes a widget in edit mode. */
export const enterEditMode = (widget: Element) => {
	widget.setAttribute("contenteditable", "");
	document.designMode = "on";
};

export const point = (element: Element, fx = 0.5, fy = 0.5): Point => {
	const { left, top, width, height } = element.getBoundingClientRect();
	return { clientX: left + width * fx, clientY: top + height * fy };
};
export const shifted = (at: Point, dx: number, dy: number): Point => ({ clientX: at.clientX + dx, clientY: at.clientY + dy });

export const pointer = (target: EventTarget, type: string, at: Point) => target.dispatchEvent(new PointerEvent(type, {
	...at, bubbles: true, composed: true, cancelable: true, isPrimary: true, pointerId: 3, pointerType: "mouse", button: 0,
}));
export const key = (target: EventTarget, name: string) => target.dispatchEvent(new KeyboardEvent("keydown", {
	key: name, bubbles: true, composed: true, cancelable: true,
}));

export async function drag(target: Element, from: Point, to: Point) {
	pointer(target, "pointerdown", from);
	pointer(target, "pointermove", shifted(from, 6, 6));
	await frames(2);
	pointer(target, "pointermove", to);
	await frames(2);
	pointer(target, "pointerup", to);
	await frames(3);
}

export const dataOf = (widget: Element) =>
	JSON.parse(widget.querySelector(':scope > script[slot="data"]')!.textContent!);

export function equal(actual: unknown, expected: unknown, message = "values differ") {
	assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

export type Widget = AutomatonComponent;
