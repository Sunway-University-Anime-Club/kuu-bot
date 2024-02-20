import { Client, GuildMember, IntentsBitField } from 'discord.js';
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
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.DirectMessages
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

/**
 * Calculate when to kick a user
 * If timeout is greater than kick timeout in config, user will be immediately kicked
 *
 * @param {GuildMember} member
 * @param {number} [timeout=config.kickTimeout]
 * @return {*}
 */
function kickControl(member: GuildMember, timeout: number = config.kickTimeout): any {
  const reason = 'User stuck with "Intro Arc" role for too long.';

  // Kick user if the timeout is greater than the kick timeout
  if (timeout > config.kickTimeout) {
    return notifyKick(member).then(async () => await member.kick(reason));
  }

  setTimeout(async () => {
    // No need to kick user if user no longer has intro role
    if (!member.roles.cache.has(config.introRoleId)) return;

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
async function notifyKick(member: GuildMember) {
  await member
    .send({
      content:
        'Yo dazo! You have been automatically kicked for not having been verified by our committee. Please reach out to @officialspimy if you think this was a mistake! Ja ne~'
    })
    .catch((_) => {}); // Do nothing if error (likely means user disabled DMs)
}

client.on('ready', async (client) => {
  client.guilds.fetch(config.guildId).then(async (guild) => {
    // Fetch all members in the guild
    await guild.members.fetch();

    // Get the current time in timestamp format
    const now = new Date().getTime();

    // Get all members with intro role to control user kick
    guild.roles.fetch(config.introRoleId).then((role) => {
      role?.members.forEach((member) => {
        kickControl(member, now - (member.joinedTimestamp ?? 0));
      });
    });
  });

  // Notify success for discord bot login
  console.log(`Logged in as ${client.user.username}`);
});

client.on('guildMemberAdd', async (member) => {
  member.roles
    .add(config.introRoleId)
    .then(kickControl)
    .catch(() => kickControl(member)); // In case of any errors
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
  let foundUser = false;
  const username = message.member?.user.username;

  for (const row of rows) {
    if (row[0] !== username) continue;

    // If match is found then send email as reminder and exit the loop
    const paymentProof =
      row[3] ||
      `Not Found and require manual check at the Spreadsheet at https://docs.google.com/spreadsheets/d/${process.env.REGISTRATION_FORM_ID}.`;

    await emailClient.sendMail({
      to: `${process.env.EMAIL_USER}`,
      from: `Spimy - <${process.env.EMAIL_USER}>`,
      subject: 'SUAC Kuu-Bot: New Discord Member',
      text: `A new member, ${username} , has joined the Discord server. Proof of payment: ${paymentProof}.`
    });

    foundUser = true;
    break;
  }

  // If no match was found in the spreadsheet, notify to do a manual check
  // This is because user might have not registered via the form but found a way into the server
  if (!foundUser) {
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
          Display Name: ${message.member?.user.displayName}
          </br>
          User ID: ${message.member?.id}
        </p>
      `
    });
  }
});

client.login(process.env.TOKEN);
