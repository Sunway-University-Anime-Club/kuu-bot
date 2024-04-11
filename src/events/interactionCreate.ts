import { ButtonInteraction, Colors } from 'discord.js';
import { client } from '..';
import config from '../config';
import { VerificationButtons } from '../utils';

client.on('interactionCreate', async (interaction) => {
  // If the interaction is not a button press, ignore
  if (!(interaction instanceof ButtonInteraction)) return;

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
    await member.roles.remove(config.introRoleId).then(async () => {
      // Add the freshie and member role
      await member.roles.add(config.freshieRoleId);
      await member.roles.add(config.memberRoleId);

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
});