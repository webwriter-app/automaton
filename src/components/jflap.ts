import type { MsgFn } from "@lit/localize";
import type { Node, StackOperation, Transition } from "../model/automaton-data";
import { readMachine, writeMachine, type Machine } from "../model/machine-data";
import { stackEffect, stackOperation } from "../model/stack-effect";

const escape = (text: string) => text.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const round = (value: number) => Math.round(value * 100) / 100;
const MARGIN = 60;

/**
 * A JFLAP 7 file (.jff) of the machine. Finite automata become `fa`, pushdown automata `pda`.
 * Bends and loop angles are not part of the format. The test for an empty stack is written as a transition that touches no stack symbol.
 * States keep their relative positions and move so that the top left one lies at a margin.
 */
export function writeJflap({ type, nodes, transitions }: Machine): string {
	const left = Math.min(...nodes.map(node => node.x ?? 0)), top = Math.min(...nodes.map(node => node.y ?? 0));
	const states = nodes.map(node => `\t\t<state id="${node.id}" name="${escape(node.label)}">
\t\t\t<x>${round((node.x ?? 0) - left + MARGIN)}</x>
\t\t\t<y>${round((node.y ?? 0) - top + MARGIN)}</y>${node.initial ? "\n\t\t\t<initial/>" : ""}${node.final ? "\n\t\t\t<final/>" : ""}
\t\t</state>`);
	const cell = (tag: string, value: string) => value ? `<${tag}>${escape(value)}</${tag}>` : `<${tag}/>`;
	const rules = transitions.flatMap(edge => edge.symbols.map((read, index) => {
		const stack = type === "pda" ? stackEffect(edge.stackOperations?.[index] ?? { operation: "none", symbol: "", condition: "" }) : undefined;
		return `\t\t<transition>
\t\t\t<from>${edge.from}</from>
\t\t\t<to>${edge.to}</to>
\t\t\t${cell("read", read)}${stack ? `\n\t\t\t${cell("pop", stack.pop)}\n\t\t\t${cell("push", stack.push)}` : ""}
\t\t</transition>`;
	}));
	return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<structure>
\t<type>${type === "pda" ? "pda" : "fa"}</type>
\t<automaton>
${[...states, ...rules].join("\n")}
\t</automaton>
</structure>
`;
}

/**
 * Reads a JFLAP file of a finite or pushdown automaton. The machine is a DFA unless a transition reads nothing or two share a state and symbol.
 * It throws an error with a message from `msg` if the file is no JFLAP file, holds another kind of machine, or cannot be represented. Nothing is applied here.
 */
export function readJflap(xml: string, msg: MsgFn): Machine {
	const document = new DOMParser().parseFromString(xml, "application/xml");
	const root = document.documentElement;
	if (document.querySelector("parsererror") || root.tagName !== "structure") throw new Error(msg("This is not a JFLAP file."));
	const kind = root.querySelector(":scope > type")?.textContent?.trim();
	if (kind !== "fa" && kind !== "pda") throw new Error(msg("Only JFLAP finite automata and pushdown automata can be imported."));
	const body = root.querySelector(":scope > automaton") ?? root;
	const bad = () => new Error(msg("The JFLAP file is incomplete or uses a feature the automaton cannot represent."));
	const text = (element: Element, tag: string) => element.querySelector(`:scope > ${tag}`)?.textContent?.trim() ?? "";
	const number = (element: Element, tag: string) => { const value = Number(text(element, tag) || 0); if (!Number.isFinite(value)) throw bad(); return value; };

	const states = [...body.querySelectorAll(":scope > state")];
	if (!states.length || states.filter(state => state.querySelector(":scope > initial")).length > 1) throw bad();
	const raw = states.map(state => {
		const id = Number(state.getAttribute("id"));
		if (!Number.isSafeInteger(id) || id < 0) throw bad();
		return { id, label: state.getAttribute("name") || `q${id}`, x: number(state, "x"), y: number(state, "y"),
			initial: !!state.querySelector(":scope > initial"), final: !!state.querySelector(":scope > final") };
	});
	const centre = (values: number[]) => Math.round((Math.min(...values) + Math.max(...values)) / 2);
	const [cx, cy] = [centre(raw.map(state => state.x)), centre(raw.map(state => state.y))];
	const nodes: Node[] = raw.map(state => ({ ...state, x: round(state.x - cx), y: round(state.y - cy) }));

	const ids = new Set(raw.map(state => state.id));
	const grouped = new Map<string, Transition>();
	for (const element of body.querySelectorAll(":scope > transition")) {
		const [from, to] = [Number(text(element, "from") || NaN), Number(text(element, "to") || NaN)];
		if (!ids.has(from) || !ids.has(to)) throw bad();
		const read = text(element, "read");
		if (Array.from(read).length > 1) throw bad();
		let operation: StackOperation | undefined;
		if (kind === "pda") {
			operation = stackOperation(text(element, "pop"), text(element, "push"));
			if (!operation) throw bad();
		}
		const key = `${from}>${to}`;
		const edge = grouped.get(key) ?? { id: grouped.size, from, to, label: "", symbols: [], stackOperations: kind === "pda" ? [] : undefined };
		edge.symbols.push(read);
		edge.stackOperations?.push(operation!);
		grouped.set(key, edge);
	}
	const transitions = [...grouped.values()];

	const seen = new Set<string>();
	const deterministic = kind === "fa" && transitions.every(edge => edge.symbols.every(symbol => {
		const key = `${edge.from} ${symbol}`;
		return symbol !== "" && !seen.has(key) && !!seen.add(key);
	}));
	const machine: Machine = { type: kind === "pda" ? "pda" : deterministic ? "dfa" : "nfa", nodes, transitions, requiredAlphabet: [], startingStack: [] };
	try { return readMachine(writeMachine(machine)); } catch { throw bad(); }
}
