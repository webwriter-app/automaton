import { Graph } from '../../graph';
import type { DFA } from '../../automata/dfa';

function inspectStates(dfa: DFA) {
    const nodes = dfa.nodes.get().filter(node => node.id !== Graph.initialGhostNode.id);
    const alphabet = dfa.getAlphabet();
    const states = nodes.map(node => {
        const transitions = dfa.getTransitionsFromNode(node);
        const covered = new Set(transitions.flatMap(edge => edge.symbols));
        return { node, transitions, missing: alphabet.filter(symbol => !covered.has(symbol)) };
    });
    return { nodes, alphabet, states };
}

export function sinkStateStatus(dfa: DFA): 'empty' | 'no-alphabet' | 'complete' | 'incomplete' {
    const { nodes, alphabet, states } = inspectStates(dfa);
    if (!nodes.length) return 'empty';
    if (!alphabet.length) return 'no-alphabet';
    return states.some(state => state.missing.length) ? 'incomplete' : 'complete';
}

export function AddSinkstateToDFA(dfa: DFA): boolean {
    const { nodes, alphabet, states } = inspectStates(dfa);
    if (!states.some(state => state.missing.length)) return false;

    const existingSink = states.find(({ node, transitions, missing }) =>
        !node.final && (node.label === 'sink' || missing.length === 0) &&
        transitions.every(edge => edge.to === node.id));
    const sinkId = existingSink?.node.id ?? dfa.getNewNodeId();
    if (!existingSink) {
        const xs = nodes.map(node => node.x ?? 0);
        const ys = nodes.map(node => node.y ?? 0);
        dfa.addNode({
            id: sinkId, label: 'sink', initial: false, final: false,
            x: Math.round(xs.reduce((sum, x) => sum + x, 0) / xs.length),
            y: Math.round(Math.max(...ys) + 150),
        });
        addSymbols(sinkId, alphabet);
    }

    for (const { node, transitions, missing } of states) {
        if (!missing.length) continue;
        const edge = transitions.find(transition => transition.to === sinkId);
        if (edge) dfa.updateTransition(edge.id, { symbols: [...edge.symbols, ...missing] });
        else addSymbols(node.id, missing);
    }
    return true;

    function addSymbols(from: number, symbols: string[]) {
        const edge = { id: dfa.getNewTransitionId(), from, to: sinkId, symbols, label: '' };
        dfa.addTransition({ ...edge, label: dfa.getTransitionLabel(edge) });
    }
}
