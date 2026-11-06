import { css } from 'lit';
import { contextMenuStyles } from './contextMenu';
import { stackStyles } from './stack';

const baseStyles = css`
    :host {
        background: white;
        display: block;
        height: 500px;

        user-select: none;
    }

    #graphCanvas {
        height: 100%;
        width: 100%;
        outline: 1px solid lightgray;
    }

    .hidden {
        display: none;
    }

    .show {
        display: block;
    }

    .editor {
        position: relative;
        height: 100%;
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
`;

export const styles = [baseStyles, contextMenuStyles, stackStyles];
