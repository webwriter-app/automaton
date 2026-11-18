import type { Table } from "../model/transition-table";
import { transitionTable } from "../model/transition-table";
import type { AutomatonComponent } from "../widgets/webwriter-automaton";
import { readJflap, writeJflap } from "./jflap";

/** The handlers of the widget's `convertFrom` and `convertTo`; the widget is `this`. */
export async function importJff(this: AutomatonComponent, file: File) {
	const machine = readJflap(await file.text(), this.msg);
	if (!this.allowedTypes.includes(machine.type)) throw new Error(this.msg("This automaton type is not allowed in this widget."));
	return () => this.replaceMachine(machine);
}

export function exportJff(this: AutomatonComponent) {
	const machine = this.machineForExport();
	return machine && new File([writeJflap(machine)], "automaton.jff", { type: "application/xml" });
}

/** The print figure as a stand-alone SVG file on a white background; `null` if there is no figure. */
export async function exportSvg(this: AutomatonComponent) {
	await this.updateComplete;
	const figure = this.renderRoot.querySelector<SVGSVGElement>(".print-machine svg");
	if (!figure) return null;
	const copy = figure.cloneNode(true) as SVGSVGElement;
	const { x, y, width, height } = figure.viewBox.baseVal;
	copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	copy.setAttribute("width", String(Math.round(width)));
	copy.setAttribute("height", String(Math.round(height)));
	copy.removeAttribute("style");
	const background = copy.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect");
	for (const [name, value] of Object.entries({ x, y, width, height, fill: "#fff" })) background.setAttribute(name, String(value));
	copy.prepend(background);
	return new File([new XMLSerializer().serializeToString(copy)], "automaton.svg", { type: "image/svg+xml" });
}

/** The transitions as a detached `table`; a DFA or NFA gets row headers. */
export function exportTable(this: AutomatonComponent) {
	const machine = this.machineForExport();
	if (!machine) return null;
	const { msg } = this;
	const { columns, rows }: Table = transitionTable(machine, {
		state: msg("State"), from: msg("From"), read: msg("Read"), pop: msg("Pop"), push: msg("Push"), to: msg("To"),
	});
	const document = this.ownerDocument;
	const table = document.createElement("table");
	const header = table.createTHead().insertRow();
	for (const column of columns) header.append(Object.assign(document.createElement("th"), { scope: "col", textContent: column }));
	const body = table.createTBody();
	for (const row of rows) {
		const line = body.insertRow();
		row.forEach((value, index) => {
			const cell = document.createElement(machine.type !== "pda" && index === 0 ? "th" : "td");
			if (cell.localName === "th") cell.scope = "row";
			cell.textContent = value === null ? "" : String(value);
			line.append(cell);
		});
	}
	return table;
}
