import { Client, ClientEvents, ClientOptions, Collection } from 'discord.js';
import glob from 'glob';
import path from 'path';
import { Command, LegacyCommand, SlashCommand } from './abstract/commands';
import { EventListener } from './abstract/events';

export type KuuModules = 'commands' | 'events';

export type CommandModule = {
  [key in LegacyCommand['key']]: Collection<string, LegacyCommand>;
} & {
  [key in SlashCommand['key']]: Collection<string, SlashCommand>;
};

export class KuuClient extends Client {
  private readonly root: string = __dirname;
  private readonly commands: CommandModule = {
    LegacyCommand: new Collection(),
    SlashCommand: new Collection()
  };

  constructor(clientOptions: ClientOptions) {
    super(clientOptions);

    this.loadModule('events').catch(() =>
      console.error('Something went wrong loading events.')
    );
    this.loadModule('commands').catch(() =>
      console.error('Something went wrong loading commands.')
    );
  }

  /**
   * Dynamically load a module for the bot.
   *
   * @memberof KuuClient
   */
  async loadModule(module: KuuModules) {
    // Create path for events
    const folderPath = path.join(this.root, '..', module);

    // Use glob to get a list of files that ends with .js or .ts in the provided folder path
    // This includes js and ts files inside folders within the the folder path.
    glob(path.join(folderPath, '**', '*.{js,ts}'), (err, files) => {
      if (err) throw err;

      // Check if there are modules to load
      if (files.length === 0) {
        console.warn(`There are no ${module} to load.`);
        return;
      }

      // Load every file that was found
      let numSkipped: number = 0;
      files.forEach((file) => {
        const defaultModule = require(file).default;

        // If there was no default export
        if (!defaultModule) {
          numSkipped += 1;
          return console.warn(
            `Skipped '${file}' as it is not a valid '${module}' module.`
          );
        }

        // Register events
        if (defaultModule.prototype instanceof EventListener) {
          const event: EventListener<keyof ClientEvents> = new defaultModule(this);
          this.on(event.name, (...args) => event.execute(...args));
          return;
        }

        // Register commands
        if (defaultModule.prototype instanceof Command) {
          const command: Command<LegacyCommand | SlashCommand> = new defaultModule(this);

          if (command.isLegacy()) {
            return this.commands.LegacyCommand.set(command.info.name, command);
          }

          if (command.isSlash()) {
            return this.commands.SlashCommand.set(command.info.name, command);
          }
        }
      });

      console.log(`Loaded ${files.length - numSkipped} ${module}.`);
    });
  }

  /**
   * Getter for legacy commands.
   *
   * @readonly
   * @memberof KuuClient
   */
  get legacyCommands() {
    return this.commands.LegacyCommand;
  }

  /**
   * Getter for slash commands.
   *
   * @readonly
   * @memberof KuuClient
   */
  get slashCommands() {
    return this.commands.SlashCommand;
  }
}