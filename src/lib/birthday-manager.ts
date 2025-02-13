import { CronJob } from 'cron';
import { TextChannel } from 'discord.js';
import { eq, isNotNull } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import config from '../config';
import { db } from '../database/drizzle';
import { discordMembers } from '../database/schemas';
import { KuuClient } from './client';

export class BirthdayManager {
  private readonly cronjob: CronJob;

  constructor(private client: KuuClient) {
    this.cronjob = CronJob.from({
      cronTime: '59 0 0 * * *', // every 12.00 am (midnight)
      onTick: () => this.celebrateBirthday(),
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
      .insert(discordMembers)
      .values({
        discordId: memberId,
        birthday,
        hasBirthYear
      })
      // It is possible that the member is already in the database so we
      // need to update the record instead of inserting
      .onConflictDoUpdate({
        target: discordMembers.discordId,
        set: { birthday }
      })
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Set the birthday of the member to NULL in the database
   *
   * @param {string} memberId - The Discord ID of the member
   * @return {*}  {Promise<boolean>} - true if successfully updated database, false otherwise
   * @memberof BirthdayManager
   */
  public async unsetBirthday(memberId: string): Promise<boolean> {
    return await db
      .update(discordMembers)
      .set({ birthday: null, hasBirthYear: false })
      .where(eq(discordMembers.discordId, memberId))
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
    const record = await db.query.discordMembers.findFirst({
      where: eq(discordMembers.discordId, memberId)
    });

    // If the member is in the database and their birthday is not null then
    // that means the member has set their birthday
    return !!record && record.birthday !== null;
  }

  /**
   * Get the next 10 upcoming birthdays, including 'today'
   *
   * @return {*} the Discord ID of the members and their birthdays (assert as never null)
   * @memberof BirthdayManager
   */
  public async getUpcomingBirthdays() {
    const MAX_NUM_UPCOMING = 10;
    const now = this.getNow();

    /**
     * 1. Fetch every members whose birthday is >= to the current month
     * 2. If the birthday month = current month, then the date >= the current date
     * 3. Count the amount of records fetched
     * 4. If the amount fetched is >= 10, then that's the data we need to return
     * 5. If the amount fetched is < 10, then we allow months that are below the current month to be fetched
     *    as well and will thus be considered as the following year instead of the current year
     */

    // prettier-ignore
    const results =  await db
      .select({
        discordId: discordMembers.discordId,
        birthday: discordMembers.birthday,
        hasBirthYear: discordMembers.hasBirthYear
      })
      .from(discordMembers)
      .where(isNotNull(discordMembers.birthday))

    const sortedResults = results.sort((a, b) => {
      return (
        a.birthday!.getMonth() - b.birthday!.getMonth() ||
        a.birthday!.getDate() - b.birthday!.getDate()
      );
    });

    const fromAfterCurMonth = sortedResults.filter((result) => {
      const afterCurMonth = result.birthday!.getMonth() > now.getMonth();
      const withinCurMonth =
        result.birthday!.getMonth() === now.getMonth() &&
        result.birthday!.getDate() >= now.getDate();
      return afterCurMonth || withinCurMonth;
    });

    if (fromAfterCurMonth.length >= MAX_NUM_UPCOMING)
      return fromAfterCurMonth.slice(0, MAX_NUM_UPCOMING);

    const finalResults = [...fromAfterCurMonth];
    for (const result of sortedResults) {
      if (!!finalResults.find((r) => r.discordId === result.discordId)) continue;
      finalResults.push(result);
      if (finalResults.length === MAX_NUM_UPCOMING) break;
    }

    return finalResults.sort((a, b) => {
      return (
        a.birthday!.getMonth() - b.birthday!.getMonth() ||
        a.birthday!.getDate() - b.birthday!.getDate()
      );
    });
  }

  public getAge(birthday: Date): number {
    return this.getUpcomingBirthdayYear(birthday) - birthday.getFullYear();
  }

  /**
   * Format the upcoming birthday into a readable format: date month year.
   * "(Today)" will be appended if the birthday date matches the current date.
   *
   * * Examples:
   * - 21 June 2024 (Today)
   * - 30 January 2025
   *
   * @param {Date} birthday - the birthday date object
   * @return {*}  {string} formatted date
   * @memberof BirthdayManager
   */
  public formatUpcomingBirthday(birthday: Date): {
    formatted: string;
    nextBirthday: Date;
  } {
    const now = this.getNow();

    const date = `${birthday.getDate()}`.padStart(2, '0');
    const month = birthday.toLocaleString('default', { month: 'long' });
    const year = this.getUpcomingBirthdayYear(birthday);

    const isToday =
      birthday.getMonth() === now.getMonth() && birthday.getDate() === now.getDate();

    return {
      formatted: `${date} ${month} ${year} ${isToday ? '(Today)' : ''}`,
      nextBirthday: new Date(`${year}-${month}-${date}`)
    };
  }

  private getNow(): Date {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset());
  }

  /**
   * If the month is < the current month or
   * if the month is = the current month and the date is < the current date,
   * then it means that the upcoming birth year should be next year.
   * 
   * * Example:
   * It is currently 21 June 2024. The birthday is 10 June.
   * 10 June has already passed for 2024. Therefore the next birthday is the following year.
    
  * @param birthday 
  * @returns the year of the upcoming birthday
  */
  private getUpcomingBirthdayYear(birthday: Date): number {
    const now = this.getNow();

    return birthday.getMonth() < now.getMonth() ||
      (birthday.getMonth() === now.getMonth() && birthday.getDate() < now.getDate())
      ? now.getFullYear() + 1
      : now.getFullYear();
  }

  /**
   * Executed by the cronjob. Announce the birthday of all members if match the current date
   * in the database.
   *
   * @private
   * @memberof BirthdayManager
   */
  private async celebrateBirthday() {
    const guild = await this.client.guilds.fetch(config.guildId).catch(() => null);
    if (!guild) return console.warn('[Birthday] Could not find guild.');

    const channel = await guild.channels
      .fetch(config.channelIds.birthday)
      .then((c) => c as TextChannel)
      .catch(() => null);
    if (!channel) return console.warn('[Birthday] Could not find channel.');

    const role = await guild.roles.fetch(config.roleIds.birthday).catch(() => null);
    if (!role) console.warn('[Birthday] Could not find birthday role.');

    /**
     * Firstly remove birthday role from everyone who has it.
     * We can remove them here because if someone has the role, it means
     * it has been at least 24 hours since they had it as this runs only once every 24 hours.
     */
    if (role) role.members.forEach((member) => member.roles.remove(role));

    const results = await db
      .select()
      .from(discordMembers)
      .where(isNotNull(discordMembers.birthday));
    results.forEach(async (result) => {
      const now = new Date();
      const nowYear = now.getFullYear();
      const nowMonth = now.getUTCMonth();
      const nowDate = now.getUTCDate();

      const birthdayYear = result.birthday!.getFullYear();
      const birthdayMonth = result.birthday!.getUTCMonth();
      const birthdayDate = result.birthday!.getUTCDate() - 1;

      if (nowMonth === birthdayMonth && nowDate === birthdayDate) {
        const member = await guild.members.fetch(result.discordId).catch(() => null);
        if (!member) return;

        const birthdayMsg = await fs.readFile(
          path.join(this.client.messagesDir, 'birthday.md'),
          { encoding: 'utf-8' }
        );

        if (role) await member.roles.add(role);

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
