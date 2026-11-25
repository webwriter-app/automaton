import type { Node, Transition } from './automaton-data';

/**
 * Strips unnecessary properties from a Node object and returns a new Node object with only the essential properties.
 * @param node - The Node object to strip.
 * @returns A new Node object with only the essential properties.
 */
export function stripNode(node: Node): Node {
    return {
        id: node.id,
        label: node.label,
        x: node.x,
        y: node.y,
        initial: node.initial,
        final: node.final,
    };
}

/**
 * Strips unnecessary properties from a transition object.
 * @param transition - The transition object to strip.
 * @returns The stripped transition object.
 */
export function stripTransition(transition: Transition): Transition {
    return {
        id: transition.id,
        from: transition.from,
        to: transition.to,
        symbols: transition.symbols,
        label: transition.label,
        bend: transition.bend,
        loopAngle: transition.loopAngle,
        stackOperations: transition.stackOperations,
    };
}

/**
 * Gives every transition the stack operations its automaton type needs: one per symbol for a PDA, none otherwise.
 * @param transitions - The transitions to convert.
 * @param type - The automaton type the transitions are for.
 */
export function transitionsForType(transitions: Transition[], type: string): Transition[] {
    return transitions.map(({ stackOperations, ...edge }) => type === 'pda'
        ? {
            ...edge,
            stackOperations: edge.symbols.map((_, index) =>
                stackOperations?.[index] ?? { operation: 'none' as const, symbol: '', condition: '' }),
        }
        : { ...edge, stackOperations: undefined });
}
