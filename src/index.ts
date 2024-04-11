import { IntentsBitField } from 'discord.js';
import dotenv from 'dotenv';
import { KuuClient } from './client';

// Load environment variables
dotenv.config();

// Create the discord bot client
const client = new KuuClient({
  root: __dirname,
  intents: [
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.DirectMessages
  ]
});

client.login(process.env.TOKEN);
export { client };
