import { html } from 'lit';
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

import { AutomatonComponent, type AutomatonType } from '../index';
import { topMenuStyles } from '../styles/topMenu';
import { DFA } from '../automata/dfa';
import { LitElementWw } from '@webwriter/lit';
import { Graph } from '../graph';
import RandExp from 'randexp';
import { SimulationStatus } from 'automata';
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
    private fullscreenChanged = () => {
        this._fullscreen = this._component?.matches(':fullscreen') ?? false;
    };

    @state()
    private accessor _choices: 'sink' | 'type' | undefined = undefined;

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
        this.ownerDocument.addEventListener('fullscreenchange', this.fullscreenChanged);
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
        this.ownerDocument.removeEventListener('fullscreenchange', this.fullscreenChanged);
    }

    render() {
        if (this._collapsed) {
            return html`
                <div class="topmenu topmenu--hamburger">
                    <sl-button
                        class="topmenu__button"
                        circle
                        aria-label=${msg("Menu")}
                        aria-expanded=${this._menuOpen || this._helpOverlay}
                        aria-controls="compact-menu"
                        @click=${() => { this._menuOpen = !this._menuOpen; this._choices = undefined; }}
                    >${biList}</sl-button>
                    ${this._menuOpen || this._helpOverlay ? html`
                        <div class="topmenu__collapsed_panel" id="compact-menu">
                            ${this.renderButtonGroups(true)}
                        </div>` : ''}
                </div>`;
        }

        return html`<div class="topmenu">${this.renderButtonGroups()}</div>`;
    }

    private renderButtonGroups(collapsed = false) {
        const formalDefinition = this._component?.automaton?.getFormalDefinition();
        const tooltipPlacement = collapsed ? 'bottom-end' : 'left';
        const buttonSize = collapsed ? 'small' : 'medium';
        const boundary = collapsed ? this._component : undefined;

        return html`
            <div class="topmenu__button_group">
                <sl-button
                    class="topmenu__button"
                    size=${buttonSize}
                    @click=${async () => {
                        try {
                            if (this._component.matches(':fullscreen')) await this.ownerDocument.exitFullscreen();
                            else await this._component.requestFullscreen();
                        } catch (err) {
                            Logger.error('Error entering/exiting fullscreen:', err);
                        }
                    }}
                    circle
                >
                    ${this._fullscreen ? biFullscreenExit : biFullscreen}
                </sl-button>
            </div>
            <div class="topmenu__button_group">
                <sl-button
                    class="topmenu__button"
                    size=${buttonSize}
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
                <sl-popup placement="bottom-end" distance="8" arrow ?shift=${collapsed} ?flip=${collapsed}
                    auto-size="both" auto-size-padding="4"
                    .shiftBoundary=${boundary} .flipBoundary=${boundary} .autoSizeBoundary=${boundary}>
                    <sl-button
                        slot="anchor"
                        class="topmenu__button"
                        size=${buttonSize}
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
                <sl-popup placement="bottom-end" distance="8" arrow ?shift=${collapsed} ?flip=${collapsed}
                    auto-size="both" auto-size-padding="4"
                    .shiftBoundary=${boundary} .flipBoundary=${boundary} .autoSizeBoundary=${boundary}
                    style="--arrow-color: var(--sl-panel-border-color)">
                    <sl-button
                        slot="anchor"
                        class="topmenu__button"
                        size=${buttonSize}
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
            ${this.renderChoices('sink', msg("Transformations"), buttonSize, boundary)}
            ${this.renderChoices('type', msg("Automaton Type"), buttonSize, boundary)}`;
    }

    private renderChoices(kind: 'sink' | 'type', label: string, size: string, boundary?: HTMLElement) {
        const { automaton, mode, allowedTypes, allowedTransformations } = this._component;
        const types = (['dfa', 'nfa', 'pda'] as const).filter(type => allowedTypes.includes(type) && type !== automaton.type);
        const disabled = mode !== 'edit' || (kind === 'sink'
            ? !(automaton instanceof DFA) || !allowedTransformations.includes('sink')
            : types.length === 0);
        const typeLabel = (type: AutomatonType) => type === 'dfa' ? msg('DFA') : type === 'nfa' ? msg('NFA') : msg('PDA');
        return html`
            <div class="topmenu__button_group" @keydown=${(event: KeyboardEvent) => {
                if (event.key === 'Escape') this._choices = undefined;
            }}>
                <sl-popup placement="bottom-end" distance="8" shift flip
                    .shiftBoundary=${boundary} .flipBoundary=${boundary}
                    ?active=${!disabled && this._choices === kind}>
                    <sl-button slot="anchor" class="topmenu__button" size=${size} circle title=${label}
                        aria-expanded=${!disabled && this._choices === kind} ?disabled=${disabled}
                        @click=${() => { this._choices = this._choices === kind ? undefined : kind; }}>
                        ${kind === 'sink' ? biArrowLeftRight : typeLabel(automaton.type)}
                    </sl-button>
                    <div class="topmenu__choices" role="group" aria-label=${label}>
                        ${kind === 'sink' ? html`
                            <sl-button size="small" @click=${() => {
                                this._choices = undefined;
                                void this._component.completeDfaWithSink();
                            }}>${msg("Add Sinkstate")}</sl-button>
                        ` : types.map(type => html`
                            <sl-button size="small" @click=${() => {
                                this._choices = undefined;
                                if (this._component.mode === 'edit' && this._component.allowedTypes.includes(type)) {
                                    this._component.type = type;
                                }
                            }}>${typeLabel(type)}</sl-button>
                        `)}
                    </div>
                </sl-popup>
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
}
