import type { Node, Transition } from "./automata";
import type { AutomatonType } from "./index";
import { ATTRIBUTE_CONVERTERS } from "./utils/attributeConverters";

export type GraphState = { type: AutomatonType; nodes: Node[]; transitions: Transition[] };
export type ParticipantState = { graph?: GraphState; explanation?: string; [key: string]: unknown };
/** The public widget aggregation context; no editor runtime dependency. */
export type AggregateContext = {
	widget: { id: string; attributes: Readonly<Record<string, string>>; html: string };
	participants: readonly { id: string; name: string }[];
	samples: readonly { id: string; learners: readonly string[]; value: unknown }[];
	missing: number;
	reference?: unknown;
};
export const aggregateViews = ["custom", "selection", "ordering", "number", "text", "spatial", "distancemap"] as const;
export type AggregateView = typeof aggregateViews[number];
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const type = (value: unknown): AutomatonType => {
	if(value !== "dfa" && value !== "nfa" && value !== "pda") throw new TypeError("Invalid automaton type");
	return value;
};

export function authoredGraph(attributes: Readonly<Record<string, string>>, reference = false): GraphState | undefined {
	const prefix = reference ? "reference-" : "";
	if(reference && (attributes["reference-nodes"] === undefined || attributes["reference-transitions"] === undefined)) return undefined;
	return {
		type: type(attributes[`${prefix}type`] ?? attributes.type ?? "dfa"),
		nodes: ATTRIBUTE_CONVERTERS.nodeArray.fromAttribute(attributes[`${prefix}nodes`] || null).map(node => ({...node, initial: !!node.initial, final: !!node.final})),
		transitions: ATTRIBUTE_CONVERTERS.transitionArray.fromAttribute(attributes[`${prefix}transitions`] || null),
	};
}

export function participantState(text: string): ParticipantState {
	const value: unknown = JSON.parse(text || "{}");
	if(!record(value)) throw new TypeError("Automaton data must be a JSON object");
	if(value.explanation !== undefined && typeof value.explanation !== "string") throw new TypeError("Explanation must be text");
	if(value.graph !== undefined) readGraph(value.graph);
	return value as ParticipantState;
}

export function readGraph(value: unknown): GraphState {
	if(!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.transitions)) throw new TypeError("Invalid automaton graph");
	const graphType = type(value.type);
	const nodes = value.nodes.map((node: unknown) => {
		if(!record(node) || !Number.isSafeInteger(node.id) || (node.id as number) < 0
			|| typeof node.label !== "string" || typeof node.initial !== "boolean" || typeof node.final !== "boolean"
			|| node.x !== undefined && (typeof node.x !== "number" || !Number.isFinite(node.x))
			|| node.y !== undefined && (typeof node.y !== "number" || !Number.isFinite(node.y))) throw new TypeError("Invalid automaton state");
		return clone(node) as unknown as Node;
	});
	const ids = new Set(nodes.map(node => node.id));
	if(ids.size !== nodes.length) throw new TypeError("Duplicate automaton state IDs");
	const transitions = value.transitions.map((edge: unknown) => {
		if(!record(edge) || !Number.isSafeInteger(edge.id) || !ids.has(edge.from as number) || !ids.has(edge.to as number)
			|| !Array.isArray(edge.symbols) || !edge.symbols.every(symbol => typeof symbol === "string")) throw new TypeError("Invalid automaton transition");
		if(edge.stackOperations !== undefined && (!Array.isArray(edge.stackOperations)
			|| edge.stackOperations.length !== edge.symbols.length || edge.stackOperations.some(op => !record(op)
				|| !["push", "pop", "empty", "none"].includes(op.operation as string) || typeof op.symbol !== "string" || typeof op.condition !== "string"))) throw new TypeError("Invalid stack operation");
		return clone(edge) as unknown as Transition;
	});
	if(new Set(transitions.map(edge => edge.id)).size !== transitions.length) throw new TypeError("Duplicate transition IDs");
	return { type: graphType, nodes, transitions };
}

export function responseGraph(value: unknown, fallback: GraphState): GraphState {
	if(!record(value)) throw new TypeError("Invalid participant data");
	return value.graph === undefined ? clone(fallback) : readGraph(value.graph);
}

export const transitionKey = (edge: Transition) => JSON.stringify([edge.from, edge.to,
	edge.symbols.map((symbol, i) => [symbol, edge.stackOperations?.[i] ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
export const orderedNodes = (graph: GraphState) => [...graph.nodes].sort((a, b) => Number(a.x ?? 0) - Number(b.x ?? 0) || a.id - b.id);
export const structuralGraph = (graph: GraphState) => ({
	type: graph.type,
	nodes: [...graph.nodes].sort((a, b) => a.id - b.id).map(({id, label, initial, final}) => ({id, label, initial, final})),
	transitions: graph.transitions.map(transitionKey).sort(),
});

/** Each shape projects the same accepted graph data; authored references are explicit. */
export function aggregate(context: AggregateContext) {
	const attributes = context.widget.attributes;
	const fallback = authoredGraph(attributes)!;
	const reference = authoredGraph(attributes, true);
	const graph = (value: unknown) => responseGraph(value, fallback);
	const graphs = context.samples.map(sample => graph(sample.value));
	const nodes = new Map<number, Node>();
	for(const source of [reference, fallback, ...graphs]) for(const node of source?.nodes ?? []) if(!nodes.has(node.id)) nodes.set(node.id, node);
	const items = [...nodes.values()].sort((a, b) => a.id - b.id).map(node => ({id: String(node.id), label: node.label}));
	if(!items.length) items.push({id: "none", label: "No states yet"});
	const configuration = (view: AggregateView) => {
	if(view === "selection") return {shape: "selection", title: "States marked accepting", items,
		value: (data: unknown) => graph(data).nodes.filter(node => node.final).map(node => String(node.id)),
		reference: reference?.nodes.filter(node => node.final).map(node => String(node.id))};
	if(view === "ordering") return {shape: "ordering", title: "State order from left to right", items,
		value: (data: unknown) => orderedNodes(graph(data)).map(node => String(node.id)),
		reference: reference ? orderedNodes(reference).map(node => String(node.id)) : undefined};
	if(view === "number") return {shape: "number", title: "Number of states", value: (data: unknown) => graph(data).nodes.length,
		reference: reference?.nodes.length};
	if(view === "text") return {shape: "text", title: "Automaton explanations", value: (data: unknown) => record(data) && typeof data.explanation === "string" ? data.explanation.trim() || undefined : undefined};
	if(view === "spatial") {
		const all = [fallback, ...graphs, ...(reference ? [reference] : [])].flatMap(source => source.nodes);
		const xs = all.map(node => Number(node.x ?? 0)), ys = all.map(node => Number(node.y ?? 0));
		const left = Math.min(0, ...xs) - 50, top = Math.min(0, ...ys) - 50;
		const width = Math.max(0, ...xs) - left + 50, height = Math.max(0, ...ys) - top + 50;
		const positions = (source: GraphState) => source.nodes.map(node => ({x: Number(node.x ?? 0) - left, y: Number(node.y ?? 0) - top}));
		return {shape: "spatial", title: "State positions", bounds: {width, height}, value: (data: unknown) => positions(graph(data)), reference: reference ? positions(reference) : undefined};
	}
	if(view === "distancemap") return {shape: "distancemap", title: "Structural differences", value: (data: unknown) => structuralGraph(graph(data)),
		reference: reference ? structuralGraph(reference) : undefined};
	if(view === "custom") return {shape: "custom", title: "Class automata", element: "webwriter-automaton-aggregate", reference};
	throw new TypeError("Unknown aggregate shape");
	};
	return aggregateViews.map(view => ({id: view, ...configuration(view)}));
}
