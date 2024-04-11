import { client } from '..';
import config from '../config';
import { kickControl } from '../utils';

client.on('ready', async (client) => {
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
});
