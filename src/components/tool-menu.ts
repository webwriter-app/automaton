import { html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import type { Point } from '../model/diagram';
import { biPlus, sinkStateIcon } from './icons';

import '@shoelace-style/shoelace/dist/themes/light.css';
import SlButton from '@shoelace-style/shoelace/dist/components/button/button.component.js';
import SlIcon from '@shoelace-style/shoelace/dist/components/icon/icon.component.js';
import type { Graph } from './graph';
import { toolMenuStyles } from './tool-menu.styles';
import { LitElementWw } from '@webwriter/lit';

export class ToolMenu extends LitElementWw {
    private nodeDrag?: { pointerId: number; start: Point; moved: boolean };

    @property({ type: Object, attribute: false })
    public accessor graph: Graph | undefined;

    public static get styles() {
        return toolMenuStyles;
    }

    static scopedElements = {
        'sl-icon': SlIcon,
        'sl-button': SlButton,
    };

    protected updated(): void {
        if (this.nodeDrag && !this.graph?.canAddNode) this.cancelNodeDrag();
    }

    render() {
        const component = this.graph?.component;
        if (!component) return nothing;
        const { msg } = component;
        const canAddNode = component.settings.permissions.node.add;
        const showSink = component.automaton.type === 'dfa' && component.sinkStateEnabled;
        if (!canAddNode && !showSink) return nothing;

        const label = msg("Add node");
        const sinkLabel = msg("Add sink state");
        const sinkReason = showSink ? component.settings.sinkDisabledReason : undefined;
        return html`
            <div class="toolmenu" contenteditable="false">
                ${showSink ? html`
                    <sl-button class="toolmenu__sink" circle size="small"
                        aria-label=${sinkLabel} title=${sinkReason ?? sinkLabel}
                        ?disabled=${sinkReason !== undefined}
                        @click=${() => void component.completeDfaWithSink()}>${sinkStateIcon}</sl-button>
                ` : nothing}
                ${canAddNode ? html`<sl-button class="toolmenu__node" circle size="large" title=${label}
                    @pointerdown=${this.startNodeDrag}
                    @pointermove=${this.moveNodeDrag}
                    @pointerup=${this.finishNodeDrag}
                    @pointercancel=${this.interruptNodeDrag}
                    @lostpointercapture=${this.interruptNodeDrag}
                    @click=${(event: MouseEvent) => {
                        // Pointer activation is handled on release. Keyboard activation still clicks the button.
                        if (event.detail === 0) this.graph?.insertNodeFromButton();
                    }}>${biPlus}</sl-button>` : nothing}
            </div>
        `;
    }

    disconnectedCallback() {
        this.cancelNodeDrag();
        super.disconnectedCallback();
    }

    private startNodeDrag(event: PointerEvent) {
        if (event.button !== 0 || !event.isPrimary || !this.graph?.canAddNode) return;
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
        if (drag.moved) this.graph?.previewNodeDrop(this.dropPoint(event));
    }

    private finishNodeDrag(event: PointerEvent) {
        const drag = this.nodeDrag;
        if (drag?.pointerId !== event.pointerId) return;
        const point = this.dropPoint(event);
        this.cancelNodeDrag();
        if (drag.moved && point) this.graph?.insertNodeFromButton(point);
        if (!drag.moved && !point) this.graph?.insertNodeFromButton();
    }

    private dropPoint(event: PointerEvent): Point | undefined {
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
        this.graph?.previewNodeDrop();
    }
}
