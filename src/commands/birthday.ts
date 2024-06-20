import {
  APIEmbedField,
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import config from '../config';
import { Command, SlashCommand } from '../lib/abstract/commands';
import { KuuClient } from '../lib/client';

export default class extends Command<SlashCommand> {
  constructor(private client: KuuClient) {
    super({
      name: 'birthday',
      description: 'Birthday commands',
      options: [
        {
          name: 'set',
          description:
            'Set birthday of a member, defaults to the member running the command',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'date',
              description: 'Birthday (e.g., 2003-01-30 or 01-30) [YYYY-MM-DD / MM-DD]',
              type: ApplicationCommandOptionType.String,
              required: true
            },
            {
              name: 'member',
              description: 'Admins only: set birthday for another member',
              type: ApplicationCommandOptionType.Mentionable
            }
          ]
        },
        {
          name: 'unset',
          description:
            'Unset birthday of a member, defaults to the member running the command',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'member',
              description: 'Admins only: unset birthday for another member',
              type: ApplicationCommandOptionType.Mentionable
            }
          ]
        },
        {
          name: 'upcoming',
          description: 'List of the next upcoming 10 birthdays on the server.',
          type: ApplicationCommandOptionType.Subcommand
        }
      ]
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<boolean> {
    const subcommand = interaction.options.getSubcommand();

    // prettier-ignore
    switch (subcommand) {
      case 'set': return await this.setBirthday(interaction);
      case 'unset': return await this.unsetBirthday(interaction);
      case 'upcoming': return await this.upcomingBirthdays(interaction);
    }

    return true;
  }

  private async setBirthday(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<boolean> {
    const dateString = interaction.options.getString('date', true);
    const birthday = this.getDate(dateString);
    if (!birthday) return false;

    const embed = new EmbedBuilder();
    const hasBirthYear = dateString.split('-').length === 3;

    let member = interaction.options.getMember('member');
    if (!member) member = interaction.member;
    const referrer = member.id === interaction.member.id ? 'your' : `${member}'s`;

    const success = this.client.birthdayManager.setBirthday(
      member.id,
      birthday,
      hasBirthYear
    );
    if (!success) {
      embed
        .setColor('Red')
        .setDescription('Yo dazo! Something went wrong and could not set birthday.');

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

      return true;
    }

    const thumbsUp = await interaction.guild.emojis
      .fetch(config.emojiIds.satania_thumbs_up)
      .then((e) => e.toString())
      .catch(() => ':thumbsup:');

    embed
      .setColor('Orange')
      .setDescription(
        `Thank you for telling me ${referrer} birthday dazo! I have now remebered it! ${thumbsUp}`
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: false
    });

    return true;
  }

  private async unsetBirthday(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<boolean> {
    let member = interaction.options.getMember('member');
    if (!member) member = interaction.member;

    // For grammar purposes, we set the right nouns to use in the messages
    let firstMention = `${member}'s`;
    let [possessiveNoun, objectiveNoun] = [`their`, 'them'];
    let command = '`/birthday set <date> [member]`';

    if (member.id === interaction.member.id) {
      firstMention = 'your';
      [possessiveNoun, objectiveNoun] = [`your`, 'you'];
      command = '`/birthday set <date>`';
    }

    const embed = new EmbedBuilder();

    if (!(await this.client.birthdayManager.hasSetBirthday(member.id))) {
      const breakdown = await interaction.guild.emojis
        .fetch(config.emojiIds.kuuchan_breakdown)
        .then((e) => e.toString())
        .catch(() => ':sob:');

      const heart = await interaction.guild.emojis
        .fetch(config.emojiIds.irys_heart)
        .then((e) => e.toString())
        .catch(() => ':heart:');

      embed
        .setColor('Red')
        .setDescription(
          [
            `Yo dazo! You have never told me what ${firstMention} birthday is ${breakdown}\n`,
            `Just let me know what ${possessiveNoun} birthday is and I will remember it and even wish ${objectiveNoun} a happy birthday when the day comes! 🥳`,
            `You can let me know ${possessiveNoun} birthday by running: ${command}! ${heart}`
          ].join('\n')
        );

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

      return true;
    }

    const success = this.client.birthdayManager.unsetBirthday(member.id);
    if (!success) {
      embed
        .setColor('Red')
        .setDescription('Yo dazo! Something went wrong and could not unset birthday.');

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

      return true;
    }

    const thumbsUp = await interaction.guild.emojis
      .fetch(config.emojiIds.satania_thumbs_up)
      .then((e) => e.toString())
      .catch(() => ':thumbsup:');

    embed
      .setColor('Orange')
      .setDescription(
        [
          `Okay, I will forget about ${firstMention} birthday! ${thumbsUp}`,
          `If this was a mistake, you can tell me ${possessiveNoun} birthday again using ${command}!`
        ].join('\n')
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: false
    });

    return true;
  }

  private async upcomingBirthdays(
    interaction: ChatInputCommandInteraction<'cached'>
  ): Promise<boolean> {
    const birthdays = await this.client.birthdayManager.getUpcomingBirthdays();

    const fields: APIEmbedField[] = await Promise.all(
      birthdays.map(async (result) => {
        const member = await interaction.guild.members
          .fetch(result.discordId)
          .catch(() => 'Unknown Member');

        const age = result.hasBirthYear
          ? `(${this.client.birthdayManager.getAge(result.birthday!)})`
          : '';

        const name = this.client.birthdayManager.formatUpcomingBirthday(result.birthday!);
        const value = `${member} ${age}`;

        return { name, value };
      })
    );

    const embed = new EmbedBuilder()
      .setColor('Orange')
      .setTitle('Upcoming Birthdays')
      .setFields(
        fields.sort((a, b) => {
          const aa = a.name.split(' ');
          const bb = b.name.split(' ');
          return parseInt(aa[2]) - parseInt(bb[2]) || parseInt(aa[0]) - parseInt(bb[0]);
        })
      );

    interaction.reply({
      embeds: [embed],
      ephemeral: false
    });

    return true;
  }

  /**
   * Get the date string as as a Date object, accounting for timezone offsets.
   *
   * @private
   * @param {string} dateString - the date in the format YYYY-MM-DD or MM-DD
   * @return {*}  {(Date | null)} a Date object if the date string is valid, null otherwise
   */
  private getDate(dateString: string): Date | null {
    const date = new Date(dateString);
    const isValid = !isNaN(date.getTime());

    if (isValid) return new Date(date.getTime() - date.getTimezoneOffset());
    return null;
  }
}
