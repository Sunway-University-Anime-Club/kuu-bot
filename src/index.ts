import { IntentsBitField } from 'discord.js';
import dotenv from 'dotenv';
import { KuuClient } from './lib/client';

// Load environment variables
dotenv.config();

// Create the discord bot client
const client = new KuuClient({
  intents: [
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.DirectMessages
  ]
});

client.login(process.env.TOKEN);
