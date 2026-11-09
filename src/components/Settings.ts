import type { MsgFn } from '@lit/localize';
import type { OptionDeclaration, SelectOptionDeclaration } from '@webwriter/lit';
import type { AutomatonComponent, AutomatonType } from '../';
import { DFA } from '../automata/dfa';
import { sinkStateStatus } from '../utils/transformations/Sinkstate';

const permissionTargets = ['node', 'edge', 'stack'] as const;
const permissionActions = [
    { id: 'add', mask: 4 },
    { id: 'delete', mask: 2 },
    { id: 'change', mask: 1 },
] as const;

export class Settings {
    constructor(private parentComponent: AutomatonComponent) {}

    get permissions() {
        const encoded = this.parentComponent.permissions ?? '777';
        const decode = (index: number) => {
            const bits = Number(encoded[index]);
            return { add: Boolean(bits & 4), delete: Boolean(bits & 2), change: Boolean(bits & 1) };
        };
        return { node: decode(0), edge: decode(1), stack: decode(2) };
    }

    get selectedPermissions() {
        const permissions = this.permissions;
        return permissionTargets.flatMap(target =>
            permissionActions.filter(({ id }) => permissions[target][id]).map(({ id }) => `${target}-${id}`)
        );
    }

    set selectedPermissions(values: string[] | null) {
        if (values === null) {
            this.parentComponent.removeAttribute('permissions');
            return;
        }
        const selected = new Set(values);
        const encoded = permissionTargets.map(target =>
            permissionActions.reduce((bits, { id, mask }) =>
                selected.has(`${target}-${id}`) ? bits | mask : bits, 0)
        ).join('');
        this.parentComponent.setAttribute('permissions', encoded);
    }

    get sinkDisabledReason() {
        const { automaton, mode, sinkStateEnabled, msg } = this.parentComponent;
        if (!(automaton instanceof DFA)) return msg('Sink completion is only available for DFAs.');
        if (!sinkStateEnabled) return msg('Sink state completion is turned off.');
        if (mode !== 'edit') return msg('Switch to Edit mode to complete the DFA.');
        switch (sinkStateStatus(automaton)) {
            case 'empty': return msg('Add a state before completing the DFA.');
            case 'no-alphabet': return msg('Define an alphabet before completing the DFA.');
            case 'complete': return msg('The DFA already has a transition for every symbol at each state.');
            case 'incomplete': return undefined;
        }
    }
}

export function drawerActions(widget: AutomatonComponent) {
    const { msg } = widget;
    const changeType = (type: AutomatonType, label: string) => {
        const { automaton, allowedTypes, mode } = widget;
        const hidden = type === automaton.type || !allowedTypes.includes(type);
        const disabled = mode !== 'edit';
        const losesStackOperations = !hidden && !disabled && automaton.type === 'pda' && type !== 'pda' &&
            automaton.transitions.get().some(edge => edge.stackOperations?.some(op => op.operation !== 'none' || op.condition));
        return {
            label: { _: label }, group: 'editing', buttonGroup: 'automaton-type', hidden, disabled,
            disabledReason: disabled ? { _: msg('Switch to Edit mode to change the automaton type.') } : undefined,
            confirm: losesStackOperations ? { _: msg('Switching away from PDA removes its stack operations. Continue?') } : undefined,
        };
    };

    return {
        get completeDfaWithSink() {
            const reason = widget.settings.sinkDisabledReason;
            return {
                label: { _: msg('Complete DFA with sink') }, group: 'editing',
                disabled: reason !== undefined,
                disabledReason: reason === undefined ? undefined : { _: reason },
            };
        },
        get switchToDfa() { return changeType('dfa', msg('Switch to DFA')); },
        get switchToNfa() { return changeType('nfa', msg('Switch to NFA')); },
        get switchToPda() { return changeType('pda', msg('Switch to PDA')); },
    };
}

export function optionGroups(msg: MsgFn) {
    return {
        editing: { label: msg('Editing'), collapsible: true },
        view: { label: msg('View'), collapsible: true },
        automation: { label: msg('Automation'), collapsible: true },
    };
}

export function options(msg: MsgFn) {
    const targets = { node: msg('Nodes'), edge: msg('Transitions'), stack: msg('Stack') };
    const actions = { add: msg('Add'), delete: msg('Delete'), change: msg('Change') };
    // The installed Lit helper types predate the drawer's tree control.
    type PermissionTree = Omit<SelectOptionDeclaration, 'options'> & {
        group: string;
        control: 'tree';
        options: { label: Record<string, string>; children: NonNullable<SelectOptionDeclaration['options']> }[];
    };

    return {
        selectedPermissions: {
            type: 'select', multiple: true, attribute: false, group: 'editing', control: 'tree',
            label: { _: msg('Permissions') },
            options: permissionTargets.map(target => ({
                label: { _: targets[target] },
                children: permissionActions.map(({ id }) => ({
                    value: `${target}-${id}`, label: { _: actions[id] },
                })),
            })),
        } satisfies PermissionTree,
        allowedTypeOptions: {
            type: 'select', multiple: true, attribute: false, group: 'editing',
            label: { _: msg('Automaton Types') },
            options: [
                { value: 'nfa', label: { _: msg('NFA') } },
                { value: 'dfa', label: { _: msg('DFA') } },
                { value: 'pda', label: { _: msg('PDA') } },
            ],
        },
        sinkStateEnabled: {
            type: Boolean, control: 'switch', attribute: false, group: 'editing',
            label: { _: msg('Enable sink state') },
        },
        allowedModeOptions: {
            type: 'select', multiple: true, attribute: false, group: 'view',
            label: { _: msg('Allowed modes') },
            options: [
                { value: 'edit', label: { _: msg('Edit') } },
                { value: 'simulate', label: { _: msg('Simulate') } },
            ],
        },
        helpEnabled: {
            type: Boolean, control: 'switch', attribute: false, group: 'view',
            label: { _: msg('Show Help') },
        },
        formalDefinitionEnabled: {
            type: Boolean, control: 'switch', attribute: false, group: 'view',
            label: { _: msg('Show Formal Definition') },
        },
        transitionsTableEnabled: {
            type: Boolean, control: 'switch', attribute: false, group: 'view',
            label: { _: msg('Show Transitions Table') },
        },
        testLanguage: { type: String, group: 'automation', label: { _: msg('Test Language') } },
        testWordsInput: { type: String, attribute: false, group: 'automation', label: { _: msg('Test Words') } },
        forcedAlphabetInput: { type: String, attribute: false, group: 'automation', label: { _: msg('Predefined Alphabet') } },
    } satisfies Record<string, PermissionTree | (OptionDeclaration & { group: string; control?: 'switch' })>;
}
