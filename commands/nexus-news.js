const Discord = require('discord.js')
const index = require('../index.js');
const client = index.clientshared;
const Enmap = require('enmap');
const NexusNews = new Enmap ({name: "Nexus Mods News"})
const serverConfig = require("../serverconfig.json");
const Parser = require('rss-parser');
let parser = new Parser({
    customFields: {
      item:['nexusmods:plain_description'],
    }
  });

//RSS feed watcher
client.once("ready", async () => {

    await checknews()
    const delay = (1000*60*60*3) //3 hours 
    const newsUpdate = setInterval(checknews, delay)
    console.log((new Date())+" - newsUpdate set for 3 hours time.")
})

async function checknews(delay) {
    try {
        var latestNews = await parser.parseURL('https://www.nexusmods.com/rss/news')
        var newsArticles = latestNews.items
        var newestPost = newsArticles[0]

        var storedArticle = await NexusNews.get('newStory')

        if (storedArticle === newestPost.link) return console.log((new Date())+" - No news updates.")

        var featureEmbed = new Discord.RichEmbed()
        .setTitle(newestPost.title)
        .setURL(newestPost.link)
        .setImage(newestPost.enclosure.url)
        .setDescription(newestPost['nexusmods:plain_description'].substr(0,250)+"...")
        .setFooter(`${newestPost.categories.toString()} - ${newestPost.author}`,client.user.avatarURL)
        .setTimestamp(newestPost.pubDate)
        .setColor(0xda8e35)

        console.log(`${new Date()} - Publishing ${newestPost.title} across linked servers with a new channel.`)
        
        NexusNews.set('newStory',newestPost.link)
        
        var iTotalServers = serverConfig.length
        for (i=0; i < iTotalServers; i++) {
            var serverSettings = serverConfig[i]
            if (!serverSettings || !serverSettings.announcementChannel) return //no news channel configured
            var server = client.guilds.find(s => s.id === serverSettings.id)
            var newsChannel = server.channels.find(c => c.id === serverSettings.announcementChannel)
            newsChannel.send(featureEmbed).catch(console.error)
        }
        
    }
    catch (err) {
        console.error(err)
    }   
}