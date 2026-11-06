import { css } from 'lit';

export const toolMenuStyles = css`
    .toolmenu {
        position: absolute;
        left: 10px;
        bottom: 10px;
        z-index: 1500;
    }

    .toolmenu sl-button {
        touch-action: none;
    }

    .toolmenu sl-button::part(base),
    .toolmenu sl-button::part(label) {
        display: flex;
        align-items: center;
        justify-content: center;
    }
`;
