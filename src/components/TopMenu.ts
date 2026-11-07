import { html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import {
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
import { LitElementWw } from '@webwriter/lit';
import { Graph } from '../graph';
import type { Node, StackOperation, Transition } from '../automata';
import { PDA } from '../automata/pda';
import RandExp from 'randexp';
import { SimulationStatus } from 'automata';
import { localized, msg, str } from '@lit/localize';
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
    private accessor _typeMenuOpen = false;

    @state()
    private accessor _definitionOpen = false;

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

    protected willUpdate(changedProperties: PropertyValues) {
        super.willUpdate(changedProperties);
        if (this._definitionOpen && !this._component.formalDefinitionEnabled && !this._component.transitionsTableEnabled) {
            this._definitionOpen = false;
        }
    }

    render() {
        if (!this._component) return nothing;
        return html`
            ${this._collapsed ? html`
                <div class="topmenu topmenu--hamburger">
                    <sl-button
                        class="topmenu__button"
                        circle
                        aria-label=${msg("Menu")}
                        aria-expanded=${this._menuOpen || this._helpOverlay}
                        aria-controls="compact-menu"
                        @click=${() => {
                            if (this._definitionOpen) void this.setDefinitionOpen(false);
                            else this._menuOpen = !this._menuOpen;
                            this._typeMenuOpen = false;
                        }}
                    >${biList}</sl-button>
                    ${this._menuOpen || this._helpOverlay ? html`
                        <div class="topmenu__collapsed_panel" id="compact-menu">
                            ${this.renderButtonGroups(true)}
                        </div>` : ''}
                </div>` : html`<div class="topmenu">${this.renderButtonGroups()}</div>`}
            ${this._definitionOpen ? this.renderDefinitionPane() : nothing}
        `;
    }

    private renderButtonGroups(collapsed = false) {
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
                        this._definitionOpen = false;
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
                            this._definitionOpen = false;
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
                <sl-button class="topmenu__button definition-trigger" size=${buttonSize} circle
                    aria-label=${msg("Definition")} title=${msg("Definition")}
                    aria-expanded=${this._definitionOpen}
                    aria-controls=${this._definitionOpen ? 'definition-pane' : nothing}
                    ?disabled=${!this.component.formalDefinitionEnabled && !this.component.transitionsTableEnabled}
                    @click=${() => void this.setDefinitionOpen(!this._definitionOpen)}
                    @keydown=${this.handleDefinitionKeydown}>${biCodeSlash}</sl-button>
            </div>
            ${this.renderTypeMenu(buttonSize, boundary)}`;
    }

    private renderTypeMenu(size: string, boundary?: HTMLElement) {
        const label = msg("Automaton Type");
        const { automaton, mode, allowedTypes } = this._component;
        const types = (['dfa', 'nfa', 'pda'] as const).filter(type => allowedTypes.includes(type) && type !== automaton.type);
        const disabled = mode !== 'edit' || types.length === 0;
        const typeLabel = (type: AutomatonType) => type === 'dfa' ? msg('DFA') : type === 'nfa' ? msg('NFA') : msg('PDA');
        return html`
            <div class="topmenu__button_group" @keydown=${(event: KeyboardEvent) => {
                if (event.key === 'Escape') this._typeMenuOpen = false;
            }}>
                <sl-popup placement="bottom-end" distance="8" shift flip
                    .shiftBoundary=${boundary} .flipBoundary=${boundary}
                    ?active=${!disabled && this._typeMenuOpen}>
                    <sl-button slot="anchor" class="topmenu__button" size=${size} circle title=${label}
                        aria-expanded=${!disabled && this._typeMenuOpen} ?disabled=${disabled}
                        @click=${() => {
                            this._definitionOpen = false;
                            this._typeMenuOpen = !this._typeMenuOpen;
                        }}>
                        ${typeLabel(automaton.type)}
                    </sl-button>
                    <div class="topmenu__choices" role="group" aria-label=${label}>
                        ${types.map(type => html`
                            <sl-button size="small" @click=${() => {
                                this._typeMenuOpen = false;
                                void this._component.switchType(type);
                            }}>${typeLabel(type)}</sl-button>
                        `)}
                    </div>
                </sl-popup>
            </div>`;
    }

    private async setDefinitionOpen(open: boolean) {
        this._definitionOpen = open;
        this._typeMenuOpen = false;
        if (this._collapsed) this._menuOpen = !open;
        if (open && this._helpOverlay) {
            this._helpOverlay = false;
            this._setHelpOverlay(false);
        }
        await this.updateComplete;
        if (this._definitionOpen !== open || !this.isConnected) return;
        if (open) {
            this.renderRoot.querySelector<HTMLButtonElement>('.definition-pane__close')?.focus();
        } else {
            const trigger = this.renderRoot.querySelector<SlButton>('.definition-trigger');
            await trigger?.updateComplete;
            if (!this._definitionOpen) trigger?.focus();
        }
    }

    private handleDefinitionKeydown(event: KeyboardEvent) {
        if (event.key !== 'Escape' || !this._definitionOpen) return;
        event.preventDefault();
        event.stopPropagation();
        void this.setDefinitionOpen(false);
    }

    private renderDefinitionPane() {
        const { automaton, formalDefinitionEnabled, transitionsTableEnabled } = this._component;
        const nodes = automaton.nodes.get().filter(node => node.id !== Graph.initialGhostNode.id);
        const labels = new Map(nodes.map(node => [node.id, node.label]));
        const transitions = automaton.transitions.get().filter(edge => labels.has(edge.from) && labels.has(edge.to));
        const outgoing = new Map(nodes.map(node => [node.id, [] as Transition[]]));
        for (const edge of transitions) outgoing.get(edge.from)!.push(edge);
        const alphabet = automaton.getAlphabet().sort();
        const tableAlphabet = transitions.some(edge => edge.symbols.includes('')) ? [...alphabet, ''] : alphabet;

        return html`
            <section id="definition-pane" class="definition-pane" aria-label=${msg("Automaton definition")}
                contenteditable="false"
                @keydown=${this.handleDefinitionKeydown}>
                <button type="button" class="definition-pane__close"
                    aria-label=${msg("Close")} title=${msg("Close")}
                    @click=${() => void this.setDefinitionOpen(false)}>×</button>
                ${keyed(`${formalDefinitionEnabled}/${transitionsTableEnabled}`, html`
                    <sl-tab-group placement="top">
                        <sl-tab slot="nav" panel="def" ?disabled=${!formalDefinitionEnabled}
                            ?active=${formalDefinitionEnabled}>${msg("Definition")}</sl-tab>
                        <sl-tab slot="nav" panel="table" ?disabled=${!transitionsTableEnabled}
                            ?active=${!formalDefinitionEnabled && transitionsTableEnabled}>${msg("Table")}</sl-tab>
                        ${formalDefinitionEnabled ? html`
                            <sl-tab-panel name="def" active tabindex="0">
                                ${this.renderFormalSummary(nodes, alphabet, transitions, automaton instanceof PDA ? automaton.startingStack : undefined)}
                                ${this.renderGroupedTransitions(nodes, outgoing, labels)}
                            </sl-tab-panel>` : nothing}
                        ${transitionsTableEnabled ? html`
                            <sl-tab-panel name="table" ?active=${!formalDefinitionEnabled} tabindex="0">
                                ${this.renderTransitionsTable(nodes, outgoing, labels, tableAlphabet)}
                            </sl-tab-panel>` : nothing}
                    </sl-tab-group>
                `)}
            </section>
        `;
    }

    private renderFormalSummary(nodes: Node[], alphabet: string[], transitions: Transition[], startingStack?: readonly string[]) {
        const set = (values: string[]) => values.length ? `{ ${values.join(', ')} }` : '∅';
        const stackSymbol = (symbol: string) => symbol || '""';
        const stackAlphabet = new Set(startingStack?.map(stackSymbol));
        if (startingStack) {
            for (const edge of transitions) {
                for (const operation of edge.stackOperations ?? []) {
                    if (operation.condition) stackAlphabet.add(operation.condition);
                    if (operation.operation === 'push' || operation.operation === 'pop') {
                        stackAlphabet.add(stackSymbol(operation.symbol));
                    }
                }
            }
        }
        const initial = nodes.filter(node => node.initial).map(node => node.label);
        const rows = [
            ['Q', msg("States"), set(nodes.map(node => node.label))],
            ['Σ', msg("Alphabet"), set(alphabet)],
            ['q₀', msg("Initial state"), initial.length > 1 ? set(initial) : initial[0] ?? '—'],
            ['F', msg("Final states"), set(nodes.filter(node => node.final).map(node => node.label))],
        ];
        if (startingStack) rows.push(
            ['Γ', msg("Stack alphabet"), set([...stackAlphabet].sort())],
            ['', msg("Starting stack"), `[${startingStack.map(stackSymbol).join(', ')}]`],
        );
        return html`
            <dl class="definition-summary">
                ${rows.map(([notation, label, value]) => html`
                    <div>
                        <dt>${notation ? html`<code>${notation}</code><span aria-hidden="true"> · </span>` : nothing}${label}</dt>
                        <dd><code>${value}</code></dd>
                    </div>
                `)}
            </dl>
        `;
    }

    private renderGroupedTransitions(nodes: Node[], outgoing: Map<number, Transition[]>, labels: Map<number, string>) {
        const groups = nodes.filter(node => outgoing.get(node.id)!.some(edge => edge.symbols.length));
        return html`
            <h3 class="definition-transitions-title"><code>δ</code> · ${msg("Transitions")}</h3>
            ${groups.length ? groups.map(node => html`
                <section class="definition-transitions">
                    <h4><code>${node.label}</code></h4>
                    <ul role="list">
                        ${outgoing.get(node.id)!.map(edge => edge.symbols.map((symbol, index) => html`
                            <li>
                                <code>${symbol || 'ε'} → ${labels.get(edge.to)}</code>
                                ${edge.stackOperations?.[index] ? this.renderStackOperation(edge.stackOperations[index]) : nothing}
                            </li>
                        `))}
                    </ul>
                </section>
            `) : html`<p class="definition-empty">${msg("No transitions yet")}</p>`}
        `;
    }

    private renderStackOperation({ operation, symbol, condition }: StackOperation) {
        const label = symbol || '""';
        const action = {
            push: () => msg(str`Push ${label}`),
            pop: () => msg(str`Pop ${label}`),
            empty: () => msg("Require an empty stack"),
            none: () => msg("Leave stack unchanged"),
        }[operation]();
        return html`
            <span class="definition-stack-operation">
                ${action}${condition && !(operation === 'pop' && condition === symbol)
                    ? html` · ${msg(str`Top is ${condition}`)}` : nothing}
            </span>
        `;
    }

    private renderTransitionsTable(nodes: Node[], outgoing: Map<number, Transition[]>, labels: Map<number, string>, alphabet: string[]) {
        return html`<table class="definition-table" aria-label=${msg("Transition table")}>
            <thead>
                <tr>
                    <th scope="col">${msg("State")}</th>
                    ${alphabet.map(symbol => html`<th scope="col">${symbol || 'ε'}</th>`)}
                </tr>
            </thead>
            <tbody>
                ${nodes.map(
                    (node) => html`<tr>
                        <th scope="row">${node.label}</th>
                        ${alphabet.map(
                            (a) => html`<td>
                                ${outgoing.get(node.id)!
                                    .filter(edge => edge.symbols.includes(a))
                                    .map(edge => labels.get(edge.to))
                                    .join(', ')}
                            </td>`
                        )}
                    </tr>`
                )}
            </tbody>
        </table>`;
    }
}
