import type { Node, Transition } from '../automata';

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
        ...(transition.selfReference ? { selfReference: transition.selfReference } : {}),
        smooth: transition.smooth,
        stackOperations: transition.stackOperations,
    };
}
