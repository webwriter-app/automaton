import { css } from 'lit';
import { contextMenuStyles } from './contextMenu';

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

    #graphCanvas {
        height: 100%;
        width: 100%;
        outline: 1px solid lightgray;
        outline-offset: -1px;
    }

    :host(:focus),
    .vis-network:focus {
        outline: none;
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

    .workspace > stack-extension {
        position: absolute;
        inset: 60px 10px 10px auto;
        display: flex;
        align-items: flex-end;
        width: 62px;
        pointer-events: none;
    }

    @container automaton (width >= 800px) {
        .workspace > stack-extension {
            position: static;
            align-items: flex-start;
            flex: 0 0 120px;
            box-sizing: border-box;
            padding: 10px;
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
            max-width: calc(100% - 320px);
        }
    }

    @container automaton (500px <= width < 560px) {
        .mode_switch {
            max-width: calc(100% - 274px);
        }
    }

    .errordisplay {
        position: absolute;
        display: none;
    }

    .mode_switch__error_indicator {
        position: absolute;
        bottom: -5px;
        right: -7px;
        color: var(--sl-color-danger-600);
        z-index: 1000;
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
`;

export const styles = [baseStyles, contextMenuStyles];
