import { LitElement, PropertyValueMap, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
    biArrowLeftRight,
    biClipboard,
    biCodeSlash,
    biFullscreen,
    biFullscreenExit,
    biGear,
    biQuestionLg,
} from '../styles/icons';

import '@shoelace-style/shoelace/dist/themes/light.css';
import SlButton from '@shoelace-style/shoelace/dist/components/button/button.component.js';
import SlBadge from '@shoelace-style/shoelace/dist/components/badge/badge.component.js';
import SlTooltip from '@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js';
import SlPopup from '@shoelace-style/shoelace/dist/components/popup/popup.component.js';
import SlTab from '@shoelace-style/shoelace/dist/components/tab/tab.component.js';
import SlTabGroup from '@shoelace-style/shoelace/dist/components/tab-group/tab-group.component.js';
import SlTabPanel from '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.component.js';

import { AutomatonComponent } from '../index';
import { topMenuStyles } from '../styles/topMenu';
import { transformations } from '../utils/transformations';
import { LitElementWw } from '@webwriter/lit';
import { SimulatorMenu } from './SimulatorMenu';
import { Graph } from '../graph';
import { stripNode, stripTransition } from '../utils/updates';
import RandExp from 'randexp';

@customElement('webwriter-automaton-topmenu')
export class TopMenu extends LitElementWw {
    @property({ type: Object, attribute: false })
    private accessor _component!: AutomatonComponent;
    public set component(component: AutomatonComponent) {
        this._component = component;
    }
    public get component(): AutomatonComponent {
        return this._component;
    }

    @property({ type: Boolean, attribute: false })
    private accessor _fullscreen: boolean = false;

    @state()
    private accessor _helpOverlay: boolean = false;

    public static get styles() {
        return topMenuStyles;
    }

    public static get scopedElements() {
        return {
            'sl-button': SlButton,
            'sl-badge': SlBadge,
            'sl-tooltip': SlTooltip,
            'sl-popup': SlPopup,
            'sl-tab': SlTab,
            'sl-tab-group': SlTabGroup,
            'sl-tab-panel': SlTabPanel,
        };
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        document.addEventListener('fullscreenchange', () => {
            this._fullscreen = document.fullscreenElement ? true : false;
        });
    }

    render() {
        const formalDefinition = this._component?.automaton?.getFormalDefinition();

        return html` <div class="topmenu">
            <div class="topmenu__button_group">
                <sl-button
                    class="topmenu__button"
                    @click=${() => {
                        if (this._fullscreen) document.exitFullscreen();
                        else this._component.requestFullscreen();
                    }}
                    circle
                >
                    ${this._fullscreen ? biFullscreenExit : biFullscreen}
                </sl-button>
            </div>
            <div class="topmenu__button_group">
                <sl-button
                    class="topmenu__button"
                    variant=${this._helpOverlay ? 'primary' : 'default'}
                    style="z-index: 2500"
                    @click=${() => {
                        this._helpOverlay = !this._helpOverlay;
                        this._component.helpOverlay = this._helpOverlay;
                    }}
                    circle
                    >${biQuestionLg}</sl-button
                >
            </div>
            <div class="topmenu__button_group">
                <sl-popup placement="bottom-end" distance="8" arrow>
                    <sl-button
                        slot="anchor"
                        class="topmenu__button"
                        @click=${(e: Event) => {
                            const popup = (e.target as HTMLElement).closest('sl-popup') as SlPopup;
                            popup.active = !popup.active;
                        }}
                        circle
                        ?disabled=${this.component.testLanguage == '' && this.component.testWords.length == 0}
                    >
                        ${biClipboard}</sl-button
                    >
                    <div class="topmenu__popup">
                        <b>Language: </b>${this.component.testLanguage}
                        <br />
                        <sl-button
                            @click=${(e: Event) => {
                                const reg = new RegExp(this.component.testLanguage);
                                const randexp = new RandExp(reg);
                                let accepted = true;
                                for (let i = 0; i < 10; i++) {
                                    const word = randexp.gen();
                                    this.component.automaton.simulator.word = word;
                                    this.component.automaton.simulator.init();
                                    const res = this.component.automaton.simulator.simulate();
                                    accepted &&= res.success;
                                }
                                this.component.automaton.simulator.word = '';
                                this.component.automaton.simulator.init();

                                (e.target as SlButton).variant = accepted ? 'success' : 'danger';
                            }}
                            >Check Automaton</sl-button
                        >

                        ${this.component.testWords.map(
                            (word) => html`<sl-button
                                @click=${(e: Event) => {
                                    this.component.automaton.simulator.word = word;
                                    this.component.automaton.simulator.init();
                                    const res = this.component.automaton.simulator.simulate();
                                    (e.target as SlButton).variant = res.success ? 'success' : 'danger';
                                    this.component.automaton.simulator.word = '';
                                    this.component.automaton.simulator.init();
                                }}
                                >${word}</sl-button
                            >`
                        )}
                    </div>
                </sl-popup>
            </div>
            <div class="topmenu__button_group">
                <sl-popup placement="bottom-end" distance="8" arrow>
                    <sl-button
                        slot="anchor"
                        class="topmenu__button"
                        circle
                        @click=${(e: Event) => {
                            const popup = (e.target as HTMLElement).closest('sl-popup') as SlPopup;
                            popup.active = !popup.active;
                        }}
                        ?disabled=${this.component.showFromalDefinition == 'false' &&
                        this.component.showTransitionsTable == 'false'}
                        >${biCodeSlash}</sl-button
                    >
                    <div class="topmenu__popup">
                        <sl-tab-group placement="bottom">
                            <sl-tab slot="nav" panel="def" ?disabled=${this.component.showFromalDefinition == 'false'}
                                >Definition</sl-tab
                            >
                            <sl-tab slot="nav" panel="table" ?disabled=${this.component.showTransitionsTable == 'false'}
                                >Table</sl-tab
                            >

                            <sl-tab-panel name="def" ?active=${this.component.showFromalDefinition == 'true'}>
                                <label>Alphabet: </label>${formalDefinition.alphabet}
                                <br />
                                <label>States: </label>${formalDefinition.nodes}
                                <br />
                                <label>Transitions: </label>${formalDefinition.transitions}
                                <br />
                                <label>Initial State: </label>${formalDefinition.initialNode}
                                <br />
                                <label>Final States: </label>${formalDefinition.finalNodes}
                            </sl-tab-panel>
                            <sl-tab-panel
                                name="table"
                                ?active=${this.component.showTransitionsTable == 'true' &&
                                this.component.showFromalDefinition == 'false'}
                            >
                                ${this.getTransitionsTable()}
                            </sl-tab-panel>
                        </sl-tab-group>
                    </div>
                </sl-popup>
            </div>
            <div class="topmenu__button_group" ?disabled=${this._component.allowedTransformations.length == 0}>
                <!-- <sl-tooltip content="Transformations" placement="left"> -->
                <sl-button
                    class="topmenu__button"
                    circle
                    ?disabled=${this._component.allowedTransformations.length == 0}
                    >${biArrowLeftRight}</sl-button
                >
                <!-- </sl-tooltip> -->
                <div class="topmenu__buttons">
                    <sl-tooltip content="Add Sinkstate" placement="left">
                        <sl-button
                            class="topmenu__button"
                            size="small"
                            circle
                            ?disabled=${!this._component.allowedTransformations.includes('sink')}
                            @click=${() => {
                                transformations.AddSinkstateToDFA(this._component.automaton);
                            }}
                            >Sink</sl-button
                        >
                    </sl-tooltip>
                </div>
            </div>
            <div class="topmenu__button_group" ?disabled=${this._component.allowedTypes.length == 0}>
                <sl-tooltip content="Automaton Type" placement="left">
                    <sl-button class="topmenu__button" circle ?disabled=${this._component.allowedTypes.length == 0}>
                        ${this._component.automaton.type.toUpperCase()}
                    </sl-button>
                </sl-tooltip>
                <div class="topmenu__buttons">
                    <sl-tooltip content="DFA" placement="left">
                        <sl-button
                            class="topmenu__button"
                            size="small"
                            @click=${() => this.switchAutomatonType('dfa')}
                            circle
                            ?disabled=${!this._component.allowedTypes.includes('dfa')}
                            >DFA</sl-button
                        >
                    </sl-tooltip>
                    <sl-tooltip content="NFA" placement="left">
                        <sl-button
                            class="topmenu__button"
                            size="small"
                            @click=${() => this.switchAutomatonType('nfa')}
                            circle
                            ?disabled=${!this._component.allowedTypes.includes('nfa')}
                            >NFA</sl-button
                        >
                    </sl-tooltip>
                    <sl-tooltip content="PDA" placement="left">
                        <sl-button
                            class="topmenu__button"
                            size="small"
                            @click=${() => this.switchAutomatonType('pda')}
                            circle
                            ?disabled=${!this._component.allowedTypes.includes('pda')}
                            >PDA</sl-button
                        >
                    </sl-tooltip>
                </div>
            </div>
        </div>`;
    }

    private getTransitionsTable() {
        const transitions = this._component.automaton.transitions
            .get()
            .filter((t) => t.from !== Graph.initialGhostNode.id);
        const alphabet = this._component.automaton.getFormalDefinition().alphabet.split(', ');
        const nodes = this._component.automaton.nodes.get().filter((n) => n.id !== Graph.initialGhostNode.id);

        const table = html`<table>
            <thead>
                <tr>
                    <th></th>
                    ${alphabet.map((a) => (a != '' ? html`<th>${a}</th>` : html`<th>ε</th>`))}
                </tr>
            </thead>
            <tbody>
                ${nodes.map(
                    (node) => html`<tr>
                        <td><b>${node.label}</b></td>
                        ${alphabet.map(
                            (a) => html`<td>
                                ${transitions
                                    .filter((t) => t.from === node.id && t.symbols.includes(a))
                                    .map((t) => nodes.find((n) => n.id === t.to)?.label)
                                    .join(',')}
                            </td>`
                        )}
                    </tr>`
                )}
            </tbody>
        </table>`;
        return table;
    }

    private switchAutomatonType(type: string): void {
        AutomatonComponent.log(
            'Switching from',
            this._component.automaton.type.toUpperCase(),
            'to',
            type.toUpperCase()
        );

        switch (this._component.automaton.type) {
            case 'dfa':
                if (type === 'nfa') this._component.automaton = transformations.DFAtoNFA(this._component.automaton);
                if (type === 'pda') this._component.automaton = transformations.DFAtoPDA(this._component.automaton);
                break;
            case 'nfa':
                if (type === 'dfa') this._component.automaton = transformations.NFAtoDFA(this._component.automaton);
                if (type === 'pda') this._component.automaton = transformations.NFAtoPDA(this._component.automaton);
                break;
            case 'pda':
                if (type === 'dfa') this._component.automaton = transformations.PDAtoDFA(this._component.automaton);
                if (type === 'nfa') this._component.automaton = transformations.PDAtoNFA(this._component.automaton);
                break;
        }

        this._component.graph.network.setData({
            nodes: this._component.automaton.nodes,
            edges: this._component.automaton.transitions,
        });

        this._component.nodes = this._component.automaton.nodes
            .get()
            .filter((n) => n.id !== Graph.initialGhostNode.id)
            .map(stripNode);
        this._component.nodes = [...this._component.nodes];

        this._component.transitions = this._component.automaton.transitions
            .get()
            .filter((t) => t.from !== Graph.initialGhostNode.id)
            .map(stripTransition);
        this._component.transitions = [...this._component.transitions];

        this.requestUpdate();
        this._component.requestUpdate();
    }
}
