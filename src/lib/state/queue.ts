/**
 * queue.ts
 *
 * Summary: Simple sequential Promise-based execution queue to prevent race conditions on I/O.
 * Expects: Asynchronous action functions.
 * Output: Sequentially resolved Promise chains.
 */
export class OperationQueue {
	private queue = Promise.resolve();

	async enqueue(op: () => Promise<void> | void): Promise<void> {
		this.queue = this.queue.then(op).catch(err => {
			console.error("[Strata] Queue operation failed:", err);
		});
		return this.queue;
	}
}
