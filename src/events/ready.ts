import { Client, REST, Routes } from 'discord.js';
import config from '../config';
import { EventListener } from '../lib/abstract/events';
import { KuuClient } from '../lib/client';
import { kickControl } from '../lib/utils';

export default class extends EventListener<'ready'> {
  constructor(private client: KuuClient) {
    super('ready');
  }

  async execute(client: Client<true>): Promise<void> {
    // Register commands
    await this.registerCommands();

    client.guilds.fetch(config.guildId).then(async (guild) => {
      // Fetch all members in the guild
      await guild.members.fetch();

      // Get the current time in timestamp format
      const now = new Date().getTime();

      // Get all members with intro role to control user kick
      guild.roles.fetch(config.roleIds.intro).then((role) => {
        role?.members.forEach((member) => {
          kickControl(member, now - (member.joinedTimestamp ?? 0));
        });
      });
    });

    // Notify success for discord bot login
    console.log(`Logged in as ${client.user.username}`);
  }

  private async registerCommands() {
    // Create the rest client to register slash commands
    const rest = new REST().setToken(process.env.TOKEN);

    // Register the slash commands
    await rest
      .put(Routes.applicationGuildCommands(process.env.APPLICATION_ID, config.guildId), {
        body: this.client.slashCommands.map((cmd) => cmd.info)
      })
      .then((cmds) => {
        console.log(
          `Successfully registered ${(cmds as unknown[]).length} commands in guild '${
            config.guildId
          }'.`
        );
      })
      .catch((error) => {
        console.error(
          `Something went wrong while registering commands for guild '${config.guildId}': ${error}`
        );
      });
  }
}
