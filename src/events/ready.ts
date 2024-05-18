import { Client } from 'discord.js';
import config from '../config';
import { EventListener } from '../lib/abstract/events';
import { kickControl } from '../lib/utils';

export default class extends EventListener<'ready'> {
  constructor() {
    super('ready');
  }

  async execute(client: Client<true>): Promise<void> {
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
}
