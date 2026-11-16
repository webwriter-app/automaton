export interface Node {
    id: number;
    label: string;
    /** The centre of the state in diagram coordinates. */
    x?: number;
    y?: number;
    final: boolean;
    initial: boolean;
    /** Transient: set by the simulation. Never stored. */
    highlight?: 'active';
}

export interface Transition {
    id: number;
    from: number;
    to: number;
    label: string;
    symbols: string[];
    stackOperations?: StackOperation[];
    /** Signed curvature of the arrow between two states. 0 or missing draws a straight line. */
    bend?: number;
    /** Position of a loop on its state in degrees, clockwise from the top. */
    loopAngle?: number;
    /** Transient: set by the simulation. Never stored. */
    highlight?: boolean;
}

export interface StackOperation {
    symbol: string;
    operation: 'push' | 'pop' | 'empty' | 'none';
    condition: string;
}
