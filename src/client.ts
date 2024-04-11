import { Client, ClientOptions } from 'discord.js';
import glob from 'glob';
import path from 'path';

interface KuuClientOptions extends ClientOptions {
  root: string;
}

export class KuuClient extends Client {
  private readonly root: string;

  constructor(private readonly clientOptions: KuuClientOptions) {
    super(clientOptions);
    this.root = this.clientOptions.root;

    this.loadListeners().catch(() =>
      console.error('Something went wrong loading events.')
    );
  }

  /**
   * Dynamically load all event listeners for the bot
   *
   * @memberof KuuClient
   */
  async loadListeners() {
    // Create path for events
    const folderPath = path.join(this.root, 'events');

    // Use glob to get a list of files that ends with .js or .ts in the provided folder path
    // This includes js and ts files inside folders within the the folder path.
    glob(path.join(folderPath, '**', '*.{js,ts}'), (err, files) => {
      if (err) throw err;

      // Check if there are any event listeners
      if (files.length === 0) {
        console.warn('There are no event listeners to load.');
        return;
      }

      // Load every file that was found
      files.forEach((file) => require(file));
      console.log(`Loaded ${files.length} event listeners.`);
    });
  }
}
