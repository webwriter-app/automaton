import type { MsgFn } from "@lit/localize";
import { Node, Transition } from "automata";
import { html, TemplateResult } from "lit";

type AutomatonErrorType = 'missing-transition' 
    | 'multiple-transitions' 
    | 'empty-transition' 
    | 'no-initial-state' 
    | 'multiple-initial-states'
    | 'other';

export class AutomatonError {
    public readonly type: AutomatonErrorType;
    public readonly node?: Node;
    public readonly transition?: Transition;
    public readonly letter?: string;

    constructor(type: AutomatonErrorType, node?: Node, transition?: Transition, letter?: string) {
        this.type = type;
        this.node = node;
        this.transition = transition;
        this.letter = letter;
    }

    public message(msg: MsgFn): TemplateResult<1> {
        switch (this.type) {
            case 'missing-transition':
                return html`${msg(html`Missing transition for <b>${this.letter}</b>`)}`;
            case 'multiple-transitions':
                return html`${msg(html`Multiple transitions for <b>${this.letter}</b>`)}`;
            case 'empty-transition':
                return html`${msg("Transition with empty symbol")}`;
            case 'no-initial-state':
                return html`${msg("No initial state defined")}`;
            case 'multiple-initial-states':
                return html`${msg("Multiple initial states defined")}`;
            default:
                return html`<b>${msg("Unknown error")}</b>`;
        }
    }
}