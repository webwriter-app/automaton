import { Logger } from "../../model/logger";
import { Automaton, SimulationResult, Node, Simulator, SimulationFeedback, SimulationStatus } from "./";
import type { Graph } from "../graph";

type StackDisplaying = Automaton & { displayStack(stack: readonly string[]): void };

export abstract class AutoSimulator extends Simulator {
    protected _currentNode: Node;
    protected _currentStep: number = 0;
    protected _currentWordPosition: number = 0;

    protected _interval: ReturnType<typeof setInterval> | undefined = undefined;

    protected _speed: number = 1000;

    protected _stepByStepPath: SimulationResult | undefined = undefined;
    protected _stepByStepHighlightTimeouts: ReturnType<typeof setTimeout>[] = [];
    
    constructor(automaton: Automaton) {
        super(automaton);
        this._currentNode = this._a.getInitialNode();
    }

    protected abstract getPath(): SimulationResult;

    public init() {}

    public simulate(): {
        status: SimulationStatus;
        simulationResult: SimulationResult;
    } {
        const result = this.getPath();

        if (result.errors && result.errors.length > 0) {
            return {
                status: SimulationStatus.ERROR,
                simulationResult: result,
            };
        }

        if (result.path!.nodes.length === 0) {
            return { status: SimulationStatus.NO_PATH, simulationResult: result  };
        }

        const lastNode = result.path!.nodes[result.path!.nodes.length - 1];
        this._a.highlightNode(lastNode);

        if (this._a.type === 'pda' && 'displayStack' in this._a) {
            const lastStack = result.path!.stacks![result.path!.stacks!.length - 1];
            (this._a as StackDisplaying).displayStack(lastStack);
        }

        return {
            status: result.accepted ? SimulationStatus.ACCEPTED : SimulationStatus.REJECTED,
            simulationResult: result,
        };
    }

    

    public startAnimation(cb: (result: SimulationFeedback) => void): void {
        const result = this.getPath();
        this._stepByStepPath = result;

        if (result.errors && result.errors.length > 0) {
            cb({
                status: SimulationStatus.ERROR,
                wordPosition: 0,
                simulationResult: result,
            });
            return;
        }
        
        if (result.path!.nodes.length === 0) {
            cb({ status: SimulationStatus.NO_PATH, wordPosition: 0, simulationResult: result  });
            return;
        }

        const iteration = () => {
            const node = result.path!.nodes[this._currentStep];

            // Display the current stack
            if (this._a.type === 'pda' && 'displayStack' in this._a) {
                const currentStack = result.path!.stacks![this._currentStep];
                (this._a as StackDisplaying).displayStack(currentStack);
            }

            if (this._currentStep >= result.path!.nodes.length - 1) {
                // This is the last step, so we highlight the node and stop the simulation
                clearInterval(this._interval);
                if (node) {
                    this._a.highlightNode(node);
                }
                cb({
                    status: result.accepted ? SimulationStatus.ACCEPTED : SimulationStatus.REJECTED,
                    wordPosition: this._word.length,
                    step: this._currentStep,
                    simulationResult: result,
                });
                return;
            }

            const transition = result.path!.transitions[this._currentStep];
            this._a.flashHighlightNode(node, this._speed / 2);
            setTimeout(() => this._a.flashHighlightTransition(transition.transition, this._speed / 2), this._speed / 2);

            cb({
                status: SimulationStatus.RUNNING,
                wordPosition: this._currentWordPosition,
                step: this._currentStep,
                simulationResult: result,
            });
            this._currentNode = node;
            this._currentStep++;

            if (transition.symbol !== '') {
                this._currentWordPosition++;
            }
        }

        iteration();
        this._interval = setInterval(iteration, this._speed);
    }

    public pauseAnimation(cb: Function): void {
        clearInterval(this._interval);
        cb({
            status: SimulationStatus.PAUSED,
            wordPosition: this._currentWordPosition,
            step: this._currentStep,
            simulationResult: this._stepByStepPath,
        });
    }

    public stopAnimation(cb: Function): void {
        clearInterval(this._interval);
        cb({
            status: SimulationStatus.STOPPED,
            wordPosition: this._currentWordPosition,
            step: this._currentStep,
            simulationResult: this._stepByStepPath,
        });
    }

    public initStepByStep(_: Graph, callback: Function): void {
        Logger.log('Initializing step-by-step mode');

        this._stepByStepPath = this.getPath();
        this._currentStep = 0;
        this._currentNode = this._a.getInitialNode();

        if (this._stepByStepPath.errors && this._stepByStepPath.errors.length > 0) {
            callback({
                status: SimulationStatus.ERROR,
                step: 0,
                wordPosition: 0,
                simulationResult: this._stepByStepPath,
            });
            return;
        }

        callback({
            status: this._stepByStepPath.path!.transitions.length === 0 ? SimulationStatus.NO_PATH : SimulationStatus.RUNNING,
            wordPosition: this._stepByStepPath.path!.nodes.length === 0 ? this.word.length : this._currentWordPosition,
            step: this._currentStep,
            simulationResult: this._stepByStepPath,
        });
    }

    public goToStep(step: number): {
        status: SimulationStatus;
        firstStep?: boolean;
        finalStep?: boolean;
        wordPosition: number;
        step: number;
        simulationResult?: SimulationResult;
    } {
         if (!this._stepByStepPath) {
            return {
                status: SimulationStatus.ERROR,
                wordPosition: this._currentWordPosition,
                step: this._currentStep,
                simulationResult: this._stepByStepPath,
            };
        }

        if (this._stepByStepPath.errors && this._stepByStepPath.errors.length > 0) {
            return {
                status: SimulationStatus.ERROR,
                wordPosition: this._currentWordPosition,
                step: this._currentStep,
            };
        }

        const oldStep = this._currentStep;
        this._currentStep = step;
        const isNextStep = this._currentStep === oldStep + 1;
        const isPreviousStep = this._currentStep === oldStep - 1;

        this._currentNode = this._stepByStepPath.path!.nodes[this._currentStep];

        this._currentWordPosition = this._stepByStepPath.path!.transitions.slice(0, this._currentStep).reduce((acc, t) => {
            if (t.symbol !== '') {
                return acc + 1;
            }
            return acc;
        }, 0);

        if (this._a.type === 'pda' && 'displayStack' in this._a) {
            const currentStack = this._stepByStepPath.path!.stacks![this._currentStep];
            (this._a as StackDisplaying).displayStack(currentStack);
        }

        // Reset scheduled highlights
        this._stepByStepHighlightTimeouts.forEach((timeout) => clearTimeout(timeout));
        this._stepByStepHighlightTimeouts = [];
        this._a.clearHighlights();

        if (isNextStep || isPreviousStep) {            
            const transition = this._stepByStepPath.path!.transitions[this._currentStep - (isNextStep ? 1 : 0)];
           
            this._a.flashHighlightTransition(transition.transition, this._speed / 2);
            this._stepByStepHighlightTimeouts.push(setTimeout(() => {
                this._a.highlightNode(this._currentNode);
            }, this._speed / 2));
        } else{
            this._a.highlightNode(this._currentNode);
        }

        if (this._currentStep >= this._stepByStepPath.path!.nodes.length - 1) {
            return {
                status: this._stepByStepPath.accepted ? SimulationStatus.ACCEPTED : SimulationStatus.REJECTED,
                firstStep: this._currentStep === 0,
                finalStep: true,
                wordPosition: this._currentWordPosition,
                step: this._currentStep,
                simulationResult: this._stepByStepPath,
            };
        }

        return {
            status: SimulationStatus.RUNNING,
            firstStep: this._currentStep === 0,
            finalStep: false,
            wordPosition: this._currentWordPosition,
            step: this._currentStep,
            simulationResult: this._stepByStepPath,
        };
    }

    public stepForward(): {
        status: SimulationStatus;
        firstStep?: boolean;
        finalStep?: boolean;
        wordPosition: number;
        step: number;
        simulationResult?: SimulationResult;
    } {
        return this.goToStep(this._currentStep + 1);
    }

    public stepBackward(): {
        status: SimulationStatus;
        firstStep?: boolean;
        finalStep?: boolean;
        wordPosition: number;
        step: number;
        simulationResult?: SimulationResult;
    } {
        return this.goToStep(this._currentStep - 1);
    }

    public reset(): void {
        this._currentStep = 0;
        this._currentWordPosition = 0;
        this._currentNode = this._a.getInitialNode();
        this._a.clearHighlights();
        this._errors = this._a.checkAutomaton();
        this._stepByStepPath = undefined;
        this._stepByStepHighlightTimeouts.forEach((timeout) => clearTimeout(timeout));
        this._stepByStepHighlightTimeouts = [];
        this.stopAnimation(() => {});
    }
}