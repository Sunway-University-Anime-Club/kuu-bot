import { Client } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: []
});

client.login(process.env.TOKEN);
