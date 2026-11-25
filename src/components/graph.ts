import type { BackgroundDetail, ConnectDetail, ConnectingDetail, MoveDetail, MovingDetail, SceneAction, SelectDetail } from '@webwriter/widget/scene';
import type { Automaton, Transition, Node } from './automata';
import { EditingBar, type EditableSelection } from './editing-bar';
import type { AutomatonComponent } from '../widgets/webwriter-automaton';
import type { AutomatonError } from './errors';
import { layoutDiagram, NODE_RADIUS, type Layout, type Point } from '../model/diagram';

export type ToolMode = 'idle' | 'addNode' | 'addEdge';

/** The key of a state or a transition in the scene. */
export const nodeKey = (id: number) => `n${id}`;
export const edgeKey = (id: number) => `e${id}`;
const idOf = (key: string) => Number(key.slice(1));

const NEW_EDGE_BEND = 0.2;

/**
 * The editor of the diagram: what is selected, which tool is active, what the pointer did, and the
 * automaton that the scene shows. It renders nothing itself; `renderScene` does.
 */
export class Graph extends EventTarget {
    private readonly lifetime = new AbortController();

    public get signal(): AbortSignal {
        return this.lifetime.signal;
    }

    private _a: Automaton;
    public get automaton(): Automaton {
        return this._a;
    }

    private _ac: AutomatonComponent;
    public get component(): AutomatonComponent {
        return this._ac;
    }

    private readonly editingBar: EditingBar;
    private stopWatching = () => {};

    private _interactive = true;
    public get interactive(): boolean {
        return this._interactive;
    }

    /** The tool that the next click or drag on the diagram uses. */
    public mode: ToolMode = 'idle';
    public lockNodeAdd = false;
    public lockEdgeAdd = false;

    /** The keys of the selected states and transitions. */
    public selection: ReadonlySet<string> = new Set();

    /** Where the state that the "add state" button is dragged with would land, in diagram coordinates. */
    public dropPreview?: Point;

    private hoveredNodeId?: number;
    private cachedErrors?: AutomatonError[];
    private cachedLayout?: Layout;
    private moved?: Map<number, Point>;

    /** The transition that a wire held over a state would make, so that the scene can show it before the wire is dropped. */
    public pending?: { from: number; to: number };

    public toggleMode: () => void = () => {};

    constructor(a: Automaton, ac: AutomatonComponent) {
        super();
        this._a = a;
        this._ac = ac;
        this.editingBar = new EditingBar(ac);
        this.watch(a);
        this.signal.addEventListener('abort', () => {
            this.stopWatching();
        });
        this.listenToKeys();
    }

    private watch(a: Automaton) {
        this.stopWatching();
        this.stopWatching = a.subscribe(() => {
            this.cachedErrors = undefined;
            this.cachedLayout = undefined;
            this._ac.requestUpdate();
        });
    }

    public destroy(): void {
        if (this.signal.aborted) return;
        this.lifetime.abort();
        this.mode = 'idle';
    }

    /** The authored diagram was replaced from outside: select nothing and fit the view to the new content. */
    public loaded(): void {
        this.selection = new Set();
        this.dropPreview = undefined;
        this.invalidate();
        // Shows all of the new diagram once, and leaves the view to the reader afterwards.
        void this._ac.updateComplete.then(() => this._ac.viewport.fit({ follow: 'none' }));
    }

    /** Something other than the automaton changed what is drawn or checked, such as the alphabet. */
    public invalidate(): void {
        this.cachedErrors = undefined;
        this.cachedLayout = undefined;
        this._ac.requestUpdate();
    }

    public setInteractive(interactive: boolean): void {
        this._interactive = interactive;
        if (!interactive) {
            this.mode = 'idle';
            this.dropPreview = undefined;
        }
    }

    public setAutomaton(automaton: Automaton): void {
        this.mode = 'idle';
        this.selection = new Set();
        this.hoveredNodeId = undefined;
        this._a = automaton;
        this.watch(automaton);
        this.invalidate();
    }

    public get errors(): AutomatonError[] {
        return this.cachedErrors ??= this._a.checkAutomaton();
    }

    public get nodeWarnings() {
        return this.hoveredNodeId === undefined ? [] : this.errors.filter(error => error.node?.id === this.hoveredNodeId);
    }

    public get layout(): Layout {
        return this.cachedLayout ??= layoutDiagram(this._a.nodes.get(), this._a.transitions.get());
    }

    /** The arrow into the initial state; it follows the state while that is dragged. */
    public get initialArrow(): Point[] | undefined {
        return (this.moved ? layoutDiagram(this._a.nodes.get(), this._a.transitions.get(), this.moved) : this.layout).initial;
    }

    public hasError(id: number): boolean {
        return this._a.showErrors && this.errors.some(error => error.node?.id === id);
    }

    public hoverNode(id?: number): void {
        const next = id !== undefined && this.errors.some(error => error.node?.id === id) ? id : undefined;
        if (next === this.hoveredNodeId) return;
        this.hoveredNodeId = next;
        this._ac.requestUpdate();
    }

    /**
     * Whether a marquee and Shift-click select several states. On a touch screen a long press adds a state instead,
     * which Scene keeps for the marquee while several can be selected.
     */
    public get multipleSelection(): boolean {
        return this.editing && !matchMedia('(pointer: coarse)').matches;
    }

    // Permissions

    public get editing(): boolean {
        return this._interactive && this._ac.mode === 'edit';
    }

    public get canAddNode(): boolean {
        return this.editing && this._ac.settings.permissions.node.add;
    }

    public get canMoveNodes(): boolean {
        return this.editing && this._ac.settings.permissions.node.change;
    }

    public get canConnect(): boolean {
        return this.editing && this._ac.settings.permissions.edge.add;
    }

    /** The answer to the scene's question whether the reader may select, move or connect. */
    public can = (action: SceneAction): boolean => {
        if (action === 'move') return this.canMoveNodes;
        if (action === 'connect') return this.canConnect;
        return action === 'select';
    };

    // View

    private get canvas(): HTMLElement | null {
        return this._ac.shadowRoot?.querySelector<HTMLElement>('#graphCanvas') ?? null;
    }

    /** A client point as a point of the diagram, if it is over the canvas. */
    private scenePoint(client: Point): Point | undefined {
        const bounds = this.canvas?.getBoundingClientRect();
        if (!bounds || client.x < bounds.left || client.x >= bounds.right ||
            client.y < bounds.top || client.y >= bounds.bottom) return undefined;
        return this._ac.scene.toScene(client.x, client.y);
    }

    // Selection

    public clearSelection(): void {
        if (!this.selection.size) return;
        this.selection = new Set();
        this._ac.requestUpdate();
    }

    /** The selected states and transitions that still exist. */
    private get selected() {
        const nodes: Node[] = [];
        const edges: Transition[] = [];
        for (const key of this.selection) {
            const item = key.startsWith('n') ? this._a.getNode(idOf(key)) : this._a.getTransition(idOf(key));
            if (!item) continue;
            if (key.startsWith('n')) nodes.push(item as Node);
            else edges.push(item as Transition);
        }
        return { nodes, edges };
    }

    private get editableSelection(): EditableSelection | undefined {
        if (!this.editing) return;
        const { nodes, edges } = this.selected;
        if (nodes.length + edges.length !== 1) return;
        return nodes.length ? { type: 'node', data: nodes[0] } : { type: 'edge', data: edges[0] };
    }

    public readonly select = (event: CustomEvent<SelectDetail>) => {
        if (event.defaultPrevented) return;
        const { keys } = event.detail;
        if (this._ac.mode === 'simulate') {
            // A click on a transition is a move of the manual simulation; nothing stays selected.
            const edge = keys.find(key => key.startsWith('e'));
            if (edge) this.dispatchEvent(new CustomEvent('edge-select', { detail: idOf(edge) }));
            return;
        }
        if (!this.editing) return;
        this.selection = new Set(keys);
        this._ac.requestUpdate();
    };

    public readonly move = (event: CustomEvent<MoveDetail>) => {
        const moved = event.detail.items.filter(({ key }) => key.startsWith('n') && this._a.getNode(idOf(key)));
        if (!this.canMoveNodes || !moved.length) return event.preventDefault();
        this._a.nodes.update(moved.map(({ key, x, y }) => ({
            id: idOf(key), x: Math.round(x + NODE_RADIUS), y: Math.round(y + NODE_RADIUS),
        })));
        this.commitEdit();
    };

    /** Only the initial arrow is not attached to its state, so it is the one thing that has to follow a drag. */
    public readonly moving = (event: CustomEvent<MovingDetail>) => {
        const { items, state } = event.detail;
        const initial = this._a.nodes.get().find(node => node.initial);
        const lead = initial && items.find(({ key }) => key === nodeKey(initial.id));
        if (!lead) return;
        this.moved = state === 'move' ? new Map([[initial.id, { x: lead.x + NODE_RADIUS, y: lead.y + NODE_RADIUS }]]) : undefined;
        this._ac.requestUpdate();
    };

    /** Shows the transition that dropping the wire would make instead of the scene's plain line. */
    public readonly connecting = (event: CustomEvent<ConnectingDetail>) => {
        const { state, from, to } = event.detail;
        const ends = state === 'move' && from && to && this.canConnect ? [idOf(from.split(':')[0]), idOf(to.split(':')[0])] : undefined;
        const next = ends && this._a.getNode(ends[0]) && this._a.getNode(ends[1]) ? { from: ends[0], to: ends[1] } : undefined;
        if (next) event.preventDefault();
        if (next?.from === this.pending?.from && next?.to === this.pending?.to) return;
        this.pending = next;
        this._ac.requestUpdate();
    };

    public readonly connect = (event: CustomEvent<ConnectDetail>) => {
        this.pending = undefined;
        const from = idOf(event.detail.from.split(':')[0]);
        const to = idOf(event.detail.to.split(':')[0]);
        if (!this.canConnect || !this._a.getNode(from) || !this._a.getNode(to)) return event.preventDefault();
        this.insertTransition(from, to);
        this.selection = new Set([nodeKey(to)]);
        if (this.mode === 'addEdge' && !this.lockEdgeAdd) this.mode = 'idle';
        this.commitEdit();
    };

    // Nodes and transitions

    public commitEdit() {
        this._ac.commitGraphEdit();
        this._ac.requestUpdate();
    }

    private insertAndSelectNode(point: Point) {
        const a = this._a;
        const node = {
            x: Math.round(point.x), y: Math.round(point.y),
            id: a.getNewNodeId(), label: a.getNewNodeLabel(),
            initial: a.nodes.length === 0, final: false,
        };
        a.addNode(node);
        this.selection = new Set([nodeKey(node.id)]);
        this.commitEdit();
    }

    /** Adds a state at the centre of the view, or where a button was dropped. */
    public insertNodeFromButton(client?: Point) {
        if (!this.canAddNode) return;
        const canvas = this.canvas;
        const point = client ? this.scenePoint(client) : canvas && (() => {
            const { left, top, width, height } = canvas.getBoundingClientRect();
            return this._ac.scene.toScene(left + width / 2, top + height / 2);
        })();
        if (!point) return;
        this.mode = 'idle';
        this.insertAndSelectNode(point);
    }

    public previewNodeDrop(client?: Point) {
        const next = client && this.canAddNode ? this.scenePoint(client) : undefined;
        if (!this.dropPreview && !next) return;
        this.dropPreview = next;
        this._ac.requestUpdate();
    }

    public planTransition(from: number, to: number) {
        const a = this._a;
        const transitions = a.transitions.get();
        const existing = transitions.find(edge => edge.from === from && edge.to === to);
        const reverse = from === to ? undefined : transitions.find(edge => edge.from === to && edge.to === from);
        const bend = reverse ? NEW_EDGE_BEND : undefined;
        const symbol = this._ac.forcedAlphabet[0] || 'a';

        const transition: Transition = {
            from, to,
            ...existing,
            ...(bend ? { bend } : {}),
            id: existing?.id ?? a.getNewTransitionId(),
            label: '',
            symbols: [...(existing?.symbols ?? []), symbol],
        };
        if (a.type === 'pda') {
            const operations = existing?.symbols.map((symbol, index) =>
                existing.stackOperations?.[index] ?? { operation: 'none' as const, symbol, condition: '' }
            ) ?? [];
            transition.stackOperations = [...operations, { operation: 'none', symbol, condition: '' }];
        }
        transition.label = a.getTransitionLabel(transition);
        return { transition, existing, reverse, bend };
    }

    private insertTransition(from: number, to: number) {
        const { transition, existing, reverse, bend } = this.planTransition(from, to);
        if (reverse) this._a.transitions.update({ id: reverse.id, bend });
        if (existing) this._a.transitions.update(transition);
        else this._a.addTransition(transition);
    }

    public deleteSelection() {
        const { permissions } = this._ac.settings;
        const { nodes, edges } = this.selected;
        const removedNodes = permissions.node.delete ? nodes : [];
        const removedEdges = permissions.edge.delete ? edges : [];
        if (!this.editing || !removedNodes.length && !removedEdges.length) return;
        for (const edge of removedEdges) this._a.removeTransition(edge.id);
        for (const node of removedNodes) this._a.removeNode(node.id);
        this.selection = new Set();
        this.commitEdit();
    }

    // Editing bar

    public renderEditingBar() {
        const selection = this.editableSelection;
        if (!selection) return;
        const currentSelection = () => {
            const current = this.editableSelection;
            return current?.type === selection.type && current.data.id === selection.data.id ? current : undefined;
        };
        return this.editingBar.render(selection, (getPatch, permission = 'change', commit = true) => {
            const current = currentSelection();
            if (!current || !this._ac.settings.permissions[current.type][permission]) return;
            const patch = getPatch(current);
            if (current.type === 'node') this._a.updateNode(current.data.id, patch as Partial<Node>);
            else this._a.updateTransition(current.data.id, patch as Partial<Transition>);
            if (commit) this.commitEdit();
            else this._ac.requestUpdate();
        }, () => {
            const current = currentSelection();
            if (current) this.deleteSelection();
        });
    }

    // Tools

    /** Switches to a tool, or back to none if it is the active one. */
    public toggleTool(mode: 'addNode' | 'addEdge') {
        this.mode = this.mode === mode ? 'idle' : mode;
        this._ac.requestUpdate();
    }

    /** A double click or a long press on the background adds a state; a click does when the tool for it is active. */
    public readonly background = (event: CustomEvent<BackgroundDetail>) => {
        if (!this.canAddNode) return;
        const { gesture, point, pointerType } = event.detail;
        if (gesture === 'longpress' && pointerType !== 'touch') return;
        if (gesture === 'click' && this.mode !== 'addNode') return;
        if (gesture === 'click' && !this.lockNodeAdd) this.mode = 'idle';
        this.insertAndSelectNode({ x: point.x, y: point.y });
    };

    private listenToKeys() {
        this._ac.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'm' && e.ctrlKey) {
                e.preventDefault();
                this.toggleMode();
            }

            if (!this._interactive) return;

            const insideControls = e.composedPath().some(target =>
                target instanceof HTMLElement &&
                (target.classList.contains('editing-bar') || target.classList.contains('definition-pane') ||
                    target.localName === 'stack-extension'));
            if (insideControls) return;

            if ((e.key === 'Delete' || e.key === 'Backspace') && this.selection.size) {
                e.preventDefault();
                this.deleteSelection();
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.mode = 'idle';
                this.dropPreview = undefined;
                this.selection = new Set();
                this._a.clearHighlights();
                this._ac.requestUpdate();
            }

            if (e.key === 'q' && e.ctrlKey && !e.shiftKey && this.canAddNode) {
                e.preventDefault();
                this.toggleTool('addNode');
            }

            if (e.key === 'Q' && e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                this.lockNodeAdd = !this.lockNodeAdd;
                this._ac.requestUpdate();
            }

            if (e.key === 'e' && e.ctrlKey && !e.shiftKey && this._ac.settings.permissions.edge.add) {
                e.preventDefault();
                this.toggleTool('addEdge');
            }

            if (e.key === 'E' && e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                this.lockEdgeAdd = !this.lockEdgeAdd;
                this._ac.requestUpdate();
            }
        }, { signal: this.signal });
    }
}
