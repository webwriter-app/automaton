import { Automaton, Node, SimulationResult, Transition } from './';
import { TemplateResult, html } from 'lit';
import { DataSet } from 'vis-data';
import { LitElementWw } from '@webwriter/lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { stackStyles } from '../styles/stack';

import SlButton from '@shoelace-style/shoelace/dist/components/button/button.component.js';
import SlInput from '@shoelace-style/shoelace/dist/components/input/input.component.js';
import SlTooltip from '@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js';
import { biTrash } from '../styles/icons';
import { styleMap } from 'lit/directives/style-map.js';
import { ManualAutoSimulator } from './manual-auto';
import { localized, msg } from '@lit/localize';
import { AutomatonError } from '@u/errors';
import { Logger } from '@u/logger';
import { AutomatonType } from 'index';

export class PDA extends Automaton {
    public simulator: PDASimulator;
    public type: AutomatonType = 'pda';

    public extension = document.createElement('stack-extension') as StackExtension;

    constructor(nodes: Node[], transitions: Transition[]) {
        super(nodes, transitions);
        this.simulator = new PDASimulator(this);

        Logger.log('Created PDA', this.nodes.get(), this.transitions.get());
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

        Logger.log('Loaded PDA', this.nodes.get(), this.transitions.get());
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

    public displayStack(stack: string[]): void {
        this.extension.setStack(stack);
        this.extension.requestUpdate();
    }
}

class PDASimulator extends ManualAutoSimulator {
    private _initialStack: string[] = [];
    private _currentStack: string[] = [];

    constructor(protected _a: PDA) {
        super(_a);
        this._currentNode = this._a.getInitialNode();
        this._initialStack = this._a.extension.getStack();
        this._currentStack = [...this._initialStack];
        this._previousTransitions = {
            accepted: this._currentNode.final,
            path: {
                nodes: [this._currentNode],
                transitions: [],
                stacks: [this._currentStack]
            }
        };
    }

    public init(): void {
        this._initialStack = this._a.extension.getStack();
        this._currentStack = [...this._initialStack];
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
        this._a.redrawNodes();
        this._currentStack = [...this._initialStack];
        this._a.displayStack(this._initialStack);
        this._previousTransitions = {
            accepted: this._currentNode.final,
            path: {
                nodes: [this._currentNode],
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
        this._graph?.network.setSelection({ edges: [] });

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
                    dialog.remove();
                    resolve({ to, symbol, stackOpIndex, transition });
                });
                return button;
            });

            dialog.append(...buttons);
            this._graph?.component.shadowRoot?.appendChild(dialog);
            dialog.showModal();
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


type StackItem = {
    id: number;
    symbol: string;
};

@customElement('stack-extension')
@localized()
export class StackExtension extends LitElementWw {
    private _stack: DataSet<StackItem> = new DataSet<StackItem>();

    @property({ type: Array }) public accessor stack: StackItem[] = [];

    @property({ type: Boolean, attribute: true, reflect: true })
    public accessor add: boolean = true;

    @property({ type: Boolean, attribute: true, reflect: true })
    public accessor delete: boolean = true;

    @property({ type: Boolean, attribute: true, reflect: true })
    public accessor change: boolean = true;

    static get styles() {
        return stackStyles;
    }
    private afterElement: HTMLElement | null = null;
    @state() private accessor _dragging: boolean = false;

    @query('.pda__stack-items') private accessor _stackItems!: HTMLElement;
    @query('.pda__stack-button') private accessor _stackButton!: HTMLElement;
    @query('.dragging') private accessor _draggingElement!: HTMLElement;

    public static get scopedElements() {
        return {
            'sl-button': SlButton,
            'sl-input': SlInput,
            'sl-tooltip': SlTooltip,
        };
    }

    private isEditable(): boolean {
        return this.contentEditable === 'true';
    }

    constructor() {
        super();
        this._stack.on('*', () => {
            this.stack = [...this._stack.get()];
        });
    }

    public getStack(): string[] {
        return this._stack.get().map((s) => s.symbol).reverse();
    }

    public setStack(stack: string[]): void {
        Logger.log('Setting stack:', stack);
        this._stack.clear();
        this._stack.add([...stack].reverse().map((s, i) => ({ id: i, symbol: s })));
    }

    public push(symbol: string): void {
        this.pushItemToStack(symbol);
    }

    public pop(): void {
        this.popItemFromStack();
    }

    public getTopItem(): string {
        return this._stack.get(0)?.symbol || '';
    }

    public checkEmpty(): boolean {
        return this._stack.length === 0;
    }

    public checkSymbol(symbol: string): boolean {
        const item = this._stack.get(0);
        return item?.symbol === symbol;
    }

    public render(): TemplateResult {
        return html`<div class="pda__stack">
            <div class="pda__stack-title">${msg("Stack")}</div>
            <sl-button
                class="pda__stack-button"
                style=${styleMap({ display: this.isEditable() ? 'block' : 'none' })}
                size="small"
                id="pda__stack-button"
                circle
                ?disabled=${!this.add}
                @click=${() => {
                    this.pushItemToStack('a');
                    this.requestUpdate();
                }}
                @dragover=${(e: DragEvent) => {
                    e.preventDefault();
                    if (!this.delete) return;
                    this.clearDropMarkers();
                    this._stackButton.classList.add('dragover');
                    this._draggingElement.classList.add('deleteable');
                }}
                @dragleave=${(e: DragEvent) => {
                    e.preventDefault();
                    this._stackButton.classList.remove('dragover');
                    this._draggingElement.classList.remove('deleteable');
                }}
                >${this._dragging && this.delete ? biTrash : '+'}</sl-button
            >
            ${this.stack.length > 0 ? html`
            <div
                class="pda__stack-items"
                id="pda__stack-items"
                @dragover=${(e: DragEvent) => {
                    e.preventDefault();
                    const afterObject = this.getDragPosition(this._stackItems, e.clientY) as {
                        element: HTMLElement;
                        offset: number;
                    };
                    this.afterElement = afterObject.element;
                    this.clearDropMarkers();

                    if (!this.afterElement) {
                        this._stackItems.classList.add('drop-before');
                    } else {
                        this.afterElement.classList.add('drop-after');
                    }
                }}
            >
                ${this.stack.map(
                    (s, i) => html`
                        <div
                            class="pda__stack-item"
                            @dragstart=${(e: DragEvent) => {
                                (e.target as HTMLElement).classList.add('dragging');
                                e.dataTransfer?.setData('index', i.toString());
                                e.dataTransfer?.setDragImage(document.createElement('div'), 0, 0);
                                this._dragging = true;
                            }}
                            @dragend=${() => {
                                Logger.log(this._draggingElement);
                                if (this._draggingElement.classList.contains('deleteable')) {
                                    this.deleteStackSymbol(i);
                                } else {
                                    this.reorderStack(
                                        i,
                                        this.afterElement
                                            ? parseInt(this.afterElement.dataset.index!)
                                            : this._stack.length
                                    );
                                }
                                this._draggingElement.classList.remove('dragging');
                                this._dragging = false;
                                this.clearDropMarkers();
                            }}
                            @dragover=${(e: DragEvent) => {
                                e.preventDefault();
                            }}
                            draggable=${this.isEditable() && this.change ? 'true' : 'false'}
                            data-index=${i}
                        >
                            <sl-tooltip content=${s.symbol} placement="left" class="pda__stack-item__tooltip">
                                <sl-input
                                    size="small"
                                    @sl-input=${(e: Event) =>
                                        this.changeStackSymbol(i, (e.target as HTMLInputElement).value)}
                                    value=${s.symbol}
                                    ?disabled=${!this.isEditable() || !this.change}
                                    autocomplete="off"
                                    autocorrect="off"
                                    autocapitalize="off"
                                    spellcheck="false"
                                ></sl-input>
                            </sl-tooltip>
                        </div>
                    `
                )}
            </div>
            ` : html`
            <div class="pda__stack-items" id="pda__stack-items">
                <div class="pda__stack-item pda__stack-item--empty">
                ${msg("empty")}
                </div>
            </div>
            `}
        </div>`;
    }

    private pushItemToStack(symbol: string): void {
        const symbols = this._stack.get().map((s) => s.symbol);
        symbols.unshift(symbol);
        this._stack.clear();
        this._stack.add(symbols.map((s, i) => ({ id: i, symbol: s })));
    }

    private popItemFromStack(): void {
        const symbols = this._stack.get().map((s) => s.symbol);
        symbols.shift();
        this._stack.clear();
        this._stack.add(symbols.map((s, i) => ({ id: i, symbol: s })));
    }

    private changeStackSymbol(index: number, symbol: string): void {
        Logger.log('changeStackSymbol', index, symbol);
        this._stack.update({ id: index, symbol });
        this.requestUpdate();
    }

    private deleteStackSymbol(index: number): void {
        Logger.log('deleteStackSymbol', index, this._stack.get());
        this._stack.remove(index);
        const symbols = this._stack.get().map((s) => s.symbol);
        this._stack.clear();
        this._stack.add(symbols.map((s, i) => ({ id: i, symbol: s })));

        this.requestUpdate();
    }

    private clearDropMarkers(): void {
        const elements = [...this._stackItems.querySelectorAll('.pda__stack-item')];
        elements.forEach((e) => {
            e.classList.remove('drop-after');
            e.classList.remove('drop-before');
            if (e !== this._draggingElement) e.classList.remove('deleteable');
        });
        this._stackItems.classList.remove('drop-before');
        this._stackButton.classList.remove('dragover');
    }

    private reorderStack(oldIndex: number, newIndex: number): void {
        if (oldIndex === newIndex) return;

        if (oldIndex < newIndex) newIndex--;

        Logger.log('reorderStack', oldIndex, newIndex);

        const symbols = this._stack.get().map((s) => s.symbol);
        const item = symbols.splice(oldIndex, 1);
        symbols.splice(newIndex, 0, item[0]);
        this._stack.clear();
        this._stack.add(symbols.map((s, i) => ({ id: i, symbol: s })));
        this.requestUpdate();
    }

    private getDragPosition(container: HTMLElement, y: number) {
        let elements = [...container.querySelectorAll('.pda__stack-item:not(.dragging)')];
        return elements.reduce(
            (closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            },
            { offset: Number.NEGATIVE_INFINITY }
        );
    }
}
