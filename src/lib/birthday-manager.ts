import { CronJob } from 'cron';
import { TextChannel } from 'discord.js';
import { eq, isNotNull } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import config from '../config';
import { db } from '../database/drizzle';
import { members } from '../database/schemas';
import { KuuClient } from './client';

export class BirthdayManager {
  private readonly cronjob: CronJob;

  constructor(private client: KuuClient) {
    this.cronjob = CronJob.from({
      cronTime: '0 0 * * *', // every 12 am (midnight)
      onTick: () => this.announceBirthday(),
      timeZone: 'Asia/Kuala_Lumpur'
    });
  }

  /**
   * Set the birthday of the member in the database
   *
   * @param {string} memberId - The Discord ID of the member
   * @param {Date} birthday - The birthday of the member
   * @return {*}  {Promise<boolean>} true if successfully saved to database, false otherwise
   * @memberof BirthdayManager
   */
  public async setBirthday(
    memberId: string,
    birthday: Date,
    hasBirthYear: boolean
  ): Promise<boolean> {
    return await db
      .insert(members)
      .values({
        discordId: memberId,
        birthday,
        hasBirthYear
      })
      // It is possible that the member is already in the database so we
      // need to update the record instead of inserting
      .onConflictDoUpdate({
        target: members.discordId,
        set: { birthday }
      })
      .then(() => true)
      .catch(() => false);
  }

  public async unsetBirthday(memberId: string): Promise<boolean> {
    return await db
      .update(members)
      .set({ birthday: null })
      .where(eq(members.discordId, memberId))
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Try to fetch the member's birthday so that we know if:
   * 1. the member is already in the database
   * 2. the member has previously set a birthday or not
   *
   * @param {string} memberId - The Discord ID of the member
   * @return {*}  {Promise<boolean>} true if the member exists and has set a birthday, false otherwise
   * @memberof BirthdayManager
   */
  public async hasSetBirthday(memberId: string): Promise<boolean> {
    const record = await db.query.members.findFirst({
      where: eq(members.discordId, memberId)
    });

    // If the member is in the database and their birthday is not null then
    // that means the member has set their birthday
    return !!record && record.birthday !== null;
  }

  /**
   * Executed by the cronjob. Announce the birthday of all members if match the current date
   * in the database.
   *
   * @private
   * @memberof BirthdayManager
   */
  private async announceBirthday() {
    const guild = await this.client.guilds.fetch(config.guildId).catch(() => null);
    if (!guild) return console.error('[Birthday] Could not find guild.');

    const channel = await guild.channels
      .fetch(config.channelIds.birthday)
      .then((c) => c as TextChannel)
      .catch(() => null);
    if (!channel) return console.error('[Birthday] Could not find channel.');

    const results = await db.select().from(members).where(isNotNull(members.birthday));
    results.forEach(async (result) => {
      const date = new Date();

      const now = new Date(date.getTime() - date.getTimezoneOffset());
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth();
      const nowDate = now.getDate();

      const birthdayYear = result.birthday!.getFullYear();
      const birthdayMonth = result.birthday!.getMonth();
      const birthdayDate = result.birthday!.getDate();

      if (nowMonth === birthdayMonth && nowDate === birthdayDate) {
        const member = await guild.members.fetch(result.discordId).catch(() => null);
        if (!member) return;

        const birthdayMsg = await fs.readFile(
          path.join(this.client.messagesDir, 'birthday.md'),
          { encoding: 'utf-8' }
        );

        await channel
          .send({
            // Replace {age} by the actual age and {mention} by the member
            content: birthdayMsg
              .replace(
                /{age}/gm,
                result.hasBirthYear ? `${nowYear - birthdayYear}th` : ''
              )
              .replace(/{mention}/gm, `${member}`)
          })
          .catch(() =>
            console.error(
              `[Birthday] Could not send birthday message for ${member.user.tag}`
            )
          );
      }
    });
  }

  /**
   * Getter cron
   * @return {CronJob}
   */
  public get cron(): CronJob {
    return this.cronjob;
  }
}
