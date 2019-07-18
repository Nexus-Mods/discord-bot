//Commands for interacting with the Nexus Mods API. 
const requestPromise = require('request-promise-native'); //For making API requests
const link = require('./commands/link.js'); //Contains saved users
const serverConfig = require('./serverconfig.json') //For server specific settings.
const nexusAPI = "https://api.nexusmods.com/" //for all regular API functions
const nexusSearchAPI ="https://search.nexusmods.com/mods"; //for quicksearching mods
const requestHeader = {
    "Application-Name": "Nexus Mods Discord Bot",
    "Application-Version": 1.0,
    "apikey": "" 
}


//Pass the Discord user so we can grab their API key
exports.games = async  (user, bUnapproved) => {
    const linkedAccounts = link.linkedAccounts
    var apiKey = linkedAccounts.has(user.id) ? linkedAccounts.get(user.id).apikey : undefined
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.")
    requestHeader.apikey = apiKey
    try {
        var gameList = await requestPromise({url: nexusAPI+"/v1/games", headers: requestHeader, qs: {include_unapproved: bUnapproved}})
        return JSON.parse(gameList)

    }
    catch (err) {
        throw new Error(`API Error: Nexus Mods API responded with ${err.statusCode}.`)
    }
}

exports.gameInfo = async (user, domainQuery) => {
    const linkedAccounts = link.linkedAccounts
    var apiKey
    if (linkedAccounts.has(user.id)) apiKey = linkedAccounts.get(user.id).apikey
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.")
    requestHeader.apikey = apiKey
    
    try {
        var response = await requestPromise({url: nexusAPI+"/v1/games/"+domainQuery, headers: requestHeader})
        var gameInfo = JSON.parse(response)
        return gameInfo
    }
    catch (err) {
        if (err.statusCode === 404) throw new Error(`${err.statusCode} - Game ${domainQuery} not found`)
        throw new Error(`API Error: Nexus Mods API responded with ${err.statusCode}.`)
    }
}

 
 exports.validate = async (apiKey) => {
   requestHeader.apikey = apiKey; //Append the user's API key to the request

   try {
    var response = await requestPromise({url : nexusAPI+"v1/users/validate.json", headers: requestHeader});
    return JSON.parse(response);
   }
   catch (err) {
       throw new Error(err.name + ': ' + err.message);
   }
}

exports.quicksearch = async (query, bIncludeAdult, gameID) => {
    console.log("Quicksearch for "+query.replace(/[^\w\s]/gi, ''))
    if (query.indexOf(`'s`) !== -1) query = query.replace(`'s`, '');
    if (query.indexOf(' ') !== -1) query = query.replace(/[^\w\s]/gi, '').split(' ').join(',')

    try {
        var searchResult = await requestPromise({url: nexusSearchAPI, qs: {terms: encodeURI(query), game_id: gameID, include_adult: bIncludeAdult}, timeout: 15000})
        var results = JSON.parse(searchResult)
        //console.log("Results:"+results.total)
        results.fullSearchURL = `https://www.nexusmods.com/search/?RH_ModList=nav:true,home:false,type:0,user_id:0,game_id:${gameID},advfilt:true,search%5Bfilename%5D:${query.split(',').join('+')},include_adult:${bIncludeAdult},page_size:20,show_game_filter:true`
        return results
    }
    catch (err) {
        //if (err.indexOf("CloudFlare")) throw new Error("Cloudflare error: Quicksearch request timed out.");
        console.log(err)
        throw new Error(err)
    }
}

exports.updatedMods = async (user, gameDomain, period = "1d") => {
    //console.log('Getting the latest mods for '+gameDomain);
    const linkedAccounts = link.linkedAccounts
    var apiKey
    if (linkedAccounts.has(user.id)) apiKey = linkedAccounts.get(user.id).apikey
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.")
    requestHeader.apikey = apiKey

    try {
        var updatedMods = await requestPromise({url: nexusAPI+'/v1/games/'+gameDomain+'/mods/updated.json', headers: requestHeader, qs: {period: period}});
        //console.log(`${JSON.parse(updatedMods).length} new mods returned for ${nexusAPI}/v1/games/${gameDomain}/mods/updated.json?period=1d`);
        return JSON.parse(updatedMods);
    }
    catch (err) {
        throw new Error(`API Error: Nexus Mods API responded with ${err.statusCode}.`)
    }
}

exports.modInfo = async (user, gameDomain, modID) => {
    const linkedAccounts = link.linkedAccounts
    var apiKey
    if (linkedAccounts.has(user.id)) apiKey = linkedAccounts.get(user.id).apikey
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.")
    requestHeader.apikey = apiKey

    try {
        var modData = await requestPromise({url: nexusAPI+'/v1/games/'+gameDomain+'/mods/'+modID+'.json', headers: requestHeader});
        return JSON.parse(modData);
    }
    catch (err) {
        throw new Error(`API Error: Nexus Mods API responded with ${err.statusCode}.`)
    }
}

exports.modChangelogs = async (user, gameDomain, modID) => {
    const linkedAccounts = link.linkedAccounts
    var apiKey
    if (linkedAccounts.has(user.id)) apiKey = linkedAccounts.get(user.id).apikey
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.")
    requestHeader.apikey = apiKey

    try {
        var modData = await requestPromise({url: nexusAPI+'/v1/games/'+gameDomain+'/mods/'+modID+'/changelogs.json', headers: requestHeader});
        return JSON.parse(modData);
    }
    catch (err) {
        throw new Error(`API Error: Nexus Mods API responded with ${err.statusCode}.`)
    }
}