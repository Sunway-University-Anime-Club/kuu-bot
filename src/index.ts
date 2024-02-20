import { Client, IntentsBitField } from 'discord.js';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { createTransport } from 'nodemailer';
import config from './config';

// Load environment variables
dotenv.config();

// Create the google client to access spreadsheets
const service = google.sheets('v4');
const googleClient = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  undefined,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/spreadsheets.readonly']
);

// Create the discord bot client
const client = new Client({
  intents: [
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.Guilds
  ]
});

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

client.on('ready', async (client) => {
  // Notify success for discord bot login
  console.log(`Logged in as ${client.user.username}`);
});

client.on('messageCreate', async (message) => {
  // Check if the message was sent in the intro channel
  if (message.channelId !== config.introChannelId) return;

  // Authenticate the google client
  const token = await googleClient.authorize();
  googleClient.setCredentials(token);

  // Fetch responses from the spreadsheet
  const response = await service.spreadsheets.values.get({
    auth: googleClient,
    spreadsheetId: process.env.REGISTRATION_FORM_ID,
    range: 'F:I'
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
  const username = message.member?.user.username;
  for (const row of rows) {
    if (row[0] !== username) continue;

    // If match is found then send email as reminder and exit the loop
    const paymentProof = row[3] || 'Not Found';
    emailClient.sendMail({
      to: `${process.env.EMAIL_USER}`,
      from: `Spimy - <${process.env.EMAIL_USER}>`,
      subject: 'SUAC Kuu-Bot: New Discord Member',
      text: `A new member, ${username} , has joined the Discord server. Proof of payment: ${paymentProof}.`
    });

    break;
  }
});

client.login(process.env.TOKEN);
