const Discord = require('discord.js');
const { getAllServers, getSavedNews, updateSavedNews } = require('../api/bot-db.js');
const nexusNewsRSS = 'https://www.nexusmods.com/rss/news';
const Parser = require('rss-parser');
const parser = new Parser({
    customFields: {
      item:['nexusmods:plain_description'],
    }
  });
let client;

//RSS feed watcher
exports.run = async (cl) => {
    client = cl;
    await checknews()
    const delay = (1000*60*60*3) //3 hours 
    setInterval(checknews, delay);
    console.log((new Date())+" - newsUpdate set for 3 hours time.");
}

async function checknews(domain = "") {
    const checkUrl = domain ? `https://www.nexusmods.com/${domain}/rss/news` : nexusNewsRSS;

    try {
        const latestNews = await parser.parseURL(checkUrl);
        const latestPost = latestNews.items[0];

        let storedNews = await getSavedNews();

        if (storedNews.title === latestPost.title || storedNews.date === latestPost.date) return console.log((new Date().toLocaleString())+" - No news updates.");

        if (!domain) await updateSavedNews({title: latestPost.title, date: latestPost.pubDate});

        const newsEmbed = new Discord.RichEmbed()
        .setTitle(latestPost.title)
        .setURL(latestPost.link)
        .setImage(latestPost.enclosure.url)
        .setDescription(latestPost['nexusmods:plain_description'].substr(0,250)+"...")
        .setFooter(`${latestPost.categories.toString()} - ${latestPost.author}`,client.user.avatarURL)
        .setTimestamp(latestPost.pubDate)
        .setColor(0xda8e35);

        console.log(`${new Date()} - Publishing ${newestPost.title} to news channel.`);

        // POST THE EMBED OUT TO THE NEWS CHANNEL(S)

        const allServers = await getAllServers();
        for (const server of allServers) {
            if (!server.news_channel) return;
            const discordGuild = client.guilds.find(g => g.id === server.id);
            const newsChannel = discordGuild ? discordGuild.channels.find(c => c.id) : undefined;
            if (newsChannel) newsChannel.send(newsEmbed).catch(console.error);
        }

    }
    catch(err) {
        console.error("Error getting news updates.",err);
    }  
}