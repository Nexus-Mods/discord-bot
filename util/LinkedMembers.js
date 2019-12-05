const Discord = require("discord.js");
const Enmap = require("enmap");
const nexusAPI = require('./../nexus-discord.js');

let NexusModsUsers = initalise();

function initalise() {
    //Set up the database for use.
    if (!NexusModsUsers) {
        NexusModsUsers = new NexusModsDiscordUsers()
        NexusModsUsers.defer.then(() => {
            console.log(`Database loaded with ${NexusModsUsers.count} members.`);
            return NexusModsUsers;
        });
    }
    
    return NexusModsUsers;
}

//Set up the enmaps.
linkedAccounts = new Enmap({
    name: "NexusModsDiscordUsers",
    autoFetch: true,
    fetchAll: true
  });

linkedAccounts.defer.then( () => 
  //exports.linkedAccounts.deleteall()
  console.log(`Database loaded with ${exports.linkedAccounts.count} members.`)
);

//Nexus Mods members database 
class NexusModsDiscordUsers {
    constructor() {
        this.members = new Enmap({
            name: "NexusModsDiscordUsers",
            autoFetch: true,
            fetchAll: true
          });
        this.members.defer.then( () => console.log(`Database loaded with ${exports.linkedAccounts.count} members.`) );
    }

    async findMember(query, client, message) {
        //Pass a string with the search query, the client and the message.
        if (typeof query !== 'string') return undefined;
        //Attempt to find a user by Discord Tag
        const userTag = query.indexOf("#") ? query.substring(0, query.indexOf("#")+5) : query.split(" ")[0]; //if tag has several words.
        const taggedMember = await client.users.find(u => u.tag.toLowerCase() === userTag.toLowerCase());

        //Attempt to find a user by ping.
        const discordMember = await message.mentions.members.first() //First ping
            || message.guild.members.find(m => m.displayName.toLowerCase() === query.toLowerCase()) //Find by display name
            || taggedMember && message.guild.members.find(m => m.id === taggedMember.id) //
            || message.guild.members.find(m => m.id === query.split(" ")[0]) //Find by Discord ID

        //Attempt to find the user in our database
        const nexusUser = discordMember 
            ? this.members.get(discordMember.id) //Get from DB by Discord ID
            : this.members.find(m => m.nexusName.toLowerCase() === args.join(" ").toLowerCase()); //Find by name.
        if (!discordMember) discordMember = message.guild.members.has(this.members.findKey(val => val === nexusUser)) 
            ? message.guild.members.get(this.members.findKey(val => val === nexusUser)) 
            : undefined;

        return {discord: discordMember, nexus: nexusUser};
    }

    getMemberDiscord(discordId) {
        //We know who we're looking for based on Discord ID. 
        if (typeof discordId !== 'string') return undefined;
        return this.members.get(discordId);
    }

    getMemberNexus(nexusName) {
        //Lookup by Nexus Mods user name. 
        return this.members.find(m => m.nexusName.toLowerCase() === nexusName.toLowerCase());
    }

    updateMember(discordId, newMember) {
        //Add a new user or update the record if they already exist. 
        this.members.get(discordId) ? this.updateMember(discordId, newMember) : this.members.set(discordId, newMember);
        return true;
    }

    removeMember(discordId) {
        //Delete a member.
        if (this.members.get(discordId)) {
            this.members.delete(discordId);
            return true;
        }
        else return false;
        
    }
}


//Classes for the linked members.

class LinkedMember {
    constructor({
        id, 
        nexusID, 
        nexusName, 
        avatarURL, 
        apikey, 
        nexusSupporter, 
        nexusPremium, 
        nexusModAuthor, 
        nexusModDownloadTotal, 
        serversLinked, 
        mods, 
        lastupdate 
    }) {
        this.id = id;
        this.nexusID = nexusID;
        this.nexusName = nexusName;
        this.avatarURL = avatarURL;
        this.apikey = apikey;
        this.nexusSupporter = nexusSupporter;
        this.nexusPremium = nexusPremium;
        this.nexusModAuthor = nexusModAuthor;
        this.nexusModDownloadTotal = nexusModDownloadTotal;
        this.serversLinked = serversLinked;
        this.mods = mods;
        this.lastupdate = lastupdate;
    }

    getDiscordUser(client) {
        if (!this.id) return undefined;
        return client.users.get(user.id === this.id);
    }

    isAPIKeyValid() {
        if (!this.apikey) return false;
        return nexusAPI.validate(apikey);
    }

    isPremium() {
        return this.nexusPremium;
    }

    isSupporter() {
        return this.nexusSupporter;
    }

    getServers() {
        return this.serversLinked;
    }

    addLinkedServer(serverId) {
        if (!this.serversLinked) this.serversLinked = [];
        return (this.serversLinked.indexOf(serverId) == -1) ? this.serversLinked.push(serverId) : false;
    }

    removeLinkedServer(serverId) {
        if (this.serversLinked.indexOf(serverId) !== -1) {
            this.serversLinked.splice(this.serversLinked.indexOf(serverId), 1);
            return true;
        }
        else return false;
    }
    
    getMods() {
        return this.mods;
    }

    addMod(mod) {
        const linkedMod = new LinkedMod(mod);
        if (!this.mods) this.mods = [];
        if (!this.mods.find(m => m === linkedMod)) this.linkedMod.push()
        else {
            const index = this.mods.indexOf(linkedMod);
            mods[index] = linkedMod;
        }
        return true;
    }

    removeMod(mod) {
        const index = this.mods.indexOf(mod);
        if (index === -1) return false;
        this.mods[index] = undefined;
        this.mods.filter(m => m !== undefined);
        return true;
    }

    updateMods(client) {
        if (!this.mods) return;
        this.mods.forEach(mod => {
            try {
                //Update the mod name.
                const newData = await nexusAPI.modInfo(this.getDiscordUser(client), mod.domain, mod.modid);
                if (newData.available === false) return new Error(`Could not update ${mod.name} for user ${this.nexusName} as it is unavailable.`);
                (newData.name !== this.name) ? this.name =newData.name : undefined;

                //Update the download count.
                const oldDownloads = mod.downloads;
                const downloadCount = await nexusAPI.getDownloads(this.getDiscordUser(client), mod.domain, mod.modid).totalDownloads;
                if (!downloadCount || !parseInt(downloadCount)) return new Error(`Could not update download count for ${mod.name} for user ${this.nexusName}. getDownloads returned ${downloadCount}`);
                console.log(`Updated download count on ${mod.name} for ${this.nexusName}`);
                mod.downloads = downloadCount;
                //Update the download count.
                this.nexusModDownloadTotal += (mod.downloads - oldDownloads)
            }
            catch(err) {
                console.log(`Error at updateMods for ${this.nexusName}`, err);
            }
        });
    }
}

class LinkedMod {
    constructor({name, downloads, game, domain, modid, url}) {
        this.name = name;
        this.downloads = downloads;
        this.game = game;
        this.domain = domain;
        this.modid = modid;
        this.url = url;
    }
}

exports = { NexusModsUsers, LinkedMember };