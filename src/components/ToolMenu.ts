import { PropertyValueMap, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { biPlus } from '../styles/icons';

import '@shoelace-style/shoelace/dist/themes/light.css';
import SlButton from '@shoelace-style/shoelace/dist/components/button/button.component.js';
import { Graph } from '../graph';
import type { Node, Transition } from '../automata';
import type { Position } from 'vis-network';
import { toolMenuStyles } from '../styles/toolMenu';
import { LitElementWw } from '@webwriter/lit';
import { localized, msg } from '@lit/localize';

@customElement('webwriter-automaton-toolmenu')
@localized()
export class ToolMenu extends LitElementWw {
    private nodeDrag?: { pointerId: number; start: Position; moved: boolean };

    @property({ type: String, attribute: false })
    private accessor _mode: 'idle' | 'addNode' | 'addEdge' = 'idle';
    public set mode(mode: 'idle' | 'addNode' | 'addEdge') {
        this._mode = mode;
    }
    public get mode() {
        return this._mode;
    }

    @property({ type: Object, attribute: false })
    private accessor _graph!: Graph;
    public set graph(graph: Graph) {
        this._graph = graph;
    }

    @property({ type: Boolean, attribute: false })
    private accessor _lockNodeAdd = false;
    public set lockNodeAdd(lockNodeAdd: boolean) {
        this._lockNodeAdd = lockNodeAdd;
    }
    public get lockNodeAdd() {
        return this._lockNodeAdd;
    }

    @property({ type: Boolean, attribute: false })
    private accessor _lockEdgeAdd = false;
    public set lockEdgeAdd(lockEdgeAdd: boolean) {
        this._lockEdgeAdd = lockEdgeAdd;
    }
    public get lockEdgeAdd() {
        return this._lockEdgeAdd;
    }

    public static get styles() {
        return toolMenuStyles;
    }

    public static get scopedElements() {
        return {
            'sl-button': SlButton,
        };
    }

    protected updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        if (!this._graph) return;
        if (this.nodeDrag && !this._graph.canAddNode) this.cancelNodeDrag();
        if (!changedProperties.has('_mode')) return;

        if (this._mode === 'addNode') {
            this._graph.network.addNodeMode();
        }

        if (this._mode === 'idle') {
            this._graph.network.disableEditMode();
        }

        this._graph.network.redraw();
    }

    render() {
        if (!this._graph?.component.settings.permissions.node.add) return nothing;

        const label = msg("Add node");
        return html`
            <div class="toolmenu" contenteditable="false">
                <sl-button circle size="large" title=${label}
                    @pointerdown=${this.startNodeDrag}
                    @pointermove=${this.moveNodeDrag}
                    @pointerup=${this.finishNodeDrag}
                    @pointercancel=${this.interruptNodeDrag}
                    @lostpointercapture=${this.interruptNodeDrag}
                    @click=${(event: MouseEvent) => {
                        // Pointer activation is handled on release. Keyboard activation still clicks the button.
                        if (event.detail === 0) this._graph.insertNodeFromButton();
                    }}>${biPlus}</sl-button>
            </div>
        `;
    }

    disconnectedCallback() {
        this.cancelNodeDrag();
        super.disconnectedCallback();
    }

    private startNodeDrag(event: PointerEvent) {
        if (event.button !== 0 || !event.isPrimary || !this._graph.canAddNode) return;
        this.nodeDrag = {
            pointerId: event.pointerId,
            start: { x: event.clientX, y: event.clientY },
            moved: false,
        };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    private moveNodeDrag(event: PointerEvent) {
        const drag = this.nodeDrag;
        if (drag?.pointerId !== event.pointerId) return;
        drag.moved ||= Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) >= 5;
        if (drag.moved) this._graph.previewNodeDrop(this.dropPoint(event));
    }

    private finishNodeDrag(event: PointerEvent) {
        const drag = this.nodeDrag;
        if (drag?.pointerId !== event.pointerId) return;
        const point = this.dropPoint(event);
        this.cancelNodeDrag();
        if (drag.moved && point) this._graph.insertNodeFromButton(point);
        if (!drag.moved && !point) this._graph.insertNodeFromButton();
    }

    private dropPoint(event: PointerEvent): Position | undefined {
        const { left, right, top, bottom } = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const { clientX: x, clientY: y } = event;
        if (x < left || x >= right || y < top || y >= bottom) return { x, y };
        return undefined;
    }

    private interruptNodeDrag(event: PointerEvent) {
        if (this.nodeDrag?.pointerId === event.pointerId) this.cancelNodeDrag();
    }

    public cancelNodeDrag() {
        if (!this.nodeDrag) return;
        this.nodeDrag = undefined;
        this._graph.previewNodeDrop();
    }

    public insertNode(position: Position, add: (node: Node) => void) {
        const { automaton } = this._graph;
        const node = {
            ...position,
            id: automaton.getNewNodeId(),
            label: automaton.getNewNodeLabel(),
            initial: automaton.nodes.getIds().every(id => id === Graph.initialGhostNode.id),
            final: false,
        };
        add(node);
        return node;
    }

    public handleNodeAdd(nodeData: Position, callback: (node: Node) => void) {
        this.insertNode(nodeData, callback);
        if (!this._lockNodeAdd) {
            this._mode = 'idle';
            this._graph.network.disableEditMode();
        } else {
            this._graph.network.addNodeMode();
        }
        this._graph.network.unselectAll();
        this._graph.requestUpdate();
    }

    public planTransition(edgeData: Pick<Transition, 'from' | 'to'> & Partial<Transition>) {
        const { automaton } = this._graph;
        const transitions = automaton.transitions.get();
        const existing = transitions.find(edge => edge.from === edgeData.from && edge.to === edgeData.to);
        const reverse = transitions.find(edge => edge.from === edgeData.to && edge.to === edgeData.from);
        const smooth = reverse ? { enabled: true, type: 'curvedCW', roundness: 0.2 } : undefined;
        const symbol = this._graph.component.forcedAlphabet[0] || 'a';

        const transition: Transition = {
            ...edgeData,
            ...existing,
            ...(smooth ? { smooth } : {}),
            id: existing?.id ?? automaton.getNewTransitionId(),
            label: '',
            symbols: [...(existing?.symbols ?? []), symbol],
        };
        if (automaton.type === 'pda') {
            const operations = existing?.symbols.map((symbol, index) =>
                existing.stackOperations?.[index] ?? { operation: 'none' as const, symbol, condition: '' }
            ) ?? [];
            transition.stackOperations = [...operations, { operation: 'none', symbol, condition: '' }];
        }
        transition.label = automaton.getTransitionLabel(transition);
        return { transition, existing, reverse, smooth };
    }

    public insertTransition(
        edgeData: Pick<Transition, 'from' | 'to'> & Partial<Transition>,
        add: (transition: Transition) => void,
    ) {
        if (edgeData.to === Graph.initialGhostNode.id || edgeData.from === Graph.initialGhostNode.id) return;

        const { transition, existing, reverse, smooth } = this.planTransition(edgeData);
        if (reverse) this._graph.automaton.transitions.update({ id: reverse.id, smooth });
        if (existing) this._graph.automaton.transitions.update(transition);
        else add(transition);
    }

    public handleTransitionAdd(
        edgeData: Pick<Transition, 'from' | 'to'> & Partial<Transition>,
        callback: (transition: Transition) => void,
    ) {
        if (edgeData.from === Graph.initialGhostNode.id || edgeData.to === Graph.initialGhostNode.id) return;

        this.insertTransition(edgeData, callback);
        if (!this._lockEdgeAdd) {
            this._mode = 'idle';
            this._graph.network.disableEditMode();
        } else {
            this._graph.network.addEdgeMode();
        }
        this._graph.network.unselectAll();
        this._graph.network.redraw();
        this._graph.requestUpdate();
    }

    public addNode() {
        this._graph.cancelConnection();
        if (this._mode === 'addNode') {
            this._mode = 'idle';
            this._graph.network.disableEditMode();
            return;
        }

        this._mode = 'addNode';
        this._graph.network.addNodeMode();
    }

    public addEdge() {
        this._graph.cancelConnection();
        if (this._mode === 'addEdge') {
            this._mode = 'idle';
            this._graph.network.disableEditMode();
            return;
        }

        this._mode = 'addEdge';
        this._graph.network.addEdgeMode();
    }
}
