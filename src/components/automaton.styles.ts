import { css } from 'lit';
import { editingBarStyles } from './editing-bar.styles';

const baseStyles = css`
    :host {
        background: white;
        display: block;
        box-sizing: border-box;
        min-width: 300px;
        height: 500px;
        min-height: 300px;
        max-height: 1200px;

        user-select: none;
    }

    :host(:fullscreen) {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        max-height: none;
    }

    .print-machine {
        display: none;
    }

    #graphCanvas {
        height: 100%;
        width: 100%;
        color: black;
        outline: 1px solid lightgray;
        outline-offset: -1px;
        user-select: none;
    }

    #graphCanvas:focus-visible {
        outline: 2px solid var(--sl-color-primary-600);
    }

    :host(:focus) {
        outline: none;
    }

    #graphCanvas.scene--adding {
        cursor: crosshair;
    }

    ww-path {
        stroke: black;
        stroke-width: 1px;
    }

    ww-path:state(hover),
    ww-path[selected] {
        stroke: var(--sl-color-primary-600);
    }

    ww-path.active {
        stroke: #075985;
        stroke-width: 2px;
    }

    ww-path.planned {
        stroke: var(--sl-color-primary-600);
        stroke-dasharray: 4 3;
    }

    ww-text.label {
        fill: #222;
        font: 12px Arial, sans-serif;
        white-space: pre-line;
        background-color: white;
        padding: 0 2px;
    }

    ww-node.state {
        box-sizing: border-box;
        font: 12px Arial, sans-serif;
        color: black;
    }

    .state__ring {
        position: absolute;
        inset: 0;
        box-sizing: border-box;
        border: 1px solid black;
        border-radius: 50%;
        background: white;
    }

    ww-node.state.final .state__ring::after {
        content: "";
        position: absolute;
        inset: 4px;
        border: 1px solid black;
        border-radius: 50%;
    }

    .state__label {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        white-space: nowrap;
        pointer-events: none;
    }

    ww-node.state:hover .state__ring,
    ww-node.state.active .state__ring {
        background: #e0f2fe;
        border-color: #075985;
    }

    ww-node.state[selected] .state__ring {
        background: #e0f2fe;
        border-color: #0284c7;
        border-width: 2px;
    }

    ww-node.state.error .state__ring {
        background: #fef3c7;
        border-color: #b45309;
    }

    ww-node.state.error .state__ring::before {
        content: "";
        position: absolute;
        right: 3px;
        bottom: 3px;
        width: 10px;
        height: 10px;
        background: red;
        clip-path: polygon(100% 0, 100% 100%, 0 100%);
    }

    ww-node.state--preview {
        opacity: 0.75;
        pointer-events: none;
    }

    ww-node.state--preview .state__ring {
        background: #e0f2fe;
        border-color: #075985;
    }

    .state__target {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 2px;
        height: 2px;
        pointer-events: none;
    }

    .state__port {
        position: absolute;
        width: 24px;
        height: 24px;
        translate: -50% -50%;
        touch-action: none;
        cursor: crosshair;
        z-index: 1;
    }

    .state__port::after {
        content: "";
        position: absolute;
        inset: 7px;
        border: 1px solid var(--sl-color-primary-600);
        border-radius: 50%;
        background: var(--sl-color-neutral-0);
    }

    .state__port:is(:hover, :focus-visible, [data-ww-port-over])::after {
        background: var(--sl-color-primary-600);
    }

    .state__port--top { left: 50%; top: -4px; }
    .state__port--bottom { left: 50%; top: calc(100% + 4px); }
    .state__port--left { left: -4px; top: 50%; }
    .state__port--right { left: calc(100% + 4px); top: 50%; }

    .view-controls {
        position: absolute;
        left: 10px;
        top: 50%;
        translate: 0 -50%;
        z-index: 1000;
        display: flex;
        flex-direction: column;
    }

    .hidden {
        display: none;
    }

    .show {
        display: block;
    }

    .editor {
        container: automaton / size;
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .editor--compact {
        overflow: hidden;
    }

    .workspace {
        --stack-width: 62px;
        position: relative;
        display: flex;
        flex: 1;
        min-height: 0;
    }

    .graph {
        position: relative;
        flex: 1;
        min-width: 0;
    }

    .empty-canvas-hint {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 16px;
        text-align: center;
        font-family: var(--sl-font-sans, sans-serif);
        color: var(--sl-color-neutral-500);
        pointer-events: none;
    }

    .node-drop-preview + .empty-canvas-hint {
        visibility: hidden;
    }

    #simulatorMenu {
        position: absolute;
        inset: auto 10px calc(10px + (var(--sl-input-height-large) - var(--sl-input-height-medium)) / 2);
        z-index: 1500;
    }

    .workspace > stack-extension {
        position: absolute;
        inset: 60px 10px 10px auto;
        display: flex;
        align-items: flex-end;
        width: var(--stack-width);
        pointer-events: none;
    }

    .workspace[data-mode="simulate"] > stack-extension {
        bottom: calc(20px + var(--sl-input-height-large));
    }

    .workspace:has(.editing-bar) > stack-extension {
        bottom: 66px;
    }

    .workspace:has(> stack-extension) #simulatorMenu {
        --simulator-feedback-end: calc(var(--stack-width) + 6px);
    }

    .workspace[data-mode="edit"]:has(> stack-extension:is([change], [delete])) {
        --stack-width: 120px;
    }

    @container automaton (width >= 800px) {
        .workspace {
            --stack-width: 100px;
        }
    }

    .mode_switch {
        position: absolute;
        top: 10px;
        left: 10px;
        max-width: calc(100% - 70px);

        z-index: 1500;
    }

    @container automaton (width >= 500px) {
        .mode_switch {
            max-width: calc(100% - 270px);
        }
    }

    @container automaton (500px <= width < 560px) {
        .mode_switch {
            max-width: calc(100% - 232px);
        }
    }

    .mode_switch__error_indicator {
        position: absolute;
        bottom: -8px;
        right: -6px;
        display: grid;
        place-items: center;
        padding: 4px;
        border: 0;
        background: transparent;
        color: var(--sl-color-warning-600);
        cursor: help;
    }

    .mode_switch__error_indicator span {
        display: flex;
    }

    .mode_switch__buttons {
        display: flex;
        user-select: none;
    }

    .mode_switch__buttons button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 0;
        min-height: var(--sl-input-height-medium);
        padding: 4px 10px;
        border: 1px solid var(--sl-input-border-color);
        background: var(--sl-color-neutral-0);
        color: var(--sl-color-neutral-700);
        font: 500 var(--sl-font-size-small) / 1.05 var(--sl-font-sans);
        cursor: pointer;
    }

    .mode_switch__buttons button:first-child {
        border-radius: var(--sl-border-radius-medium) 0 0 var(--sl-border-radius-medium);
    }

    .mode_switch__buttons button + button {
        border-left: 0;
        border-radius: 0 var(--sl-border-radius-medium) var(--sl-border-radius-medium) 0;
    }

    .mode_switch__buttons button[aria-pressed="true"] {
        background: var(--sl-color-primary-600);
        color: var(--sl-color-neutral-0);
    }

    .mode_switch__buttons button:focus-visible {
        outline: var(--sl-focus-ring);
        outline-offset: -2px;
    }

    .mode_switch__buttons button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .mode_switch__buttons [aria-hidden] {
        display: flex;
    }

    .mode_switch__label {
        overflow-wrap: anywhere;
    }

    .help-backdrop {
        background-color: rgba(0, 0, 0, 0.1);
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        z-index: 1900;
    }

    .help-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        z-index: 2000;
    }

    .help-overlay > * {
        position: absolute;
    }

    .help-overlay .line {
        border-bottom: 2px solid white;
        border-right: 2px solid white;
    }

    .help-overlay__fullscreen {
        top: 228px;
        right: 10px;
    }

    .edit-help__transition {
        bottom: 128px;
        left: 80px;
    }

    .edit-help__sink {
        bottom: calc(16px + var(--sl-input-height-large) + (var(--sl-input-height-small) - 22px) / 2);
        left: 70px;
    }

    @container automaton (width >= 500px) {
        .workspace:has(> stack-extension) .help-overlay__fullscreen {
            top: 54px;
            right: calc(var(--stack-width) + 18px);
        }

        .workspace:has(> stack-extension) .edit-help {
            width: calc(100% - var(--stack-width));
        }
    }

    @container automaton (500px <= width < 800px) {
        .workspace:has(> stack-extension) .edit-help__transition {
            bottom: 151px;
        }
    }

    .simulator-help {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        box-sizing: border-box;
        padding: 10px;
    }

    .simulator-help > * {
        position: static;
    }

    .compact-help {
        position: absolute;
        inset: 112px 10px 10px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        overflow: auto;
        overflow-wrap: anywhere;
        font-family: var(--sl-font-sans, sans-serif);
        font-size: var(--sl-font-size-small, 0.875rem);
        z-index: 2000;
    }

    .compact-help > span {
        background: var(--sl-color-neutral-0, white);
        border-radius: 4px;
        padding: 4px 8px;
    }

    @media print {
        :host {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            min-width: 0 !important;
            max-width: 100% !important;
            break-inside: avoid;
        }

        .editor {
            display: none;
        }

        .print-machine {
            display: block;
            margin: 0;
            break-inside: avoid;
            color: #222;
            font: 10pt/1.4 var(--sl-font-sans, sans-serif);
        }

        .print-machine figcaption {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: 0.25em 1em;
            padding-block: 0.25em;
            border-block-end: 1px solid #aaa;
            overflow-wrap: anywhere;
        }

        .print-machine svg {
            display: block;
            max-width: 100%;
            height: auto;
            margin: 0.5em auto 0;
        }
    }
`;

export const styles = [baseStyles, editingBarStyles];
