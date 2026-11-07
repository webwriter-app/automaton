import { css } from 'lit';

export const editingBarStyles = css`
    .workspace-footer {
        position: absolute;
        inset: auto 10px 10px auto;
        z-index: 1500;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: flex-end;
        gap: 8px;
        width: max-content;
        max-width: calc(100% - 76px);
        pointer-events: none;
    }

    .warning-panel {
        width: max-content;
        max-width: min(16rem, 100%);
        font-family: var(--sl-font-sans, sans-serif);
    }

    .warning-panel--all {
        display: none;
        pointer-events: auto;
    }

    .workspace:has(.mode_switch__error_indicator:is(:hover, :focus)) .warning-panel--all {
        display: block;
    }

    .workspace:has(.mode_switch__error_indicator:is(:hover, :focus)) .warning-panel--node {
        display: none;
    }

    .warning-panel::part(message) {
        padding: 8px 12px;
    }

    .warning-panel ul {
        margin: 0;
        padding-inline-start: 1em;
        max-height: 110px;
        overflow: auto;
        overflow-wrap: anywhere;
    }

    .editing-bar {
        pointer-events: auto;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        max-width: 100%;
        height: var(--sl-input-height-large);
        padding: 4px 6px;
        border: 1px solid var(--sl-panel-border-color);
        border-radius: var(--sl-border-radius-medium);
        background: var(--sl-panel-background-color);
        color: var(--sl-color-neutral-700);
        font-family: var(--sl-font-sans, sans-serif);
        font-size: var(--sl-font-size-small);
    }

    .editing-bar > :is(sl-input, sl-select) {
        flex: 0 1 5.5rem;
        min-width: 40px;
    }

    .editing-bar :is(sl-input, sl-select)::part(form-control-label) {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
    }

    .editing-bar__delete {
        --sl-input-height-small: 26px;
        flex: none;
    }

    .editing-bar__delete svg {
        width: 14px;
        height: 14px;
    }

    .editing-bar sl-button::part(label) {
        display: grid;
        place-items: center;
    }

    .editing-bar__checks {
        display: flex;
        flex: 0 1 auto;
        flex-direction: column;
        gap: 1px;
        height: var(--sl-input-height-small);
        min-width: 0;
    }

    .editing-bar__checks sl-checkbox {
        display: flex;
        flex: 1;
        align-items: center;
        --sl-spacing-x-small: 4px;
        --sl-toggle-size-small: 12px;
        --sl-input-font-size-small: 11px;
        min-width: 0;
        min-height: 0;
    }

    .editing-bar__checks sl-checkbox::part(base) {
        align-items: center;
        line-height: 1;
    }

    .editing-bar__checks sl-checkbox::part(label) {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .editing-bar__edge-fields {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        overflow-x: auto;
        max-height: 100%;
        scrollbar-width: thin;
        padding: 3px;
    }

    .editing-bar__edge-fields > * {
        flex: none;
    }

    .editing-bar__symbol,
    .editing-bar__stack-actions,
    .editing-bar__range {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .editing-bar__symbol + .editing-bar__symbol {
        padding-inline-start: 6px;
        border-inline-start: 1px solid var(--sl-panel-border-color);
    }

    .editing-bar__symbol :is(sl-input, sl-select) {
        width: 50px;
    }

    @supports (field-sizing: content) {
        .editing-bar sl-input::part(base) {
            inline-size: auto;
            min-inline-size: 100%;
            max-inline-size: 100%;
        }

        .editing-bar sl-input::part(input) {
            field-sizing: content;
        }

        .editing-bar > sl-input {
            flex-basis: auto;
            min-inline-size: 3.5rem;
            max-inline-size: 12rem;
        }

        .editing-bar__symbol sl-input {
            inline-size: auto;
            min-inline-size: 2.75rem;
            max-inline-size: 8rem;
        }

        .editing-bar__symbol sl-input[maxlength="1"] {
            max-inline-size: 4rem;
        }
    }

    .editing-bar__range {
        white-space: nowrap;
    }

    .editing-bar__range input {
        width: 44px;
        margin: 0;
        accent-color: var(--sl-color-primary-600);
    }
`;
