import { Automaton, SimulationResult, Node, Transition } from '../automata';
import { ManualAutoSimulator } from './manual-auto';
import { Logger } from '@u/logger';
import { AutomatonType } from 'index';

export class NFA extends Automaton {
    public simulator: NFASimulator;

    public type: AutomatonType = 'nfa';

    constructor(nodes: Node[], transitions: Transition[]) {
        super(nodes, transitions);
        this.simulator = new NFASimulator(this);
    }
    
    public loadAutomaton(data: { nodes: Node[]; transitions: Transition[] }): void {
        this.nodes.clear();
        this.transitions.clear();

        this.nodes.update(data.nodes);
        this.transitions.update(data.transitions);

        for (const node of this.nodes.get()) {
            if (node.final) this.updateNode(node.id, { final: true });
            if (node.initial) this.updateNode(node.id, { initial: true });
        }

        Logger.log('Loaded NFA', this.nodes.get(), this.transitions.get());
    }
    public saveAutomaton(): string {
        throw new Error('Method not implemented.');
    }

    public getTransitionLabel(transition: Transition): string {
        if (transition.symbols.length === 1) {
            return transition.symbols[0] === '' ? 'ε' : transition.symbols[0];
        }

        return transition.symbols.map((s) => (s === '' ? 'ε' : s)).join(', ');
    }
}

export class NFASimulator extends ManualAutoSimulator {
    constructor(automaton: NFA) {
        super(automaton);
    }

    protected getPath(): SimulationResult {
        this._errors = this._a.checkAutomaton();
        if (this._errors.length > 0) {
            return { accepted: false, path: { nodes: [], transitions: [] }, errors: this._errors };
        }

        type PathTransition = { transition: Transition; symbol: string };

        // Cache the epsilon closure computations for performance
        const epsilonClosures = new Map<number, Set<{ nodes: Node[]; transitions: PathTransition[] }>>();

        const getEpsilonClosure = (node: Node): Set<{ nodes: Node[]; transitions: PathTransition[] }> => {
            if (epsilonClosures.has(node.id)) {
                return epsilonClosures.get(node.id)!;
            }

            const closure = new Set<{ nodes: Node[]; transitions: PathTransition[] }>();
            const visited = new Set<number>();
            const queue: { nodes: Node[]; transitions: PathTransition[] }[] = [{ nodes: [node], transitions: [] }];

            while (queue.length > 0) {
                const current = queue.shift()!;
                const currentNode = current.nodes[current.nodes.length - 1];
                if (visited.has(currentNode.id)) continue;

                visited.add(currentNode.id);
                closure.add(current);

                const currentEpsilonTransitions = this._a
                    .getTransitionsFromNode(currentNode)
                    .filter((t) => t.symbols.includes(''));

                for (const transition of currentEpsilonTransitions) {
                    const targetNode = this._a.getNode(transition.to);
                    if (targetNode && !visited.has(targetNode.id)) {
                        queue.push({
                            nodes: [...current.nodes, targetNode],
                            transitions: [...current.transitions, { transition, symbol: '' }]
                        });
                    }
                }
            }

            epsilonClosures.set(node.id, closure);
            return closure;
        };

        const initialNode = this._a.getInitialNode();
        if (!initialNode) {
            return { accepted: false, path: { nodes: [], transitions: [] } };
        }

        type SearchState = {
            node: Node;
            wordIndex: number;
            path: { nodes: Node[]; transitions: PathTransition[] };
        };

        // Start with epsilon closure of initial node
        const initialClosure = getEpsilonClosure(initialNode);
        const queue: SearchState[] = Array.from(initialClosure).map((closurePath) => ({
            node: closurePath.nodes[closurePath.nodes.length - 1],
            wordIndex: 0,
            path: closurePath
        }));

        while (queue.length > 0) {
            const { node, wordIndex, path } = queue.shift()!;

            // Check if we have processed the entire word
            if (wordIndex >= this._word.length) {
                if (node.final) {
                    return { accepted: true, path };
                }
                continue;
            }

            const currentLetter = this._word[wordIndex];
            const transitions = this._a.getTransitionsFromNode(node);

            for (const transition of transitions) {
                if (!transition.symbols.includes(currentLetter)) continue;

                const targetNode = this._a.getNode(transition.to);
                if (!targetNode) continue;

                const targetClosure = getEpsilonClosure(targetNode);

                for (const closurePath of targetClosure) {
                    const newPathNodes = [...path.nodes, ...closurePath.nodes];
                    const newPathTransitions = [
                        ...path.transitions,
                        { transition, symbol: currentLetter },
                        ...closurePath.transitions
                    ];

                    queue.push({
                        node: closurePath.nodes[closurePath.nodes.length - 1],
                        wordIndex: wordIndex + 1,
                        path: { nodes: newPathNodes, transitions: newPathTransitions }
                    });
                }
            }
        }

        // No accepting path found
        return { accepted: false, path: { nodes: [], transitions: [] } };
    }

    protected isValidTransition(transition: Transition): boolean {
        const validSymbol =
            transition.symbols.includes(this._word[this._currentWordPosition]) || transition.symbols.includes('');
        const validFrom = transition.from === this._currentNode.id;

        return validSymbol && validFrom;
    }

    protected highlightPossibleTransitions(node: Node): boolean {
        const transitions = this._a.getTransitionsFromNode(node);
        const currentSymbol = this._word[this._currentWordPosition];
        const validTransitions = transitions.filter(
            (t) => t.symbols.includes(currentSymbol) || t.symbols.includes('')
        );

        this._a.clearHighlights();

        // reset selected transitions
        this._graph?.network.setSelection({ edges: [] });

        if (validTransitions.length === 0) {
            return false;
        }
        for (const transition of validTransitions) {
            this._a.highlightTransition(transition);
        }
        this._a.highlightNode(node);
        return true;
    }

    protected async getManualMove(transition: Transition): Promise<{ to: Node; symbol: string } | null> {
        const possibleSymbols = transition.symbols.filter(
            (s) => s === '' || s === this._word[this._currentWordPosition]
        );

        if (possibleSymbols.length === 0) {
            return null;
        }

        const to = this._a.getNode(transition.to) as Node;

        if (possibleSymbols.length > 1) {
            return new Promise((resolve) => {
                const dialog = document.createElement('dialog');

                const buttons = possibleSymbols.map((s) => {
                    const button = document.createElement('button');
                    button.innerHTML = s === '' ? 'ε' : s;
                    button.addEventListener('click', () => {
                        dialog.close();
                        resolve({ to, symbol: s });
                    });
                    return button;
                });

                dialog.append(...buttons);
                this.showMoveDialog(dialog, () => resolve(null));
            });
        }

        return { to, symbol: possibleSymbols[0] };
    }

    protected updateStateAfterManualMove(move: { to: Node; symbol: string }): void {
        // do nothing
        // win
    }

    protected updateStateAfterGoToStep(_step: number): void {
        // NFA has no additional state to update
    }
}
