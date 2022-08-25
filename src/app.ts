import { logMessage } from './api/util';
import { DiscordBot } from './DiscordBot';
import heapdump from 'heapdump'
import http from 'http';

require('dotenv').config();

const bot = DiscordBot.getInstance();
start();

async function start() {
    try {
        await bot.connect();
    }
    catch(err) {
        logMessage('Failed to connect Discord bot', err, true);
        process.exit();
    }

    try {
        await bot.setupInteractions();
    }
    catch(err) {
        logMessage('Failed to set up Discord bot interactions', err, true);
        process.exit();
    }
}

const requestLogs: { url: string | undefined, date: Date }[] = [];
const server = http.createServer((req, res) => {
    if (req.url === '/heapdump') {
        heapdump.writeSnapshot((err, filename) => {
            logMessage('Heapdump written: ', filename);
        })
    }
    requestLogs.push({ url: req.url, date: new Date() });
    res.end(JSON.stringify(requestLogs));
});

server.listen(3000);
logMessage('Server listening to port 3000');
logMessage(`Heapdump enabled. Run "kill -USR2 ${process.pid} or send a request to heapdump to generate a heapdump.`);