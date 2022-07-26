import { DiscordBot } from './DiscordBot';

require('dotenv').config();

const bot = DiscordBot.getInstance();

bot.connect();