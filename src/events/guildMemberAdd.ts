import { GuildMember } from 'discord.js';
import config from '../config';
import { EventListener } from '../lib/abstract/events';
import { kickControl } from '../lib/utils';

export default class extends EventListener<'guildMemberAdd'> {
  constructor() {
    super('guildMemberAdd');
  }

  async execute(member: GuildMember): Promise<void> {
    member.roles
      .add(config.roleIds.intro)
      .then(kickControl)
      .catch(() => kickControl(member)); // In case of any errors
  }
}
