import { css } from 'lit';

export const simulationMenuStyles = css`
    .simulator {
        gap: 6px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
    }

    .simulator__label {
        grid-column: 1 / -1;
        margin-inline-end: var(--simulator-feedback-end, 0);
        padding: 6px 8px;
        border: 1px solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-medium);
        background: var(--sl-color-neutral-0);

        font-size: var(--sl-font-size-small);

        max-height: min(120px, 25cqh);
        overflow: auto;
        overflow-wrap: anywhere;
    }

    .simulator__label__errors {
        max-height: 100px;
        overflow-y: auto;
    }

    .simulator__label__path {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-top: 5px;
        overflow-x: auto;
    }

    .simulator__label__path__transition {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
    }

    .simulator__label__path__transition span {
        font-size: var(--sl-font-size-small);
        margin: -6px 0;
    }

    .simulator__label__path__transition svg {
        width: 1.2em;
        height: 1.2em;
    }

    .simulator__input {
        min-width: 0;
        --sl-input-font-size-medium: var(--sl-font-size-small);
    }

    @supports (field-sizing: content) {
        .simulator__input {
            justify-self: end;
            inline-size: fit-content;
            min-inline-size: min(100%, 6rem);
            max-inline-size: 100%;
        }

        .simulator__input::part(base) {
            inline-size: auto;
            min-inline-size: 100%;
            max-inline-size: 100%;
        }

        .simulator__input::part(input) {
            field-sizing: content;
        }
    }

    .simulator__input.danger::part(base) {
        border-color: var(--sl-color-danger-600);
        background-color: var(--sl-color-danger-50);
    }

    .simulator__input.success::part(base) {
        border-color: var(--sl-color-success-600);
        background-color: var(--sl-color-success-50);
    }

    .simulator__input.danger:focus-within::part(base) {
        border-color: var(--sl-color-danger-600);
        box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-color-danger-300);
    }

    .simulator__input.success:focus-within::part(base) {
        border-color: var(--sl-color-success-600);
        box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-color-success-300);
    }

    .simulator sl-button::part(base),
    .simulator sl-button::part(label) {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .simulator_buttons sl-button::part(label) {
        padding-inline: 10px;
    }

    .simulator__input-display {
        box-sizing: border-box;
        border: solid var(--sl-input-border-width) var(--sl-input-border-color);

        border-radius: var(--sl-input-border-radius-medium);
        font-size: var(--sl-font-size-small);
        height: var(--sl-input-height-medium);

        display: inline-flex;
        background-color: white;

        align-items: stretch;
        justify-content: start;
        position: relative;
        width: 100%;
        font-family: var(--sl-input-font-family);
        font-weight: var(--sl-input-font-weight);
        letter-spacing: var(--sl-input-letter-spacing);
        vertical-align: middle;
        overflow: visible;
        cursor: text;
        transition: var(--sl-transition-fast) color, var(--sl-transition-fast) border,
            var(--sl-transition-fast) box-shadow, var(--sl-transition-fast) background-color;
    }

    .simulator__input-display__prefix {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;

        margin-inline-start: var(--sl-input-spacing-medium);
    }

    .simulator__input-display__input {
        height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
        padding: 0 var(--sl-input-spacing-medium);

        flex: 1 1 auto;
        font-family: inherit;
        font-size: inherit;
        font-weight: inherit;
        min-width: 0px;
        color: var(--sl-input-color);
        border: none;
        background: transparent;
        box-shadow: none;
        margin: 0px;
        cursor: inherit;
        appearance: none;

        display: inline-flex;
        align-items: center;
        justify-content: start;
        overflow-x: auto;
    }

    .simulator__input-display.danger {
        border-color: var(--sl-color-danger-600);
        background-color: var(--sl-color-danger-50);
    }

    .simulator__input-display.success {
        border-color: var(--sl-color-success-600);
        background-color: var(--sl-color-success-50);
    }
`;
