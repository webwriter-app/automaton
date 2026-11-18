import type { Machine } from "./machine-data";
import { stackEffect } from "./stack-effect";

export type Table = { columns: string[]; rows: (string | number | null)[][] };

export type TableLabels = { state: string; from: string; read: string; pop: string; push: string; to: string };

const EPSILON = "ε";
const EMPTY_STACK = "⊥";

/**
 * The transitions as a table. A DFA or NFA gets one row per state and one column per symbol, each cell listing the target states; a PDA gets one row per rule.
 * A row label starts with → for the initial state and * for a final one.
 */
export function transitionTable(machine: Machine, labels: TableLabels): Table {
	const name = new Map(machine.nodes.map(node => [node.id, node.label]));
	if (machine.type === "pda") {
		const rows = machine.transitions.flatMap(edge => edge.symbols.map((read, index) => {
			const { pop, push, emptyStack } = stackEffect(edge.stackOperations?.[index] ?? { operation: "none", symbol: "", condition: "" });
			return [name.get(edge.from) ?? "", read || EPSILON, emptyStack ? EMPTY_STACK : pop || EPSILON, push || EPSILON, name.get(edge.to) ?? ""];
		}));
		return { columns: [labels.from, labels.read, labels.pop, labels.push, labels.to], rows };
	}
	const symbols = [...new Set(machine.transitions.flatMap(edge => edge.symbols))].sort((a, b) => a === "" ? 1 : b === "" ? -1 : a.localeCompare(b));
	const rows = machine.nodes.map(node => [
		`${node.initial ? "→" : ""}${node.final ? "*" : ""}${node.initial || node.final ? " " : ""}${node.label}`,
		...symbols.map(symbol => {
			const targets = machine.transitions.filter(edge => edge.from === node.id && edge.symbols.includes(symbol)).map(edge => name.get(edge.to) ?? "");
			return targets.length ? [...new Set(targets)].join(", ") : null;
		}),
	]);
	return { columns: [labels.state, ...symbols.map(symbol => symbol || EPSILON)], rows };
}
