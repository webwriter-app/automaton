import { Node, StackOperation, Transition } from '../automata';

/**
 * Checks if the nodes have been updated by comparing the new value with the old value.
 * Returns true if any of the nodes have changed, false otherwise.
 *
 * @param value - The new value of the nodes.
 * @param oldValue - The old value of the nodes.
 * @returns A boolean indicating whether the nodes have been updated.
 */
export function checkIfNodesUpdated(value: Node[], oldValue: Node[]) {
    if (!oldValue) return true;
    if (!value) return true;

    if (value.length !== oldValue.length) {
        return true;
    }

    for (let i = 0; i < value.length; i++) {
        if (hasNodeChanged(value[i], oldValue[i])) {
            return true;
        }
    }
    return false;
}

/**
 * Checks if the transitions have been updated by comparing the new value with the old value.
 * Returns true if the transitions have been updated, false otherwise.
 *
 * @param value - The new array of transitions.
 * @param oldValue - The old array of transitions.
 * @returns A boolean indicating whether the transitions have been updated.
 */
export function checkIfTransitionsUpdated(value: Transition[], oldValue: Transition[]) {
    if (!oldValue) return true;
    if (!value) return true;

    if (value.length !== oldValue.length) {
        return true;
    }

    for (let i = 0; i < value.length; i++) {
        if (hasTransitionChanged(value[i], oldValue[i])) {
            return true;
        }
    }
    return false;
}

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
export function stripTransition(transition: any) {
    let strippedTransition = {
        id: transition.id,
        from: transition.from,
        to: transition.to,
        symbols: transition.symbols,
        label: transition.label,
        selfReference: transition.selfReference,
        smooth: transition.smooth,
        stackOperations: transition.stackOperations,
    };

    if (!transition.selfReference) {
        delete strippedTransition.selfReference;
    }

    return strippedTransition;
}

/**
 * Checks if a node has changed by comparing its properties with the old data.
 * @param newData - The new data of the node.
 * @param oldData - The old data of the node.
 * @returns A boolean value indicating whether the node has changed or not.
 */
export function hasNodeChanged(newData: Node, oldData: Node) {
    return (
        newData.id !== oldData.id ||
        newData.label !== oldData.label ||
        newData.x !== oldData.x ||
        newData.y !== oldData.y ||
        newData.initial !== oldData.initial ||
        newData.final !== oldData.final
    );
}

/**
 * Checks if a transition has changed by comparing its properties with the old data.
 * @param newData - The new transition data.
 * @param oldData - The old transition data.
 * @returns True if the transition has changed, false otherwise.
 */
export function hasTransitionChanged(newData: Transition, oldData: Transition) {
    return (
        newData.id !== oldData.id ||
        newData.from !== oldData.from ||
        newData.to !== oldData.to ||
        newData.label !== oldData.label ||
        didSymbolsChange(newData.symbols, oldData.symbols) ||
        newData.selfReference !== oldData.selfReference ||
        newData.smooth !== oldData.smooth ||
        didStackOperationsChange(
            newData.stackOperations as StackOperation[],
            oldData.stackOperations as StackOperation[]
        )
    );
}

/**
 * Checks if the symbols have changed between two arrays.
 *
 * @param newSymbols - The new symbols array.
 * @param oldSymbols - The old symbols array.
 * @returns A boolean indicating whether the symbols have changed.
 */
function didSymbolsChange(newSymbols: string[], oldSymbols: string[]) {
    return newSymbols.length !== oldSymbols.length ||
        newSymbols.some((symbol, index) => symbol !== oldSymbols[index]);
}

/**
 * Checks if the stack operations have changed.
 * @param newOperations - The new stack operations.
 * @param oldOperations - The old stack operations.
 * @returns A boolean indicating whether the stack operations have changed.
 */
function didStackOperationsChange(newOperations: StackOperation[], oldOperations: StackOperation[]) {
    if (!newOperations && !oldOperations) return false;
    if (!newOperations || !oldOperations) return true;
    if (newOperations.length !== oldOperations.length) return true;

    for (let i = 0; i < newOperations.length; i++) {
        if (
            newOperations[i].operation !== oldOperations[i].operation ||
            newOperations[i].symbol !== oldOperations[i].symbol ||
            newOperations[i].condition !== oldOperations[i].condition
        ) {
            return true;
        }
    }

    return false;
}
