import type { StackOperation } from "./automaton-data";

/** What a stack operation does in the pop and push notation of textbooks and JFLAP. */
export type StackEffect = { pop: string; push: string; emptyStack: boolean };

/** The operation `push X if the top is c` pops c and pushes Xc, so the operations map to pop/push pairs without loss, except the test for an empty stack. */
export function stackEffect({ operation, symbol, condition }: StackOperation): StackEffect {
	switch (operation) {
		case "push": return { pop: condition, push: symbol + condition, emptyStack: false };
		case "pop": return { pop: symbol, push: "", emptyStack: false };
		case "empty": return { pop: "", push: "", emptyStack: true };
		default: return { pop: condition, push: condition, emptyStack: false };
	}
}

/** The reverse of `stackEffect`; `undefined` for a pop/push pair the widget's operations cannot express. */
export function stackOperation(pop: string, push: string): StackOperation | undefined {
	const [popped, pushed] = [Array.from(pop), Array.from(push)];
	if (popped.length > 1 || pushed.length > 2) return undefined;
	if (!popped.length) {
		if (!pushed.length) return { operation: "none", symbol: "", condition: "" };
		return pushed.length === 1 ? { operation: "push", symbol: push, condition: "" } : undefined;
	}
	const [top] = popped;
	if (!pushed.length) return { operation: "pop", symbol: top, condition: "" };
	if (pushed.length === 1) return pushed[0] === top ? { operation: "none", symbol: "", condition: top } : undefined;
	return pushed[1] === top ? { operation: "push", symbol: pushed[0], condition: top } : undefined;
}
