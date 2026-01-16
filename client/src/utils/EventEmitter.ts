/**
 * Type-safe event emitter for component communication
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = { [key: string]: any };
export type EventCallback<T> = (data: T) => void;

export class EventEmitter<Events extends EventMap = EventMap> {
  private listeners = new Map<keyof Events, Set<EventCallback<unknown>>>();

  on<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  emit<K extends keyof Events>(
    event: K,
    ...args: Events[K] extends void ? [] : [data: Events[K]]
  ): void {
    const data = args[0];
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in event handler for ${String(event)}:`, err);
      }
    });
  }

  once<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
    const wrapper = (data: Events[K]) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  removeAllListeners(event?: keyof Events): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
