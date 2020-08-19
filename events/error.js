var retryInterval = undefined;
var myClient = undefined;
var Discord = require('discord.js');
require("dotenv").config();

module.exports = async (client, error) => {
  myClient = client
  console.error(`${new Date()} - The bot has encountered an error (error.js).\n${JSON.stringify(error.message,null,2)}`)
  if (client.status !== 5) return
  await client.login(process.env.TOKEN).catch((err) => {
    retryInterval = setInterval(retrylogin, 10000)
    console.error(`${new Date()} - Failed to reconnect, retry in 10 seconds. (error.js)`)
    })
}


async function retrylogin() {
  clearInterval(retryInterval)
  retryInterval = undefined
  if (myClient && myClient.status !== 5) {
    console.log(`${new Date()} - Reconnect success. (error.js)`)
  }
  else {
    try {
      if (!myClient) myClient = new Discord.Client()
      await myClient.login(process.env.TOKEN)
      console.log(`${new Date()} - Reconnect success. (error.js)`)
    }
    catch(err) {
      console.error(`${new Date()} - Reconnect failed, trying again in 10 seconds. (error.js).\n${err.message}`)
      if (!retryInterval) retryInterval = setInterval(retrylogin, 10000)
    }
  }
}