import { css } from 'lit';

export const topMenuStyles = css`
    .topmenu {
        position: absolute;

        display: flex;
        flex-direction: row-reverse;
        gap: 10px;

        align-items: flex-start;

        right: 10px;
        top: 10px;
    }

    @container automaton (500px <= width < 560px) {
        .topmenu {
            gap: 2px;
        }
    }

    .topmenu sl-button::part(base),
    .topmenu sl-button::part(label) {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .topmenu__choices {
        display: flex;
        gap: 6px;
        padding: 6px;
        border: 1px solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-medium);
        background: white;
    }

    .topmenu__button_group {
        display: flex;
        gap: 10px;
        flex-direction: column;
        position: relative;
        cursor: pointer;
        touch-action: manipulation;
    }

    .topmenu__button {
        position: relative;
        z-index: 1500;
    }

    .topmenu__button sl-button {
        position: absolute;
        top: -15px;
        right: -15px;
    }

    .topmenu--hamburger {
        z-index: 2500;
    }

    .topmenu__collapsed_panel {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        display: flex;
        gap: 6px;
        padding: 8px;
        background-color: white;
        outline: 1px solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-medium);
    }

    .topmenu__collapsed_panel .topmenu__button_group {
        flex-direction: row;
    }

    .topmenu__collapsed_panel sl-tooltip::part(base__popup) {
        z-index: 2000;
    }

    .topmenu__popup {
        max-width: min(400px, var(--auto-size-available-width, 60vw));
        max-height: min(350px, var(--auto-size-available-height, 350px));
        background-color: white;
        outline: 1px solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-medium);
        font-size: 1rem;
        overflow: auto;
        overflow-wrap: anywhere;
    }

    .topmenu__popup label {
        font-weight: var(--sl-font-weight-semibold);
    }

    .topmenu__popup__table {
        width: 100%;
        border-collapse: collapse;
    }

    .topmenu__popup__table th, .topmenu__popup__table td {
        padding: 0.25em 0.5em;
        border: 1px solid var(--sl-panel-border-color);
        text-align: center;
    }
`;
