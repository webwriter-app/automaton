import type { AutomatonType } from "../index";
import type { Node, StackOperation, Transition } from "../automata";

export const machineBlockSelector = ':scope > script[type="application/json"][slot="data"]:not([src])';

export type Machine = {
    type: AutomatonType;
    nodes: Node[];
    transitions: Transition[];
    requiredAlphabet: string[];
    startingStack: string[];
};

export type MachineData = {
    format: "webwriter-automaton";
    version: 1;
    type: AutomatonType;
    states: {
        id: number;
        label: string;
        x: number;
        y: number;
        initial?: boolean;
        final?: boolean;
    }[];
    transitions: {
        id: number;
        from: number;
        to: number;
        rules: { read: string; stack?: { op: StackOperation["operation"]; symbol?: string; ifTop?: string } }[];
        bend?: number;
        loopAngle?: number;
    }[];
    requiredAlphabet?: string[];
    startingStack?: string[];
};

export function emptyMachine(): Machine {
    return { type: "dfa", nodes: [], transitions: [], requiredAlphabet: [], startingStack: [] };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isId = (value: unknown): value is number => isNumber(value) && Number.isSafeInteger(value) && value >= 0;

function invalidData(): never {
    throw new Error("Invalid WebWriter automaton data");
}

function readSymbols(value: unknown): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.every(symbol => typeof symbol === "string")) invalidData();
    return value;
}

function readStackOperation(value: unknown): StackOperation {
    if (value === undefined) return { operation: "none", symbol: "", condition: "" };
    if (!isRecord(value)) invalidData();
    const { op, symbol = "", ifTop = "" } = value;
    if ((op !== "push" && op !== "pop" && op !== "empty" && op !== "none") ||
        typeof symbol !== "string" || typeof ifTop !== "string") invalidData();
    return { operation: op, symbol, condition: ifTop };
}

export function readMachine(text: string | null): Machine {
    if (text === null) return emptyMachine();
    const data: unknown = JSON.parse(text);
    if (!isRecord(data) || data.format !== "webwriter-automaton" || data.version !== 1) invalidData();
    const { type } = data;
    if ((type !== "dfa" && type !== "nfa" && type !== "pda") ||
        !Array.isArray(data.states) || !Array.isArray(data.transitions)) invalidData();

    const nodeIds = new Set<number>();
    const nodes = data.states.map((state: unknown): Node => {
        if (!isRecord(state)) invalidData();
        const { id, label, x, y, initial = false, final = false } = state;
        if (!isId(id) || nodeIds.has(id) || typeof label !== "string" || !isNumber(x) || !isNumber(y) ||
            typeof initial !== "boolean" || typeof final !== "boolean") invalidData();
        nodeIds.add(id);
        return { id, label, x, y, initial, final };
    });
    const edgeIds = new Set<number>();
    const transitions = data.transitions.map((edge: unknown): Transition => {
        if (!isRecord(edge)) invalidData();
        const { id, from, to, bend, loopAngle } = edge;
        if (!isId(id) || edgeIds.has(id) || !isId(from) || !isId(to) ||
            !nodeIds.has(from) || !nodeIds.has(to) || !Array.isArray(edge.rules) ||
            (bend !== undefined && !isNumber(bend)) || (loopAngle !== undefined && !isNumber(loopAngle))) invalidData();
        edgeIds.add(id);
        const rules = edge.rules.map((rule: unknown) => {
            if (!isRecord(rule) || typeof rule.read !== "string") invalidData();
            return { read: rule.read, stack: type === "pda" ? readStackOperation(rule.stack) : undefined };
        });
        const transition: Transition = { id, from, to, label: "", symbols: rules.map(rule => rule.read) };
        if (type === "pda") transition.stackOperations = rules.map(rule => rule.stack!);
        if (bend) transition.smooth = { enabled: true, type: bend < 0 ? "curvedCCW" : "curvedCW", roundness: Math.abs(bend) };
        if (loopAngle !== undefined) transition.selfReference = { angle: ((450 - (loopAngle % 360)) % 360) * Math.PI / 180 };
        return transition;
    });
    return { type, nodes, transitions, requiredAlphabet: readSymbols(data.requiredAlphabet), startingStack: readSymbols(data.startingStack) };
}

export function writeMachine({ type, nodes, transitions, requiredAlphabet, startingStack }: Machine): string {
    const data: MachineData = {
        format: "webwriter-automaton",
        version: 1,
        type,
        states: nodes.map(({ id, label, x, y, initial, final }) => ({
            id, label, x: x ?? 0, y: y ?? 0, initial: initial || undefined, final: final || undefined,
        })),
        transitions: transitions.map(edge => {
            const curve = typeof edge.smooth === "object" ? edge.smooth : undefined;
            const angle = edge.selfReference?.angle;
            return {
                id: edge.id, from: edge.from, to: edge.to,
                rules: edge.symbols.map((read, index) => {
                    const operation = edge.stackOperations?.[index];
                    return {
                        read,
                        stack: type === "pda" && operation ? {
                            op: operation.operation, symbol: operation.symbol || undefined, ifTop: operation.condition || undefined,
                        } : undefined,
                    };
                }),
                bend: curve?.roundness ? curve.roundness * (curve.type === "curvedCCW" ? -1 : 1) : undefined,
                loopAngle: angle === undefined ? undefined : Math.round((450 - angle * 180 / Math.PI) * 1e9) / 1e9 % 360,
            };
        }),
        requiredAlphabet: requiredAlphabet.length ? requiredAlphabet : undefined,
        startingStack: startingStack.length ? startingStack : undefined,
    };
    // Script contents are raw text when the document is serialized as HTML.
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
