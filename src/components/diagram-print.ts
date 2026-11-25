import { svg } from 'lit';
import type { Node } from '../model/automaton-data';
import { NODE_RADIUS, points, type Layout } from '../model/diagram';

const MARGIN = 30;
const LINE_HEIGHT = 14;
const LABEL_GAP = 6;
const MAX_WIDTH = 720;
const MAX_HEIGHT = 500;

/** The whole diagram as a figure for printing: fitted to its content, whatever the view of the editor shows. */
export function renderPrintDiagram(nodes: readonly Node[], layout: Layout, label: string) {
    const { x, y, width, height } = layout.bounds;
    const box = { x: x - MARGIN, y: y - MARGIN, width: width + 2 * MARGIN, height: height + 2 * MARGIN };
    const shown = Math.min(1, MAX_WIDTH / box.width, MAX_HEIGHT / box.height) * box.width;
    const line = (shape: readonly { x: number; y: number }[]) => svg`<polyline points=${points(shape)} fill="none" stroke="#000" marker-end="url(#print-arrow)" />`;
    return svg`<svg role="img" aria-label=${label} viewBox="${box.x} ${box.y} ${box.width} ${box.height}" style="width: ${shown}px; overflow: visible"
        font-family="Arial, sans-serif" font-size="12">
        <marker id="print-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="12" markerHeight="12" orient="auto" markerUnits="userSpaceOnUse">
            <polygon points="0,0 10,5 0,10" fill="#000" />
        </marker>
        ${[...layout.edges.values()].filter(edge => edge.points.length).map(edge => {
            const side = edge.labelSide;
            const up = side.y <= 0;
            const anchor = Math.abs(side.x) < 0.3 ? 'middle' : side.x > 0 ? 'start' : 'end';
            const top = edge.labelOn.y + side.y * LABEL_GAP - (up ? (edge.lines.length - 1) * LINE_HEIGHT : -LINE_HEIGHT + 3);
            return svg`
                ${line(edge.points)}
                ${edge.lines.map((text, index) => svg`<text x=${edge.labelOn.x + side.x * LABEL_GAP} y=${top + index * LINE_HEIGHT} text-anchor=${anchor}>${text}</text>`)}`;
        })}
        ${layout.initial ? line(layout.initial) : ''}
        ${nodes.map(node => {
            const { x: cx, y: cy } = layout.centres.get(node.id)!;
            return svg`
                <circle cx=${cx} cy=${cy} r=${NODE_RADIUS} fill="#fff" stroke="#000" />
                ${node.final ? svg`<circle cx=${cx} cy=${cy} r=${NODE_RADIUS - 5} fill="none" stroke="#000" />` : ''}
                <text x=${cx} y=${cy} text-anchor="middle" dominant-baseline="central">${node.label}</text>`;
        })}
    </svg>`;
}
