export class Logger {
    private static _verbose: boolean = false;
    
    public static set verbose(verbose: boolean) {
        Logger._verbose = verbose;
    }
    
    public static get verbose(): boolean {
        return Logger._verbose;
    }
    
    public static log(...args: unknown[]): void {
        if (Logger._verbose) {
            console.log('[webwriter-automaton]', ...args);
        }
    }

    public static warn(...args: unknown[]): void {
        if (Logger._verbose) {
            console.warn('[webwriter-automaton]', ...args);
        }
    }

    public static error(...args: unknown[]): void {
        console.error('[webwriter-automaton]', ...args);
    }

    public static time(label: string): void {
        if (Logger._verbose) {
            console.time(`[webwriter-automaton] ${label}`);
        }
    }

    public static timeEnd(label: string): void {
        if (Logger._verbose) {
            console.timeEnd(`[webwriter-automaton] ${label}`);
        }
    }
}
