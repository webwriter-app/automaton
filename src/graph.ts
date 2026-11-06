import { Transition, Node, Automaton } from './automata';
import { Network, Position } from 'vis-network';
import { ContextMenu } from './components/ContextMenu';
import { ToolMenu } from './components/ToolMenu';
import { DRAW } from './utils/draw';
import { html, TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { biExclamationOctagon } from './styles/icons';
import { COLORS } from './utils/colors';
import { AutomatonComponent } from './index';
import { AutomatonError } from '@u/errors';
import { Logger } from './utils/logger';
import { msg } from '@lit/localize';

type ConnectionSide = 'top' | 'left' | 'bottom' | 'right';
type CanvasGesture = {
    pointer: { DOM: Position; canvas: Position };
    event: { pointerType?: string; preventDefault(): void };
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

    private _cm: ContextMenu;
    public get contextMenu(): ContextMenu {
        return this._cm;
    }

    private _interactive: boolean = true;

    private _tm: ToolMenu;

    private _hovered!: Node | Transition | null;
    private _hoveredType!: 'Node' | 'Transition';

    private _selected!: Node | Transition;
    private _selectedType!: 'Node' | 'Transition';

    private _errors: AutomatonError[] = [];
    public get errors(): AutomatonError[] {
        return this._errors;
    }

    private _currentError!: {
        offset: {
            x: number;
            y: number;
        };
        message: TemplateResult<1>;
    } | null;

    private _lastPosition: Position = { x: 0, y: 0 };
    private _nodeCenterPointerOffset: Position = { x: 0, y: 0 };
    private _connection?: { from: number; side: ConnectionSide };
    private _connectionDrag?: { id: number; start: Position; moved: boolean };

    public toggleMode: () => void = () => {};

    private _requestUpdate: () => void = () => {};
    public set requestUpdate(fn: () => void) {
        this._requestUpdate = () => {
            this._errors = this._a.checkAutomaton();
            if (!this._errors.some((e) => e.node?.id === this._hovered?.id)) {
                this._currentError = null;
            }

            fn();
            this.displayErrors();
        };

        this._cm.requestUpdate = this._requestUpdate;
    }
    public get requestUpdate(): () => void {
        return this._requestUpdate;
    }

    constructor(private canvas: HTMLElement, a: Automaton, tm: ToolMenu, ac: AutomatonComponent) {
        this._a = a;
        this._ac = ac;
        this._tm = tm;
        this._cm = new ContextMenu(ac);
        this._cm.requestUpdate = this._requestUpdate;

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
                heightConstraint: { minimum: 40 },
                widthConstraint: { minimum: 40 },
            },
            edges: {
                color: 'black',
                smooth: {
                    enabled: true,
                    type: 'curvedCW',
                    forceDirection: 'none',
                    roundness: 0,
                },
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
        if (!interactive) this.cancelConnection();
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
        this._a = automaton;
        this._n.setData(this._a.getGraphData());
        this._a.redrawNodes();
        this.requestUpdate();
    }

    private get canUseCanvasTools() {
        return this._interactive && this._ac.mode === 'edit' && this._tm.mode === 'idle';
    }

    private addNodeAt({ pointer }: CanvasGesture): boolean {
        if (!this.canUseCanvasTools || !this._ac.settings.permissions.node.add || this._connection ||
            this._n.getNodeAt(pointer.DOM) !== undefined || this._n.getEdgeAt(pointer.DOM) !== undefined) return false;

        const node = this._tm.insertNode(
            { x: Math.round(pointer.canvas.x), y: Math.round(pointer.canvas.y) },
            node => this._a.addNode(node),
        );
        this._n.selectNodes([node.id]);
        this._selected = node;
        this._selectedType = 'Node';
        this._requestUpdate();
        return true;
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
            temporaryIds: { nodes: string[] };
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
        this._n.redraw();
        return true;
    }

    private moveConnectionPreview(event: PointerEvent) {
        const preview = this.connectionPreview;
        if (preview.temporaryIds.nodes.length) {
            preview._dragControlNode({ center: { x: event.clientX, y: event.clientY } });
        }
    }

    public cancelConnection() {
        if (!this._connection) return;
        this._connection = undefined;
        this._connectionDrag = undefined;
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
            this._selected = this._a.getNode(to) as Node;
            this._selectedType = 'Node';
            this._requestUpdate();
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
    
    /**
     * Updates the selected data (either a Node or a Transition) in the graph.
     *
     * @param data - The data (Node or Transition) to be updated.
     */
    private updateSelectedData(data: Node | Transition) {
        if (this._selectedType === 'Node') {
            if (data.id === Graph.initialGhostNode.id) return;

            if (!data.label) this._a.updateNode(data.id, { ...(data as Node), label: undefined });
            else this._a.updateNode(data.id, data as Node);

            this._selected = this._a.getNode(data.id) as Node;
        } else if (this._selectedType === 'Transition') {
            if (!data.label) this._a.updateTransition(data.id, { ...(data as Transition), label: undefined });
            this._a.updateTransition(data.id, data as Transition);

            this._selected = this._a.getTransition(data.id) as Transition;
        }
        this._requestUpdate();
    }

    /**
     * Deletes the selected node or transition from the automaton.
     */
    private deleteSelected() {
        Logger.log('Deleting', this._selected);

        if (this._selectedType === 'Node') {
            if (this._selected.id === Graph.initialGhostNode.id) return;
            if (!this._ac.settings.permissions.node.delete) return;

            this._a.removeNode(this._selected.id);
        } else if (this._selectedType === 'Transition') {
            if (!this._ac.settings.permissions.edge.delete) return;

            this._a.removeTransition(this._selected.id);
        }
        this._requestUpdate();

        if (this._tm.mode === 'addEdge') {
            this.network.addEdgeMode();
        }

        this._cm.blur();
        this._selected = null as any;
    }

    /**
     * Sets up event listeners for the graph.
     * This method handles various events such as click, context menu, node selection, node hover, etc.
     * It also handles keyboard events for adding nodes, adding edges, deleting selected elements, etc.
     */
    private setupListeners() {
        this._n.on('click', ({ pointer }: CanvasGesture) => {
            this._cm.blur();
            if (this._connection) this.finishConnection(pointer.DOM);
        });
        this._n.on('doubleClick', (gesture: CanvasGesture) => this.addNodeAt(gesture));
        this._n.on('afterDrawing', () => this.positionConnectionPoints());

        const oncontext = (e: any) => {
            e.event.preventDefault();

            if (!this._interactive) return;

            if (!this._hovered) {
                this._cm.blur();
                return;
            }

            if (
                this._hovered.id === Graph.initialGhostNode.id ||
                (this._hoveredType === 'Transition' && (this._hovered as Transition).from === Graph.initialGhostNode.id)
            ) {
                return;
            }

            this._selected = this._hovered;
            this._selectedType = this._hoveredType;
            this._cm.setData(
                this._selected,
                this._selectedType,
                this.updateSelectedData.bind(this),
                this.deleteSelected.bind(this)
            );
            this._cm.setPosition(e.pointer.DOM);
            if (this._selectedType === 'Node') {
                this._n.selectNodes([this._selected.id]);
            } else if (this._selectedType === 'Transition') {
                this._n.selectEdges([this._selected.id]);
            }
            this._cm.show();
        };
        this._n.on('oncontext', oncontext);
        this._n.on('hold', (gesture: CanvasGesture) => {
            if (gesture.event.pointerType === 'touch' && this.addNodeAt(gesture)) return;
            oncontext(gesture);
        });
        this._n.on('selectNode', (e: any) => {
            const nodeId = e.nodes[0];
            
            if (nodeId === Graph.initialGhostNode.id) {
                this._n.unselectAll();
                return;
            }
            
            this._selected = this._a.getNode(nodeId) as Node;
            this._selectedType = 'Node';
        });
        this._n.on('deselectNode', () => {
            this._selected = null as any;
            this._selectedType = null as any;
        });
        this._n.on('hoverNode', (e: any) => {
            const nodeId = e.node as number;
            if (nodeId === Graph.initialGhostNode.id) return;
            
            this._hovered = this._a.getNode(nodeId);
            this._hoveredType = 'Node';

            if (this._ac.showHelp == 'false') return;

            if (this._errors.some((e) => e.node?.id === this._hovered?.id)) {
                this._currentError = {
                    offset: this._n.canvasToDOM({
                        x: (this._hovered?.x as number) + 15,
                        y: (this._hovered?.y as number) + 15,
                    }),
                    message: this._errors.filter((e) => e.node?.id === this._hovered?.id)?.reduce(
                        (acc, error) => html`${acc}${error.message}<br/>`,
                        html``
                    ) || '',
                };
            }
        });
        this._n.on('blurNode', () => {
            this._hovered = null;
            this._currentError = null;
        });
        this._n.on('hoverEdge', (e: any) => {
            this._hovered = this._a.getTransition(e.edge);
            this._hoveredType = 'Transition';
        });
        this._n.on('blurEdge', () => {
            this._hovered = null;
        });        
        this._n.on('dragging', (e: any) => {
            if (!e.nodes || e.nodes.length == 0) return;

            const draggedNodeId = e.nodes[0] as number;
            const draggedNode = this._a.getNode(draggedNodeId);
            
            if (draggedNode && draggedNode.initial && draggedNodeId !== Graph.initialGhostNode.id) {
                const newX = e.pointer.canvas.x + this._nodeCenterPointerOffset.x - 100;
                const newY = e.pointer.canvas.y + this._nodeCenterPointerOffset.y;
                
                this._a.updateNode(Graph.initialGhostNode.id, {
                    x: newX,
                    y: newY
                });
            }
        });        
        this._n.on('dragStart', (e: any) => {
            this._currentError = null;
            this._cm.blur();

            if (e.nodes && e.nodes.length > 0) {
                this._nodeCenterPointerOffset = {
                    x: (e.nodes[0] !== undefined ? this._a.getNode(e.nodes[0])?.x ?? 0 : 0) - e.pointer.canvas.x,
                    y: (e.nodes[0] !== undefined ? this._a.getNode(e.nodes[0])?.y ?? 0 : 0) - e.pointer.canvas.y
                }
            }
        });
        this._n.on('dragEnd', () => {
            this._n.storePositions();
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

            if ((e.key === 'Delete' || e.key === 'Backspace') && !this._cm.isVisible() && this._selected) {
                e.preventDefault();
                this.deleteSelected();
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelConnection();
                this._selected = null as any;
                this._selectedType = null as any;
                this._n.unselectAll();
                this._a.clearHighlights();

                this._cm.blur();
                this._tm.mode = 'idle';
            }

            if (e.key === 'q' && e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                this._tm.addNode();
                this._tm.visible = true;
            }

            if (e.key === 'Q' && e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                this._tm.lockNodeAdd = !this._tm.lockNodeAdd;
                this._tm.visible = true;
            }

            if (e.key === 'e' && e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                this._tm.addEdge();
                this._tm.visible = true;
            }

            if (e.key === 'E' && e.ctrlKey && e.shiftKey) {
                e.preventDefault();
                this._tm.lockEdgeAdd = !this._tm.lockEdgeAdd;
                this._tm.visible = true;
            }

            if (e.key === 'ArrowLeft' && this._selected && this._selectedType === 'Node' && !this._cm.isVisible()) {
                e.preventDefault();
                const x = (this._selected as Node).x || 0;
                this.updateSelectedData({ ...this._selected, x: x - 10 });
                this.updateGhostNodePosition();
            }

            if (e.key === 'ArrowRight' && this._selected && this._selectedType === 'Node' && !this._cm.isVisible()) {
                e.preventDefault();
                const x = (this._selected as Node).x || 0;
                this.updateSelectedData({ ...this._selected, x: x + 10 });
                this.updateGhostNodePosition();
            }

            if (e.key === 'ArrowUp' && this._selected && this._selectedType === 'Node' && !this._cm.isVisible()) {
                e.preventDefault();
                const y = (this._selected as Node).y || 0;
                this.updateSelectedData({ ...this._selected, y: y - 10 });
                this.updateGhostNodePosition();
            }

            if (e.key === 'ArrowDown' && this._selected && this._selectedType === 'Node' && !this._cm.isVisible()) {
                e.preventDefault();
                const y = (this._selected as Node).y || 0;
                this.updateSelectedData({ ...this._selected, y: y + 10 });
                this.updateGhostNodePosition();
            }
        });
    }

    /**
     * Updates the position of the ghost node based on the initial node's position.
     */
    public updateGhostNodePosition() {
        const initialNode = this._a.getInitialNode();
        if (initialNode && this._a.getNode(Graph.initialGhostNode.id)) {
            const newX = (initialNode.x || 0) - 100;
            const newY = initialNode.y || 0;
            
            Graph.initialGhostNode.x = newX;
            Graph.initialGhostNode.y = newY;
            
            this._a.updateNode(Graph.initialGhostNode.id, {
                x: newX,
                y: newY
            });
        }
    }

    /**
     * Displays the errors in the graph by highlighting the error nodes.
     */
    private displayErrors() {
        this._a.redrawNodes();
        for (const error of this._errors) {
            if (error.node) {
                this._a.highlightErrorNode(error.node.id);
            }
        }
        this._n.redraw();
    }

    /**
     * Renders the error display.
     * @returns The HTML representation of the error display.
     */
    public renderErrorDisplay() {
        return html`<sl-alert
            class="errordisplay"
            variant="warning"
            style=${styleMap({
                display: this._currentError ? 'block' : 'none',
                left: `${this._currentError?.offset.x}px`,
                top: `${this._currentError?.offset.y}px`,
            })}
            open
            >${biExclamationOctagon} ${this._currentError?.message}</sl-alert
        >`;
    }
}
