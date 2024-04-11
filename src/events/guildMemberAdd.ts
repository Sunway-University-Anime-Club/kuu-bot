import { client } from '..';
import config from '../config';
import { kickControl } from '../utils';

client.on('guildMemberAdd', async (member) => {
  member.roles
    .add(config.introRoleId)
    .then(kickControl)
    .catch(() => kickControl(member)); // In case of any errors
});
