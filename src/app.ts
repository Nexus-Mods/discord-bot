import { DiscordBot } from './DiscordBot';

const oomHeapDump = require('node-oom-heapdump')({
    path: 'oomHeapdump'
});

require('dotenv').config();

const bot = DiscordBot.getInstance();

bot.connect();