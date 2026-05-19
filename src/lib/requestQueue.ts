export type QueuedTask<T = any> = () => Promise<T>;

interface QueueItem<T = any> {
  id: string;
  task: QueuedTask<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  enqueuedAt: number;
}

export class RequestQueue {
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private maxConcurrency: number;

  constructor(maxConcurrency = 2) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Enqueues an asynchronous task and returns a Promise that resolves when the task finishes.
   */
  public enqueue<T = any>(task: QueuedTask<T>, description = 'unnamed-task'): Promise<T> {
    const id = `${description}-${Math.random().toString(36).substring(2, 9)}`;
    
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        task,
        resolve,
        reject,
        enqueuedAt: Date.now()
      });

      console.log(`[Queue] Task '${id}' enqueued. Queue length: ${this.queue.length}`);
      this.processNext();
    });
  }

  /**
   * Attempts to process the next item(s) in the queue if concurrency slots are available.
   */
  private async processNext(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency) {
      console.log(`[Queue] Processing locked. ${this.activeCount}/${this.maxConcurrency} active slots occupied.`);
      return;
    }

    const item = this.queue.shift();
    if (!item) return; // Queue is empty

    this.activeCount++;
    console.log(`[Queue] Executing task '${item.id}'. Active: ${this.activeCount}/${this.maxConcurrency}. Wait time in queue: ${Date.now() - item.enqueuedAt}ms`);

    try {
      const result = await item.task();
      item.resolve(result);
    } catch (err) {
      console.error(`[Queue] Task '${item.id}' failed:`, err);
      item.reject(err);
    } finally {
      this.activeCount--;
      console.log(`[Queue] Task '${item.id}' finished. Active remaining: ${this.activeCount}`);
      // Tick next task
      this.processNext();
    }
  }

  /**
   * Returns current count of enqueued items
   */
  public get length(): number {
    return this.queue.length;
  }

  /**
   * Returns current count of actively executing items
   */
  public get active(): number {
    return this.activeCount;
  }

  /**
   * Clears all pending requests in queue
   */
  public clear(): void {
    const cancelledCount = this.queue.length;
    this.queue.forEach(item => {
      item.reject(new Error('A fila de requisições foi cancelada ou redefinida.'));
    });
    this.queue = [];
    console.log(`[Queue] Queue cleared. ${cancelledCount} requests were rejected.`);
  }
}

// Export a singleton request queue for standard client operations (e.g. concurrency = 1 to guarantee sequential AI operations)
export const clientRequestQueue = new RequestQueue(1);
