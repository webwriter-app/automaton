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

    .definition-pane {
        position: absolute;
        inset-block-start: 58px;
        inset-inline-end: 10px;
        z-index: 2600;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        inline-size: min(400px, calc(100% - 20px));
        max-block-size: min(420px, calc(100% - 68px));
        overflow: hidden;
        border: 1px solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-large);
        background: var(--sl-panel-background-color, white);
        color: var(--sl-color-neutral-900);
        box-shadow: var(--sl-shadow-medium);
        font-family: var(--sl-font-sans);
        font-size: var(--sl-font-size-small);
        overflow-wrap: anywhere;
        user-select: text;
    }

    @container automaton (width < 500px) {
        .definition-pane {
            inset: auto 8px 8px;
            inline-size: auto;
            block-size: min(420px, calc(100% - 68px));
        }
    }

    .definition-pane__close {
        position: absolute;
        inset-block-start: 6px;
        inset-inline-end: 6px;
        z-index: 1;
        display: grid;
        place-items: center;
        inline-size: 32px;
        block-size: 32px;
        padding: 0;
        border: 0;
        border-radius: var(--sl-border-radius-medium);
        background: transparent;
        color: var(--sl-color-neutral-700);
        font: inherit;
        font-size: var(--sl-font-size-x-large);
        cursor: pointer;
    }

    .definition-pane__close:hover {
        background: var(--sl-color-neutral-100);
    }

    .definition-pane sl-tab-group {
        --track-width: 0px;
        display: flex;
        flex: 1;
        flex-direction: column;
        min-block-size: 0;
    }

    .definition-pane sl-tab-group::part(base) {
        flex: 1;
        min-block-size: 0;
    }

    .definition-pane sl-tab-group::part(nav) {
        flex: none;
        padding-inline-end: 44px;
        border-block-end: 1px solid var(--sl-panel-border-color);
    }

    .definition-pane sl-tab-group::part(body) {
        min-block-size: 0;
        overscroll-behavior: contain;
    }

    .definition-pane sl-tab[active]::part(base) {
        box-shadow: inset 0 -2px var(--sl-color-primary-600);
    }

    .definition-pane sl-tab-panel {
        --padding: 12px;
    }

    .definition-pane sl-tab-panel:focus-visible {
        outline: 2px solid var(--sl-color-primary-600);
        outline-offset: -2px;
    }

    .definition-pane sl-tab-panel[name="table"] {
        --padding: 0;
    }

    .definition-summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin: 0 0 14px;
    }

    .definition-summary > div {
        padding: 6px 8px;
        border-radius: var(--sl-border-radius-medium);
        background: var(--sl-color-neutral-50);
    }

    .definition-summary dt {
        color: var(--sl-color-neutral-700);
        font-size: var(--sl-font-size-x-small);
        font-weight: var(--sl-font-weight-semibold);
    }

    .definition-summary dd {
        margin: 3px 0 0;
    }

    .definition-transitions-title {
        margin: 0 0 8px;
        font-size: inherit;
        font-weight: var(--sl-font-weight-semibold);
    }

    .definition-transitions {
        border-block-start: 1px solid var(--sl-panel-border-color);
        padding: 5px 0;
    }

    .definition-transitions:last-child {
        padding-block-end: 0;
    }

    .definition-transitions h4 {
        display: inline;
        margin: 0;
        margin-inline-end: 8px;
        font-size: inherit;
    }

    .definition-transitions ul {
        display: inline;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .definition-transitions li {
        display: inline;
    }

    .definition-transitions li > code {
        display: inline-block;
        box-sizing: border-box;
        max-inline-size: 100%;
    }

    .definition-transitions li + li > code {
        border-inline-start: 1px solid var(--sl-panel-border-color);
        padding-inline-start: 6px;
    }

    .definition-stack-operation, .definition-empty {
        color: var(--sl-color-neutral-700);
    }

    .definition-empty {
        margin: 0;
    }

    .definition-table {
        width: 100%;
        border-collapse: collapse;
    }

    .definition-table th, .definition-table td {
        padding: 0.25em 0.5em;
        border: 1px solid var(--sl-panel-border-color);
        text-align: center;
    }

    .definition-table th {
        background: var(--sl-color-neutral-50);
    }
`;
