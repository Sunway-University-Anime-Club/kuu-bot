import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  Interaction
} from 'discord.js';
import config from '../config';
import { EventListener } from '../lib/abstract/events';
import { KuuClient } from '../lib/client';
import { VerificationButtons } from '../lib/utils';

export default class extends EventListener<'interactionCreate'> {
  constructor(private client: KuuClient) {
    super('interactionCreate');
  }

  async execute(interaction: Interaction): Promise<any> {
    // Handle command interactions
    if (interaction.isChatInputCommand()) {
      try {
        return this.handleCommandInteraction(interaction);
      } catch (err) {
        return console.error(err);
      }
    }

    // Handle button interactions
    if (interaction.isButton()) {
      return this.handleButtonInteraction(interaction);
    }
  }

  async handleButtonInteraction(interaction: ButtonInteraction) {
    if (interaction.channelId !== config.channelIds.verification) return;

    // Get button type
    const [btnType, userId] = interaction.customId.split('-');

    // Get member to verify or reject
    const member = await interaction.guild?.members.fetch(userId);

    if (!member) {
      await interaction.reply({
        content: 'The member could not be found.',
        ephemeral: true
      });
      return;
    }

    // Get the message and embed
    const message = interaction.message;
    const embed = message.embeds.shift()!;
    const embedData = embed.toJSON();

    // Handle verify button press
    if (btnType === VerificationButtons.VEFIFY) {
      // Remove the intro arc role
      await member.roles.remove(config.roleIds.intro).then(async () => {
        // Add the freshie and member role
        await member.roles.add(config.roleIds.freshie);
        await member.roles.add(config.roleIds.member);

        // Show feedback for successful verification
        await interaction.reply({
          content: `Successfully verified ${member.user.displayName}.`,
          ephemeral: true
        });

        // Update the embed colour and remove the buttons
        embedData.color = Colors.Green;
        await message.edit({ embeds: [embedData], components: [] });
      });
      return;
    }

    // Handle reject button press
    if (btnType === VerificationButtons.REJECT) {
      await member.kick('Discord membership rejected.').then(async () => {
        // Show feedback for successful verification
        await interaction.reply({
          content: `Successfully rejected ${member.user.displayName}.`,
          ephemeral: true
        });

        // Update the embed colour and remove the buttons
        embedData.color = Colors.Red;
        await message.edit({ embeds: [embedData], components: [] });

        // Let user know they were kicked
        await member
          .send({
            content:
              'Yo dazo! You have been kicked because you were rejected from the Discord server. Please reach out to @officialspimy if you think this was a mistake! Ja ne~'
          })
          .catch((_) => {});
      });
      return;
    }
  }

  async handleCommandInteraction(interaction: ChatInputCommandInteraction) {
    const command = this.client.slashCommands.get(interaction.commandName);
    const embed = new EmbedBuilder().setColor('Red');

    /**
     * If command is not found, let user know.
     * Realistically this should never happen but just in case of edge cases.
     * * In theory, this could happen if the command was deleted but is still registered on Discord's side.
     * ! NOTE: I have not implemented a way to unregister commands on Discord's side (yet).
     */
    if (!command) {
      embed.setDescription(
        `There were no command matching ${interaction.commandName} found.`
      );
      return await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    try {
      const success = await command.execute(interaction);
      if (success) return;

      embed.setDescription('Please check the command descriptions for proper usage.');
      return await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } catch (error) {
      console.error(error);
      embed.setDescription('Something went wrong while trying to execute this command.');

      return await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  }
}
