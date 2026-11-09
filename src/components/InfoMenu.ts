import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styles } from '../styles/styles';

import '@shoelace-style/shoelace/dist/themes/light.css';

import SlButton from '@shoelace-style/shoelace/dist/components/button/button.component.js';
import SlTooltip from '@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js';
import SlAlert from '@shoelace-style/shoelace/dist/components/alert/alert.component.js';

import { Graph } from '../graph';
import { biExclamationOctagon, biInfo } from '../styles/icons';

import { styleMap } from 'lit/directives/style-map.js';

@customElement('webwriter-automaton-infomenu')
export class InfoMenu extends LitElement {
    @property({ type: Boolean, attribute: false })
    private accessor infoCardOpen = false;

    @property({ type: Object, attribute: false })
    private accessor _graph!: Graph;
    public set graph(graph: Graph) {
        this._graph = graph;
    }

    public static get styles() {
        return styles;
    }

    public static get scopedElements() {
        return {
            'sl-button': SlButton,
            'sl-tooltip': SlTooltip,
            'sl-alert': SlAlert,
        };
    }

    render() {
        const def = this._graph?.automaton.getFormalDefinition();

        if (!def) {
            return html``;
        }

        return html`<div class="infomenu">
            <sl-button
                class="infomenu__button"
                circle
                ?outline=${this.infoCardOpen}
                variant=${this._graph.errors.length > 0 ? 'danger' : 'default'}
                @click=${() => (this.infoCardOpen = !this.infoCardOpen)}
                >${biInfo}</sl-button
            >
            <div class="infomenu__content" style=${styleMap({ display: this.infoCardOpen ? 'block' : 'none' })}>
                ${this._graph?.errors.length > 0
                    ? html`<sl-alert variant="danger" open>
                          ${biExclamationOctagon}
                          ${this._graph?.errors.map((error) => html`${error.message(this._graph.component.msg)}<br />`)}
                      </sl-alert> `
                    : ''}
            </div>

            <!-- <div class=${'infomenu__content' + (this.infoCardOpen ? '' : ' hidden')}>
                <p>Q: ${def.nodes}</p>
                <p>Σ: ${def.alphabet}</p>
                <p>q<sub>0</sub>: ${def.initialNode}</p>
                <p>F: {${def.finalNodes}}</p>
                <p>δ: ${def.transitions}</p>
            </div> -->
        </div>`;
    }
}
