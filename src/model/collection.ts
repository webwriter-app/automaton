type Identified = { id: number };

export type CollectionEvent = 'add' | 'update' | 'remove';
type Change<T> = { items: number[]; oldData: T[] };
type Listener<T> = (event: CollectionEvent, change: Change<T>) => void;

/**
 * Items with a numeric id that tell their listeners what changed. `update` merges into an existing item
 * and adds a missing one; stored items are replaced, never mutated, so a reference stays a snapshot.
 */
export class Collection<T extends Identified> {
    private readonly stored = new Map<number, T>();
    private readonly listeners = new Set<Listener<T>>();

    get length(): number {
        return this.stored.size;
    }

    get(): T[];
    get(id: number): T | null;
    get(options: { filter: (item: T) => boolean }): T[];
    get(arg?: number | { filter: (item: T) => boolean }): T[] | T | null {
        if (typeof arg === 'number') return this.stored.get(arg) ?? null;
        const items = [...this.stored.values()];
        return arg ? items.filter(arg.filter) : items;
    }

    getIds(options?: { filter: (item: T) => boolean }): number[] {
        return this.get(options ?? { filter: () => true }).map(item => item.id);
    }

    add(data: T | T[]): void {
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
            if (this.stored.has(item.id)) throw new Error(`Cannot add item: id ${item.id} already exists`);
            this.stored.set(item.id, item);
        }
        this.emit('add', items.map(item => item.id), []);
    }

    update(data: (Partial<T> & Identified) | (Partial<T> & Identified)[]): void {
        const added: number[] = [];
        const updated: number[] = [];
        const oldData: T[] = [];
        for (const patch of Array.isArray(data) ? data : [data]) {
            const old = this.stored.get(patch.id);
            if (old) {
                oldData.push(old);
                updated.push(patch.id);
                this.stored.set(patch.id, { ...old, ...patch });
            } else {
                added.push(patch.id);
                this.stored.set(patch.id, patch as T);
            }
        }
        if (added.length) this.emit('add', added, []);
        if (updated.length) this.emit('update', updated, oldData);
    }

    remove(ids: number | number[]): void {
        const removed: T[] = [];
        for (const id of Array.isArray(ids) ? ids : [ids]) {
            const item = this.stored.get(id);
            if (item && this.stored.delete(id)) removed.push(item);
        }
        if (removed.length) this.emit('remove', removed.map(item => item.id), removed);
    }

    clear(): void {
        this.remove([...this.stored.keys()]);
    }

    /** Returns the function that stops the listener. */
    on(listener: Listener<T>): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(event: CollectionEvent, items: number[], oldData: T[]) {
        for (const listener of [...this.listeners]) listener(event, { items, oldData });
    }
}
