import { msg } from '@lit/localize';
import type { OptionDeclaration } from '@webwriter/lit';
import type { AutomatonComponent } from '../';

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
        const selected = new Set(values || []);
        const encoded = permissionTargets.map(target =>
            permissionActions.reduce((bits, { id, mask }) =>
                selected.has(`${target}-${id}`) ? bits | mask : bits, 0)
        ).join('');
        this.parentComponent.setAttribute('permissions', encoded);
    }
}

export function optionGroups() {
    return {
        editing: { label: msg('Editing'), collapsible: true },
        view: { label: msg('View'), collapsible: true },
        automation: { label: msg('Automation'), collapsible: true },
        advanced: { label: msg('Advanced'), advanced: true },
    };
}

export function options() {
    const targets = { node: msg('Node'), edge: msg('Edge'), stack: msg('Stack') };
    const actions = { add: msg('Add'), delete: msg('Delete'), change: msg('Change') };

    return {
        selectedPermissions: {
            type: 'select', multiple: true, attribute: false, group: 'editing',
            label: { _: msg('Editing') },
            options: permissionTargets.flatMap(target => permissionActions.map(({ id }) => ({
                value: `${target}-${id}`, label: { _: `${targets[target]} · ${actions[id]}` },
            }))),
        },
        allowedTypeOptions: {
            type: 'select', multiple: true, attribute: false, group: 'editing',
            label: { _: msg('Automaton Types') },
            options: [
                { value: 'nfa', label: { _: msg('NFA') } },
                { value: 'dfa', label: { _: msg('DFA') } },
                { value: 'pda', label: { _: msg('PDA') } },
            ],
        },
        allowedTransformationOptions: {
            type: 'select', multiple: true, attribute: false, group: 'editing',
            label: { _: msg('Transformations') },
            options: [{ value: 'sink', label: { _: msg('Sinkstate') } }],
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
        verbose: { type: Boolean, group: 'advanced', label: { _: msg('Verbose') } },
    } satisfies Record<string, OptionDeclaration & { group: string; control?: 'switch' }>;
}
