import { ClientEvents } from 'discord.js';

/**
 * Every events should extend this abstract class.
 *
 * @export
 * @abstract
 * @class EventListener
 * @template T
 */
export abstract class EventListener<T extends keyof ClientEvents> {
  constructor(private event: T) {}

  /**
   * This method should be overridden by subclasses.
   * Contains logic for event handling.
   *
   * @abstract
   * @param {...ClientEvents[T]} args
   * @memberof EventListener
   */
  abstract execute(...args: ClientEvents[T]): Promise<any>;

  /**
   * Name of the event listener.
   *
   * @readonly
   * @memberof EventListener
   */
  get name() {
    return this.event;
  }
}
