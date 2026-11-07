import { Graph } from '../graph';
import { DataSet } from 'vis-data';
import { EdgeOptions, NodeOptions } from 'vis-network';
import { stripNode, stripTransition } from '../utils/updates';
import { COLORS } from '../utils/colors';
import { TemplateResult } from 'lit';
import { AutomatonComponent, AutomatonType } from '../';
import { AutomatonError } from '@u/errors';

export interface Node extends NodeOptions {
    id: number;
    label: string;

    final: boolean;
    initial: boolean;
}

export interface Transition extends EdgeOptions {
    id: number;
    from: number;
    to: number;
    label: string;
    symbols: string[];
    stackOperations?: StackOperation[];
}

export interface StackOperation {
    symbol: string;
    operation: 'push' | 'pop' | 'empty' | 'none';
    condition: string;
}

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
    public nodes: DataSet<Node> = new DataSet<Node>();
    public transitions: DataSet<Transition> = new DataSet<Transition>();

    private _showErrors = true;
    public set showErrors(value: boolean) {
        this._showErrors = value;
        this.resetColors();
    }
    public get showErrors(): boolean {
        return this._showErrors;
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

    public abstract loadAutomaton(data: { nodes: Node[]; transitions: Transition[] }): void;
    public abstract saveAutomaton(): string;

    protected getNodes(): Node[] {
        return this.nodes.get();
    }

    protected getTransitions(): Transition[] {
        return this.transitions.get();
    }

    protected getAlphabet(): string[] {
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
        return this.transitions.get().filter((t) => t.from != Graph.initialGhostNode.id && t.from === node.id);
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

    public getGraphData(): { nodes: DataSet<Node>; edges: DataSet<Transition> } {
        return { nodes: this.nodes, edges: this.transitions };
    }

    public setFinalNode(id: number, final: boolean): void {
        this.nodes.update({
            id,
            final,
            shape: final ? 'custom' : 'circle',
        });
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
        this.transitions.remove(this.transitions.getIds({ filter: (e: Transition) => e.from === id }));
    }

    public updateTransition(transitionId: number, transition: Partial<Transition>): void {
        this.transitions.update({ id: transitionId, ...transition });
    }

    /* ------------------- */

    public highlightErrorNode(id: number): void {
        if (!this.showErrors) return;

        this.nodes.update({
            id,
            color: COLORS.warning,
        });
    }

    public highlightNode(node: Node): void {
        if (!this.nodes.get(node.id)) return;
        this.nodes.update({
            id: node.id,
            color: COLORS.blue,
        });
    }

    public flashHighlightNode(node: Node, duration: number): void {
        this.highlightNode(node);

        setTimeout(() => {
            if (!this.nodes.get(node.id)) return;
            this.nodes.update({
                id: node.id,
                color: COLORS.standard,
            });
        }, duration);
    }

    public highlightTransition(transition: Transition): void {
        if (!this.transitions.get(transition.id)) return;
        this.transitions.update({
            id: transition.id,
            color: COLORS.blue.border,
            width: 2,
        });
    }

    public flashHighlightTransition(transition: Transition, duration: number): void {
        this.highlightTransition(transition);

        setTimeout(() => {
            if (!this.transitions.get(transition.id)) return;
            this.transitions.update({
                id: transition.id,
                color: COLORS.standard.border,
                width: 1,
            });
        }, duration);
    }

    public clearHighlights(): void {
        this.nodes.update(
            this.nodes
                .get()
                .filter((n) => n.id !== Graph.initialGhostNode.id)
                .map((n) => ({ id: n.id, color: COLORS.standard }))
        );

        this.transitions.update(
            this.transitions
                .get()
                .filter((t) => t.from !== Graph.initialGhostNode.id)
                .map((t) => ({ id: t.id, color: COLORS.standard.border, width: 1 }))
        );
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

    public redrawNodes(): void {
        for (const node of this.nodes.get()) {
            this.updateNode(node.id, { shape: node.final ? 'custom' : 'circle' });
        }
        this.nodes.update({ 
            id: Graph.initialGhostNode.id, 
            color: { 
                background: 'transparent', 
                border: 'transparent',
                hover: 'transparent',
                highlight: 'transparent'
            },
            size: 1,
            borderWidth: 0,
            opacity: 0
        });
    }

    protected resetColors(): void {
        this.nodes.update(
            this.nodes
                .get()
                .filter((n) => n.id !== Graph.initialGhostNode.id)
                .map((n) => ({
                    ...n,
                    color: {
                        background: '#fff',
                        border: '#000',
                        hover: COLORS.blue,
                        highlight: COLORS.blue,
                    },
                }))
        );

        this.transitions.update(
            this.transitions.get().map((t) => ({
                ...t,
                color: {
                    color: '#000',
                    highlight: '#000',
                    hover: '#000',
                },
            }))
        );
    }

    public export(): string {
        return JSON.stringify({
            nodes: this.nodes
                .get()
                .filter((n) => n.id !== Graph.initialGhostNode.id)
                .map(stripNode),
            transitions: this.transitions
                .get()
                .filter((t) => t.from !== Graph.initialGhostNode.id)
                .map(stripTransition),
        });
    }

    public import(data: string): void {
        const parsed = JSON.parse(data);
        this.updateAutomaton(parsed.nodes, parsed.transitions);
    }

    /* LISTENERS */
    private setupListeners() {
        this.nodes.on('add', (_, data: { items: (string | number)[] }) => {
            const initialNodeId = data.items.find((id) => this.nodes.get(id)?.initial);
            if (initialNodeId !== undefined) this.updateInitialNode(this.nodes.get(initialNodeId) as Node);

            const finalNodeIds = data.items.filter((id) => this.nodes.get(id)?.final);
            this.nodes.update(finalNodeIds.map((id) => ({ id, shape: 'custom' })) as Node[]);
        });

        this.nodes.on('update', (_, data: { 
                items: (string | number)[], 
                oldData: (Node & Record<'id', string | number>)[],
                data: (Node & Record<'id', string | number>)[]
            }) => {
            for (const item of data.items) {
                const node = this.nodes.get(item) as Node;
                const oldNode = data.oldData.find((n) => n.id === item) as Node;

                if (node.initial && !oldNode.initial) {
                    this.updateInitialNode(node);
                }

                if (node.final && !oldNode.final) {
                    this.updateNode(node.id, { shape: 'custom' });
                }

                if (!node.final && oldNode.final) {
                    this.updateNode(node.id, { shape: 'circle' });
                }
            }
        });

        this.transitions.on('add', (_, data: { items: (string | number)[] }) => {
            for (const id of data.items) {
                const transition = this.transitions.get(id) as Transition;
                this.updateTransition(Automaton.toNumber(id), { label: transition.symbols.join(', ') });
            }
        });

        this.transitions.on('update', (_, data: { 
                items: (string | number)[], 
                oldData: (Transition & Record<'id', string | number>)[],
                data: (Transition & Record<'id', string | number>)[]
            }) => {
            for (const id of data.items) {
                const transition = this.transitions.get(id) as Transition;

                if (transition.label !== this.getTransitionLabel(transition)) {
                    const label = this.getTransitionLabel(transition);
                    this.updateTransition(Automaton.toNumber(id), { label: label });
                }
            }
        });
    }

    private updateInitialNode(node: Node): void {
        const currentInitialNodes = this.nodes.get({ filter: (n) => n.initial && n.id !== node.id });
        this.nodes.update(currentInitialNodes.map((n) => ({ ...n, initial: false })));

        if (this.nodes.get(Graph.initialGhostNode.id)) {
            this.removeTransitionsFromNode(Graph.initialGhostNode.id);
        } else {
            this.addNode(Graph.initialGhostNode);
        }

        this.addTransition({
            from: Graph.initialGhostNode.id,
            to: node.id,
            label: '',
            id: -1,
            symbols: [],
        });


        this.nodes.update({
            ...Graph.initialGhostNode,
            x: node.x ? node.x - 100 : -100,
            y: node.y ? node.y : 0,
            hidden: false,
            fixed: true,
        });
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
