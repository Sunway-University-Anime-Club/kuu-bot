import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  Message,
  TextChannel
} from 'discord.js';
import { google } from 'googleapis';
import fetch from 'node-fetch';
import config from '../config';
import { EventListener } from '../lib/abstract/events';
import { VerificationButtons } from '../lib/utils';

// Create the google client to access spreadsheets
const service = google.sheets('v4');
const googleClient = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  undefined,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/spreadsheets.readonly']
);

const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${process.env.REGISTRATION_FORM_ID}`;
const MEMBER_CHECK_API_URL = `${process.env.BACKEND_URL}/member`;

type Member = {
  proofOfPayment: string;
  favouriteCharacter: string;
};

type MemberSuccess = { isMember: boolean; member: Member };
type MemberError = { error: string };

export default class extends EventListener<'messageCreate'> {
  constructor() {
    super('messageCreate');
  }

  async execute(message: Message): Promise<void> {
    // Check if the message was sent in the intro channel
    if (message.channelId !== config.channelIds.intro) return;

    // Fetch the verification channel
    const verificationChannel = (await message.guild?.channels.fetch(
      config.channelIds.verification
    )) as TextChannel;

    // Set up the embed containing the necessary information
    const embed = new EmbedBuilder()
      .setAuthor({
        name: message.author.displayName,
        iconURL: message.author.displayAvatarURL()
      })
      .setColor(Colors.Orange)
      .setDescription(message.content)
      .setTimestamp();

    // Verify user and give them the appropriate roles
    const verifyButton = new ButtonBuilder()
      .setCustomId(`${VerificationButtons.VEFIFY}-${message.author.id}`)
      .setLabel('Verify')
      .setStyle(ButtonStyle.Success);

    // Reject user to automatically kick the user out
    const rejectButton = new ButtonBuilder()
      .setCustomId(`${VerificationButtons.REJECT}-${message.author.id}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger);

    // Add component row for the verify and reject buttons
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      verifyButton,
      rejectButton
    );

    const memberWebsiteFetch = await this.isMemberWebsite(message);
    let member: Member | undefined;

    if (!memberWebsiteFetch || !memberWebsiteFetch.isMember) {
      const spreadsheet = await this.checkSpreadsheet(message, embed);

      function isError(data: any): data is { error: string } {
        return data && typeof data.error === 'string';
      }

      if (isError(spreadsheet) || !spreadsheet.isMember) {
        embed.addFields(
          {
            name: 'Issue',
            value: `User not found in [Spreadsheet](${SPREADSHEET_URL}). Manual check required.`
          },
          { name: 'Username', value: `${message.member?.user.username}` },
          { name: 'Display Name', value: `${message.member?.displayName}` },
          { name: 'User ID', value: `${message.member?.id}` }
        );
      } else {
        member = spreadsheet.member;
      }
    } else {
      member = memberWebsiteFetch.member;
    }

    if (member) {
      embed.addFields(
        { name: 'Proof of Payment', value: member.proofOfPayment },
        { name: 'Favourite Husbando/Waifu', value: member.favouriteCharacter }
      );
    }

    // Send the embed with the buttons to the verification channel
    await verificationChannel.send({
      content: `<@&${config.roleIds.itManager}>`,
      embeds: [embed],
      components: [actionRow]
    });
  }

  async isMemberWebsite(message: Message) {
    console.log('checking website');

    return await fetch(MEMBER_CHECK_API_URL, {
      method: 'POST',
      body: JSON.stringify({ discordId: message.member?.id }),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.BACKEND_API_KEY
      }
    }).then(async (response) => {
      const data = (await response.json()) as MemberSuccess | MemberError;
      if (response.ok) return data as MemberSuccess;

      console.error((data as MemberError).error);
      return null;
    });
  }

  async checkSpreadsheet(message: Message, embed: EmbedBuilder) {
    console.log('checking spreadsheet');

    // Authenticate the google client
    const token = await googleClient.authorize();
    googleClient.setCredentials(token);

    // Fetch responses from the spreadsheet
    const response = await service.spreadsheets.values.get({
      auth: googleClient,
      spreadsheetId: process.env.REGISTRATION_FORM_ID,
      range: config.spreadsheetColumns
    });

    // Check if fetch request was successful
    if (response.status !== 200) {
      console.warn(
        `Something went wrong fetching spreadsheet: [${response.status}] ${response.statusText}`
      );
      return { error: response.statusText };
    }

    // Check if there are responses in the spreadsheet
    const rows = response.data.values;
    if (!rows?.length) {
      console.warn('No responses found.');
      return { error: 'No responses found' };
    }

    // Remove the headers
    rows.shift();

    let foundUser;
    const username = message.member?.user.username;

    /**
     * When there is no match found, the loop will continue until the end and exit
     *
     * When there is a match found, the loop will return early and thus pop the function
     * from the call stack.
     *
     * TLDR: anything after the loop will be ignored if there is a match.
     */
    for (const row of rows) {
      // If match is not found then skip to the next iteration
      if (row[0] !== username) continue;
      foundUser = row;
    }

    if (typeof foundUser !== 'undefined') {
      const manualCheckUrl = `Not Found and require manual check at the Spreadsheet at ${SPREADSHEET_URL}`;
      const proofOfPayment = foundUser[3] || manualCheckUrl;
      const favouriteCharacter = foundUser[foundUser.length - 1] || manualCheckUrl;

      const successMember: MemberSuccess = {
        isMember: true,
        member: {
          proofOfPayment,
          favouriteCharacter
        }
      };
      return successMember;
    } else {
      const failMember: MemberSuccess = {
        isMember: false,
        member: {
          proofOfPayment: '',
          favouriteCharacter: ''
        }
      };
      return failMember;
    }
  }
}
