import { Graph } from '../graph';
import { Automaton, Node, SimulationResult, Simulator, Transition } from '../automata';
import { AutoSimulator } from './auto';
import { AutomatonError } from '@u/errors';
import { Logger } from '@u/logger';
import { AutomatonType } from 'index';

export class DFA extends Automaton {
    public simulator: Simulator;

    public type: AutomatonType = 'dfa';

    constructor(nodes: Node[], transitions: Transition[]) {
        super(nodes, transitions);
        this.simulator = new DFASimulator(this);
    }

    public requiredAlphabet: readonly string[] = [];

    public override getAlphabet(): string[] {
        return [...new Set([...this.requiredAlphabet, ...super.getAlphabet()])].filter(symbol => symbol !== '');
    }

    checkAutomaton(): AutomatonError[] {
        const errors: AutomatonError[] = super.checkAutomaton();
        const alphabet = this.getAlphabet();

        this.resetColors();

        for (const node of this.nodes.get()) {
            if (node.id === Graph.initialGhostNode.id) continue;
            let errorLengthBefore = errors.length;

            const transitions = this.getTransitionsFromNode(node);

            for (const letter of alphabet) {
                if (!transitions.some((t) => t.symbols.includes(letter))) {
                    errors.push(new AutomatonError('missing-transition', node, undefined, letter));
                }

                if (
                    transitions
                        .map((t) => t.symbols)
                        .flat()
                        .filter((s) => s === letter).length > 1
                ) {
                    errors.push(new AutomatonError('multiple-transitions', node, undefined, letter));
                }
            }

            if (transitions.some((t) => t.symbols.includes(''))) {
                errors.push(new AutomatonError('empty-transition', node));
            }

            if (errorLengthBefore < errors.length) {
                this.highlightErrorNode(node.id);
            }
        }

        return errors;
    }

    loadAutomaton(data: { nodes: Node[]; transitions: Transition[] }): void {
        this.nodes.clear();
        this.transitions.clear();

        this.nodes.update(data.nodes);
        this.transitions.update(data.transitions);

        for (const node of this.nodes.get()) {
            if (node.final) this.updateNode(node.id, { final: true });
            if (node.initial) this.updateNode(node.id, { initial: true });
        }

        Logger.log('Loaded DFA', this.nodes.get(), this.transitions.get());
    }

    saveAutomaton(): string {
        return '';
    }

    public getTransitionLabel(transition: Transition): string {
        if (transition.symbols.length === 1) {
            return transition.symbols[0] === '' ? ' ' : transition.symbols[0];
        }

        return transition.symbols.join(', ');
    }
}

class DFASimulator extends AutoSimulator {
    constructor(automaton: DFA) {
        super(automaton);
        this._currentNode = this._a.getInitialNode();
    }

    protected getPath(): SimulationResult {
        this._errors = this._a.checkAutomaton();
        if (this._errors.length > 0) {
            return { accepted: false, path: {nodes: [], transitions: []}, errors: this._errors };
        }

        const pathNodes: Node[] = [];
        let currentNode = this._a.getInitialNode();
        pathNodes.push(currentNode);

        const pathTransitions: { transition: Transition; symbol: string }[] = [];

        for (const letter of this._word) {
            const transition = this._a.getTransitionsFromNode(currentNode).find((t) => t.symbols.includes(letter));
            if (!transition) {
                return { accepted: false, path: { nodes: pathNodes, transitions: pathTransitions } };
            }
            currentNode = this._a.getNode(transition.to) as Node;
            pathNodes.push(currentNode);
            pathTransitions.push({ transition, symbol: letter });
        }

        return { accepted: !!currentNode.final, path: { nodes: pathNodes, transitions: pathTransitions } };
    }
}
