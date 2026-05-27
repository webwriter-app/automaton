import { Transition, Node, StackOperation } from '../automata';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { biDatabase, biDatabaseAdd, biDatabaseDash, biDatabaseSlash, biTrash } from '../styles/icons';
import { AutomatonComponent } from 'index';
import { classMap } from 'lit/directives/class-map.js';
import { msg } from '@lit/localize';
import { Logger } from '@u/logger';

/**
 * Represents a context menu component that provides options for interacting with nodes and edges.
 */
export class ContextMenu {
    private selected: {
        data: Transition | Node;
        type: 'Node' | 'Transition' | undefined;
        updateFn: Function;
        deleteFn: Function;
    } = {
        data: { id: 0, label: '', initial: false, final: false },
        type: undefined,
        updateFn: () => {},
        deleteFn: () => {},
    };
    private position = { x: 0, y: 0 };
    private translate = { x: '-100%', y: '-100%' };

    private visible = false;

    public requestUpdate: () => void = () => {};

    constructor(private parentComponent: AutomatonComponent) {}

    public render() {
        return html`<div
            id="contextMenu"
            class="context-menu"
            style=${styleMap(
                { 
                    left: this.position.x + 'px', 
                    top: this.position.y + 'px', 
                    transform: `translate(${this.translate.x}, ${this.translate.y})`, 
                    display: this.visible ? 'block' : 'none' 
                }
            )}
        >
            ${this.selected?.type === 'Node' ? this.nodeContextMenu() : null}
            ${this.selected?.type === 'Transition'
                ? this.edgeContextMenu(!!(this.selected.data as Transition).stackOperations)
                : null}
        </div>`;
    }

    private nodeContextMenu() {
        return html`
            <div class="context-menu__header">
                <span class="context-menu__header__label">${msg("Node")} ${this.selected?.data.label}</span>
                <sl-button
                    class="context-menu__button"
                    circle
                    size="small"
                    @click=${() => {
                        this.selected.deleteFn();
                        this.hide();
                    }}
                    style=${styleMap({
                        display: this.parentComponent.settings.permissions.node.delete ? 'block' : 'none',
                    })}
                    >${biTrash}</sl-button
                >
            </div>
            <sl-divider style="--spacing: var(--sl-spacing-x-small)"></sl-divider>
            <sl-input
                placeholder=${msg("Label")}
                value=${this.selected?.data.label || ''}
                @sl-input=${(e: any) => {
                    this.selected.updateFn({ ...this.selected.data, label: e.target.value });
                    this.selected.data = { ...this.selected.data, label: e.target.value };
                }}
                ?disabled=${!this.parentComponent.settings.permissions.node.change}
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
            ></sl-input>
            <sl-divider style="--spacing: var(--sl-spacing-x-small)"></sl-divider>
            <div class="context-menu__checkboxes">
                <sl-checkbox
                    ?checked=${(this.selected?.data as Node).initial}
                    ?disabled=${(this.selected?.data as Node).initial ||
                    !this.parentComponent.settings.permissions.node.change}
                    @sl-change=${(e: any) => {
                        Logger.log('initial', e.target.checked);
                        this.selected.updateFn({ ...this.selected.data, initial: e.target.checked });
                        this.selected.data = { ...this.selected.data, initial: e.target.checked };
                    }}
                    name="initial"
                    >${msg("Initial")}</sl-checkbox
                >
                <sl-checkbox
                    ?checked=${(this.selected?.data as Node).final}
                    ?disabled=${!this.parentComponent.settings.permissions.node.change}
                    @sl-change=${(e: any) => {
                        this.selected.updateFn({ ...this.selected.data, final: e.target.checked });
                        this.selected.data = { ...this.selected.data, final: e.target.checked };
                    }}
                    name="final"
                    >${msg("Final")}</sl-checkbox
                >
            </div>
        `;
    }

    private edgeContextMenu(isPda: boolean = false) {
        let transition = this.selected?.data as Transition;
        let stackOperations = transition.stackOperations as StackOperation[] || [];

        return html`
            <div class="context-menu__header">
                <span class="context-menu__header__label">${msg("Edge")} ${transition.label}</span>
                <sl-button
                    class="context-menu__button"
                    circle
                    size="small"
                    @click=${() => {
                        this.selected.deleteFn();
                        this.hide();
                    }}
                    style=${styleMap({
                        display: this.parentComponent.settings.permissions.edge.delete ? 'block' : 'none',
                    })}
                    >${biTrash}</sl-button
                >
            </div>
            <sl-divider style="--spacing: var(--sl-spacing-x-small)"></sl-divider>
            <div class=${classMap({"context-menu__inputs": true, "context-menu__inputs--pda": isPda})}>
                ${transition.symbols.map(
                    (symbol, i) => html`
                        <div class="context-menu__inputs__group">
                            ${this.parentComponent.forcedAlphabet.length > 0
                                ? html`
                                    <sl-select
                                        placeholder=${msg("Symbol")}
                                        value=${symbol}
                                        size="small"
                                        ?disabled=${!this.parentComponent.settings.permissions.edge.change}
                                        @sl-change=${(e: any) => {
                                            Logger.log(e.target.value);
                                            const symbols = transition.symbols;
                                            symbols[i] = e.target.value;
                                            this.selected.updateFn({ ...transition, symbols });
                                            transition = { ...transition, symbols };
                                        }}
                                        name="symbol"
                                    >
                                        ${this.parentComponent.forcedAlphabet.map(
                                            (symbol) => html`<sl-option value=${symbol}>${symbol}</sl-option>`
                                        )}
                                    </sl-select>
                                `
                                : html`
                                    <sl-input
                                        placeholder=${msg("Symbol")}
                                        value=${symbol}
                                        size="small"
                                        maxlength="1"
                                        ?disabled=${!this.parentComponent.settings.permissions.edge.change}
                                        @sl-input=${(e: any) => {
                                            Logger.log(e.target.value);
                                            const symbols = transition.symbols;
                                            symbols[i] = e.target.value;
                                            this.selected.updateFn({ ...transition, symbols });
                                            transition = { ...transition, symbols };
                                        }}
                                        autocomplete="off"
                                        autocorrect="off"
                                        autocapitalize="off"
                                        spellcheck="false"
                                    ></sl-input>
                                `}
                            ${isPda ? html`
                                <sl-input
                                    placeholder=${msg("Stack")}
                                    value=${stackOperations[i].symbol}
                                    size="small"
                                    ?disabled=${!this.parentComponent.settings.permissions.edge.change || stackOperations[i].operation === 'empty' || stackOperations[i].operation === 'none'}
                                    @sl-input=${(e: any) => {
                                        const operation = {
                                            operation: stackOperations[i].operation,
                                            symbol: e.target.value,
                                            condition: stackOperations[i].condition,
                                        };
                                        stackOperations[i] = operation as StackOperation;
                                        this.selected.updateFn({ ...transition, stackOperations: stackOperations });
                                        transition = { ...transition, stackOperations: stackOperations };
                                    }}
                                    autocomplete="off"
                                    autocorrect="off"
                                    autocapitalize="off"
                                    spellcheck="false"
                                ></sl-input>
                                <sl-input
                                    placeholder=${msg("If")}
                                    value=${stackOperations[i].condition}
                                    size="small"
                                    ?disabled=${!this.parentComponent.settings.permissions.edge.change || stackOperations[i].operation === 'empty'}
                                    @sl-input=${(e: any) => {
                                        const operation = {
                                            operation: stackOperations[i].operation,
                                            symbol: stackOperations[i].symbol,
                                            condition: e.target.value,
                                        };
                                        stackOperations[i] = operation as StackOperation;
                                        this.selected.updateFn({ ...transition, stackOperations: stackOperations });
                                        transition = { ...transition, stackOperations: stackOperations };
                                    }}
                                    autocomplete="off"
                                    autocorrect="off"
                                    autocapitalize="off"
                                    spellcheck="false"
                                ></sl-input>

                                <sl-button-group label=${msg("Stack Actions")}>
                                    <sl-tooltip content=${msg("Push")} placement="top">
                                        <sl-button
                                            variant=${stackOperations[i].operation == 'push' ? 'primary' : 'default'}
                                            size="small"
                                            ?disabled=${!this.parentComponent.settings.permissions.edge.change}
                                            @click=${() => {
                                                const operation = {
                                                    operation: 'push',
                                                    symbol: stackOperations[i].symbol,
                                                    condition: stackOperations[i].condition,
                                                };
                                                stackOperations[i] = operation as StackOperation;
                                                this.selected.updateFn({ ...transition, stackOperations: stackOperations });
                                                transition = { ...transition, stackOperations: stackOperations };
                                            }}
                                            >${biDatabaseAdd}</sl-button
                                        >
                                    </sl-tooltip>
                                    <sl-tooltip content=${msg("Pop")} placement="top">
                                        <sl-button
                                            variant=${stackOperations[i].operation == 'pop' ? 'primary' : 'default'}
                                            size="small"
                                            ?disabled=${!this.parentComponent.settings.permissions.edge.change}
                                            @click=${() => {
                                                const operation = {
                                                    operation: 'pop',
                                                    symbol: stackOperations[i].symbol,
                                                    condition: stackOperations[i].condition,
                                                };
                                                stackOperations[i] = operation as StackOperation;
                                                this.selected.updateFn({ ...transition, stackOperations: stackOperations });
                                                transition = { ...transition, stackOperations: stackOperations };
                                            }}
                                            >${biDatabaseDash}</sl-button
                                        >
                                    </sl-tooltip>
                                    <sl-tooltip content=${msg("Empty Check")} placement="top">
                                        <sl-button
                                            variant=${stackOperations[i].operation == 'empty' ? 'primary' : 'default'}
                                            size="small"
                                            ?disabled=${!this.parentComponent.settings.permissions.edge.change}
                                            @click=${() => {
                                                const operation = {
                                                    operation: 'empty',
                                                    symbol: '',
                                                    condition: '',
                                                };
                                                stackOperations[i] = operation as StackOperation;
                                                this.selected.updateFn({ ...transition, stackOperations: stackOperations });
                                                transition = { ...transition, stackOperations: stackOperations };
                                            }}
                                            >${biDatabaseSlash}</sl-button
                                        >
                                    </sl-tooltip>
                                    <sl-tooltip content=${msg("Keep")} placement="top">
                                        <sl-button
                                            variant=${stackOperations[i].operation == 'none' ? 'primary' : 'default'}
                                            size="small"
                                            ?disabled=${!this.parentComponent.settings.permissions.edge.change}
                                            @click=${() => {
                                                const operation = {
                                                    operation: 'none',
                                                    symbol: '',
                                                    condition: stackOperations[i].condition,
                                                };
                                                stackOperations[i] = operation as StackOperation;
                                                this.selected.updateFn({ ...transition, stackOperations: stackOperations });
                                                transition = { ...transition, stackOperations: stackOperations };
                                            }}
                                            >${biDatabase}</sl-button
                                        >
                                    </sl-tooltip>
                                </sl-button-group>
                            ` : ''}
                            <sl-button
                                class="context-menu__button"
                                circle
                                size="small"
                                @click=${() => {
                                    const symbols = transition.symbols;
                                    symbols.splice(i, 1);
                                    this.selected.updateFn({ ...transition, symbols });
                                    transition = { ...transition, symbols };

                                    if (symbols.length === 0) {
                                        this.selected.deleteFn();
                                        this.hide();
                                    }
                                }}
                                style=${styleMap({
                                    display: this.parentComponent.settings.permissions.edge.delete ? 'block' : 'none',
                                })}
                                >${biTrash}</sl-button
                            >
                        </div>
                    `
                )}
                <sl-button
                    class="context-menu__button__add"
                    size="small"
                    @click=${() => {
                        const symbols = transition.symbols;
                        symbols.push('');

                        if (isPda) {
                            stackOperations.push({ operation: 'none', symbol: '', condition: '' });
                            this.selected.updateFn({ ...transition, stackOperations, symbols });
                            transition = { ...transition, stackOperations, symbols };
                        } else {
                            this.selected.updateFn({ ...transition, symbols });
                            transition = { ...transition, symbols };
                        }
                    }}
                    style=${styleMap({
                        display: this.parentComponent.settings.permissions.edge.add ? 'block' : 'none',
                    })}>
                    ${msg("Add symbol")}
                </sl-button>
            </div>
            <sl-divider style="--spacing: var(--sl-spacing-x-small)"></sl-divider>
            ${transition.from === transition.to ? html`
                <sl-range
                    label=${msg("Position")}
                    min="0"
                    max="360"
                    style="--track-color-active: var(--sl-color-primary-600);--track-color-inactive: var(--sl-color-primary-100);"
                    value=${(450 - (transition.selfReference?.angle ?? (Math.PI / 4)) * (180 / Math.PI)) % 360}
                    @sl-input=${(e: any) => {
                        const value = e.target.value;
                        this.selected.updateFn({
                            ...transition,
                            selfReference: { angle: ((450 - value) % 360) * (Math.PI / 180) },
                        });
                    }}
                ></sl-range>`
            : html`
                <sl-range
                    label=${msg("Bend")}
                    min="-100"
                    max="100"
                    style="--track-color-active: var(--sl-color-primary-600);--track-color-inactive: var(--sl-color-primary-100);--track-active-offset: 50%;"
                    value=${(transition.smooth as any)?.roundness ? (transition.smooth as any).roundness * 100 : 0}
                    @sl-input=${(e: any) => {
                        const value = e.target.value;
                        this.selected.updateFn({
                            ...transition,
                            smooth: { type: value < 0 ? 'curvedCCW' : 'curvedCW', roundness: Math.abs(value / 100) },
                        });
                    }}
                ></sl-range>`
            }
        `;
    }

    public setData(data: Node | Transition, type: 'Node' | 'Transition', updateFn: Function, deleteFn: Function) {
        this.selected = { data, type, updateFn, deleteFn };
        this.requestUpdate();
    }

    public setPosition({ x, y }: { x: number; y: number }) {
        this.position = { x, y };

        const totalWidth = this.parentComponent.shadowRoot?.getElementById("graphCanvas")?.clientWidth || 0;
        const totalHeight = this.parentComponent.shadowRoot?.getElementById("graphCanvas")?.clientHeight || 0;

        this.translate.x = x > totalWidth / 2 ? '-100%' : '0%';
        this.translate.y = y > totalHeight / 2 ? '-100%' : '0%';

        this.requestUpdate();
    }

    public show() {
        this.visible = true;
        this.requestUpdate();
    }

    public hide() {
        this.visible = false;
        this.requestUpdate();
    }

    public isVisible() {
        return this.visible;
    }

    public toggle() {
        this.visible = !this.visible;
        this.requestUpdate();
    }

    public blur() {
        this.hide();
        this.requestUpdate();
    }
}