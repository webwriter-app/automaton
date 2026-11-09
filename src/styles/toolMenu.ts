import { css } from 'lit';

export const toolMenuStyles = css`
    .toolmenu {
        position: absolute;
        left: 10px;
        bottom: 10px;
        z-index: 1500;
        width: var(--sl-input-height-large);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    .toolmenu__node {
        touch-action: none;
    }

    .toolmenu__sink:only-child {
        margin-bottom: calc(var(--sl-input-height-large) + 6px);
    }

    .toolmenu sl-button::part(base),
    .toolmenu sl-button::part(label) {
        display: flex;
        align-items: center;
        justify-content: center;
    }
`;
