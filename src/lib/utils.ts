import { GuildMember } from 'discord.js';
import config from '../config';

/**
 * Calculate when to kick a user
 * If timeout is greater than kick timeout in config, user will be immediately kicked
 *
 * @param {GuildMember} member
 * @param {number} [timeout=config.kickTimeout]
 * @return {*}
 */
export function kickControl(
  member: GuildMember,
  timeout: number = config.kickTimeout
): any {
  const reason = 'User stuck with "Intro Arc" role for too long.';

  // Kick user if the timeout is greater than the kick timeout
  if (timeout > config.kickTimeout) {
    return notifyKick(member).then(async () => await member.kick(reason));
  }

  setTimeout(async () => {
    // No need to kick user if user no longer has intro role
    const updatedMember = await member.fetch();
    if (!updatedMember.roles.cache.has(config.roleIds.intro)) return;

    // Kick user
    notifyKick(member).then(async () => {
      await member.kick(reason);
    });
  }, timeout);
}

/**
 * Utility function to notify kicked user of their kick
 *
 * @param {GuildMember} member
 */
export async function notifyKick(member: GuildMember) {
  await member
    .send({
      content:
        'Yo dazo! You have been automatically kicked for not having been verified by our committee. Please reach out to @officialspimy if you think this was a mistake! Ja ne~'
    })
    .catch((_) => {}); // Do nothing if error (likely means user disabled DMs)
}

export function getNumberWithOrdinal(num: number): string {
  const j = num % 10;
  const k = num % 100;

  if (j === 1 && k !== 11) {
    return num + 'st';
  }

  if (j === 2 && k !== 12) {
    return num + 'nd';
  }

  if (j === 3 && k !== 13) {
    return num + 'rd';
  }

  return num + 'th';
}

export enum VerificationButtons {
  VEFIFY = 'verify',
  REJECT = 'reject'
}
