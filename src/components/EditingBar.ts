import type { Transition, Node, StackOperation } from '../automata';
import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { biDatabase, biDatabaseAdd, biDatabaseDash, biDatabaseSlash, biPlus, biTrash } from '../styles/icons';
import type { AutomatonComponent } from '../index';
import { msg } from '@lit/localize';

export type EditableSelection =
    | { type: 'node'; data: Node }
    | { type: 'edge'; data: Transition };

export type EditPermission = 'add' | 'change' | 'delete';
type UpdateEdge = (patch: (edge: Transition) => Partial<Transition>, permission?: EditPermission) => void;

const stackActions = [
    ['push', biDatabaseAdd, () => msg("Push")],
    ['pop', biDatabaseDash, () => msg("Pop")],
    ['empty', biDatabaseSlash, () => msg("Empty Check")],
    ['none', biDatabase, () => msg("Keep")],
] as const;

export class EditingBar {
    constructor(private parentComponent: AutomatonComponent) {}

    public render(
        selection: EditableSelection,
        update: (getPatch: (current: EditableSelection) => Partial<Node> | Partial<Transition>, permission?: EditPermission) => void,
        remove: () => void,
    ) {
        const { type, data } = selection;
        const permissions = this.parentComponent.settings.permissions[type];
        const name = type === 'node' ? msg("Node") : msg("Edge");
        const updateEdge: UpdateEdge = (getPatch, permission) =>
            update(current => current.type === 'edge' ? getPatch(current.data) : {}, permission);
        const deleteLabel = type === 'node' ? msg("Delete node") : msg("Delete transition");
        return keyed(`${type}:${data.id}`, html`
            <div class="editing-bar" role="group" aria-label=${name} contenteditable="false">
                ${type === 'node' ? html`
                    <sl-input
                        label=${msg("Label")} placeholder=${msg("Label")} size="small"
                        .value=${data.label || ''} ?disabled=${!permissions.change}
                        @sl-input=${(event: Event) => update(() => ({ label: this.value(event) || undefined }))}
                        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    ></sl-input>
                    <div class="editing-bar__checks">
                        <sl-checkbox
                            name="initial" size="small" ?checked=${data.initial} ?disabled=${data.initial || !permissions.change}
                            @sl-change=${(event: Event) => update(() => ({ initial: this.checked(event) }))}
                        ><span title=${msg("Initial")}>${msg("Initial")}</span></sl-checkbox>
                        <sl-checkbox
                            name="final" size="small" ?checked=${data.final} ?disabled=${!permissions.change}
                            @sl-change=${(event: Event) => update(() => ({ final: this.checked(event) }))}
                        ><span title=${msg("Final")}>${msg("Final")}</span></sl-checkbox>
                    </div>
                ` : html`
                    ${this.edgeFields(data, updateEdge)}
                `}
                ${permissions.delete ? html`
                    <sl-button class="editing-bar__delete" circle size="small"
                        title=${deleteLabel} @click=${remove}>${biTrash}</sl-button>
                ` : null}
            </div>
        `);
    }

    private value(event: Event) {
        return (event.currentTarget as HTMLElement & { value: string }).value;
    }

    private checked(event: Event) {
        return (event.currentTarget as HTMLElement & { checked: boolean }).checked;
    }

    private symbolInput(edge: Transition, index: number, update: UpdateEdge) {
        const alphabet = this.parentComponent.forcedAlphabet;
        const disabled = !this.parentComponent.settings.permissions.edge.change;
        const symbol = edge.symbols[index] ?? '';
        const change = (event: Event) => {
            const value = this.value(event);
            update(current => {
                const symbols = [...current.symbols];
                symbols[index] = value;
                return { symbols };
            });
        };
        const label = msg("Symbol");
        return alphabet.length ? html`
            <sl-select label=${label} placeholder=${label} .value=${symbol} size="small" hoist
                ?disabled=${disabled} @sl-change=${change}>
                ${alphabet.map(value => html`<sl-option value=${value}>${value}</sl-option>`)}
            </sl-select>
        ` : html`
            <sl-input label=${label} placeholder=${label} .value=${symbol} size="small" maxlength="1"
                ?disabled=${disabled} @sl-input=${change} autocomplete="off" autocorrect="off"
                autocapitalize="off" spellcheck="false"></sl-input>
        `;
    }

    private edgeFields(edge: Transition, update: UpdateEdge) {
        const { add, change, delete: canDelete } = this.parentComponent.settings.permissions.edge;
        const changeOperation = (index: number, patch: Partial<StackOperation>) => update(current => {
            const stackOperations = current.stackOperations?.map((operation, i) =>
                index === i ? { ...operation, ...patch } : operation);
            return { stackOperations };
        });
        const selfLoop = edge.from === edge.to;
        const smooth = typeof edge.smooth === 'object' ? edge.smooth : undefined;
        const angle = edge.selfReference?.angle ?? Math.PI / 4;
        return html`
            <div class="editing-bar__edge-fields">
                ${edge.symbols.map((_, index) => {
                    const operation = edge.stackOperations?.[index];
                    return html`
                        <div class="editing-bar__symbol">
                            ${this.symbolInput(edge, index, update)}
                            ${canDelete && edge.symbols.length > 1 ? html`
                                <sl-button circle size="small" title=${msg("Remove symbol")}
                                    @click=${() => update(current => ({
                                        symbols: current.symbols.filter((_, i) => i !== index),
                                        stackOperations: current.stackOperations?.filter((_, i) => i !== index),
                                    }), 'delete')}>${biTrash}</sl-button>
                            ` : null}
                            ${operation ? html`
                                <sl-input size="small" label=${msg("Stack")} placeholder=${msg("Stack")} .value=${operation.symbol}
                                    ?disabled=${!change || operation.operation === 'empty' || operation.operation === 'none'}
                                    @sl-input=${(event: Event) => changeOperation(index, { symbol: this.value(event) })}></sl-input>
                                <sl-input size="small" label=${msg("If")} placeholder=${msg("If")} .value=${operation.condition}
                                    ?disabled=${!change || operation.operation === 'empty'}
                                    @sl-input=${(event: Event) => changeOperation(index, { condition: this.value(event) })}></sl-input>
                                <div class="editing-bar__stack-actions" role="group" aria-label=${msg("Stack Actions")}>
                                    ${stackActions.map(([action, icon, label]) => html`
                                        <sl-button circle size="small" title=${label()}
                                            variant=${operation.operation === action ? 'primary' : 'default'}
                                            ?disabled=${!change}
                                            @click=${() => changeOperation(index, {
                                                operation: action,
                                                ...(action === 'empty' || action === 'none' ? { symbol: '' } : {}),
                                                ...(action === 'empty' ? { condition: '' } : {}),
                                            })}>${icon}</sl-button>
                                    `)}
                                </div>
                            ` : null}
                        </div>
                    `;
                })}
                ${add ? html`
                    <sl-button size="small" circle title=${msg("Add symbol")} @click=${() => update(current => ({
                        symbols: [...current.symbols, ''],
                        stackOperations: current.stackOperations && [...current.stackOperations, { operation: 'none', symbol: '', condition: '' }],
                    }), 'add')}>${biPlus}</sl-button>
                ` : null}
                <label class="editing-bar__range">
                    ${selfLoop ? msg("Position") : msg("Bend")}
                    <input type="range" min=${selfLoop ? 0 : -100} max=${selfLoop ? 360 : 100}
                        .value=${String(selfLoop ? (450 - angle * 180 / Math.PI) % 360
                            : (smooth?.roundness ?? 0) * (smooth?.type === 'curvedCCW' ? -100 : 100))}
                        ?disabled=${!change}
                        @input=${(event: Event) => {
                            const value = Number(this.value(event));
                            update(() => selfLoop
                                ? { selfReference: { angle: ((450 - value) % 360) * (Math.PI / 180) } }
                                : { smooth: { enabled: true, type: value < 0 ? 'curvedCCW' : 'curvedCW', roundness: Math.abs(value / 100) } });
                        }}>
                </label>
            </div>
        `;
    }
}
