import { PropertyValueMap, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
    biArrowLeftRight,
    biClipboard,
    biCodeSlash,
    biFullscreen,
    biFullscreenExit,
    biList,
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
import { Graph } from '../graph';
import { stripNode, stripTransition } from '../utils/updates';
import RandExp from 'randexp';
import { SimulationStatus } from 'automata';
import { NFA } from 'automata/nfa';
import { PDA } from 'automata/pda';
import { localized, msg } from '@lit/localize';
import { Logger } from '@u/logger';

@customElement('webwriter-automaton-topmenu')
@localized()
export class TopMenu extends LitElementWw {
    @property({ type: Object, attribute: false })
    private accessor _component!: AutomatonComponent;
    public set component(component: AutomatonComponent) {
        this._component = component;
    }
    public get component(): AutomatonComponent {
        return this._component;
    }

    @state()
    private accessor _fullscreen: boolean = false;

    @state()
    private accessor _helpOverlay: boolean = false;

    @state()
    private accessor _collapsed: boolean = false;

    @state()
    private accessor _menuOpen: boolean = false;

    private _resizeObserver?: ResizeObserver;

    @property({ type: Object, attribute: false })
    private accessor _graph!: Graph;
    public set graph(graph: Graph) {
        this._graph = graph;
    }

    @property({ type: Object, attribute: false })
    private accessor _setHelpOverlay!: (visible: boolean) => (void);
    public set setHelpOverlay(f: (visible: boolean) => (void)) {
        this._setHelpOverlay = f;
    }

    private _setCollapsed?: (collapsed: boolean) => void;
    public set setCollapsed(f: (collapsed: boolean) => void) {
        this._setCollapsed = f;
    }

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

    connectedCallback(): void {
        super.connectedCallback();
        const host = (this.getRootNode() as ShadowRoot)?.host ?? this.parentElement;
        if (host) {
            this._resizeObserver = new ResizeObserver((entries) => {
                const width = entries[0]?.contentRect.width ?? Infinity;
                const collapsed = width < 500;
                this._collapsed = collapsed;
                this._setCollapsed?.(collapsed);
                if (!collapsed) this._menuOpen = false;
            });
            this._resizeObserver.observe(host);
        }
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this._resizeObserver?.disconnect();
    }

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        // Important for when the user exits fullscreen mode by pressing ESC or F11
        document.addEventListener('fullscreenchange', () => {
            this._fullscreen = !!document.fullscreenElement;
        });
    }

    render() {
        if (this._collapsed) {
            return html`
                <div class="topmenu topmenu--hamburger" style=${this._helpOverlay ? 'z-index: 2500' : ''}>
                    <sl-popup placement="bottom-end" distance="8" ?active=${this._menuOpen || this._helpOverlay}>
                        <sl-button
                            slot="anchor"
                            class="topmenu__button"
                            circle
                            style=${this._helpOverlay ? 'z-index: 2500' : ''}
                            @click=${() => { this._menuOpen = !this._menuOpen; }}
                        >${biList}</sl-button>
                        <div class="topmenu__collapsed_panel">
                            ${this.renderButtonGroups(true)}
                        </div>
                    </sl-popup>
                </div>`;
        }

        return html`<div class="topmenu">${this.renderButtonGroups()}</div>`;
    }

    private renderButtonGroups(collapsed = false) {
        const formalDefinition = this._component?.automaton?.getFormalDefinition();
        const tooltipPlacement = collapsed ? 'top' : 'left';
        const popupPlacement = collapsed ? 'left-end' : 'bottom-end';

        return html`
            <div class="topmenu__button_group">
                <sl-button
                    class="topmenu__button"
                    @click=${async (e: Event) => {
                        this._fullscreen = this.ownerDocument.fullscreenElement === this._component;
                        
                        const button = (e.target as HTMLElement).closest('sl-button') as SlButton;

                        try {
                            if (this._fullscreen) await document.exitFullscreen();
                            else await this._component.requestFullscreen();
                        } catch (err) {
                            Logger.error('Error entering/exiting fullscreen:', err);
                        }

                        // Remove and re-append the button to update its hover state
                        const parent = button.parentElement;
                        if (parent) {
                            parent.removeChild(button);
                            parent.appendChild(button);
                        }
                        this._fullscreen = this.ownerDocument.fullscreenElement === this._component;
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
                        this._setHelpOverlay(this._helpOverlay);
                    }}
                    circle
                    >${biQuestionLg}</sl-button
                >
            </div>
            <div class="topmenu__button_group">
                <sl-popup placement=${popupPlacement} distance="8" arrow ?shift=${collapsed}>
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
                        <b>${msg("Language:")} </b>${this.component.testLanguage}
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
                                    accepted &&= res.status === SimulationStatus.ACCEPTED;
                                }
                                this.component.automaton.simulator.word = '';
                                this.component.automaton.simulator.init();

                                (e.target as SlButton).variant = accepted ? 'success' : 'danger';
                            }}
                            >${msg("Check Automaton")}</sl-button
                        >

                        ${this.component.testWords.map(
                            (word) => html`<sl-button
                                @click=${(e: Event) => {
                                    this.component.automaton.simulator.word = word;
                                    this.component.automaton.simulator.init();
                                    const res = this.component.automaton.simulator.simulate();
                                    (e.target as SlButton).variant = res.status === SimulationStatus.ACCEPTED ? 'success' : 'danger';
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
                <sl-popup placement=${popupPlacement} distance="8" arrow ?shift=${collapsed} ?flip=${collapsed} auto-size="vertical" style="--arrow-color: var(--sl-panel-border-color)">
                    <sl-button
                        slot="anchor"
                        class="topmenu__button"
                        circle
                        @click=${(e: Event) => {
                            const popup = (e.target as HTMLElement).closest('sl-popup') as SlPopup;
                            popup.active = !popup.active;
                        }}
                        ?disabled=${this.component.showFormalDefinition == 'false' &&
                        this.component.showTransitionsTable == 'false'}
                        >${biCodeSlash}</sl-button
                    >
                    <div class="topmenu__popup">
                        <sl-tab-group placement="top">
                            <sl-tab slot="nav" panel="def" 
                                ?disabled=${this.component.showFormalDefinition == 'false'}
                                ?active=${this.component.showFormalDefinition == 'true'}
                                >${msg("Definition")}</sl-tab
                            >
                            <sl-tab slot="nav" panel="table" 
                                ?disabled=${this.component.showTransitionsTable == 'false'}
                                ?active=${this.component.showTransitionsTable == 'true' && this.component.showFormalDefinition == 'false'}
                                >${msg("Table")}</sl-tab
                            >

                            <sl-tab-panel name="def" ?active=${this.component.showFormalDefinition == 'true'} style="--padding: 1em">
                                <label>${msg("Alphabet:")} </label>${formalDefinition.alphabet}
                                <br />
                                <label>${msg("States:")} </label>${formalDefinition.nodes}
                                <br />
                                <label>${msg("Transitions:")} </label>${formalDefinition.transitions}
                                <br />
                                <label>${msg("Initial State:")} </label>${formalDefinition.initialNode}
                                <br />
                                <label>${msg("Final States:")} </label>${formalDefinition.finalNodes}
                            </sl-tab-panel>
                            <sl-tab-panel
                                name="table"
                                ?active=${this.component.showTransitionsTable == 'true' &&
                                this.component.showFormalDefinition == 'false'}
                                style="--padding: 0"
                            >
                                ${this.getTransitionsTable()}
                            </sl-tab-panel>
                        </sl-tab-group>
                    </div>
                </sl-popup>
            </div>
            <div class="topmenu__button_group">
                <!-- <sl-tooltip content="Transformations" placement="left"> -->
                <sl-button
                    class="topmenu__button"
                    circle
                    ?disabled=${this._component.allowedTransformations.length === 0 || this._component.mode === 'simulate'}
                    >${biArrowLeftRight}</sl-button
                >
                <!-- </sl-tooltip> -->
                <div class="topmenu__buttons">
                    ${this._component.allowedTransformations.includes('sink') && this._component.mode !== 'simulate'
                        ? html`
                            <sl-tooltip content=${msg("Add Sinkstate")} placement=${tooltipPlacement} ?hoist=${collapsed}>
                                <sl-button
                                    class="topmenu__button"
                                    size="small"
                                    ?circle=${msg("Sink").length <= 4}
                                    @click=${() => {
                                        transformations.AddSinkstateToDFA(this._component.automaton);
                                    }}
                                    >${msg("Sink")}</sl-button
                                >
                            </sl-tooltip>
                        ` : ''}
                </div>
            </div>
            <div class="topmenu__button_group">
                <sl-tooltip content=${msg("Automaton Type")} placement=${tooltipPlacement} ?hoist=${collapsed}>
                    <sl-button class="topmenu__button" circle ?disabled=${this._component.allowedTypes.length === 0 || this._component.mode === 'simulate'}>
                        ${this._component.automaton.type === 'dfa'
                            ? msg('DFA') : this._component.automaton.type === 'nfa'
                            ? msg('NFA') : msg('PDA')}
                    </sl-button>
                </sl-tooltip>
                <div class="topmenu__buttons">
                    ${this._component.allowedTypes.length > 0 && this._component.mode !== 'simulate'
                         ? html`
                            <sl-tooltip content=${msg("DFA")} placement=${tooltipPlacement} ?hoist=${collapsed}>
                                <sl-button
                                    class="topmenu__button"
                                    size="small"
                                    @click=${() => this.switchAutomatonType('dfa')}
                                    circle
                                    ?disabled=${!this._component.allowedTypes.includes('dfa')}
                                    >${msg("DFA")}</sl-button
                                >
                            </sl-tooltip>
                            <sl-tooltip content=${msg("NFA")} placement=${tooltipPlacement} ?hoist=${collapsed}>
                                <sl-button
                                    class="topmenu__button"
                                    size="small"
                                    @click=${() => this.switchAutomatonType('nfa')}
                                    circle
                                    ?disabled=${!this._component.allowedTypes.includes('nfa')}
                                    >${msg("NFA")}</sl-button
                                >
                            </sl-tooltip>
                            <sl-tooltip content=${msg("PDA")} placement=${tooltipPlacement} ?hoist=${collapsed}>
                                <sl-button
                                    class="topmenu__button"
                                    size="small"
                                    @click=${() => this.switchAutomatonType('pda')}
                                    circle
                                    ?disabled=${!this._component.allowedTypes.includes('pda')}
                                    >${msg("PDA")}</sl-button
                                >
                            </sl-tooltip>
                        ` : ''}
                </div>
            </div>`;
    }

    private getTransitionsTable() {
        const transitions = this._component.automaton.transitions
            .get()
            .filter((t) => t.from !== Graph.initialGhostNode.id);
        const alphabet = this._component.automaton.getFormalDefinition().alphabet.split(', ').sort();
        const nodes = this._component.automaton.nodes.get().filter((n) => n.id !== Graph.initialGhostNode.id);

        const table = html`<table class="topmenu__popup__table">
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
        Logger.log(
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
                if (type === 'dfa') this._component.automaton = transformations.NFAtoDFA(this._component.automaton as NFA);
                if (type === 'pda') this._component.automaton = transformations.NFAtoPDA(this._component.automaton as NFA);
                break;
            case 'pda':
                if (type === 'dfa') this._component.automaton = transformations.PDAtoDFA(this._component.automaton as PDA);
                if (type === 'nfa') this._component.automaton = transformations.PDAtoNFA(this._component.automaton as PDA);
                break;
        }

        this._graph.network.setData({
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
