import { css } from 'lit';

export const stackStyles = css`
    .pda__stack {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        width: 100%;
        max-height: 100%;
        border: 1px solid lightgray;
        border-radius: 5px;
        background-color: white;
        pointer-events: auto;
        z-index: 1400;
    }

    .pda__stack-toggle {
        display: none;
        border: 0;
        font: inherit;
        cursor: pointer;
    }

    @container automaton (width < 500px) {
        .pda__stack-title,
        .pda__stack-toggle[aria-expanded='false'] ~ .pda__stack-button,
        .pda__stack-toggle[aria-expanded='false'] ~ .pda__stack-items {
            display: none;
        }

        .pda__stack-toggle {
            display: block;
            min-height: 44px;
        }
    }

    .pda__stack sl-button::part(base),
    .pda__stack sl-button::part(label) {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .pda__stack-button {
        align-self: center;
        margin: 8px;
    }

    .pda__stack-button[hidden] {
        display: none;
    }

    .pda__stack-button.dragover::part(base) {
        background-color: var(--sl-color-danger-50);
        color: var(--sl-color-danger-700);
        border-color: var(--sl-color-danger-300);
    }

    .pda__stack-items {
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
        overflow-y: auto;
        width: 100%;
    }

    .pda__stack-items::-webkit-scrollbar {
        width: 5px;
    }

    .pda__stack-items::-webkit-scrollbar-thumb {
        background-color: var(--sl-color-primary-600);
        border-radius: 5px;
    }

    .pda__stack-items::-webkit-scrollbar-track {
        background-color: var(--sl-color-primary-100);
    }

    .pda__stack-items::-webkit-scrollbar-thumb:hover,
    .pda__stack-items::-webkit-scrollbar-thumb:active {
        background-color: var(--sl-color-primary-700);
    }

    .pda__stack-item {
        width: 100%;
        margin: 0;

        padding: 5px;
        box-sizing: border-box;

        border-top: 1px solid lightgray;
    }

    .pda__stack-item.dragging sl-input::part(base) {
        background-color: var(--sl-color-primary-50);
    }

    .pda__stack-item:hover {
        background-color: var(--sl-color-primary-50);
    }

    .pda__stack-item--empty {
        font-size: var(--sl-font-size-small);
        color: var(--sl-color-neutral-500);
        text-align: center;
    }

    .pda__stack-title,
    .pda__stack-toggle {
        background-color: var(--sl-color-primary-600);
        text-align: center;
        color: white;
        overflow-wrap: anywhere;
        border-top-left-radius: 5px;
        border-top-right-radius: 5px;
    }

    .drop-before {
        border-bottom: 5px solid var(--sl-color-primary-600);
    }

    .drop-after {
        border-top: 5px solid var(--sl-color-primary-600);
    }

    .deleteable sl-input::part(base) {
        background-color: var(--sl-color-danger-50) !important;
        color: var(--sl-color-danger-700) !important;
        border-color: var(--sl-color-danger-300) !important;

        box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-color-danger-300);
    }
`;
