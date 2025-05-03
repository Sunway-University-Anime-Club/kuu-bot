import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  ComponentType,
  Message,
  ThreadAutoArchiveDuration,
  ThreadChannel,
  User
} from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import config from '../config';
import { Command, SlashCommand } from '../lib/abstract/commands';
import { KuuClient } from '../lib/client';

interface Prompt {
  message: string;
  answer: PromptAnswer;
  imagePath?: string;
}

const answers = ['Accepted', 'Needs Revision', 'Rejected'] as const;
type PromptAnswer = (typeof answers)[number];
type GroupName = 'green' | 'red' | 'blue' | 'light-purple';

const prompts: Prompt[] = [
  {
    message:
      "I bought paper plates and cups for the club's Christmas party. Receipt is attached below.",
    answer: 'Accepted',
    imagePath: 'TTIRASWRTAC/receipts/1.jpg'
  },
  {
    message:
      "I'm claiming RM66.24 for a meal I had while brainstorming club ideas alone.",
    answer: 'Rejected',
    imagePath: 'TTIRASWRTAC/receipts/2.jpg'
  },
  {
    message:
      'I want to be reimbursed RM38.16 for poster and card printing. The budget was approved last month.',
    answer: 'Accepted',
    imagePath: 'TTIRASWRTAC/receipts/3.jpg'
  },
  {
    message:
      'Bought a RM150 office chair. No receipt, but it was used once for a club event.',
    answer: 'Rejected',
    imagePath: 'TTIRASWRTAC/receipts/4.jpg'
  },
  {
    message:
      'I would like to request reimbursement for RM20 for birthday decorations for a member.',
    answer: 'Rejected',
    imagePath: 'TTIRASWRTAC/receipts/5.png'
  },
  {
    message:
      'Claiming RM50 for batteries and extension cords used during Clubs and Societies Fiesta.',
    answer: 'Accepted',
    imagePath: 'TTIRASWRTAC/receipts/6.jpg'
  },
  {
    message:
      'I lost the receipt but I bought snacks for the meeting yesterday. Can I still claim it?',
    answer: 'Needs Revision'
  },
  {
    message: 'I got a RM10 notebook for personal use at club meetings, can I claim it?',
    answer: 'Rejected',
    imagePath: 'TTIRASWRTAC/receipts/8.jpg'
  },
  {
    message: "Reimbursement request: RM40 for our event's performer's travel expenses.",
    answer: 'Accepted',
    imagePath: 'TTIRASWRTAC/receipts/9.jpg'
  },
  {
    message: "Here's a claim for RM80 on a gaming mouse I wanted to try during meetings.",
    answer: 'Rejected',
    imagePath: 'TTIRASWRTAC/receipts/10.jpg'
  },
  {
    message:
      "I've got a claim of RM27 for flyers. Receipt is missing, but it's from our regular printer.",
    answer: 'Needs Revision'
  },
  {
    message:
      'Claiming RM46 for coffee and drinks I bought for the event. Invoice attached.',
    answer: 'Accepted',
    imagePath: 'TTIRASWRTAC/receipts/12.jpg'
  },
  {
    message:
      "I'm submitting a claim for RM20. It's for a t-shirt I got at another club's event.",
    answer: 'Rejected',
    imagePath: 'TTIRASWRTAC/receipts/13.jpg'
  },
  {
    message:
      "I'd like to claim RM10 for change that I paid to a member looking to sign up but had no small notes. I have picture proof of the payment.",
    answer: 'Accepted',
    imagePath: 'TTIRASWRTAC/receipts/14.jpg'
  },
  {
    message:
      'Requesting RM30 reimbursement for an e-hailing ride to attend our meeting. No prior approval.',
    answer: 'Needs Revision',
    imagePath: 'TTIRASWRTAC/receipts/15.jpg'
  },
  {
    message:
      'I bought decorations for the bake sale that our club is participating in. The total was RM35.',
    answer: 'Accepted',
    imagePath: 'TTIRASWRTAC/receipts/16.jpg'
  },
  {
    message:
      "Claiming RM22 for a book I think is useful for our club's mission. No receipt.",
    answer: 'Needs Revision'
  },
  {
    message:
      "I'm claiming RM35 for event refreshments, can I use this receipt with the same amount but a different item?",
    answer: 'Needs Revision',
    imagePath: 'TTIRASWRTAC/receipts/18.jpg'
  },
  {
    message:
      "Requesting RM100 for an external speaker's fee. Signed and approved invoice attached.",
    answer: 'Accepted',
    imagePath: 'TTIRASWRTAC/receipts/19.jpg'
  },
  {
    message:
      'I have a receipt from buying prizes for an event 1 year ago, can I claim it now?',
    answer: 'Rejected',
    imagePath: 'TTIRASWRTAC/receipts/20.jpg'
  }
];

export default class extends Command<SlashCommand> {
  // Map to keep track of started members and their correct answers count
  private readonly startedGroups: Map<GroupName, number> = new Map<GroupName, number>();

  constructor(private client: KuuClient) {
    super({
      name: 'treasurer',
      description: 'Start a treasurer game for the event',
      options: [
        {
          name: 'group',
          description: 'The group to start the game for',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            {
              name: 'Green',
              value: 'green'
            },
            {
              name: 'Red',
              value: 'red'
            },
            {
              name: 'Blue',
              value: 'blue'
            },
            {
              name: 'Light Purple',
              value: 'light-purple'
            }
          ]
        }
      ]
    });
  }

  async execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<boolean> {
    let group: GroupName | undefined;

    try {
      await interaction.deferReply({ ephemeral: true });

      // Check if the interaction is in the correct channel and is a text channel
      if (interaction.channelId !== config.channelIds.event) return false;
      if (interaction.channel?.type !== ChannelType.GuildText) return false;

      // Get the group from the interaction options
      group = interaction.options.getString('group', true) as GroupName;

      // Check if the member is already in a thread
      if (this.startedGroups.has(group)) return false;

      // Set the thread to be private and only visible to the member who started it
      const thread = await interaction.channel.threads.create({
        name: `${group}'s game`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        type: ChannelType.PrivateThread,
        invitable: false
      });
      await thread.members.add(interaction.user.id).catch(console.error);

      // Send a message to the thread to notify the user that the game has started
      await this.handleGame(interaction.user, group, thread).catch(console.error);
      await interaction.editReply({
        content: `Your game has started in ${thread}.`
      });

      // Add the member to the started members map with 0 correct answers
      this.startedGroups.set(group, 0);
    } catch (err) {
      if (group) {
        // If the game failed, remove the member from the started groups
        this.startedGroups.delete(group);
      }
    }
    return true;
  }

  private async handleGame(
    user: User,
    group: GroupName,
    thread: ThreadChannel,
    promptIndex = 0
  ) {
    // Base case: if the prompt index is out of bounds, end the game
    if (promptIndex >= prompts.length) {
      const numCorrect = this.startedGroups.get(group) || 0;
      const points = this.calculatePoints(numCorrect);
      await thread.send({
        content: `Game over! You have completed all the prompts. You got **${numCorrect} correct answers**, earning **${points} point${
          points !== 1 ? 's' : ''
        }**.`
      });
      thread.setLocked(true);
      return;
    }

    // Get the current prompt
    const { message, imagePath } = prompts[promptIndex];

    // Add component row for the buttons
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...this.createButtons(user, promptIndex)
    );

    // Attach the receipt image if it exists
    const files: AttachmentBuilder[] = [];
    if (imagePath) {
      const receipt = await fs.readFile(path.join(this.client.eventsDir, imagePath));
      files.push(new AttachmentBuilder(receipt, { name: path.basename(imagePath) }));
    }

    // Send the message with the prompt and buttons
    const msg = await thread.send({
      content: message,
      files: files,
      components: [actionRow]
    });

    msg
      .awaitMessageComponent({ componentType: ComponentType.Button })
      .then((interaction) =>
        this.handleButtonClick(user, group, interaction, promptIndex, thread, msg)
      )
      .catch((err) => {
        // If the game crashed, remove the member from the started groups so they can start again
        this.startedGroups.delete(group);
        console.error(err);
      });
  }

  private createButtons(user: User, promptIndex: number) {
    const acceptButton = new ButtonBuilder()
      .setCustomId(`${user.id}-${promptIndex}-accepted`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success);

    const needsRevisionButton = new ButtonBuilder()
      .setCustomId(`${user.id}-${promptIndex}-revision`)
      .setLabel('Needs Revision')
      .setStyle(ButtonStyle.Secondary);

    const rejectButton = new ButtonBuilder()
      .setCustomId(`${user.id}-${promptIndex}-reject`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger);

    return [acceptButton, needsRevisionButton, rejectButton];
  }

  private async handleButtonClick(
    user: User,
    group: GroupName,
    interaction: ButtonInteraction,
    promptIndex: number,
    thread: ThreadChannel,
    message: Message
  ) {
    // Map the button ID to an expected answer
    const answerId = interaction.customId.split('-')[2];
    const answer: PromptAnswer =
      answerId === 'accepted'
        ? 'Accepted'
        : answerId === 'revision'
        ? 'Needs Revision'
        : 'Rejected';

    const expectedAnswer = prompts[promptIndex].answer;

    // Check if the answer is correct
    if (answer === expectedAnswer) {
      interaction.reply(`Correct! The answer was **${expectedAnswer}**.`);

      // Increment the number of correct answers for the member
      this.startedGroups.set(group, (this.startedGroups.get(group) ?? 0) + 1);
    } else {
      interaction.reply(`Incorrect! The correct answer was **${expectedAnswer}**.`);
    }

    // Edit the message to remove the buttons after a selection is made
    await message.edit({
      content: message.content,
      files: message.attachments.map((attachment) => attachment),
      components: []
    });

    // Recursively call the handleGame function to continue the game
    this.handleGame(user, group, thread, promptIndex + 1);
  }

  private calculatePoints(correctAnswers: number): number {
    if (correctAnswers >= 16 && correctAnswers <= 20) return 4;
    if (correctAnswers >= 11 && correctAnswers <= 15) return 3;
    if (correctAnswers >= 6 && correctAnswers <= 10) return 2;
    if (correctAnswers >= 1 && correctAnswers <= 5) return 1;
    return 0;
  }
}
