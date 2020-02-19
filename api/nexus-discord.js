//Commands for interacting with the Nexus Mods API. 
const requestPromise = require('request-promise-native'); //For making API requests
const nexusAPI = "https://api.nexusmods.com/"; //for all regular API functions
const nexusSearchAPI ="https://search.nexusmods.com/mods"; //for quicksearching mods
const nexusStatsAPI = "https://staticstats.nexusmods.com/live_download_counts/mods/"; //for getting stats by game.
const requestHeader = {
    "Application-Name": "Nexus Mods Discord Bot",
    "Application-Version": 2.0,
    "apikey": "" 
};


// Pass the user so we can grab their API key

let cachedGames; //cache the game list for 5 mins.

exports.games = async  (user, bUnapproved) => {
    const apiKey = user.apikey ? user.apikey : undefined;
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.");
    if (cachedGames && cachedGames.update && new Date().getTime() < cachedGames.update) return cachedGames.games;
    requestHeader.apikey = apiKey
    try {
        const gameList = await requestPromise({url: nexusAPI+"/v1/games", headers: requestHeader, qs: {include_unapproved: bUnapproved}})
        cachedGames = {games: JSON.parse(gameList), update: new Date().getTime() + (5*60*1000)};
        return cachedGames.games;
    }
    catch (err) {
        //console.log(err);
        throw new Error(`Nexus Mods API responded with ${err.statusCode} while fetching all games. Please try again later.`)
    }
}

exports.gameInfo = async (user, domainQuery) => {
    const apiKey = user.apikey ? user.apikey : undefined;
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.")
    requestHeader.apikey = apiKey
    
    try {
        const response = await requestPromise({url: nexusAPI+"/v1/games/"+domainQuery, headers: requestHeader})
        const gameInfo = JSON.parse(response)
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
    const response = await requestPromise({url : nexusAPI+"v1/users/validate.json", headers: requestHeader});
    return JSON.parse(response);
   }
   catch (err) {
       throw new Error(err.name + ': ' + err.message);
   }
}

exports.quicksearch = async (query, bIncludeAdult, gameID) => {
    // console.log("Quicksearch for "+query.replace(/[^\w\s]/gi, ''))
    if (query.indexOf(`'s`) !== -1) query = query.replace(`'s`, '');
    if (query.indexOf(' ') !== -1) query = query.replace(/[^\w\s]/gi, '').split(' ').join(',');

    try {
        const searchResult = await requestPromise({url: nexusSearchAPI, qs: {terms: encodeURI(query), game_id: gameID, include_adult: bIncludeAdult}, timeout: 15000});
        let results = JSON.parse(searchResult);
        //console.log("Results:"+results.total)
        results.fullSearchURL = `https://www.nexusmods.com/search/?RH_ModList=nav:true,home:false,type:0,user_id:0,game_id:${gameID},advfilt:true,search%5Bfilename%5D:${query.split(',').join('+')},include_adult:${bIncludeAdult},page_size:20,show_game_filter:true`
        return results;
    }
    catch (err) {
        if (err.message.toLowerCase().indexOf("cloudflare") !== -1) throw new Error("Cloudflare error: Quicksearch request timed out.");
        console.log(err);
        throw new Error(`Nexus Mods Search API responded with ${err.statusCode} while fetching results. Please try again later.`);
    }
}

exports.updatedMods = async (user, gameDomain, period = "1d") => {
    //console.log('Getting the latest mods for '+gameDomain);
    const apiKey = user.apikey ? user.apikey : undefined;
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.")
    requestHeader.apikey = apiKey

    try {
        const updatedMods = await requestPromise({url: nexusAPI+'/v1/games/'+gameDomain+'/mods/updated.json', headers: requestHeader, qs: {period: period}});
        //console.log(`${JSON.parse(updatedMods).length} new mods returned for ${nexusAPI}/v1/games/${gameDomain}/mods/updated.json?period=1d`);
        return JSON.parse(updatedMods);
    }
    catch (err) {
        throw new Error(`API Error: Nexus Mods API responded with ${err.statusCode}.`)
    }
}

exports.modInfo = async (user, gameDomain, modID) => {
    const apiKey = user.apikey ? user.apikey : undefined;
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.");
    requestHeader.apikey = apiKey

    try {
        const modData = await requestPromise({url: nexusAPI+'/v1/games/'+gameDomain+'/mods/'+modID+'.json', headers: requestHeader});
        return JSON.parse(modData);
    }
    catch (err) {
        throw new Error(`Nexus Mods API responded with ${err.statusCode} while fetching mod data. Please try again later.`)
    }
}

exports.modChangelogs = async (user, gameDomain, modID) => {
    const apiKey = user.apikey ? user.apikey : undefined;
    if (!apiKey) throw new Error("API Error 403: Please link your Nexus Mods account to your Discord in order to use this feature. See `!nexus link` for help.")
    requestHeader.apikey = apiKey

    try {
        const modData = await requestPromise({url: nexusAPI+'/v1/games/'+gameDomain+'/mods/'+modID+'/changelogs.json', headers: requestHeader});
        return JSON.parse(modData);
    }
    catch (err) {
        throw new Error(`API Error: Nexus Mods API responded with ${err.statusCode}.`)
    }
}

exports.getDownloads = async (user, gameDomain, gameId = -1, modID = -1) => {
    try {
        //console.log(`getDownloads for ${user.name}, domain ${gameDomain}, gameid ${gameId}, modId ${modID}`)
        if (gameId === -1) {
            const gameList = await exports.games(user, false);
            const game = gameList.find(g => g.domain_name == gameDomain);
            gameId = game ? game.id : -1;
        }
        if (gameId === -1) return new Error(`Could not resolve game ID for ${gameDomain}`);
        //Get the stats CSV for this game.
        const statsCSV = await requestPromise({url: `${nexusStatsAPI}${gameId}.csv`, encoding: 'utf8'});
        //Map the CSV into a JS Object.
        const gameStats = statsCSV.split(/\n/).map(
            row => {
                if (row === "") return; // There seems to be a blank row at the end of every CSV.
                const values = row.split(",");
                if (values.length !== 3) {
                    //Just in case we get some bad data. 
                    console.log(`Invalid row in CSV for ${gameDomain} (${gameId}): ${row} `);
                    return;
                }
                return {
                    id: parseInt(values[0]),
                    total_downloads: parseInt(values[1]),
                    unique_downloads: parseInt(values[2])
                }
            }
        ).filter(m => m !== undefined);
        //if we requested a specific mod, return the mod data.
        if (modID !== -1) {
            const modStat = gameStats.find(m => m.id === parseInt(modID))
            return modStat || {id: modID, total_downloads: 0, unique_downloads: 0}; //If the mod has never been downloaded it will return none.
        }
        //otherwise return the entire game.
        else return gameStats;
    }
    catch(err) {
        console.log(err);
        throw new Error(`Could not retrieve download data for ${gameDomain} ${modID} \n ${err}`);
    }

}