import { PropertyValueMap, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { biLock, biNodePlus, biPlus, biShare, biUnlock } from '../styles/icons';

import '@shoelace-style/shoelace/dist/themes/light.css';
import SlButton from '@shoelace-style/shoelace/dist/components/button/button.component.js';
import SlBadge from '@shoelace-style/shoelace/dist/components/badge/badge.component.js';
import SlTooltip from '@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js';
import { Graph } from '../graph';
import type { Node, Transition } from '../automata';
import type { Position } from 'vis-network';
import { toolMenuStyles } from '../styles/toolMenu';
import { LitElementWw } from '@webwriter/lit';
import { localized, msg } from '@lit/localize';

@customElement('webwriter-automaton-toolmenu')
@localized()
export class ToolMenu extends LitElementWw {
    @property({ type: Boolean, attribute: false })
    private accessor _visible = false;
    public set visible(visible: boolean) {
        this._visible = visible;
    }

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
            'sl-badge': SlBadge,
            'sl-tooltip': SlTooltip,
        };
    }

    protected updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
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
        return html` <div
            class="toolmenu"
            style=${styleMap({
                display:
                    this._graph.component.settings.permissions.node.add ||
                    this._graph.component.settings.permissions.edge.add
                        ? 'flex'
                        : 'none',
            })}
        >
            <sl-button class="toolmenu__button" @click=${this.toggleToolbar} circle size="large">${biPlus}</sl-button>
            <div class="toolmenu__buttons" style=${styleMap({ display: this._visible ? 'flex' : 'none' })}>
                <sl-tooltip content=${msg("Add node (Ctrl+Q)")} placement="right">
                    <sl-button
                        class="toolmenu__button"
                        @click=${this.addNode}
                        variant=${this._mode === 'addNode' ? 'primary' : 'default'}
                        circle
                        style=${styleMap({
                            display: this._graph.component.settings.permissions.node.add ? 'block' : 'none',
                        })}
                        >${biNodePlus}
                        <sl-button
                            size="small"
                            variant=${this._lockNodeAdd ? 'primary' : 'default'}
                            circle
                            @click=${(e: any) => {
                                e.stopPropagation();
                                this._lockNodeAdd = !this._lockNodeAdd;
                            }}
                            >${this._lockNodeAdd ? biLock : biUnlock}</sl-button
                        >
                    </sl-button>
                </sl-tooltip>
                <sl-tooltip content=${msg("Add edge (Ctrl+E)")} placement="right">
                    <sl-button
                        class="toolmenu__button"
                        @click=${this.addEdge}
                        variant=${this._mode === 'addEdge' ? 'primary' : 'default'}
                        circle
                        style=${styleMap({
                            display: this._graph.component.settings.permissions.edge.add ? 'block' : 'none',
                        })}
                        >${biShare}
                        <sl-button
                            size="small"
                            variant=${this._lockEdgeAdd ? 'primary' : 'default'}
                            circle
                            @click=${(e: any) => {
                                e.stopPropagation();
                                this._lockEdgeAdd = !this._lockEdgeAdd;
                            }}
                            >${this._lockEdgeAdd ? biLock : biUnlock}</sl-button
                        >
                    </sl-button>
                </sl-tooltip>
            </div>
        </div>`;
    }

    public insertNode(position: Position, add: (node: Node) => void) {
        const node = {
            ...position,
            id: this._graph.automaton.getNewNodeId(),
            label: this._graph.automaton.getNewNodeLabel(),
            initial: false,
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

    private toggleToolbar() {
        this._visible = !this._visible;
        this.requestUpdate();
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
