import { html, nothing } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { repeat } from 'lit/directives/repeat.js';
import { DEFAULT_LOOP_ANGLE, NODE_RADIUS, sceneBend } from '../model/diagram';
import type { Transition } from '../model/automaton-data';
import { edgeKey, nodeKey, type Graph } from './graph';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const DIAMETER = 2 * NODE_RADIUS;

/** The side of its arc that the label of a loop goes to: the one that faces away from the state. */
const loopSide = (angle: number) => (['above', 'right', 'below', 'left'] as const)[Math.round((((angle % 360) + 360) % 360) / 90) % 4];

/** A transition between two states, drawn by the scene: bent against its opposite, or as a loop on one state. */
function renderTransition(edge: Pick<Transition, 'from' | 'to' | 'bend' | 'loopAngle'>, label: string, attributes: { class: string; key?: string; selected?: boolean }) {
    const loop = edge.from === edge.to;
    return html`
        <ww-path class=${attributes.class} data-ww-key=${ifDefined(attributes.key)} from=${nodeKey(edge.from)} to=${nodeKey(edge.to)} marker-end="arrow"
            loop=${ifDefined(loop ? edge.loopAngle ?? DEFAULT_LOOP_ANGLE : undefined)}
            bend=${ifDefined(!loop && edge.bend ? sceneBend(edge.bend) : undefined)}
            ?selectable=${attributes.key !== undefined} ?selected=${attributes.selected}
            aria-label=${ifDefined(attributes.key === undefined ? undefined : label.replace(/\s+/g, ' ').trim())}>
            ${label.trim() === '' ? nothing : html`<ww-text class="label" side=${loop ? loopSide(edge.loopAngle ?? DEFAULT_LOOP_ANGLE) : 'above'}>${label}</ww-text>`}
        </ww-path>`;
}

/** The diagram as scene elements: transitions, the initial arrow and the states. */
export function renderScene(graph: Graph) {
    const { automaton, layout, selection, editing } = graph;
    const { msg } = graph.component;
    const sideLabels = {
        top: msg("Connect from top"),
        left: msg("Connect from left"),
        bottom: msg("Connect from bottom"),
        right: msg("Connect from right"),
    };
    const showPorts = graph.canConnect;
    const connecting = graph.mode === 'addEdge';
    const single = selection.size === 1;
    const plan = graph.pending && graph.planTransition(graph.pending.from, graph.pending.to);
    const initial = graph.initialArrow;

    return html`<ww-scene id="graphCanvas" contenteditable="false"
        class=${classMap({ 'node-drop-preview': !!graph.dropPreview, 'scene--adding': graph.mode === 'addNode' })}
        select=${graph.multipleSelection ? 'multiple' : 'single'} move-step="10" connect-click
        data-ww-viewport="canvas" data-ww-viewport-zoom="0.5 5" data-ww-viewport-wheel="zoom" data-ww-viewport-resize="centre"
        data-ww-viewport-fit-padding="40" data-ww-viewport-fit-max="1" data-ww-viewport-follow="none"
        @ww-select=${graph.select} @ww-move=${graph.move} @ww-moving=${graph.moving} @ww-connect=${graph.connect}
        @ww-connecting=${graph.connecting} @ww-background=${graph.background} @pointerdown=${() => graph.hoverNode()}
        @contextmenu=${(event: Event) => event.preventDefault()}>
        ${repeat(automaton.transitions.get(), edge => edge.id, edge => {
            const key = edgeKey(edge.id);
            // While a wire is held over a state, the transition it would extend or bend shows how it will look.
            const planned = plan?.existing?.id === edge.id ? plan.transition : edge;
            const bend = plan?.reverse?.id === edge.id ? plan.bend : planned.bend;
            return renderTransition({ ...planned, bend }, planned.label, {
                class: `edge${edge.highlight ? ' active' : ''}${planned !== edge ? ' planned' : ''}`,
                key, selected: selection.has(key),
            });
        })}
        ${plan && !plan.existing ? renderTransition({ from: plan.transition.from, to: plan.transition.to, bend: plan.bend, loopAngle: plan.transition.loopAngle },
            plan.transition.label, { class: 'edge planned' }) : nothing}
        ${initial ? html`<ww-path class="edge" .points=${initial} marker-end="arrow"></ww-path>` : nothing}
        ${repeat(automaton.nodes.get(), node => node.id, node => {
            const key = nodeKey(node.id);
            const { x, y } = layout.centres.get(node.id)!;
            const selected = selection.has(key);
            const classes = classMap({
                state: true,
                final: node.final,
                active: node.highlight === 'active',
                error: node.highlight !== 'active' && graph.hasError(node.id),
            });
            return html`
                <ww-node class=${classes} data-ww-key=${key} outline="circle" x=${x - NODE_RADIUS} y=${y - NODE_RADIUS} width=${DIAMETER} height=${DIAMETER}
                    aria-label=${node.label} ?selectable=${editing} ?movable=${graph.canMoveNodes} ?selected=${selected}
                    @pointerenter=${() => graph.hoverNode(node.id)} @pointerleave=${() => graph.hoverNode()}>
                    <span class="state__ring"></span>
                    <span class="state__label">${node.label}</span>
                    <span class="state__target" data-ww-port="in" data-ww-accept="wire"></span>
                    ${showPorts && (connecting || selected && single) ? SIDES.map(side => html`
                        <span class="state__port state__port--${side}" data-ww-port=${side} data-ww-side=${side} data-ww-link="wire"
                            aria-label=${sideLabels[side]} title=${sideLabels[side]}></span>`) : nothing}
                </ww-node>`;
        })}
        ${graph.dropPreview ? html`
            <ww-node class="state state--preview" x=${graph.dropPreview.x - NODE_RADIUS} y=${graph.dropPreview.y - NODE_RADIUS}
                width=${DIAMETER} height=${DIAMETER}>
                <span class="state__ring"></span>
                <span class="state__label">${automaton.getNewNodeLabel()}</span>
            </ww-node>` : nothing}
    </ww-scene>`;
}
