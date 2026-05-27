import { TemplateResult, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

import '@shoelace-style/shoelace/dist/themes/light.css';
import SlButton from '@shoelace-style/shoelace/dist/components/button/button.component.js';
import SlBadge from '@shoelace-style/shoelace/dist/components/badge/badge.component.js';
import SlTooltip from '@shoelace-style/shoelace/dist/components/tooltip/tooltip.component.js';
import SlInput from '@shoelace-style/shoelace/dist/components/input/input.component.js';
import SlButtonGroup from '@shoelace-style/shoelace/dist/components/button-group/button-group.component.js';

import {
    biSkipStart,
    biPlay,
    biSkipEnd,
    biAlphabet,
    biSkipForward,
    biArrowCounterclockwise,
    biPause,
    biStop,
    biArrowRight,
    biHandIndexThumb,
} from '../styles/icons';
import { Automaton, SimulationFeedback, SimulationResult, SimulationStatus } from '../automata';
import { classMap } from 'lit/directives/class-map.js';
import { SlChangeEvent } from '@shoelace-style/shoelace';
import { styleMap } from 'lit/directives/style-map.js';
import { simulationMenuStyles } from '../styles/simulationMenu';
import { LitElementWw } from '@webwriter/lit';
import { Graph } from '../graph';
import { ManualAutoSimulator } from 'automata/manual-auto';
import { localized, msg } from '@lit/localize';
import { Logger } from '@u/logger';

@customElement('webwriter-automaton-simulatormenu')
@localized()
export class SimulatorMenu extends LitElementWw {
    @state()
    private accessor _automaton!: Automaton;
    public set automaton(automaton: Automaton) {
        this._automaton = automaton;
    }

    @property({ type: Object, attribute: false })
    public accessor graph!: Graph;

    @state()
    private accessor _result!: {
        status: SimulationStatus;
        wordPosition: number;
        step: number;
    } | null;
    private set result(result: { status: SimulationStatus; wordPosition: number; step?: number }) {
        this._result = {
            status: result.status,
            wordPosition: result.wordPosition,
            step: result.step || result.wordPosition,
        };
    }

    @state()
    private accessor _simulationResult: SimulationResult | null = null;

    @property({ type: String, attribute: false })
    private accessor _mode: 'idle' | 'step' | 'run' | 'animate' = 'idle';

    @state()
    private accessor _animationRunning: boolean = false;

    public static get styles() {
        return simulationMenuStyles;
    }

    @query('#simulator_back') private accessor _backButton!: SlButton;
    @query('#simulator_next') private accessor _nextButton!: SlButton;

    @query('#simulator_toggle') private accessor _toggleButton!: SlButton;
    @query('#simulator_stop') private accessor _stopButton!: SlButton;

    @query('#wordInput') private accessor _wordInput!: SlInput;

    public static get scopedElements() {
        return {
            'sl-button': SlButton,
            'sl-tooltip': SlTooltip,
            'sl-badge': SlBadge,
            'sl-input': SlInput,
            'sl-button-group': SlButtonGroup,
        };
    }

    render() {
        return html`<div class=${classMap({
            simulator: true,
            'simulator--pda': this._automaton.type === 'pda',
        })}>${this.renderLabel()} ${this.renderInput()} ${this.renderButtonGroup()}</div>`;
    }

    private renderLabel() {
        if (!this._simulationResult) {
            return html`<div
                class="simulator__label">
            </div>`;
        }
        else if (this._simulationResult.errors && this._simulationResult.errors.length > 0) {
            return html`<div
                class="simulator__label">
                    <span>
                        ${msg(html`Please fix the following <sl-badge variant="danger">errors</sl-badge> to run the simulation:`)}
                        <br/>
                        <div class="simulator__label__errors">${ this._simulationResult.errors.map(e => {
                            if (e.node) {
                                return html`${e.node?.label}: ${e.message}<br/>`;
                            }
                            return html`${e.message}<br/>`;
                        }) }</div>
                    </span>
            </div>`;
        }
        else if (this._result?.status === SimulationStatus.NO_PATH || !this._simulationResult.path || this._simulationResult.path.nodes.length === 0) {
            return html`<div
                class="simulator__label">
                    <span>
                        ${msg(html`No valid path found. The automaton <sl-badge variant="danger">rejects</sl-badge> the word <b>${this._automaton.simulator.word}</b>.`)}
                    </span>
            </div>`;
        }
        else {
            let pathHtml: TemplateResult<1>[] = [];

            const pathLengthShown = (this._result?.step || 0) + 1;
            for (let i = 0; i < pathLengthShown; i++) {
                const nodeLabel = this._simulationResult?.path.nodes[i].label || '';
                pathHtml.push(html`<sl-button
                    @click=${() => {
                        this.goToStep(i);
                    }}
                    class="simulator__label__path__node"
                    ?circle=${nodeLabel.length <= 3}
                    ?pill=${nodeLabel.length > 3}
                    size="medium"
                    >${nodeLabel}</sl-button>`);
                
                if (i < pathLengthShown - 1) {
                    pathHtml.push(html`
                    <div class="simulator__label__path__transition">
                        <span>${this._simulationResult?.path.transitions[i].symbol || 'ε'}</span>
                        ${biArrowRight}
                    </div>`);
                }
            }

            return html`<div
                    class="simulator__label">
                        ${!!this._result?.status && this._result.status === SimulationStatus.ACCEPTED
                            ? msg(html`<span>The automaton <sl-badge variant="success">accepts</sl-badge> the word <b>${this._automaton.simulator.word || "ε"}</b>.</span>`)
                            : !!this._result?.status && this._result.status === SimulationStatus.REJECTED
                            ? msg(html`<span>The automaton <sl-badge variant="danger">rejects</sl-badge> the word <b>${this._automaton.simulator.word || "ε"}</b>.</span>`)
                            : !!this._result?.status && this._result.status === SimulationStatus.NO_MOVES
                            ? html`<span>${msg("No further moves possible. Try a different path.")}</span>`
                            : !!this._result?.status && this._result.status === SimulationStatus.PAUSED
                            ? html`<span>${msg("Simulation paused.")}</span>`
                            : ""}
                        
                        <div class="simulator__label__path">
                            ${pathHtml}
                        </div>
                </div>`;
        }
    }

    private renderInput() {
        return html` <sl-input
                class='simulator__input'
                style=${styleMap({
                    display: this._mode === 'idle' ? 'block' : 'none',
                })}
                @sl-input=${(e: SlChangeEvent) => {
                    this._automaton.simulator.word = (e.target as SlInput).value;
                    this.reset();
                    this.requestUpdate();
                }}
                value=${this._automaton.simulator.word}
                id="wordInput"
                placeholder=${msg("Input Word e.g. aaabbb, step;step;stop")}
                clearable
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
            >
                <span slot="prefix" class="simulator__input__prefix">${biAlphabet}</span>
            </sl-input>
            <div
                class='simulator__input-display'
                style=${styleMap({
                    display: this._mode !== 'idle' ? 'flex' : 'none',
                })}
                @click=${() => {
                    this.reset();
                    this._wordInput.focus();
                }}
            >
                <span slot="prefix" class="simulator__input-display__prefix">${biAlphabet}</span>
                <div class="simulator__input-display__input">
                    ${this._automaton.simulator.wordArray.map((e, i) => {
                        return i === this._result?.wordPosition ? html`|${e}` : e;
                    })}${this._result?.wordPosition === this._automaton.simulator.wordArray.length ? '|' : ''}
                </div>
            </div>`;
    }

    private renderButtonGroup() {
        return html`<sl-button-group
                class="simulator_buttons"
                style=${styleMap({
                    display: this._mode === 'idle' ? 'initial' : 'none',
                })}
            >
                ${this._automaton.type === 'pda' || this._automaton.type === 'nfa' ? html`
                <sl-tooltip content=${msg("Manual")} placement="top">
                    <sl-button
                        @click=${() => {
                            this.startStepByStep(true);
                        }}
                        >${biHandIndexThumb}</sl-button
                    >
                </sl-tooltip>
                ` : ''}
                <sl-tooltip content=${msg("Animate")} placement="top">
                    <sl-button
                        @click=${() => {
                            this.startAnimation();
                        }}
                        >${biPlay}</sl-button
                    >
                </sl-tooltip>
                <sl-tooltip content=${msg("Step by Step")} placement="top">
                    <sl-button
                        @click=${() => {
                            this.startStepByStep();
                        }}
                        >${biSkipEnd}</sl-button
                    >
                </sl-tooltip>
                <sl-tooltip content=${msg("Check")} placement="top">
                    <sl-button
                        @click=${() => {
                            this.run();
                        }}
                        >${biSkipForward}</sl-button
                    >
                </sl-tooltip> </sl-button-group
            ><sl-button-group
                class="simulator_buttons"
                style=${styleMap({
                    display: this._mode === 'step' ? 'flex' : 'none',
                })}
            >
                <sl-tooltip content=${msg("Back")} placement="top">
                    <sl-button
                        id="simulator_back"
                        @click=${() => {
                            this.stepBackward();
                        }}
                        disabled
                        >${biSkipStart}</sl-button
                    >
                </sl-tooltip>
                <sl-tooltip content=${msg("Next")} placement="top">
                    <sl-button
                        id="simulator_next"
                        @click=${() => {
                            this.stepForward();
                        }}
                        >${biSkipEnd}</sl-button
                    >
                </sl-tooltip>
                <sl-tooltip content=${msg("Reset")} placement="top">
                    <sl-button
                        @click=${() => {
                            this.reset();
                        }}
                        >${biArrowCounterclockwise}</sl-button
                    >
                </sl-tooltip> </sl-button-group
            ><sl-button-group
                class="simulator_buttons"
                style=${styleMap({
                    display: this._mode === 'run' ? 'flex' : 'none',
                })}
            >
                <sl-tooltip content=${msg("Reset")} placement="top">
                    <sl-button
                        @click=${() => {
                            this.reset();
                        }}
                        >${biArrowCounterclockwise}</sl-button
                    >
                </sl-tooltip>
            </sl-button-group>
            <sl-button-group
                class="simulator_buttons"
                style=${styleMap({ display: this._mode === 'animate' ? 'flex' : 'none' })}
            >
                <sl-tooltip content=${this._animationRunning ? msg('Pause') : msg('Play')} placement="top">
                    <sl-button
                        @click=${() => {
                            this.toggleAnimation();
                        }}
                        id="simulator_toggle"
                        >${this._animationRunning ? biPause : biPlay}</sl-button
                    >
                </sl-tooltip>
                <sl-tooltip content=${msg("Stop")} placement="top">
                    <sl-button
                        @click=${() => {
                            this.stopAnimation();
                        }}
                        id="simulator_stop"
                        >${biStop}</sl-button
                    >
                </sl-tooltip>
                <sl-tooltip content=${msg("Reset")} placement="top">
                    <sl-button
                        @click=${() => {
                            this.reset();
                        }}
                        >${biArrowCounterclockwise}</sl-button
                    >
                </sl-tooltip>
            </sl-button-group> `;
    }

    private run() {
        this.reset();
        this._mode = 'run';

        Logger.time('simulation');
        const result = this._automaton.simulator.simulate();
        Logger.timeEnd('simulation');

        this.result = {
            status: result.status,
            wordPosition: this._automaton.simulator.word.length,
            step: (result.simulationResult?.path?.nodes.length || 1) - 1,
        };

        this._simulationResult = result.simulationResult || null;

        Logger.log('Simulation Result:', this._simulationResult);

        this.requestUpdate();
    }

    private startAnimation() {
        this.reset();
        this._mode = 'animate';

        if (!!this._automaton.getInitialNode())
            this._automaton.highlightNode(this._automaton.getInitialNode());

        this._automaton.simulator.startAnimation((result: SimulationFeedback) => {
            Logger.log('Animation Result:', result);

            this.result = result;
            this._simulationResult = result.simulationResult || null;

            if (result.status !== SimulationStatus.RUNNING) {
                this._toggleButton.disabled = true;
                this._stopButton.disabled = true;
            }

            this.requestUpdate();
        });

        this._animationRunning = true;
        this.requestUpdate();
    }

    private stopAnimation() {
        this._automaton.simulator.stopAnimation((result) => {
            this.result = result;
            this._simulationResult = result.simulationResult || null;

            this._toggleButton.disabled = true;
            this._stopButton.disabled = true;

            this.requestUpdate();
        });
        this._animationRunning = false;
        this.requestUpdate();
    }

    private toggleAnimation() {
        if (this._animationRunning) {
            this._automaton.simulator.pauseAnimation((result) => {
                this.result = result;
                this._simulationResult = result.simulationResult || null;
                this.requestUpdate();
            });
            this._animationRunning = false;
        } else {
            this._automaton.simulator.startAnimation((result) => {
                this.result = result;
                this._simulationResult = result.simulationResult || null;

                if (result.status !== SimulationStatus.RUNNING) {
                    this._toggleButton.disabled = true;
                    this._stopButton.disabled = true;
                }

                this.requestUpdate();
            });
            this._animationRunning = true;
        }
        this.requestUpdate();
    }

    public reset() {
        this._automaton.simulator.reset();
        this._result = {
            status: SimulationStatus.IDLE,
            wordPosition: 0,
            step: 0,
        };
        this._simulationResult = null;
        this._mode = 'idle';
        this._nextButton.disabled = false;
        this._backButton.disabled = true;

        this._toggleButton.disabled = false;
        this._stopButton.disabled = false;

        this.requestUpdate();
    }

    public init() {
        this._automaton.simulator.init();
    }

    private startStepByStep(manual = false) {
        this.reset();
        this._mode = 'step';

        if (manual && (this._automaton.type === 'nfa' || this._automaton.type === 'pda')) {
            (this._automaton.simulator as ManualAutoSimulator).setManualMode(true);
        }

        this._automaton.simulator.initStepByStep(this.graph, (res: any) => {
            Logger.log(res);
            this.result = res;
            this._simulationResult = res.simulationResult || null;

            this._backButton.disabled = res.step <= 0;

            if (
                res.status === SimulationStatus.NO_PATH
                || res.status === SimulationStatus.ACCEPTED
                || res.status === SimulationStatus.REJECTED
                || res.status === SimulationStatus.ERROR
            ) {
                this._nextButton.disabled = true;
            }

            this.requestUpdate();
        });

        if (!!this._automaton.getInitialNode())
            this._automaton.highlightNode(this._automaton.getInitialNode());

        this.requestUpdate();
    }

    private goToStep(step: number) {
        if (this._mode !== 'step') {
            this.startStepByStep();
        }

        const result = this._automaton.simulator.goToStep(step);

        this.result = result;
        if (result.simulationResult) {
            this._simulationResult = result.simulationResult;
        }

        this._nextButton.disabled = result.finalStep || false;
        this._backButton.disabled = result.firstStep || false;

        this.requestUpdate();
    }

    private stepForward() {
        this.goToStep(this._result?.step !== undefined ? this._result.step + 1 : 0);
    }

    private stepBackward() {
        this.goToStep(this._result?.step !== undefined ? this._result.step - 1 : 0);
    }
}
