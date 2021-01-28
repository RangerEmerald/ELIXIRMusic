require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client({retryLimit: 10, shardCount: 3});

const { music } = require('./music/music.js');

const prefix = process.env.PREFIX;
const prefix2 = process.env.PREFIX2;

client.on('ready', () => {
    console.log(`${client.user.tag} has logged in`);
});

client.on('message', message => {
    if (message.author.bot) return; 
    else if (message.content.toLowerCase().startsWith(prefix2)) {
        const args = message.content.toLowerCase().slice(prefix2.length).split(" ");
        music(message, args, client, Discord);
    } else if (message.content.toLowerCase().startsWith(prefix)) {
        const args = message.content.toLowerCase().slice(prefix.length).split(" ");
        music(message, args, client, Discord);
    }
});

client.on('error', error => {
    message.channel.send("There was an error in getting that command back to you.");
    console.log(`An error has occured! --- ${error}`);
});

client.login(process.env.TOKEN);