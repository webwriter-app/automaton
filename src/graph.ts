import { Transition, Node, Automaton } from './automata';
import { Network, Position, type EdgeOptions } from 'vis-network';
import { EditingBar, type EditableSelection } from './components/EditingBar';
import { ToolMenu } from './components/ToolMenu';
import { DRAW } from './utils/draw';
import { html } from 'lit';
import { COLORS } from './utils/colors';
import { AutomatonComponent } from './index';
import { AutomatonError } from '@u/errors';
import { msg } from '@lit/localize';

type ConnectionSide = 'top' | 'left' | 'bottom' | 'right';
type CanvasGesture = {
    pointer: { DOM: Position; canvas: Position };
    event: { pointerType?: string; preventDefault(): void };
};

const MIN_NODE_DIAMETER = 40;
const NODE_MARGIN = 5;
const TRANSITION_CURVE = { enabled: true, type: 'curvedCW', forceDirection: 'none', roundness: 0 };
const POINTER_CURVE = { enabled: true, type: 'continuous', roundness: 0.5 };
const PREVIEW_OPACITY = 0.55;

type PreviewEdge = {
    toId: string | number;
    from?: Position;
    to?: Position;
    edgeType: { getDistanceToEdge(x1: number, y1: number, x2: number, y2: number, x: number, y: number): number };
    hover: boolean;
    chooser: boolean | ((values: { color: string; opacity: number; width: number }) => void);
    options: {
        label?: string;
        hidden: boolean;
        smooth: typeof TRANSITION_CURVE;
        color: { opacity: number };
    };
    setOptions(options: EdgeOptions & { to?: string | number }): void;
};

/**
 * Represents a graph that combines an automaton, network, and other components.
 */
export class Graph {
    private _a: Automaton;
    public get automaton(): Automaton {
        return this._a;
    }

    private _n: Network;
    public get network(): Network {
        return this._n;
    }

    private _ac: AutomatonComponent;
    public get component(): AutomatonComponent {
        return this._ac;
    }

    private editingBar: EditingBar;

    private _interactive: boolean = true;

    private _tm: ToolMenu;

    private hoveredNodeId?: number;
    public get nodeWarnings() {
        return this.hoveredNodeId === undefined ? [] : this._errors.filter(error => error.node?.id === this.hoveredNodeId);
    }

    private _errors: AutomatonError[] = [];
    public get errors(): AutomatonError[] {
        return this._errors;
    }

    private _lastPosition: Position = { x: 0, y: 0 };
    private _connection?: { from: number; side: ConnectionSide };
    private _connectionDrag?: { id: number; start: Position; moved: boolean };

    private nodeDropPreview?: Position;
    private _previewPlan?: ReturnType<ToolMenu['planTransition']>;

    public toggleMode: () => void = () => {};

    private _requestUpdate: () => void = () => {};
    public set requestUpdate(fn: () => void) {
        this._requestUpdate = () => {
            this._errors = this._a.checkAutomaton();
            fn();
            this.displayErrors();
        };
    }
    public get requestUpdate(): () => void {
        return this._requestUpdate;
    }

    constructor(private canvas: HTMLElement, a: Automaton, tm: ToolMenu, ac: AutomatonComponent) {
        this._a = a;
        this._ac = ac;
        this._tm = tm;
        this.editingBar = new EditingBar(ac);

        const options = {
            physics: false,
            nodes: {
                shape: 'circle',
                ctxRenderer: DRAW.ctx.doubleCircle,
                color: {
                    background: 'white',
                    border: 'black',
                    hover: COLORS.blue,
                    highlight: COLORS.blue,
                },
                heightConstraint: { minimum: MIN_NODE_DIAMETER },
                widthConstraint: { minimum: MIN_NODE_DIAMETER },
            },
            edges: {
                color: 'black',
                smooth: TRANSITION_CURVE,
                arrows: 'to',
                font: {},
            },
            layout: {
                randomSeed: 1,
            },
            interaction: { hover: true },
            manipulation: {
                enabled: true,
                controlNodeStyle: {
                    color: { background: '#0284c7', border: COLORS.blue.border },
                },
                addNode: this._tm.handleNodeAdd.bind(this._tm),
                addEdge: this._tm.handleTransitionAdd.bind(this._tm),
            },
        };

        this._n = new Network(canvas, a.getGraphData(), options);
        canvas.addEventListener('pointermove', event => {
            if (this._connection) this.moveConnectionPreview(event);
        });
        canvas.addEventListener('pointerleave', () => {
            this.hideNodeWarning();
            if (!this._connection || this._connectionDrag) return;
            this.previewConnectionTarget({});
            this._n.redraw();
        });
        canvas.addEventListener('pointerdown', () => {
            // Remove the temporary endpoint before vis-network hit-tests the clicked node.
            if (this._connection) this.connectionPreview._cleanupTemporaryNodesAndEdges();
        }, { capture: true });
        this._errors = this._a.checkAutomaton();
        this.displayErrors();
        this.setupListeners();
    }

    /**
     * Sets the interactive mode of the graph.
     * @param interactive - A boolean value indicating whether the graph should be interactive or not.
     */
    public setInteractive(interactive: boolean): void {
        this._interactive = interactive;
        if (!interactive) {
            this.cancelConnection();
            this._tm.cancelNodeDrag();
        }
        if (this._interactive) {
            this._n.setOptions({
                interaction: {
                    dragNodes: true,
                    // dragView: true,
                    // zoomView: true,
                },
            });
        } else {
            this._n.setOptions({
                interaction: {
                    dragNodes: false,
                    // dragView: false,
                    // zoomView: false,
                },
            });
        }
    }

    /**
     * Sets the automaton for the graph.
     *
     * @param automaton - The automaton to set.
     */
    public setAutomaton(automaton: Automaton): void {
        this.cancelConnection();
        this._tm.cancelNodeDrag();
        this.hoveredNodeId = undefined;
        this._a = automaton;
        this._n.setData(this._a.getGraphData());
        this._a.redrawNodes();
        this.requestUpdate();
    }

    private get canUseCanvasTools() {
        return this._interactive && this._ac.mode === 'edit' && this._tm.mode === 'idle';
    }

    public get canAddNode() {
        return this._interactive && this._ac.mode === 'edit' && this._ac.settings.permissions.node.add;
    }

    private addNodeAt({ pointer }: CanvasGesture): boolean {
        if (!this.canUseCanvasTools || !this.canAddNode || this._connection ||
            this._n.getNodeAt(pointer.DOM) !== undefined || this._n.getEdgeAt(pointer.DOM) !== undefined) return false;

        this.insertAndSelectNode(pointer.canvas);
        return true;
    }

    public insertNodeFromButton(client?: Position) {
        if (!this.canAddNode) return;
        const point = client ? this.nodeDropPoint(client) : this._n.DOMtoCanvas({
            x: this.canvas.clientWidth / 2,
            y: this.canvas.clientHeight / 2,
        });
        if (!point) return;

        if (this._tm.mode !== 'idle') {
            this._tm.mode = 'idle';
            this._n.disableEditMode();
        }
        this.cancelConnection();
        this.insertAndSelectNode(point);
    }

    private insertAndSelectNode(point: Position) {
        const node = this._tm.insertNode(
            { x: Math.round(point.x), y: Math.round(point.y) },
            node => this._a.addNode(node),
        );
        this._n.selectNodes([node.id]);
        this.commitEdit();
    }

    public commitEdit() {
        this._ac.commitGraphEdit();
        this._requestUpdate();
    }

    private nodeDropPoint(client: Position) {
        const bounds = this.canvas.getBoundingClientRect();
        if (client.x < bounds.left || client.x >= bounds.right ||
            client.y < bounds.top || client.y >= bounds.bottom) return undefined;
        return this._n.DOMtoCanvas({
            x: (client.x - bounds.left) * this.canvas.clientWidth / bounds.width,
            y: (client.y - bounds.top) * this.canvas.clientHeight / bounds.height,
        });
    }

    public previewNodeDrop(client?: Position) {
        const previous = this.nodeDropPreview;
        this.nodeDropPreview = client && this.canAddNode ? this.nodeDropPoint(client) : undefined;
        if (!previous && !this.nodeDropPreview) return;
        this.canvas.classList.toggle('node-drop-preview', !!this.nodeDropPreview);
        this._n.redraw();
    }

    private drawNodeDropPreview(ctx: CanvasRenderingContext2D) {
        if (!this.nodeDropPreview || !this.canAddNode) return;
        ctx.save();
        ctx.globalAlpha = 0.75;
        DRAW.ctx.circle({
            ctx,
            ...this.nodeDropPreview,
            label: this._a.getNewNodeLabel(),
            style: {
                size: MIN_NODE_DIAMETER / 2 + NODE_MARGIN,
                color: COLORS.blue.background,
                borderColor: COLORS.blue.border,
                borderWidth: 1,
            },
        }).drawNode();
        ctx.restore();
    }

    private get selectedNodeId(): number | undefined {
        const [id, ...others] = this._n.getSelectedNodes();
        return typeof id === 'number' && id !== Graph.initialGhostNode.id && !others.length && this._a.getNode(id)
            ? id : undefined;
    }

    private connectionPoint(id: number, side: ConnectionSide): Position {
        const { left, right, top, bottom } = this._n.getBoundingBox(id);
        const x = side === 'left' ? left : side === 'right' ? right : (left + right) / 2;
        const y = side === 'top' ? top : side === 'bottom' ? bottom : (top + bottom) / 2;
        const point = this._n.canvasToDOM({ x, y });
        return {
            x: point.x + (side === 'left' ? -4 : side === 'right' ? 4 : 0),
            y: point.y + (side === 'top' ? -4 : side === 'bottom' ? 4 : 0),
        };
    }

    // The public add-edge mode binds its own gestures. Use its preview directly so
    // the temporary edge and target node match the toolbar's connection tool.
    private get connectionPreview() {
        return (this._n as Network & { manipulation: {
            touchTime: number;
            temporaryIds: { nodes: string[]; edges: string[] };
            _handleConnect(event: { center: Position }): void;
            _dragControlNode(event: { center: Position }): void;
            _cleanupTemporaryNodesAndEdges(): void;
        } }).manipulation;
    }

    private startConnection(side: ConnectionSide): boolean {
        const from = this.selectedNodeId;
        if (from === undefined || !this.canUseCanvasTools || !this._ac.settings.permissions.edge.add) return false;
        if (this._connection?.from === from) {
            this._connection.side = side;
            this._n.redraw();
            return true;
        }

        this.cancelConnection();
        this._connection = { from, side };
        const bounds = this.canvas.getBoundingClientRect();
        const center = this._n.canvasToDOM(this._n.getPositions([from])[from]);
        const preview = this.connectionPreview;
        // These gestures already have one start event per press.
        preview.touchTime = 0;
        preview._handleConnect({ center: { x: bounds.left + center.x, y: bounds.top + center.y } });
        this.previewConnectionTarget({});
        this._n.redraw();
        return true;
    }

    private moveConnectionPreview(event: PointerEvent) {
        const preview = this.connectionPreview;
        if (preview.temporaryIds.nodes.length) {
            preview._dragControlNode({ center: { x: event.clientX, y: event.clientY } });
        }
    }

    private get previewBody() {
        return (this._n as Network & { body: {
            nodes: Record<string, Position & { options: { opacity: number } }>;
            edges: Record<string, PreviewEdge>;
        } }).body;
    }

    private previewConnectionTarget({ from, to }: { from?: string | number; to?: string | number }) {
        const { nodes: [endpointId], edges: [edgeId] } = this.connectionPreview.temporaryIds;
        if (!endpointId || !edgeId) return;

        const validTarget = this._ac.mode === 'edit' && this._ac.settings.permissions.edge.add &&
            typeof from === 'number' && typeof to === 'number' && to !== from &&
            to !== Graph.initialGhostNode.id && this._a.getNode(from) && this._a.getNode(to);
        const plan = validTarget ? this._tm.planTransition({ from, to }) : undefined;
        this._previewPlan = plan;

        const edge = this.previewBody.edges[edgeId];
        const destination = plan?.transition.to ?? endpointId;
        const configuredCurve = plan?.transition.smooth;
        const smooth = plan
            ? typeof configuredCurve === 'boolean' ? { ...TRANSITION_CURVE, enabled: configuredCurve } : configuredCurve ?? TRANSITION_CURVE
            : POINTER_CURVE;
        const label = plan?.transition.label ?? ' ';
        const hidden = !!plan?.existing;
        if (edge.toId !== destination || edge.options.label !== label || edge.options.hidden !== hidden ||
            edge.options.smooth.type !== smooth.type || edge.options.smooth.roundness !== smooth.roundness ||
            edge.options.smooth.enabled !== smooth.enabled || edge.options.color.opacity !== PREVIEW_OPACITY) {
            edge.setOptions({
                to: destination, smooth, label, hidden,
                chosen: false,
                labelHighlightBold: false,
                color: {
                    color: '#000000', hover: '#000000', highlight: '#000000',
                    inherit: false, opacity: PREVIEW_OPACITY,
                },
                font: { color: 'rgba(52, 52, 52, 0.55)' },
            });
        }
        this.previewBody.nodes[endpointId].options.opacity = PREVIEW_OPACITY;
    }

    private stylePreviewedEdges(): (() => void) | undefined {
        const plan = this._previewPlan;
        if (!plan || !this.connectionPreview.temporaryIds.edges.length) return;
        if (plan.existing) {
            const edge = this.previewBody.edges[plan.existing.id];
            if (!edge) return;
            const { hover, chooser } = edge;
            edge.hover = true;
            edge.chooser = values => {
                values.color = '#0284c7';
                values.opacity = PREVIEW_OPACITY;
                values.width += 2;
            };
            return () => {
                edge.hover = hover;
                edge.chooser = chooser;
            };
        }

        // A new opposite-direction transition bends both arrows when committed.
        if (plan.reverse && plan.smooth) {
            const edge = this.previewBody.edges[plan.reverse.id];
            if (!edge) return;
            const smooth = edge.options.smooth;
            if (smooth.enabled === plan.smooth.enabled && smooth.type === plan.smooth.type &&
                smooth.roundness === plan.smooth.roundness) return;
            edge.options.smooth = { ...plan.smooth, forceDirection: smooth.forceDirection };
            edge.setOptions({ smooth: plan.smooth });
            return () => {
                edge.options.smooth = smooth;
                edge.setOptions({});
            };
        }
        return undefined;
    }

    public cancelConnection() {
        if (!this._connection) return;
        this._connection = undefined;
        this._connectionDrag = undefined;
        this._previewPlan = undefined;
        this.connectionPreview._cleanupTemporaryNodesAndEdges();
    }

    private finishConnection(position: Position) {
        const from = this._connection?.from;
        this.cancelConnection();
        const to = this._n.getNodeAt(position);
        if (from !== undefined && this.canUseCanvasTools && this._ac.settings.permissions.edge.add &&
            typeof to === 'number' && to !== from && to !== Graph.initialGhostNode.id &&
            this._a.getNode(from) && this._a.getNode(to)) {
            this._tm.insertTransition({ from, to }, transition => this._a.addTransition(transition));
            this._n.selectNodes([to]);
            this.commitEdit();
        } else {
            this._n.redraw();
        }
    }

    private startConnectionDrag(event: PointerEvent, side: ConnectionSide) {
        if (event.button !== 0 || !event.isPrimary || !this.startConnection(side)) return;
        this._connectionDrag = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, moved: false };
        (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
    }

    private moveConnectionDrag(event: PointerEvent) {
        const drag = this._connectionDrag;
        if (drag?.id !== event.pointerId) return;
        drag.moved ||= Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) >= 4;
        if (drag.moved) this.moveConnectionPreview(event);
    }

    private releaseConnectionDrag(event: PointerEvent) {
        const drag = this._connectionDrag;
        if (drag?.id !== event.pointerId) return;
        this._connectionDrag = undefined;
        if (!drag.moved) return;
        const bounds = this.canvas.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX >= bounds.right ||
            event.clientY < bounds.top || event.clientY >= bounds.bottom) {
            this.cancelConnection();
            this._n.redraw();
            return;
        }
        this.finishConnection({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    }

    public renderConnectionPoints() {
        const labels = {
            top: msg("Connect from top"),
            left: msg("Connect from left"),
            bottom: msg("Connect from bottom"),
            right: msg("Connect from right"),
        };
        return html`${(Object.keys(labels) as ConnectionSide[]).map(side => html`
            <button type="button" class="connection-point" data-side=${side} hidden
                aria-label=${labels[side]} title=${labels[side]} contenteditable="false"
                @pointerdown=${(event: PointerEvent) => this.startConnectionDrag(event, side)}
                @pointermove=${(event: PointerEvent) => this.moveConnectionDrag(event)}
                @pointerup=${(event: PointerEvent) => this.releaseConnectionDrag(event)}
                @pointercancel=${() => {
                    this.cancelConnection();
                    this._n.redraw();
                }}
                @click=${(event: MouseEvent) => {
                    if (event.detail === 0) this.startConnection(side);
                }}></button>
        `)}`;
    }

    private positionConnectionPoints() {
        const canConnect = this.canUseCanvasTools && this._ac.settings.permissions.edge.add;
        if (this._connection && (!canConnect || !this._a.getNode(this._connection.from))) {
            this.cancelConnection();
        }
        this.canvas.classList.toggle('connection-in-progress', this.connectionPreview.temporaryIds.nodes.length > 0);

        const id = canConnect ? this.selectedNodeId : undefined;
        for (const point of this._ac.shadowRoot!.querySelectorAll<HTMLButtonElement>('.connection-point')) {
            point.hidden = id === undefined;
            if (id === undefined) continue;
            const side = point.dataset.side as ConnectionSide;
            const { x, y } = this.connectionPoint(id, side);
            point.style.left = `${x}px`;
            point.style.top = `${y}px`;
            point.classList.toggle('connection-point--active', this._connection?.side === side && this._connection.from === id);
        }
    }

    /**
     * Represents the initial ghost node in the graph.
     */
    static initialGhostNode: Node = {
        id: -1,
        label: '',
        x: -100,
        y: -100,
        initial: false,
        final: false,
        widthConstraint: false,
        size: 1,
        hidden: true,
        fixed: true,
    };    
    
    private get editableSelection(): EditableSelection | undefined {
        if (!this._interactive || this._ac.mode !== 'edit') return;
        const [nodeId, ...otherNodes] = this._n.getSelectedNodes();
        if (nodeId !== undefined) {
            if (typeof nodeId !== 'number' || nodeId === Graph.initialGhostNode.id || otherNodes.length) return;
            const node = this._a.getNode(nodeId);
            if (node) return { type: 'node', data: node };
            return;
        }
        const [edgeId, ...otherEdges] = this._n.getSelectedEdges();
        if (typeof edgeId !== 'number' || otherEdges.length) return;
        const edge = this._a.getTransition(edgeId);
        if (edge && edge.from !== Graph.initialGhostNode.id) return { type: 'edge', data: edge };
        return undefined;
    }

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
            else this._requestUpdate();
        }, () => {
            const current = currentSelection();
            if (current) this.deleteSelected(current);
        });
    }

    private deleteSelected(selection: EditableSelection) {
        if (!this._ac.settings.permissions[selection.type].delete) return;
        this._n.unselectAll();
        if (selection.type === 'node') this._a.removeNode(selection.data.id);
        else this._a.removeTransition(selection.data.id);
        this.commitEdit();
        if (this._tm.mode === 'addEdge') this.network.addEdgeMode();
    }

    private setupListeners() {
        this._n.on('click', ({ pointer }: CanvasGesture) => {
            if (this._connection) this.finishConnection(pointer.DOM);
        });
        this._n.on('doubleClick', (gesture: CanvasGesture) => this.addNodeAt(gesture));
        this._n.on('controlNodeDragging', event => this.previewConnectionTarget(event.controlEdge));
        // Highlight or bend existing arrows for this frame without changing their data.
        let restorePreview: (() => void) | undefined;
        this._n.on('beforeDrawing', () => { restorePreview = this.stylePreviewedEdges(); });
        this._n.on('afterDrawing', ctx => {
            restorePreview?.();
            this.drawNodeDropPreview(ctx);
            if (!this.connectionPreview.temporaryIds.edges.length) this._previewPlan = undefined;
            this.positionConnectionPoints();
        });

        this._n.on('oncontext', ({ event }: CanvasGesture) => event.preventDefault());
        this._n.on('hold', (gesture: CanvasGesture) => {
            if (gesture.event.pointerType === 'touch') this.addNodeAt(gesture);
        });
        this._n.on('select', () => this._ac.requestUpdate());
        this._n.on('hoverNode', ({ node }: { node: number }) => {
            if (node !== Graph.initialGhostNode.id && this._errors.some(error => error.node?.id === node)) {
                this.hoveredNodeId = node;
                this._ac.requestUpdate();
            }
        });
        this._n.on('blurNode', () => this.hideNodeWarning());
        this._n.on('dragging', ({ nodes }: { nodes: number[] }) => {
            if (nodes.length) this.updateGhostNodePosition();
        });
        this._n.on('dragStart', () => this.hideNodeWarning());
        this._n.on('dragEnd', ({ nodes }: { nodes: number[] }) => {
            const moved = nodes.filter(id => id !== Graph.initialGhostNode.id && this._a.getNode(id));
            if (moved.length) {
                const positions = this._n.getPositions(moved);
                this._a.nodes.update(moved.map(id => ({ id, ...positions[id] })));
                this.commitEdit();
            }
            this._lastPosition = this._n.getViewPosition();
        });
        let scaleBeforeResize: number | undefined;
        this._n.on('resize', () => {
            if (scaleBeforeResize !== undefined) return;
            const scale = this._n.getScale();
            scaleBeforeResize = scale;
            // vis-network emits resize before scaling the camera to the new canvas size.
            queueMicrotask(() => {
                scaleBeforeResize = undefined;
                if (this._n.getScale() !== scale) this._n.moveTo({ scale });
            });
        });
        this._n.on('zoom', (e: any) => {
            if (e.scale < 0.5) {
                this._n.moveTo({ scale: 0.5, position: this._lastPosition });
            } else if (e.scale > 5) {
                this._n.moveTo({ scale: 5, position: this._lastPosition });
            } else {
                this._lastPosition = this._n.getViewPosition();
            }
        });
        this._ac.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'm' && e.ctrlKey) {
                e.preventDefault();
                this.toggleMode();
            }

            if (!this._interactive) return;

            const insideControls = e.composedPath().some(target =>
                target instanceof HTMLElement &&
                (target.classList.contains('editing-bar') || target.localName === 'stack-extension'));
            if (insideControls) return;

            const selected = this.editableSelection;
            if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
                e.preventDefault();
                this.deleteSelected(selected);
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelConnection();
                this._tm.cancelNodeDrag();
                this._n.unselectAll();
                this._a.clearHighlights();
                this._ac.requestUpdate();
                this._tm.mode = 'idle';
            }

            if (e.key === 'q' && e.ctrlKey && !e.shiftKey && this.canAddNode) {
                e.preventDefault();
                this._tm.addNode();
            }

            if (e.key === 'Q' && e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                this._tm.lockNodeAdd = !this._tm.lockNodeAdd;
            }

            if (e.key === 'e' && e.ctrlKey && !e.shiftKey && this._ac.settings.permissions.edge.add) {
                e.preventDefault();
                this._tm.addEdge();
            }

            if (e.key === 'E' && e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                this._tm.lockEdgeAdd = !this._tm.lockEdgeAdd;
            }

            if (selected?.type === 'node' && this._ac.settings.permissions.node.change) {
                const dx = e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowRight' ? 10 : 0;
                const dy = e.key === 'ArrowUp' ? -10 : e.key === 'ArrowDown' ? 10 : 0;
                if (dx || dy) {
                    e.preventDefault();
                    const { id, x = 0, y = 0 } = selected.data;
                    this._a.updateNode(id, { x: x + dx, y: y + dy });
                    this.commitEdit();
                }
            }
        });
    }

    private updateGhostNodePosition() {
        const ghostId = Graph.initialGhostNode.id;
        const { nodes, edges } = this.previewBody;
        const ghost = nodes[ghostId];
        const initial = this._a.getInitialNode();
        if (edges[ghostId]) edges[ghostId].options.hidden = !initial;
        if (!ghost || !initial || !nodes[initial.id]) return;

        const center = nodes[initial.id];
        const nodeRadius = (id: number) => {
            const { left, right, top, bottom } = this._n.getBoundingBox(id);
            return Math.max(20, (right - left) / 2, (bottom - top) / 2);
        };
        const radius = nodeRadius(initial.id);
        const length = Math.max(100, radius + 70);
        const obstacles = this._a.nodes.get()
            .filter(node => node.id !== ghostId && node.id !== initial.id && nodes[node.id])
            .map(node => ({ position: nodes[node.id], radius: nodeRadius(node.id) + 6 }))
            .filter(node => Math.hypot(node.position.x - center.x, node.position.y - center.y) <= length + node.radius);
        const transitions = this._a.transitions.get()
            .filter(transition => transition.from !== ghostId)
            .map(transition => edges[transition.id])
            .filter(edge => edge?.from && edge.to && !edge.options.hidden);

        let best = { x: center.x - length, y: center.y };
        let bestScore = Infinity;
        // Prefer the usual left side, then try nearby angles until the shaft is clear.
        for (let index = 0; index < 16; index++) {
            const step = Math.ceil(index / 2) * (index % 2 ? 1 : -1);
            const angle = Math.PI + step * Math.PI / 8;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            let score = 0;
            for (let distance = radius + 4; distance <= length; distance += 8) {
                const x = center.x + dx * distance;
                const y = center.y + dy * distance;
                if (obstacles.some(node => Math.hypot(x - node.position.x, y - node.position.y) < node.radius)) score += 2;
                if (transitions.some(({ from, to, edgeType }) =>
                    edgeType.getDistanceToEdge(from!.x, from!.y, to!.x, to!.y, x, y) < 9)) score++;
                if (score >= bestScore) break;
            }
            if (score < bestScore) {
                best = { x: center.x + dx * length, y: center.y + dy * length };
                bestScore = score;
                if (score === 0) break;
            }
        }

        // This helper node belongs to the canvas. Its position is never authored.
        ghost.x = best.x;
        ghost.y = best.y;
    }

    /**
     * Displays the errors in the graph by highlighting the error nodes.
     */
    private displayErrors() {
        this._a.redrawNodes();
        this.updateGhostNodePosition();
        for (const error of this._errors) {
            if (error.node) {
                this._a.highlightErrorNode(error.node.id);
            }
        }
        this._n.redraw();
    }

    private hideNodeWarning() {
        if (this.hoveredNodeId === undefined) return;
        this.hoveredNodeId = undefined;
        this._ac.requestUpdate();
    }
}
