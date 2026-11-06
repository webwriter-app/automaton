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

    .hidden {
        display: none;
    }

    .show {
        display: block;
    }

    .editor {
        container: automaton / size;
        display: flex;
        flex-direction: column;
        height: 100%;
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
        line-height: 16px;

        z-index: 1500;
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

    .mode_switch__select {
        width: 150px;
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
`;

export const styles = [baseStyles, contextMenuStyles];
