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
import { createTransport } from 'nodemailer';
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

// Create the email client for sending email
const emailClient = createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  secure: false,
  tls: {
    rejectUnauthorized: false
  }
});

const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${process.env.REGISTRATION_FORM_ID}`;

export default class extends EventListener<'messageCreate'> {
  constructor() {
    super('messageCreate');
  }

  async execute(message: Message): Promise<void> {
    // Check if the message was sent in the intro channel
    if (message.channelId !== config.channelIds.intro) return;

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
      return console.warn(
        `Something went wrong fetching spreadsheet: [${response.status}] ${response.statusText}`
      );
    }

    // Check if there are responses in the spreadsheet
    const rows = response.data.values;
    if (!rows?.length) return console.warn('No responses found.');

    // Remove the headers
    rows.shift();

    // Check if username response match new discord user
    let foundUser = false;
    const username = message.member?.user.username;

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

    for (const row of rows) {
      // If match is not found then skip to the next iteration
      if (row[0] !== username) continue;

      const manualCheckUrl = `Not Found and require manual check at the Spreadsheet at ${SPREADSHEET_URL}`;
      const paymentProof = row[3] || manualCheckUrl;
      const favHusWaifu = row[row.length - 1] || manualCheckUrl;

      // Send email as reminder, send embed to verification channel and exit the loop
      await emailClient.sendMail({
        to: `${process.env.EMAIL_USER}`,
        from: `Spimy - <${process.env.EMAIL_USER}>`,
        subject: 'SUAC Kuu-Bot: New Discord Member',
        text: `A new member, ${username} , has joined the Discord server. Proof of payment: ${paymentProof}.`
      });

      // Add found fields to the embed
      embed.addFields(
        { name: 'Proof of Payment', value: paymentProof },
        { name: 'Favourite Husbando/Waifu', value: favHusWaifu }
      );

      // Send the embed with the buttons to the verification channel
      await verificationChannel.send({
        embeds: [embed],
        components: [actionRow]
      });

      foundUser = true;
      break;
    }

    // If no match was found in the spreadsheet, notify to do a manual check
    // This is because user might have not registered via the form but found a way into the server
    if (!foundUser) {
      const displayName = message.member?.user.displayName;
      const userId = message.member?.id;

      await emailClient.sendMail({
        to: `${process.env.EMAIL_USER}`,
        from: `Spimy - <${process.env.EMAIL_USER}>`,
        subject: 'SUAC Kuu-Bot: Discord Member with no Registration',
        html: `
        <p>
          A new user who has joined the Discord server without registering through the Google Forms has been detected.
          </br>
          A manual check is required to ensure this was not a mistake.
        
          </br>
          </br>

          <b>Discord User Information</b>
          </br>
          Username: ${username}
          </br>
          Display Name: ${displayName}
          </br>
          User ID: ${userId}
        </p>
      `
      });

      // Add additional information to the embed
      embed.addFields(
        {
          name: 'Issue',
          value: `User not found in [Spreadsheet](${SPREADSHEET_URL}). Manual check required.`
        },
        { name: 'Username', value: `${username}` },
        { name: 'Display Name', value: `${displayName}` },
        { name: 'User ID', value: `${userId}` }
      );

      // Send the embed with the buttons to the verification channel
      await verificationChannel.send({
        embeds: [embed],
        components: [actionRow]
      });
    }
  }
}
