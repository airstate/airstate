import Queue from 'yocto-queue';

export function createBlockingQueue<T>() {
    const items = new Queue<T>();
    const resolvers = new Queue<(value: T) => void>();

    return {
        /**
         * Synchronously enqueue an item to the queue
         * @param item The item to add to the queue
         */
        enqueue(item: T): void {
            if (resolvers.size > 0) {
                // Someone is waiting for an item, resolve immediately
                const resolver = resolvers.dequeue()!;
                resolver(item);
            } else {
                // No one waiting, add to queue
                items.enqueue(item);
            }
        },

        /**
         * Asynchronously dequeue an item from the queue
         * If the queue is empty, this will block (return a promise) until an item is available
         * @returns Promise that resolves to the next item
         */
        async dequeue(): Promise<T> {
            if (items.size > 0) {
                // Item available, return immediately
                return items.dequeue()!;
            } else {
                // No items available, create a promise that will be resolved when enqueue is called
                return new Promise<T>((resolve) => {
                    resolvers.enqueue(resolve);
                });
            }
        },

        /**
         * Get the current size of the queue
         * @returns Number of items currently in the queue
         */
        get size(): number {
            return items.size;
        },

        /**
         * Check if the queue is empty
         * @returns True if queue is empty, false otherwise
         */
        get isEmpty(): boolean {
            return items.size === 0;
        },

        /**
         * Check if there are consumers waiting for items
         * @returns True if consumers are blocked waiting for items
         */
        get hasWaitingConsumers(): boolean {
            return resolvers.size > 0;
        },

        /**
         * Get the number of consumers waiting for items
         * @returns Number of blocked consumers
         */
        get waitingConsumers(): number {
            return resolvers.size;
        },

        /**
         * Clear all items from the queue
         * Note: This will not affect already waiting consumers
         */
        clear(): void {
            items.clear();
        }
    };
}
