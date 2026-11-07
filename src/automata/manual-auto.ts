import { Graph } from '../graph';
import { Automaton, SimulationFeedback, SimulationResult, SimulationStatus, Transition, Node } from './index';
import { AutoSimulator } from './auto';

export abstract class ManualAutoSimulator extends AutoSimulator {
    protected _manualMode = false;
    protected _mode: 'simulation' | 'stepByStep' = 'simulation';
    protected _graph: Graph | undefined;
    protected _previousTransitions: SimulationResult = { accepted: false, path: { nodes: [], transitions: [] } };

    constructor(automaton: Automaton) {
        super(automaton);
        this._currentNode = this._a.getInitialNode();
        this._previousTransitions = { accepted: this._currentNode?.final ?? false, path: { nodes: this._currentNode ? [this._currentNode] : [], transitions: [] } };
    }

    public setManualMode(manual: boolean): void {
        this._manualMode = manual;
    }

    public reset(): void {
        super.reset();
        this._manualMode = false;
        this._mode = 'simulation';
        this._currentNode = this._a.getInitialNode();
        this._previousTransitions = { accepted: this._currentNode?.final ?? false, path: { nodes: this._currentNode ? [this._currentNode] : [], transitions: [] } };
    }

    protected abstract isValidTransition(transition: Transition): boolean;
    protected abstract highlightPossibleTransitions(node: Node): boolean;
    protected abstract getManualMove(transition: Transition): Promise<{ to: Node, symbol: string, [key: string]: any } | null>;
    protected abstract updateStateAfterManualMove(move: { to: Node, symbol: string, [key: string]: any }): void;
    protected abstract updateStateAfterGoToStep(step: number): void;

    public initStepByStep(graph: Graph, cb: (feedback: SimulationFeedback) => void): void {
        if (this._manualMode) {
            this._currentNode = this._a.getInitialNode() as Node;
            this._currentStep = 0;
            this._currentWordPosition = 0;
            if (!this._previousTransitions.path) {
                this._previousTransitions.path = { nodes: [], transitions: [] };
            }
            this._previousTransitions.path.nodes = [this._currentNode];
            this._previousTransitions.path.transitions = [];
            this._previousTransitions.accepted = this._currentNode.final;
            if (this._previousTransitions.path.stacks) {
                this._previousTransitions.path.stacks = [this._previousTransitions.path.stacks[0]];
            }
            this._mode = 'stepByStep';

            if (this._graph !== graph) {
                this._graph = graph;

                this._graph?.network.on('selectEdge', async (e) => {
                    if (this._mode !== 'stepByStep') return;

                    const transition = this._a.getTransition(e.edges[0]);

                    if (!transition) return;
                    if (!this.isValidTransition(transition)) return;

                    const move = await this.getManualMove(transition);
                    if (!move) return;

                    this._previousTransitions.path!.nodes.push(move.to);
                    this._previousTransitions.path!.transitions.push({ transition, symbol: move.symbol });
                    this._previousTransitions.accepted = move.to.final;

                    this._currentNode = move.to;
                    this._currentStep++;
                    this._currentWordPosition += move.symbol === '' ? 0 : 1;

                    this.updateStateAfterManualMove(move);

                    this._a.clearHighlights();
                    this._a.highlightNode(this._currentNode);
                    const nextMovePossible = this.highlightPossibleTransitions(this._currentNode);
                    this._sendStepByStepFeedback(nextMovePossible, cb);
                });
            }

            const nextMovePossible = this.highlightPossibleTransitions(this._currentNode);
            this._sendStepByStepFeedback(nextMovePossible, cb, true);
        } else {
            super.initStepByStep(graph, cb);
        }
    }

    private _sendStepByStepFeedback(nextMovePossible: boolean, cb: (feedback: SimulationFeedback) => void, initial = false): boolean {
        if (this._currentNode.final && this._currentWordPosition >= this._word.length) {
            this._graph?.network.setSelection({ edges: [] });
            cb({
                status: SimulationStatus.ACCEPTED,
                wordPosition: this._currentWordPosition,
                step: this._currentStep,
                simulationResult: this._previousTransitions
            });
            return true;
        }
        
        cb({
            status: nextMovePossible ? SimulationStatus.RUNNING : SimulationStatus.NO_MOVES,
            wordPosition: initial ? 0 : this._currentWordPosition,
            step: initial ? 0 : this._currentStep,
            simulationResult: this._previousTransitions
        });
        return false;
    }

    public goToStep(step: number): {
        status: SimulationStatus;
        firstStep?: boolean;
        finalStep?: boolean;
        wordPosition: number;
        step: number;
        simulationResult?: SimulationResult;
    } {
        if (!this._manualMode) {
            return super.goToStep(step);
        }

        if (step < 0 || step > this._currentStep) {
            // Invalid step
            return {
                status: SimulationStatus.RUNNING,
                wordPosition: this._currentWordPosition,
                step: this._currentStep,
                simulationResult: this._previousTransitions,
                firstStep: this._currentStep === 0,
                finalStep: true
            };
        }

        this._currentStep = step;
        this._previousTransitions.path!.nodes = this._previousTransitions.path!.nodes.slice(0, this._currentStep + 1);
        this._previousTransitions.path!.transitions = this._previousTransitions.path!.transitions.slice(
            0,
            this._currentStep
        );
        if (!!this._previousTransitions.path!.stacks) {
            this._previousTransitions.path!.stacks = this._previousTransitions.path!.stacks.slice(0, this._currentStep + 1);
        }

        this._currentNode = this._previousTransitions.path!.nodes[this._currentStep];
        this.updateStateAfterGoToStep(this._currentStep);

        // Recalculate word position
        this._currentWordPosition = this._previousTransitions.path!.transitions.reduce((acc, t) => {
            return acc + (t.symbol !== '' ? 1 : 0);
        }, 0);

        this._previousTransitions.accepted = this._currentNode.final;

        this._a.clearHighlights();
        this._a.highlightNode(this._currentNode);
        let nextMovePossible = this.highlightPossibleTransitions(this._currentNode);

        if (this._currentNode.final && this._currentWordPosition >= this._word.length) {
            this._graph?.network.setSelection({ edges: [] });
            return {
                status: SimulationStatus.ACCEPTED,
                wordPosition: this._currentWordPosition,
                step: this._currentStep,
                simulationResult: this._previousTransitions,
                firstStep: this._currentStep === 0,
                finalStep: true
            };
        }

        return {
            status: nextMovePossible ? SimulationStatus.RUNNING : SimulationStatus.NO_MOVES,
            wordPosition: this._currentWordPosition,
            step: this._currentStep,
            simulationResult: this._previousTransitions,
            firstStep: this._currentStep === 0,
            finalStep: true
        };
    }
}
