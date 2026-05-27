import { biGear } from '../styles/icons';
import { AutomatonComponent } from '../';
import { html } from 'lit';
import { SlChangeEvent, SlCheckbox, SlInput, SlSelect } from '@shoelace-style/shoelace';

import { live } from 'lit/directives/live.js';
import { msg } from '@lit/localize';
import { Logger } from '@u/logger';

export class Settings {
    constructor(private parentComponent: AutomatonComponent) {
        this.numberStringToPermissions(parentComponent.permissions);
    }

    private _permissions = {
        node: {
            add: true,
            delete: true,
            change: true,
        },
        edge: {
            add: true,
            delete: true,
            change: true,
        },
        stack: {
            add: true,
            delete: true,
            change: true,
        },
    };
    private set permissions(permissions: typeof this._permissions) {
        this._permissions = permissions;
        this.parentComponent.permissions = this.permissionsToNumberString();
    }
    public get permissions() {
        return this._permissions;
    }

    render() {
        return html`<h2>${biGear} ${msg("Settings")}</h2>
            <hr />
            <sl-details summary=${msg("Editing")}>
                <table>
                    <tr>
                        <th></th>
                        <th>${msg("Add")}</th>
                        <th>${msg("Delete")}</th>
                        <th>${msg("Change")}</th>
                    </tr>
                    <tr>
                        <td>${msg("Node")}</td>
                        <td>
                            <sl-checkbox
                                ?checked=${live(this.permissions.node.add)}
                                @sl-input=${(e: SlChangeEvent) => {
                                    const c = e.target as SlCheckbox;
                                    this.permissions = {
                                        ...this.permissions,
                                        node: { ...this.permissions.node, add: (e.target as SlCheckbox).checked },
                                    };
                                    c.checked = this.permissions.node.add;
                                }}
                                name="node-add"
                            ></sl-checkbox>
                        </td>
                        <td>
                            <sl-checkbox
                                ?checked=${this.permissions.node.delete}
                                @sl-input=${(e: SlChangeEvent) => {
                                    const c = e.target as SlCheckbox;
                                    this.permissions = {
                                        ...this.permissions,
                                        node: { ...this.permissions.node, delete: (e.target as SlCheckbox).checked },
                                    };
                                    c.checked = this.permissions.node.delete;
                                }}
                                name="node-delete"
                            ></sl-checkbox>
                        </td>
                        <td>
                            <sl-checkbox
                                ?checked=${this.permissions.node.change}
                                @sl-input=${(e: SlChangeEvent) => {
                                    const c = e.target as SlCheckbox;
                                    this.permissions = {
                                        ...this.permissions,
                                        node: { ...this.permissions.node, change: (e.target as SlCheckbox).checked },
                                    };
                                    c.checked = this.permissions.node.change;
                                }}
                                name="node-change"
                            ></sl-checkbox>
                        </td>
                    </tr>
                    <tr>
                        <td>${msg("Edge")}</td>
                        <td>
                            <sl-checkbox
                                ?checked=${this.permissions.edge.add}
                                @sl-input=${(e: SlChangeEvent) => {
                                    const c = e.target as SlCheckbox;
                                    this.permissions = {
                                        ...this.permissions,
                                        edge: { ...this.permissions.edge, add: (e.target as SlCheckbox).checked },
                                    };
                                    c.checked = this.permissions.edge.add;
                                }}
                                name="edge-add"
                            ></sl-checkbox>
                        </td>
                        <td>
                            <sl-checkbox
                                ?checked=${this.permissions.edge.delete}
                                @sl-input=${(e: SlChangeEvent) => {
                                    const c = e.target as SlCheckbox;
                                    this.permissions = {
                                        ...this.permissions,
                                        edge: { ...this.permissions.edge, delete: (e.target as SlCheckbox).checked },
                                    };
                                    c.checked = this.permissions.edge.delete;
                                }}
                                name="edge-delete"
                            ></sl-checkbox>
                        </td>
                        <td>
                            <sl-checkbox
                                ?checked=${this.permissions.edge.change}
                                @sl-input=${(e: SlChangeEvent) => {
                                    const c = e.target as SlCheckbox;
                                    this.permissions = {
                                        ...this.permissions,
                                        edge: { ...this.permissions.edge, change: (e.target as SlCheckbox).checked },
                                    };
                                    c.checked = this.permissions.edge.change;
                                }}
                                name="edge-change"
                            ></sl-checkbox>
                        </td>
                    </tr>
                    <tr>
                        <td>${msg("Stack")}</td>
                        <td>
                            <sl-checkbox
                                ?checked=${this.permissions.stack.add}
                                @sl-input=${(e: SlChangeEvent) => {
                                    const c = e.target as SlCheckbox;
                                    this.permissions = {
                                        ...this.permissions,
                                        stack: { ...this.permissions.stack, add: (e.target as SlCheckbox).checked },
                                    };
                                    c.checked = this.permissions.stack.add;
                                }}
                                name="stack-add"
                            ></sl-checkbox>
                        </td>
                        <td>
                            <sl-checkbox
                                ?checked=${this.permissions.stack.delete}
                                @sl-input=${(e: SlChangeEvent) => {
                                    const c = e.target as SlCheckbox;
                                    this.permissions = {
                                        ...this.permissions,
                                        stack: { ...this.permissions.stack, delete: (e.target as SlCheckbox).checked },
                                    };
                                    c.checked = this.permissions.stack.delete;
                                }}
                                name="stack-delete"
                            ></sl-checkbox>
                        </td>
                        <td>
                            <sl-checkbox
                                ?checked=${this.permissions.stack.change}
                                @sl-input=${(e: SlChangeEvent) => {
                                    const c = e.target as SlCheckbox;
                                    this.permissions = {
                                        ...this.permissions,
                                        stack: { ...this.permissions.stack, change: (e.target as SlCheckbox).checked },
                                    };
                                    c.checked = this.permissions.stack.change;
                                }}
                                name="stack-change"
                            ></sl-checkbox>
                        </td>
                    </tr>
                </table>
                <sl-select
                    label=${msg("Automaton Types")}
                    .value=${this.parentComponent.allowedTypes}
                    value=${this.parentComponent.allowedTypes.join(' ')}
                    multiple
                    @sl-change=${(e: SlChangeEvent) => {
                        this.parentComponent.allowedTypes = (e.target as SlSelect).value as string[];
                        this.parentComponent.requestUpdate();
                    }}
                    name="automatonTypes"
                >
                    <sl-option value="nfa">${msg("NFA")}</sl-option>
                    <sl-option value="dfa">${msg("DFA")}</sl-option>
                    <sl-option value="pda">${msg("PDA")}</sl-option>
                </sl-select>
                <sl-select
                    label=${msg("Transformations")}
                    .value=${this.parentComponent.allowedTransformations}
                    multiple
                    @sl-change=${(e: SlChangeEvent) => {
                        this.parentComponent.allowedTransformations = (e.target as SlSelect).value as string[];
                        this.parentComponent.requestUpdate();
                    }}
                    name="transformations"
                >
                    <sl-option value="sink">${msg("Sinkstate")}</sl-option>
                </sl-select>
            </sl-details>
            <sl-details summary=${msg("View")}>
                <sl-select
                    label=${msg("Allowed modes")}
                    .value=${this.parentComponent.allowedModes}
                    multiple
                    @sl-change=${(e: SlChangeEvent) => {
                        this.parentComponent.allowedModes = (e.target as SlSelect).value as string[];
                        this.parentComponent.requestUpdate();
                    }}
                    name="modes"
                >
                    <sl-option value="edit">${msg("Edit")}</sl-option>
                    <sl-option value="simulate">${msg("Simulate")}</sl-option>
                </sl-select>
                <sl-switch
                    value=${this.parentComponent.showHelp == 'true' ? true : false}
                    ?checked=${this.parentComponent.showHelp == 'true' ? true : false}
                    @sl-change=${(e: SlChangeEvent) => {
                        this.parentComponent.showHelp = (e.target as SlCheckbox).checked ? 'true' : 'false';
                        this.parentComponent.automaton.showErrors = (e.target as SlCheckbox).checked;
                        this.parentComponent.requestUpdate();
                    }}
                    name="showHelp"
                    >${msg("Show Help")}</sl-switch
                >
                <sl-switch
                    value=${this.parentComponent.showFormalDefinition == 'true' ? true : false}
                    ?checked=${this.parentComponent.showFormalDefinition == 'true' ? true : false}
                    @sl-change=${(e: SlChangeEvent) => {
                        this.parentComponent.showFormalDefinition = (e.target as SlCheckbox).checked ? 'true' : 'false';
                        this.parentComponent.requestUpdate();
                    }}
                    name="showFormalDefinition"
                    >${msg("Show Formal Definition")}</sl-switch
                >
                <sl-switch
                    value=${this.parentComponent.showTransitionsTable == 'true' ? true : false}
                    ?checked=${this.parentComponent.showTransitionsTable == 'true' ? true : false}
                    @sl-change=${(e: SlChangeEvent) => {
                        this.parentComponent.showTransitionsTable = (e.target as SlCheckbox).checked ? 'true' : 'false';
                        this.parentComponent.requestUpdate();
                    }}
                    name="showTransitionsTable"
                    >${msg("Show Transitions Table")}</sl-switch
                >

                <sl-select value="XaX" label=${msg("PDA Label Style")} name="pdalabelstyle">
                    <sl-option value="XaX">a, X|aX</sl-option>
                    <!-- <sl-option>a -> aa|a</sl-option> -->
                </sl-select>
            </sl-details>
            <sl-details summary=${msg("Automation")}>
                <sl-input
                    label=${msg("Test Language")}
                    value=${this.parentComponent.testLanguage}
                    @sl-input=${(e: SlChangeEvent) => {
                        this.parentComponent.testLanguage = (e.target as SlInput).value;
                        this.parentComponent.requestUpdate();
                    }}
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                ></sl-input>
                <sl-input
                    label=${msg("Test Words")}
                    value=${this.parentComponent.testWords.join(',')}
                    @sl-input=${(e: SlChangeEvent) => {
                        if ((e.target as SlInput).value === '') {
                            this.parentComponent.testWords = [];
                            this.parentComponent.requestUpdate();
                            return;
                        }
                        this.parentComponent.testWords = (e.target as SlInput).value.split(',');
                        this.parentComponent.requestUpdate();
                    }}
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                ></sl-input>
                <sl-input
                    label=${msg("Predefined Alphabet")}
                    value=${this.parentComponent.forcedAlphabet.join(',')}
                    @sl-input=${(e: SlChangeEvent) => {
                        if ((e.target as SlInput).value === '') {
                            this.parentComponent.forcedAlphabet = [];
                            this.parentComponent.requestUpdate();
                            return;
                        }
                        this.parentComponent.forcedAlphabet = (e.target as SlInput).value.split(',').filter((x) => x.length === 1);
                        // remove duplicates
                        this.parentComponent.forcedAlphabet = [...new Set(this.parentComponent.forcedAlphabet)];

                        this.parentComponent.requestUpdate();
                    }}
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                ></sl-input>
            </sl-details>
            <sl-details summary=${msg("Advanced")}>
                <sl-checkbox
                    ?checked=${Logger.verbose}
                    @sl-change=${(e: SlChangeEvent) => {
                        this.parentComponent.verbose = (e.target as SlCheckbox).checked;
                        this.parentComponent.requestUpdate();
                    }}
                    name="verbose"
                >${msg("Verbose")}</sl-checkbox>
            </sl-details>`;
    }

    permissionsToNumberString() {
        const nodeString =
            (this.permissions.node.add ? '1' : '0') +
            (this.permissions.node.delete ? '1' : '0') +
            (this.permissions.node.change ? '1' : '0');

        const edgeString =
            (this.permissions.edge.add ? '1' : '0') +
            (this.permissions.edge.delete ? '1' : '0') +
            (this.permissions.edge.change ? '1' : '0');

        const stackString =
            (this.permissions.stack.add ? '1' : '0') +
            (this.permissions.stack.delete ? '1' : '0') +
            (this.permissions.stack.change ? '1' : '0');

        return (
            parseInt(nodeString, 2).toString() +
            parseInt(edgeString, 2).toString() +
            parseInt(stackString, 2).toString()
        );
    }

    numberStringToPermissions(num: string) {
        const nodeString = parseInt(num[0], 10).toString(2).padStart(3, '0');
        const edgeString = parseInt(num[1], 10).toString(2).padStart(3, '0');
        const stackString = parseInt(num[2], 10).toString(2).padStart(3, '0');

        this.permissions = {
            node: {
                add: nodeString[0] === '1',
                delete: nodeString[1] === '1',
                change: nodeString[2] === '1',
            },
            edge: {
                add: edgeString[0] === '1',
                delete: edgeString[1] === '1',
                change: edgeString[2] === '1',
            },
            stack: {
                add: stackString[0] === '1',
                delete: stackString[1] === '1',
                change: stackString[2] === '1',
            },
        };
    }
}
