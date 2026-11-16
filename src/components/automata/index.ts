import type { Graph } from '../graph';
import { Collection } from '../../model/collection';
import type { Node, Transition } from '../../model/automaton-data';
import { stripNode, stripTransition } from '../../model/updates';
import { TemplateResult } from 'lit';
import { AutomatonComponent, AutomatonType } from '../../widgets/webwriter-automaton';
import { AutomatonError } from '../errors';

export type { Node, StackOperation, Transition } from '../../model/automaton-data';

interface FormalDefinition {
    nodes: string;
    alphabet: string;
    transitions: string;
    initialNode: string;
    finalNodes: string;
}

export type SimulationResult = {
    accepted: boolean;
    path?: {
        nodes: Node[];
        transitions: {
            transition: Transition;
            symbol: string;
        }[];
        stacks?: string[][];
    };
    errors?: AutomatonError[];
}

export abstract class Automaton {
    public nodes = new Collection<Node>();
    public transitions = new Collection<Transition>();

    /** Whether the diagram marks the states that have errors. */
    public showErrors = true;

    /** Calls `listener` after every change of a state or a transition. Returns the function that stops it. */
    public subscribe(listener: () => void): () => void {
        const stops = [this.nodes.on(listener), this.transitions.on(listener)];
        return () => stops.forEach(stop => stop());
    }

    public abstract type: AutomatonType;

    constructor(nodes: Node[], transitions: Transition[]) {
        this.setupListeners();

        this.nodes.update(nodes);
        this.transitions.update(transitions);
    }

    public checkAutomaton(): AutomatonError[] {
        const errors: AutomatonError[] = [];
        const initialNodes = this.nodes.get().filter((n) => n.initial);
        
        if (initialNodes.length === 0) {
            errors.push(new AutomatonError('no-initial-state'));
        } else if (initialNodes.length > 1) {
            errors.push(new AutomatonError('multiple-initial-states'));
        }

        return errors;
    }
    public abstract simulator: Simulator;

    public extension: HTMLElement | null = null;

    public abstract getTransitionLabel(transition: Transition): string;

    /** Replaces everything with the authored states and transitions. */
    public loadAutomaton(data: { nodes: Node[]; transitions: Transition[] }): void {
        this.nodes.clear();
        this.transitions.clear();
        this.nodes.update(data.nodes);
        this.transitions.update(data.transitions);
    }

    public abstract saveAutomaton(): string;

    protected getNodes(): Node[] {
        return this.nodes.get();
    }

    protected getTransitions(): Transition[] {
        return this.transitions.get();
    }

    public getAlphabet(): string[] {
        return [
            ...new Set(
                this.transitions
                    .get()
                    .filter((e) => e.symbols?.length > 0)
                    .map((t) => t.symbols)
                    .flat()
                    .filter((s) => s !== '')
            ),
        ];
    }

    protected getFinalNodes(): string[] {
        return this.nodes
            .get()
            .filter((n) => n.final)
            .map((n) => n.label);
    }

    public updateAutomaton(nodes: Node[], transitions: Transition[]): void {
        if (nodes) this.nodes.update(nodes);
        if (transitions) this.transitions.update(transitions);

        for (const node of this.nodes.get()) {
            if (node.final) this.updateNode(node.id, { final: true });
            if (node.initial) this.updateNode(node.id, { initial: true });
        }
    }

    public getInitialNode(): Node {
        return this.nodes.get().find((n) => n.initial)!;
    }

    protected getNodeLabel(id: number): string {
        return this.nodes.get().find((n) => n.id === id)!.label;
    }

    public getTransitionsFromNode(node: Node): Transition[] {
        return this.transitions.get().filter((t) => t.from === node.id);
    }

    public getFormalDefinition(): FormalDefinition {
        return {
            nodes: this.getNodes()
                .filter((n) => n.label !== '')
                .map((n) => n.label)
                .join(', '),
            alphabet: this.getAlphabet().sort().join(', '),
            transitions: this.getTransitions()
                .filter((t) => t.label !== '')
                .map((t) => t.symbols.map((s) => `(${this.getNodeLabel(t.from)},${s || "ε"}): ${this.getNodeLabel(t.to)}`))
                .flat()
                .join('; '),
            initialNode: this.getInitialNode()?.label,
            finalNodes: this.getFinalNodes().join(', '),
        };
    }

    public setFinalNode(id: number, final: boolean): void {
        this.nodes.update({ id, final });
    }

    public hasTransitionSymbol(node: Node, symbol: string): boolean {
        const transitions = this.getTransitionsFromNode(node);
        return transitions.some((t) => t.symbols.includes(symbol));
    }

    /* GETTERS */
    public getNode(id: number): Node | null {
        return this.nodes.get(id);
    }

    public getTransition(id: number): Transition | null {
        return this.transitions.get(id);
    }

    /* NODE MANIPULATIONS */
    public addNode(node: Node): void {
        this.nodes.add(node);
    }

    public removeNode(id: number): void {
        const transitions = this.transitions.get().filter((t) => t.from === id || t.to === id);

        for (const transition of transitions) {
            this.transitions.remove(transition.id);
        }
        this.nodes.remove(id);
    }

    public updateNode(nodeId: number, data: Partial<Node>): void {
        this.nodes.update({ id: nodeId, ...data });
    }

    /* TRANSITION MANIPULATIONS */
    public addTransition(transition: Transition): void {
        this.transitions.add(transition);
    }

    public removeTransition(id: number): void {
        this.transitions.remove(id);
    }

    public removeTransitionsFromNode(id: number): void {
        this.transitions.remove(this.transitions.getIds({ filter: e => e.from === id }));
    }

    public updateTransition(transitionId: number, transition: Partial<Transition>): void {
        this.transitions.update({ id: transitionId, ...transition });
    }

    /* ------------------- */

    public highlightNode(node: Node): void {
        if (!this.nodes.get(node.id)) return;
        this.nodes.update({ id: node.id, highlight: 'active' });
    }

    public flashHighlightNode(node: Node, duration: number): void {
        this.highlightNode(node);

        setTimeout(() => {
            if (!this.nodes.get(node.id)) return;
            this.nodes.update({ id: node.id, highlight: undefined });
        }, duration);
    }

    public highlightTransition(transition: Transition): void {
        if (!this.transitions.get(transition.id)) return;
        this.transitions.update({ id: transition.id, highlight: true });
    }

    public flashHighlightTransition(transition: Transition, duration: number): void {
        this.highlightTransition(transition);

        setTimeout(() => {
            if (!this.transitions.get(transition.id)) return;
            this.transitions.update({ id: transition.id, highlight: undefined });
        }, duration);
    }

    public clearHighlights(): void {
        this.nodes.update(this.nodes.get({ filter: n => n.highlight !== undefined }).map(n => ({ id: n.id, highlight: undefined })));
        this.transitions.update(this.transitions.get({ filter: t => t.highlight !== undefined }).map(t => ({ id: t.id, highlight: undefined })));
    }

    private static toNumber(id: string | number): number {
        return typeof id === 'number' ? id : parseInt(id as string);
    }

    public getNewNodeId(): number {
        return this.nodes.get().length > 0
            ? Math.max(...this.nodes.getIds().map(Automaton.toNumber)) + 1
            : 0;
    }

    public getNewNodeLabel(): string {
        return 'q' + this.getNewNodeId();
    }

    public getNewTransitionId(): number {
        return this.transitions.get().length > 0
            ? Math.max(...this.transitions.getIds().map(Automaton.toNumber)) + 1
            : 0;
    }

    public export(): string {
        return JSON.stringify({
            nodes: this.nodes.get().map(stripNode),
            transitions: this.transitions.get().map(stripTransition),
        });
    }

    public import(data: string): void {
        const parsed = JSON.parse(data);
        this.updateAutomaton(parsed.nodes, parsed.transitions);
    }

    /* LISTENERS */
    private setupListeners() {
        this.nodes.on((event, { items, oldData }) => {
            if (event === 'add') {
                const initial = items.map(id => this.nodes.get(id)).find(node => node?.initial);
                if (initial) this.updateInitialNode(initial);
            } else if (event === 'update') {
                for (const id of items) {
                    const node = this.nodes.get(id)!;
                    if (node.initial && !oldData.find(old => old.id === id)?.initial) this.updateInitialNode(node);
                }
            }
        });

        this.transitions.on((event, { items }) => {
            if (event === 'remove') return;
            for (const id of items) {
                const transition = this.transitions.get(id)!;
                const label = this.getTransitionLabel(transition);
                if (transition.label !== label) this.updateTransition(id, { label });
            }
        });
    }

    /** At most one state is initial: the one that was set last. */
    private updateInitialNode(node: Node): void {
        this.nodes.update(this.nodes.get({ filter: n => n.initial && n.id !== node.id }).map(n => ({ id: n.id, initial: false })));
    }
}

export const SimulationStatus = Object.freeze({
    IDLE: 'idle',
    ERROR: 'error',
    NO_PATH: 'no_path',
    RUNNING: 'running',
    PAUSED: 'paused',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    NO_MOVES: 'no_moves',
    STOPPED: 'stopped',
});
export type SimulationStatus = (typeof SimulationStatus)[keyof typeof SimulationStatus];

export type SimulationFeedback = {
    status: SimulationStatus;
    finalStep?: boolean;
    firstStep?: boolean;
    wordPosition: number;
    step?: number;
    simulationResult?: SimulationResult;
};

export abstract class Simulator {
    protected _a: Automaton;
    protected _errors: AutomatonError[] = [];

    protected _word: string[] = [];
    public get word(): string {
        return this._word.join('');
    }
    public set word(word: string) {
        if (word.includes(';')) this._word = word.split(';');
        else this._word = word.split('');
        this.reset();
    }

    public get wordArray(): string[] {
        return this._word;
    }

    constructor(automaton: Automaton) {
        this._a = automaton;
        this._errors = this._a.checkAutomaton();
    }

    public abstract simulate(): {
        status: SimulationStatus;
        simulationResult?: SimulationResult;
    };

    public abstract initStepByStep(graph: Graph, callback: Function): void;

    public abstract startAnimation(callback: (result: SimulationFeedback) => void): void;
    public abstract stopAnimation(callback: (result: SimulationFeedback) => void): void;
    public abstract pauseAnimation(callback: (result: SimulationFeedback) => void): void;

    public abstract stepForward(): SimulationFeedback;
    public abstract stepBackward(): SimulationFeedback;
    public abstract goToStep(step: number): SimulationFeedback;

    public abstract reset(): void;
    public abstract init(): void;
}

export abstract class AutomatonExtension {
    public abstract render(): TemplateResult;
    public abstract requestUpdate: () => void;

    public abstract component: AutomatonComponent;
}
