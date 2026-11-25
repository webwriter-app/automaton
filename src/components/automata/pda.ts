import { Automaton, Node, SimulationResult, Transition } from './';
import type { StackExtension } from './stack-extension';
import { ManualAutoSimulator } from './manual-auto';
import { sourceMsg } from '../../../localization/localizer';
import { Logger } from '../../model/logger';
import { AutomatonType } from '../../widgets/webwriter-automaton';

export class PDA extends Automaton {
    public simulator: PDASimulator;
    public type: AutomatonType = 'pda';

    public extension: StackExtension;
    public startingStack: readonly string[] = [];

    /** @param registry The registry of the widget that renders the stack, which defines `stack-extension`. */
    constructor(nodes: Node[], transitions: Transition[], registry: CustomElementRegistry) {
        super(nodes, transitions);
        this.extension = document.createElement('stack-extension', { customElementRegistry: registry }) as StackExtension;
        this.simulator = new PDASimulator(this);

        Logger.log('Created PDA', this.nodes.get(), this.transitions.get());
    }


    public saveAutomaton(): string {
        throw new Error('Method not implemented.');
    }

    public getTransitionLabel(transition: Transition): string {
        if (transition.stackOperations) {
            const operations = transition.stackOperations;
            const parts = transition.symbols.map((s, i) => {
                const stackSymbol = operations[i].condition || 'X';
                if (s === '') s = 'ε';
                switch (operations[i].operation) {
                    case 'push':
                        return `${s},${stackSymbol}|${operations[i].symbol}${stackSymbol}`;
                    case 'pop':
                        return `${s},${operations[i].symbol}|ε`;
                    case 'empty':
                        return `${s},Γ₀|Γ₀`;
                    default:
                        return `${s},${stackSymbol}|${stackSymbol}`;
                }
            });
            return parts.join('\n');
        }

        if (transition.symbols.length === 1) {
            return transition.symbols[0] === '' ? 'ε' : transition.symbols[0];
        }

        return transition.symbols.join(', ');
    }

    public setStartingStack(stack: readonly string[]): void {
        this.startingStack = [...stack];
        this.extension.setStack(stack);
    }

    public displayStack(stack: readonly string[]): void {
        if (this.extension.contentEditable === 'true') return;
        this.extension.setStack(stack);
    }
}

class PDASimulator extends ManualAutoSimulator {
    private _initialStack: string[] = [];
    private _currentStack: string[] = [];

    constructor(protected _a: PDA) {
        super(_a);
        this._currentNode = this._a.getInitialNode();
        this.init();
        this._previousTransitions = {
            accepted: this._currentNode?.final ?? false,
            path: {
                nodes: this._currentNode ? [this._currentNode] : [],
                transitions: [],
                stacks: [this._currentStack]
            }
        };
    }

    public init(): void {
        this._initialStack = [...this._a.startingStack];
        this._currentStack = [...this._initialStack];
        this._a.displayStack(this._currentStack);
    }

    protected getPath(): SimulationResult {
        this._errors = this._a.checkAutomaton();
        if (this._errors.length > 0) {
            return { accepted: false, path: { nodes: [], transitions: [], stacks: [] }, errors: this._errors };
        }

        type PathTransition = { transition: Transition; symbol: string };

        // Necessary for performance: track visited states
        const visitedStates = new Set<string>();
        const generateStateKey =
            (node: Node, wordIndex: number, stack: string[]): string => `${node.id}-${wordIndex}-${stack.join(',')}`;

        // Cache the epsilon closure computations for performance
        const epsilonClosures = new Map<string, Set<{ nodes: Node[]; transitions: PathTransition[]; stacks: string[][] }>>();

        const getEpsilonClosure = (
            node: Node,
            stack: string[]
        ): Set<{ nodes: Node[]; transitions: PathTransition[]; stacks: string[][] }> => {
            // TODO: Use truly unique keys for closures
            const generateKey = (n: Node, s: string[]): string => `${n.id}-${s.join(',')}`;

            if (epsilonClosures.has(generateKey(node, stack))) {
                return epsilonClosures.get(generateKey(node, stack))!;
            }

            const closure = new Set<{ nodes: Node[]; transitions: PathTransition[]; stacks: string[][] }>();
            const visited = new Set<string>();
            const queue: { nodes: Node[]; transitions: PathTransition[]; stacks: string[][] }[] = [
                { nodes: [node], transitions: [], stacks: [stack] }
            ];

            while (queue.length > 0) {
                const current = queue.shift()!;
                const currentNode = current.nodes[current.nodes.length - 1];
                const currentStack = current.stacks[current.stacks.length - 1];
                if (visited.has(generateKey(currentNode, currentStack))) continue;

                visited.add(generateKey(currentNode, currentStack));
                closure.add(current);

                const currentEpsilonTransitions = this._a.getTransitionsFromNode(currentNode).filter((t) => t.symbols.includes(''));

                for (const transition of currentEpsilonTransitions) {
                    const targetNode = this._a.getNode(transition.to);

                    // Handle stack operations
                    if (!transition.stackOperations || transition.stackOperations.length === 0) {
                        continue;
                    }
                    for (let i = 0; i < transition.stackOperations.length; i++) {
                        const stackOperation = transition.stackOperations[i];
                        const currentSymbol = transition.symbols[i];

                        if (currentSymbol !== '') continue;
                        if (stackOperation.condition && stackOperation.condition !== stack[stack.length - 1]) continue;

                        const newStack = [...currentStack];

                        if (stackOperation.operation === 'push') {
                            newStack.push(stackOperation.symbol);
                        } else if (stackOperation.operation === 'pop') {
                            if (newStack.length > 0 && newStack[newStack.length - 1] === stackOperation.symbol) {
                                newStack.pop();
                            } else {
                                continue;
                            }
                        } else if (stackOperation.operation === 'empty') {
                            if (newStack.length !== 0) {
                                continue;
                            }
                        }

                        // Add the new stack state to the history
                        const newStackHistory = [...current.stacks, newStack];

                        if (targetNode && !visited.has(generateKey(targetNode, newStack))) {
                            queue.push({
                                nodes: [...current.nodes, targetNode],
                                transitions: [...current.transitions, { transition, symbol: '' }],
                                stacks: newStackHistory
                            });
                        }
                    }
                }
            }

            epsilonClosures.set(generateKey(node, stack), closure);
            return closure;
        };

        const initialNode = this._a.getInitialNode();
        if (!initialNode) {
            return { accepted: false, path: { nodes: [], transitions: [], stacks: [] } };
        }

        type SearchState = {
            node: Node;
            wordIndex: number;
            stack: string[];
            path: { nodes: Node[]; transitions: PathTransition[]; stacks: string[][] };
        };

        // Start with epsilon closure of initial node
        const initialClosure = getEpsilonClosure(initialNode, this._initialStack);
        const queue: SearchState[] = Array.from(initialClosure).map((closurePath) => ({
            node: closurePath.nodes[closurePath.nodes.length - 1],
            wordIndex: 0,
            stack: closurePath.stacks[closurePath.stacks.length - 1],
            path: closurePath
        }));

        while (queue.length > 0) {
            const { node, wordIndex, stack, path } = queue.shift()!;

            // Check if we have already visited this state
            const stateKey = generateStateKey(node, wordIndex, stack);
            if (visitedStates.has(stateKey)) {
                continue;
            }
            visitedStates.add(stateKey);

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

                // Handle stack operations
                if (!transition.stackOperations || transition.stackOperations.length !== transition.symbols.length)
                    continue;
                for (let i = 0; i < transition.stackOperations.length; i++) {
                    const stackOperation = transition.stackOperations[i];
                    const currentSymbol = transition.symbols[i];

                    if (currentSymbol !== currentLetter) continue;
                    if (stackOperation.condition && stackOperation.condition !== stack[stack.length - 1]) continue;

                    const newStack = [...stack];

                    if (stackOperation.operation === 'push') {
                        newStack.push(stackOperation.symbol);
                    } else if (stackOperation.operation === 'pop') {
                        if (newStack.length > 0 && newStack[newStack.length - 1] === stackOperation.symbol) {
                            newStack.pop();
                        } else {
                            continue;
                        }
                    } else if (stackOperation.operation === 'empty') {
                        if (newStack.length !== 0) continue;
                    }

                    const targetClosure = getEpsilonClosure(targetNode, [...newStack]);

                    for (const closurePath of targetClosure) {
                        const newPathNodes = [...path.nodes, ...closurePath.nodes];
                        const newPathTransitions = [
                            ...path.transitions,
                            { transition, symbol: currentLetter },
                            ...closurePath.transitions
                        ];
                        const newPathStackHistory = [...path.stacks, ...closurePath.stacks];

                        queue.push({
                            node: closurePath.nodes[closurePath.nodes.length - 1],
                            wordIndex: wordIndex + 1,
                            stack: closurePath.stacks[closurePath.stacks.length - 1],
                            path: { nodes: newPathNodes, transitions: newPathTransitions, stacks: newPathStackHistory }
                        });
                    }
                }
            }
        }

        // No accepting path found
        return { accepted: false, path: { nodes: [], transitions: [], stacks: [] } };
    }

    public reset(): void {
        super.reset();
        this.init();
        this._previousTransitions = {
            accepted: this._currentNode?.final ?? false,
            path: {
                nodes: this._currentNode ? [this._currentNode] : [],
                transitions: [],
                stacks: [this._currentStack]
            }
        };
    }

    protected isValidTransition(transition: Transition): boolean {
        const currentSymbol = this._word[this._currentWordPosition] || '';
        const validFrom = transition.from === this._currentNode.id;
        if (!validFrom) return false;

        for (let i = 0; i < transition.symbols.length; i++) {
            const symbol = transition.symbols[i];
            if (symbol !== currentSymbol && symbol !== '') continue;

            const stackOp = transition.stackOperations?.[i];
            if (!stackOp) continue;

            const topOfStack = this._currentStack.length > 0 ? this._currentStack[this._currentStack.length - 1] : undefined;

            if (stackOp.condition && stackOp.condition !== topOfStack) continue;
            if (stackOp.operation === 'pop' && (this._currentStack.length === 0 || stackOp.symbol !== topOfStack))
                continue;
            if (stackOp.operation === 'empty' && this._currentStack.length > 0) continue;

            return true;
        }

        return false;
    }

    protected highlightPossibleTransitions(node: Node): boolean {
        const transitions = this._a.getTransitionsFromNode(node);
        const currentSymbol = this._word[this._currentWordPosition] || '';

        const validTransitions = transitions.filter((t) => {
            if (t.from !== node.id) return false;

            for (let i = 0; i < t.symbols.length; i++) {
                const symbol = t.symbols[i];
                if (symbol !== currentSymbol && symbol !== '') continue;

                const stackOp = t.stackOperations?.[i];
                if (!stackOp) continue;

                const topOfStack =
                    this._currentStack.length > 0 ? this._currentStack[this._currentStack.length - 1] : undefined;

                if (stackOp.condition && stackOp.condition !== topOfStack) continue;
                if (stackOp.operation === 'pop' && (this._currentStack.length === 0 || stackOp.symbol !== topOfStack))
                    continue;
                if (stackOp.operation === 'empty' && this._currentStack.length > 0) continue;

                return true;
            }
            return false;
        });

        this._a.clearHighlights();
        this._graph?.clearSelection();

        if (validTransitions.length === 0) {
            this._a.highlightNode(node);
            return false;
        }
        for (const transition of validTransitions) {
            this._a.highlightTransition(transition);
        }
        this._a.highlightNode(node);
        return true;
    }

    protected async getManualMove(
        transition: Transition
    ): Promise<{ to: Node; symbol: string; stackOpIndex: number; transition: Transition } | null> {
        const currentSymbol = this._word[this._currentWordPosition] || '';
        const to = this._a.getNode(transition.to) as Node;

        const validOps: { symbol: string; stackOpIndex: number }[] = [];

        for (let i = 0; i < transition.symbols.length; i++) {
            const symbol = transition.symbols[i];
            if (symbol !== currentSymbol && symbol !== '') continue;

            const stackOp = transition.stackOperations?.[i];
            if (!stackOp) continue;

            const topOfStack =
                this._currentStack.length > 0 ? this._currentStack[this._currentStack.length - 1] : undefined;

            if (stackOp.condition && stackOp.condition !== topOfStack) continue;
            if (stackOp.operation === 'pop' && (this._currentStack.length === 0 || stackOp.symbol !== topOfStack))
                continue;
            if (stackOp.operation === 'empty' && this._currentStack.length > 0) continue;

            validOps.push({ symbol, stackOpIndex: i });
        }

        if (validOps.length === 0) {
            return null;
        }

        if (validOps.length === 1) {
            return { to, symbol: validOps[0].symbol, stackOpIndex: validOps[0].stackOpIndex, transition };
        }

        return new Promise((resolve) => {
            const dialog = document.createElement('dialog');
            dialog.style.position = 'absolute';
            dialog.style.top = '50%';
            dialog.style.left = '50%';
            dialog.style.transform = 'translate(-50%, -50%)';
            dialog.style.zIndex = '1000';

            const msg = this._graph?.component.msg ?? sourceMsg;
            const p = document.createElement('p');
            p.innerText = msg('Choose a move:');
            dialog.appendChild(p);

            const buttons = validOps.map(({ symbol, stackOpIndex }) => {
                const button = document.createElement('button');
                const stackOp = transition.stackOperations![stackOpIndex];
                let opLabel = '';
                switch (stackOp.operation) {
                    case 'push':
                        opLabel = msg('push') + ' ' + stackOp.symbol;
                        break;
                    case 'pop':
                        opLabel = msg('pop') + ' ' + stackOp.symbol;
                        break;
                    case 'empty':
                        opLabel = msg('empty');
                        break;
                    default:
                        opLabel = msg('none');
                        break;
                }
                button.innerHTML = `${symbol === '' ? 'ε' : symbol}, ${opLabel}`;
                button.addEventListener('click', () => {
                    dialog.close();
                    resolve({ to, symbol, stackOpIndex, transition });
                });
                return button;
            });

            dialog.append(...buttons);
            this.showMoveDialog(dialog, () => resolve(null));
        });
    }

    protected updateStateAfterManualMove(move: { to: Node; symbol: string; stackOpIndex: number; transition: Transition }): void {
        const stackOp = move.transition.stackOperations![move.stackOpIndex];

        const newStack = [...this._currentStack];
        if (stackOp.operation === 'push') {
            newStack.push(stackOp.symbol);
        } else if (stackOp.operation === 'pop') {
            newStack.pop();
        }

        this._previousTransitions.path!.stacks!.push(newStack);

        this._currentStack = newStack;
        this._a.displayStack(this._currentStack);
    }

    protected updateStateAfterGoToStep(step: number): void {
        this._currentStack = this._previousTransitions.path!.stacks![step];
        this._a.displayStack(this._currentStack);
    }
}
