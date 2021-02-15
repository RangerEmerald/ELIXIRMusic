require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client({retryLimit: 10, shardCount: 3});

const { music } = require('./music/music.js');
const { cache } = require('./SQLQueries/queries');

const prefix = process.env.PREFIX;
const prefix2 = process.env.PREFIX2;

client.on('ready', () => {
    cache();
    console.log(`${client.user.tag} has logged in`);
});

client.on('message', message => {
    if (message.author.bot) return; 
    else if (message.content.toLowerCase().startsWith(prefix2)) {
        const args = message.content.toLowerCase().replace(/\s+/g,' ').trim().slice(prefix2.length).split(" ");
        music(message, args, client, Discord);
    } else if (message.content.toLowerCase().startsWith(prefix)) {
        const args = message.content.toLowerCase().replace(/\s+/g,' ').trim().slice(prefix.length).split(" ");
        music(message, args, client, Discord);
    }
});

client.login(process.env.TOKEN);