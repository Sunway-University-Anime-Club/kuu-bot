import {
  ChatInputApplicationCommandData,
  ChatInputCommandInteraction,
  Message,
  PermissionResolvable
} from 'discord.js';

/**
 * Interface for information about how to use a command.
 *
 * @export
 * @interface CommandUsage
 */
export interface CommandUsage {
  required: boolean;
  argument: string;
  description?: string;
}

/**
 * Interface for legacy command information.
 *
 * @export
 * @interface LegacyCommand
 */
export interface LegacyCommand {
  info: {
    name: string;
    description: string;
    aliases: string[];
    usage?: CommandUsage[];
    permissions?: PermissionResolvable[];
    category?: string;
    disabled?: boolean;
  };
  key: 'LegacyCommand';
}

/**
 * Interface for slash command information.
 *
 * @export
 * @interface SlashCommand
 */
export interface SlashCommand {
  info: ChatInputApplicationCommandData & { disabled?: boolean };
  key: 'SlashCommand';
}

/**
 * Interface for arguments in execute method based on the type of command.
 *
 * @export
 * @interface KuuCommands
 */
export interface KuuCommands {
  LegacyCommand: [message: Message<true>, args: string[]];
  SlashCommand: [interaction: ChatInputCommandInteraction];
}

/**
 * Every commands should extend this abstract class.
 *
 * @export
 * @abstract
 * @class Command
 * @template T
 */
export abstract class Command<T extends LegacyCommand | SlashCommand> {
  constructor(private command: T['info']) {}

  /**
   * This method should be overridden by subclasses.
   * Contains logic for slash command execution.
   *
   * @abstract
   * @param {...KuuCommands[T['key']]} args
   * @return {*}  {Promise<boolean>} - true if successful, false otherwise
   * @memberof Command
   */
  abstract execute(...args: KuuCommands[T['key']]): Promise<boolean>;

  /**
   * Get the information about the command.
   *
   * @readonly
   * @memberof Command
   */
  get info() {
    return {
      ...this.command,
      execute: this.execute
    };
  }

  public isLegacy(): this is Command<LegacyCommand> {
    return 'aliases' in this.command;
  }

  public isSlash(): this is Command<SlashCommand> {
    return !('aliases' in this.command);
  }
}
