import type { Node, Transition } from './automaton-data';

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const NODE_RADIUS = 25;
const LOOP_RADIUS = 20;
const CURVE_STEPS = 24;
const INITIAL_ARROW_LENGTH = 100;
/** The loop position of a transition that has none: up and to the right. */
export const DEFAULT_LOOP_ANGLE = 45;

/**
 * The drawn line of a transition as a polyline, for the print figure and for keeping the initial arrow
 * clear of it. The scene draws the transitions itself.
 */
export type EdgeShape = {
    /** The line from one state border to the other. Empty if the states overlap. */
    points: Point[];
    lines: string[];
    /** The point of the line that the label sits next to, and the side it is pushed to. */
    labelOn: Point;
    labelSide: Point;
};

/** The arrow into the initial state: from its tail to the border of the state. */
export type Layout = {
    centres: Map<number, Point>;
    edges: Map<number, EdgeShape>;
    initial?: Point[];
    bounds: Rect;
};

const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const length = (a: Point) => Math.hypot(a.x, a.y);
const unit = (a: Point): Point => {
    const l = length(a) || 1;
    return { x: a.x / l, y: a.y / l };
};
const along = (from: Point, direction: Point, distance: number): Point =>
    ({ x: from.x + direction.x * distance, y: from.y + direction.y * distance });

/**
 * The stored `bend` of a transition (the roundness that vis-network used to draw it) as the `bend` of a Scene
 * path: the sideways distance of the control point from the middle of the chord, in chord lengths. Positive
 * is to the left of the way from the first state to the second, as in both.
 */
export function sceneBend(bend: number): number {
    const roundness = Math.abs(bend);
    const turn = (roundness * 0.5 + 0.5) * Math.PI;
    return Math.sign(bend) * (roundness * 0.5 + 0.5) * Math.abs(Math.cos(turn));
}

/** The control point of the quadratic curve between two states, as Scene bends an arc. */
function control(from: Point, to: Point, bend: number): Point {
    const sideways = sceneBend(bend);
    return { x: (from.x + to.x) / 2 + (to.y - from.y) * sideways, y: (from.y + to.y) / 2 - (to.x - from.x) * sideways };
}

const quadratic = (a: Point, c: Point, b: Point, t: number): Point => {
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
};

/** The parameter where the curve leaves (or reaches) the circle around a state, by bisection. */
function borderParameter(curve: (t: number) => Point, centre: Point, outward: 1 | -1): number {
    let inside = outward === 1 ? 0 : 1;
    let outside = outward === 1 ? 1 : 0;
    for (let i = 0; i < 24; i++) {
        const middle = (inside + outside) / 2;
        if (length(minus(curve(middle), centre)) < NODE_RADIUS) inside = middle;
        else outside = middle;
    }
    return outside;
}

export function labelLines(label: string): string[] {
    return label === '' ? [] : label.split('\n');
}

/** The side of a line that its label goes to: the upper one, or the right one if the line is vertical. */
function upperNormal(tangent: Point): Point {
    const normal = { x: -tangent.y, y: tangent.x };
    return normal.y > 1e-6 || (Math.abs(normal.y) <= 1e-6 && normal.x < 0) ? { x: -normal.x, y: -normal.y } : normal;
}

function loopShape(centre: Point, angle: number, lines: string[]): EdgeShape {
    const theta = ((angle % 360) + 360) % 360;
    const mathAngle = (450 - theta) * Math.PI / 180;
    const outward = { x: Math.cos(mathAngle), y: -Math.sin(mathAngle) };
    const middle = along(centre, outward, NODE_RADIUS);
    // The part of the loop circle outside the state, walked clockwise.
    const spread = Math.atan2(
        Math.sqrt(NODE_RADIUS ** 2 - ((NODE_RADIUS ** 2 + NODE_RADIUS ** 2 - LOOP_RADIUS ** 2) / (2 * NODE_RADIUS)) ** 2),
        (NODE_RADIUS ** 2 + NODE_RADIUS ** 2 - LOOP_RADIUS ** 2) / (2 * NODE_RADIUS) - NODE_RADIUS,
    );
    const start = Math.atan2(outward.y, outward.x) - spread;
    const end = Math.atan2(outward.y, outward.x) + spread;
    const point = (psi: number): Point => ({ x: middle.x + LOOP_RADIUS * Math.cos(psi), y: middle.y + LOOP_RADIUS * Math.sin(psi) });
    const points: Point[] = [];
    for (let i = 0; i <= CURVE_STEPS; i++) points.push(point(start + (end - start) * i / CURVE_STEPS));
    return { points, lines, labelOn: along(middle, outward, LOOP_RADIUS), labelSide: outward };
}

function lineShape(from: Point, to: Point, bend: number | undefined, lines: string[]): EdgeShape {
    const empty: EdgeShape = { points: [], lines, labelOn: from, labelSide: { x: 0, y: -1 } };
    if (length(minus(to, from)) <= 2 * NODE_RADIUS) return empty;
    if (!bend) {
        const direction = unit(minus(to, from));
        const start = along(from, direction, NODE_RADIUS);
        const tip = along(to, direction, -NODE_RADIUS);
        return { points: [start, tip], lines, labelOn: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, labelSide: upperNormal(direction) };
    }
    const via = control(from, to, bend);
    const curve = (t: number) => quadratic(from, via, to, t);
    const first = borderParameter(curve, from, 1);
    const last = borderParameter(curve, to, -1);
    if (first >= last) return empty;
    const points: Point[] = [];
    for (let i = 0; i <= CURVE_STEPS; i++) points.push(curve(first + (last - first) * i / CURVE_STEPS));
    const tangent = unit(minus(curve(0.52), curve(0.48)));
    return { points, lines, labelOn: curve(0.5), labelSide: upperNormal(tangent) };
}

export function distanceToPolyline(points: readonly Point[], at: Point): number {
    let nearest = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const dx = points[i + 1].x - a.x;
        const dy = points[i + 1].y - a.y;
        const squared = dx * dx + dy * dy;
        const t = squared ? Math.min(1, Math.max(0, ((at.x - a.x) * dx + (at.y - a.y) * dy) / squared)) : 0;
        nearest = Math.min(nearest, Math.hypot(at.x - a.x - t * dx, at.y - a.y - t * dy));
    }
    return nearest;
}

/** The arrow into the initial state, on the left unless another state or a line is in the way. */
function initialShape(initial: Point, centres: Map<number, Point>, ownId: number, edges: EdgeShape[]): Point[] {
    const obstacles = [...centres].filter(([id, centre]) => id !== ownId && length(minus(centre, initial)) <= INITIAL_ARROW_LENGTH + NODE_RADIUS + 6);
    let best = { x: -1, y: 0 };
    let bestScore = Infinity;
    for (let index = 0; index < 16; index++) {
        const step = Math.ceil(index / 2) * (index % 2 ? 1 : -1);
        const angle = Math.PI + step * Math.PI / 8;
        const direction = { x: Math.cos(angle), y: Math.sin(angle) };
        let score = 0;
        for (let distance = NODE_RADIUS + 4; distance <= INITIAL_ARROW_LENGTH; distance += 8) {
            const at = along(initial, direction, distance);
            if (obstacles.some(([, centre]) => length(minus(at, centre)) < NODE_RADIUS + 6)) score += 2;
            if (edges.some(edge => edge.points.length > 1 && distanceToPolyline(edge.points, at) < 9)) score++;
            if (score >= bestScore) break;
        }
        if (score < bestScore) {
            best = direction;
            bestScore = score;
            if (score === 0) break;
        }
    }
    const tail = along(initial, best, INITIAL_ARROW_LENGTH);
    const tip = along(initial, best, NODE_RADIUS);
    return [tail, tip];
}

function include(box: { left: number; top: number; right: number; bottom: number }, x: number, y: number) {
    box.left = Math.min(box.left, x);
    box.right = Math.max(box.right, x);
    box.top = Math.min(box.top, y);
    box.bottom = Math.max(box.bottom, y);
}

/**
 * Places the states and finds the lines of the transitions and the initial arrow as plain geometry.
 * `moved` holds centres that differ from the stored ones, such as those of states that are being dragged.
 */
export function layoutDiagram(nodes: readonly Node[], transitions: readonly Transition[], moved?: ReadonlyMap<number, Point>): Layout {
    const centres = new Map(nodes.map(node => [node.id, moved?.get(node.id) ?? { x: node.x ?? 0, y: node.y ?? 0 }]));
    const edges = new Map<number, EdgeShape>();
    for (const edge of transitions) {
        const from = centres.get(edge.from);
        const to = centres.get(edge.to);
        if (!from || !to) continue;
        const lines = labelLines(edge.label);
        edges.set(edge.id, edge.from === edge.to ? loopShape(from, edge.loopAngle ?? DEFAULT_LOOP_ANGLE, lines) : lineShape(from, to, edge.bend, lines));
    }
    const first = nodes.find(node => node.initial);
    const initial = first && initialShape(centres.get(first.id)!, centres, first.id, [...edges.values()]);

    const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const { x, y } of centres.values()) {
        include(box, x - NODE_RADIUS, y - NODE_RADIUS);
        include(box, x + NODE_RADIUS, y + NODE_RADIUS);
    }
    for (const edge of edges.values()) {
        for (const { x, y } of edge.points) include(box, x, y);
        include(box, edge.labelOn.x, edge.labelOn.y);
    }
    for (const { x, y } of initial ?? []) include(box, x, y);
    const bounds = box.left > box.right ? { x: 0, y: 0, width: 0, height: 0 }
        : { x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top };
    return { centres, edges, initial, bounds };
}

export const points = (shape: readonly Point[]) => shape.map(({ x, y }) => `${x},${y}`).join(' ');
