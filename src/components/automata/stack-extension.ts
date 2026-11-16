import { TemplateResult, html, nothing } from 'lit';
import { Collection } from '../../model/collection';
import { LitElementWw } from '@webwriter/lit';
import { property, state } from 'lit/decorators.js';
import { stackStyles } from './stack-extension.styles';

import SlButton from '@shoelace-style/shoelace/dist/components/button/button.component.js';
import SlIcon from '@shoelace-style/shoelace/dist/components/icon/icon.component.js';
import SlInput from '@shoelace-style/shoelace/dist/components/input/input.component.js';
import SlTag from '@shoelace-style/shoelace/dist/components/tag/tag.component.js';
import SlTooltip from '@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js';
import { biTrash } from '../icons';
import { Logger } from '../../model/logger';
import { widgetMsg } from '@webwriter/lit/localize';
import { Drag, type DragCommitDetail } from '@webwriter/lit/drag';

type StackItem = {
    id: number;
    symbol: string;
};

export class StackExtension extends LitElementWw {
    private readonly msg = widgetMsg(this);

    private _stack = new Collection<StackItem>();

    @property({ type: Array }) public accessor stack: StackItem[] = [];

    @property({ type: Boolean, attribute: true, reflect: true })
    public accessor add: boolean = true;

    @property({ type: Boolean, attribute: true, reflect: true })
    public accessor delete: boolean = true;

    @property({ type: Boolean, attribute: true, reflect: true })
    public accessor change: boolean = true;

    @property({ attribute: false })
    public accessor showHelp = false;

    static get styles() {
        return stackStyles;
    }
    private readonly drag = new Drag(this, { can: () => this.canDragStack() });
    @state() private accessor _stackOpen = false;


    static scopedElements = {
        'sl-icon': SlIcon,
        'sl-button': SlButton,
        'sl-input': SlInput,
        'sl-tag': SlTag,
        'sl-tooltip': SlTooltip,
    };

    private isEditable(): boolean {
        return this.contentEditable === 'true';
    }

    constructor() {
        super();
        this._stack.on(() => {
            this.stack = [...this._stack.get()];
        });
    }

    public getStack(): string[] {
        return this._stack.get().map((s) => s.symbol).reverse();
    }

    public setStack(stack: readonly string[]): void {
        const current = this.getStack();
        if (stack.length === current.length && stack.every((symbol, index) => symbol === current[index])) return;
        Logger.log('Setting stack:', stack);
        this._stack.clear();
        this._stack.add([...stack].reverse().map((s, i) => ({ id: i, symbol: s })));
    }

    public push(symbol: string): void {
        this.pushItemToStack(symbol);
    }

    public pop(): void {
        this.popItemFromStack();
    }

    public getTopItem(): string {
        return this._stack.get(0)?.symbol || '';
    }

    public checkEmpty(): boolean {
        return this._stack.length === 0;
    }

    public checkSymbol(symbol: string): boolean {
        const item = this._stack.get(0);
        return item?.symbol === symbol;
    }

    public render(): TemplateResult {
        const { msg } = this;
        const label = msg("Stack");
        const canRemove = this.isEditable() && this.delete;
        const canMove = this.isEditable() && this.change;
        const showTrash = canRemove && this.drag.item !== null;
        return html`<div class=${this.showHelp ? 'pda__stack pda__stack--help' : 'pda__stack'}
            @ww-dragcommit=${this.commitStackDrop}>
            <div class="pda__stack-title">${label}</div>
            ${this.showHelp ? html`<sl-tag size="small" class="pda__stack-help">
                ${canRemove ? msg("Remove stack items with ×") : label}
            </sl-tag>` : ''}
            <button
                type="button"
                class="pda__stack-toggle"
                aria-expanded=${this._stackOpen}
                aria-controls="pda__stack-button pda__stack-items"
                @click=${() => { this._stackOpen = !this._stackOpen; }}
            >${label}</button>
            <sl-button
                class="pda__stack-button"
                data-ww-drop=${canRemove ? 'stack' : nothing}
                data-ww-label=${msg("Remove stack item")}
                ?hidden=${!this.isEditable()}
                size="small"
                id="pda__stack-button"
                circle
                ?disabled=${!this.add && !showTrash}
                aria-label=${showTrash ? msg("Remove stack item") : msg("Add symbol")}
                @click=${() => {
                    if (!this.isEditable() || !this.add || this.drag.item) return;
                    this.pushItemToStack('a');
                    this.notifyStackEdit();
                }}
                >${showTrash ? biTrash : '+'}</sl-button
            >
            ${this.stack.length > 0 ? html`
            <div
                class="pda__stack-items"
                id="pda__stack-items"
                data-ww-drop=${canMove ? 'stack' : nothing}
                data-ww-drop-position="index"
                data-ww-label=${label}
            >
                ${this.stack.map(
                    (s, i) => html`
                        <div
                            class="pda__stack-item"
                            data-ww-drag=${canMove || canRemove ? 'stack' : nothing}
                            data-ww-key=${i}
                            data-ww-label=${s.symbol}
                            data-index=${i}
                        >
                            ${canMove || canRemove ? html`
                                <button type="button" class="pda__stack-grip" data-ww-drag-handle
                                    aria-label="${msg("Position")}: ${s.symbol}"
                                    title=${msg("Move the elements by drag and drop")}
                                >⠿</button>
                            ` : ''}
                            <sl-tooltip content=${s.symbol} placement="left" class="pda__stack-item__tooltip">
                                <sl-input
                                    size="small"
                                    @sl-input=${(e: Event) =>
                                        this.changeStackSymbol(i, (e.target as HTMLInputElement).value)}
                                    value=${s.symbol}
                                    ?disabled=${!this.isEditable() || !this.change}
                                    autocomplete="off"
                                    autocorrect="off"
                                    autocapitalize="off"
                                    spellcheck="false"
                                ></sl-input>
                            </sl-tooltip>
                            ${canRemove ? html`
                                <button type="button" class="pda__stack-remove"
                                    aria-label=${msg("Remove stack item")}
                                    title=${msg("Remove stack item")}
                                    @click=${() => this.deleteStackSymbol(i)}>×</button>
                            ` : ''}
                        </div>
                    `
                )}
            </div>
            ` : html`
            <div class="pda__stack-items" id="pda__stack-items">
                <div class="pda__stack-item pda__stack-item--empty">
                ${msg("empty")}
                </div>
            </div>
            `}
        </div>`;
    }

    private pushItemToStack(symbol: string): void {
        const symbols = this._stack.get().map((s) => s.symbol);
        symbols.unshift(symbol);
        this._stack.clear();
        this._stack.add(symbols.map((s, i) => ({ id: i, symbol: s })));
    }

    private popItemFromStack(): void {
        const symbols = this._stack.get().map((s) => s.symbol);
        symbols.shift();
        this._stack.clear();
        this._stack.add(symbols.map((s, i) => ({ id: i, symbol: s })));
    }

    private changeStackSymbol(index: number, symbol: string): void {
        if (!this.isEditable() || !this.change || !this._stack.get(index)) return;
        Logger.log('changeStackSymbol', index, symbol);
        this._stack.update({ id: index, symbol });
        this.notifyStackEdit();
    }

    private deleteStackSymbol(index: number): void {
        if (!this.isEditable() || !this.delete || !this._stack.get(index)) return;
        Logger.log('deleteStackSymbol', index, this._stack.get());
        this._stack.remove(index);
        const symbols = this._stack.get().map((s) => s.symbol);
        this._stack.clear();
        this._stack.add(symbols.map((s, i) => ({ id: i, symbol: s })));

        this.notifyStackEdit();
    }

    private notifyStackEdit() {
        this.dispatchEvent(new Event('starting-stack-change', { bubbles: true }));
    }

    private canDragStack(): boolean {
        return this.isEditable() && !this.showHelp && (this.change || this.delete);
    }

    private commitStackDrop(event: CustomEvent<DragCommitDetail>) {
        const { key, target, index } = event.detail;
        const from = Number(key);
        if (target.id === 'pda__stack-button') this.deleteStackSymbol(from);
        else if (index !== null) this.reorderStack(from, index);
    }

    private reorderStack(oldIndex: number, newIndex: number): void {
        if (oldIndex === newIndex || !this._stack.get(oldIndex)) return;

        Logger.log('reorderStack', oldIndex, newIndex);

        const symbols = this._stack.get().map((s) => s.symbol);
        const item = symbols.splice(oldIndex, 1);
        symbols.splice(newIndex, 0, item[0]);
        this._stack.clear();
        this._stack.add(symbols.map((s, i) => ({ id: i, symbol: s })));
        this.notifyStackEdit();
    }
}
