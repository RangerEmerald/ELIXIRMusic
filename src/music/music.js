const ytdl = require('ytdl-core-discord');
const ytpl = require('ytpl')
const Youtube = require('simple-youtube-api');

let youtube = new Youtube(process.env.YOUTUBE_API_KEY);
let backupyoutube = new Youtube(process.env.BACKUP_YOUTUBE_API_KEY);

const { deletefrom, addDatabase, returnPlaylists, cacheQueue } = require('../SQLQueries/queries');
const { Queue } = require('./format');

const queue = new Map();
const messageCollectorMap = new Map();

async function isSavedPlaylist(key) {
    let characters = key.split("");
    let eachElement = {
        upperCase: 0,
        lowerCase: 0
    }

    for (i in characters) {
        if (characters[i].toLowerCase() === characters[i]) eachElement.lowerCase++;
        else if (characters[i].toUpperCase() === characters[i]) eachElement.upperCase++;
    }
    
    if (eachElement.lowerCase > 7 && eachElement.upperCase > 7 && eachElement.upperCase + eachElement.lowerCase == 24) return true;
    else return false;
}

async function messageEmbed(antispam, color, whatmsg, message, Discord) {
    if (!antispam) {
        const messageEmbed = new Discord.MessageEmbed() 
            .setColor(color)
            .setDescription(whatmsg)
        
        message.channel.send(messageEmbed);
    }
}

function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
      '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(str);
  }

async function playqueue(firstVideo, message, Discord, serverQueue, voiceChannel) {
    let song = {
        id: firstVideo.player_response.videoDetails.videoId,
        title: firstVideo.player_response.videoDetails.title,
        url: `https://www.youtube.com/watch?v=${firstVideo.player_response.videoDetails.videoId}`,
        slength: firstVideo.player_response.videoDetails.lengthSeconds,
        songauthor: firstVideo.player_response.videoDetails.author,
        channel: `https://www.youtube.com/channel/${firstVideo.player_response.videoDetails.channelId}`,
        live: firstVideo.player_response.videoDetails.isLiveContent,
        authorid: message.author.id,
        authortag: message.member.user.tag
    }

    if (!serverQueue.songs.length) {
        serverQueue.textChannel = message.channel;
        serverQueue.voiceChannel = voiceChannel;
        serverQueue.playing = true;
        serverQueue.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            serverQueue.connection = await connection;
            play(message.guild, serverQueue.songs[0], message, Discord);
        } catch (err) {
            console.log(`There was an error connecting in a voice channel --- ${err}`);
            return messageEmbed(false, "RED", "There was an error in connecting to a voice channel", message, Discord);
        }

    } else {
        serverQueue.songs.push(song);
        return messageEmbed(serverQueue.antispam, "GREEN", `**[${song.songauthor}](${song.channel}) | [${song.title}](${song.url})** has been added to the queue. [<@!${song.authorid}>]`, message, Discord)
    }
}

async function music(message, args, client, Discord) {
    let serverQueue = queue.get(message.guild.id);
    let unlowerArgs = message.content.replace(/\s+/g,' ').trim().split(" ").slice(1);
    let searchString = unlowerArgs.slice(1).join(" ");

    if (searchString.includes("<") || searchString.includes(">")) searchString = await searchString.replace(/[\<\>]/g, "");
    
    if (messageCollectorMap.get(message.author.id)) return;

    if (!serverQueue) {
        queue.set(message.guild.id, new Queue(null, null, null, [], 100, false, "none", false));
        serverQueue = queue.get(message.guild.id);
    }

    //*None-music affected commands here
    if (args[1] == "queue" || args[1] == "q" || args[1] == "savequeue" || args[1] == "sq" || args[1] == "savedplaylist" || args[1] == "sp" || args[1] == "deleteplaylist" || args[1] == "dp") {
        switch (args[1]) {
            case "queue":
            case "q":
                if (!serverQueue.songs.length) return messageEmbed(false, "RED", `There is nothing in the queue!`, message, Discord);
                let includesLive = false;
                let queueArray = [];
                let queuelength = 0;
                for (var i = 0; i < serverQueue.songs.length; i++) {
                    let songlength = new Date(serverQueue.songs[i].slength*1000).toISOString().substr(11, 8);
                    if (serverQueue.songs[i].live || (serverQueue.loop == "song" && !i)) {
                        songlength = "∞";
                        includesLive = true;
                    }
                    if (serverQueue.loop == "queue") includesLive = true;
                    queuelength += Number(serverQueue.songs[i].slength);
                    queueArray.push(`+ ${i+1}) ${serverQueue.songs[i].songauthor} | ${serverQueue.songs[i].title} - ${songlength} - ${serverQueue.songs[i].authortag}`);
                    if (i == 0) {
                        queueArray.pop();
                        queueArray.push(`+ ${i+1}) ${serverQueue.songs[i].songauthor} | ${serverQueue.songs[i].title} - ${songlength} - ${serverQueue.songs[i].authortag} <-- Current Song`);
                    }
                }
                let times = new Date(queuelength*1000).toISOString().substr(11, 8);
                if (includesLive) times = "∞";
                message.channel.send(`\`\`\`diff\n${queueArray.join("\n")}\n- This is the end of the queue! Do e.play [yt link] to add more songs! Loop is currently set to '${serverQueue.loop}'\n- The length of the queue is ${times} long\`\`\``);
                break;
            case "savedqueue":
            case "sq":
                if (!serverQueue.songs.length) return messageEmbed(false, "RED", `There is nothing in the queue!`, message, Discord);
                if (!args[2]) return messageEmbed(false, "RED", "You must include what you want to name this playlist!", message, Discord);
                let jsonqueue = [];
                let plname = unlowerArgs.slice(1).join(" ");
                for (i in serverQueue.songs) jsonqueue.push(serverQueue.songs[i].id);
                return addDatabase(message, plname, JSON.stringify(jsonqueue));
            case "savedplaylist":
            case "sp" :
                return returnPlaylists(message, Discord);
            case "deleteplaylist":
            case "dp":
                return deletefrom(unlowerArgs[1], message);
        }
    }
    
    //*Music affected Commands Under
    else if (args[1] == "play" || args[1] == "p" || args[1] == "pause" || args[1] == "paws" || args[1] == "resume" || args[1] == "res" || args[1] == "skip" || args[1] == "s" || args[1] == "disconnect" || args[1] == "d" || args[1] == "volume" || args[1] == "v" || args[1] == "loop" || args[1] == "l" || args[1] == "remove" || args[1] == "r" || args[1] == "antispam" || args[1] == "ap" || args[1] == "deletequeue" || args[1] == "dq") {
        if (serverQueue.playing && client.guilds.cache.get(message.guild.id).voice.channel && client.guilds.cache.get(message.guild.id).voice.channel.id != message.member.voice.channel.id) return messageEmbed(false, "RED", "You need to be in the same voice channel as me in order to use my commands!", message, Discord);
        else if ((args[1] == "resume" || args[1] == "res" || args[1] == "pause" || args[1] == "paws" || args[1] == "skip" || args[1] == "s") && (!serverQueue.songs.length || (!serverQueue.connection || !serverQueue.connection.dispatcher))) return messageEmbed(false, "RED", "There is nothing playing right now!", message, Discord);
        switch (args[1]) {
            case "play":
            case "p":
                const voiceChannel = message.member.voice.channel;
                if (!voiceChannel) return messageEmbed(false, "RED", "You must first be in a voice channel!", message, Discord);

                const permissions = voiceChannel.permissionsFor(message.client.user);
                if (!permissions.has('CONNECT')) return messageEmbed(false, "RED", "I do not have permission to connect to that voice channel!", message, Discord);
                else if (!permissions.has('SPEAK')) return messageEmbed(false, "RED", "I do not have permission to speak in that voice channel!", message, Discord);
                else if (!args[2]) return messageEmbed(false, "RED", `You need to include either a youtube link or the song name!`, message, Discord);
                
                let firstVideo = null;
                if (searchString.includes("youtube.com/playlist")) {
                    const playlist = await ytpl(searchString);
                    for (var i = 0; i < playlist.items.length; i++) {
                        let serverQueue = queue.get(message.guild.id);
                        await playqueue(await ytdl.getInfo(playlist.items[i].id), message, Discord, serverQueue, voiceChannel);
                    }
                    return;
                } else if (await isSavedPlaylist(searchString)) {
                    const result = cacheQueue.get(searchString);
                    if (result) {
                        const songs = JSON.parse(result.queue);
                        messageEmbed(false, "GREEN", `Now playing playlist **${result.name} | ${searchString}** saved by **${message.author.tag}**`, message, Discord);
                        for (i in songs) {
                            let serverQueue = queue.get(message.guild.id);
                            await playqueue(await ytdl.getInfo(songs[i]), message, Discord, serverQueue, voiceChannel);
                        }
                    } else return message.channel.send(`You don't own a playlist with the id \`${searchString}\`!`);
                } else if (validURL(searchString)){
                    firstVideo = await ytdl.getInfo(searchString);
                    await playqueue(firstVideo, message, Discord, serverQueue, voiceChannel);
                } else {
                    try {
                        messageCollectorMap.set(message.author.id, true);
                        const vidAr = [];
                        var videos = await youtube.searchVideos(searchString, 5);
                        for (var i = 0; i < 5; i++) {
                            let vid2 = await ytdl.getInfo(videos[i].id);
                            let slength = new Date(vid2.player_response.videoDetails.lengthSeconds*1000).toISOString().substr(11, 8);
                            if (vid2.player_response.videoDetails.isLiveContent) slength = "∞";
                            vidAr.push(`+ ${i+1}) ${vid2.player_response.videoDetails.author} | ${vid2.player_response.videoDetails.title} - ${slength}`);
                        }
                        message.channel.send(`\`\`\`diff\n${vidAr.join("\n")}\n-Type one of the numbers to pick a song. Type "stop" to stop.\`\`\``);
                        const collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 60000 });
                        await collector.on('collect', async message2 => {
                            if (message2.content.toLowerCase().startsWith("e.music")) messageEmbed(false, "RED", "You must either choose one of those numbers or type `stop` before you can do other commands", message, Discord);
                            else if (message2.content === "stop") collector.stop('reason');
                            else if (isNaN(message2.content)) messageEmbed(false, "RED", `You must choose one of those numbers!`, message2, Discord);
                            else if (0 >= message2.content || 5 < message2.content) messageEmbed(false, "RED", `You must choose a number between 1 and 5!`, message2, Discord);
                            else {
                                firstVideo = await ytdl.getInfo(videos[Number(message2.content)-1].id);
                                collector.stop('done');
                            }
                        });
                        collector.on('end', async (collected, reason) => {
                            messageCollectorMap.delete(message.author.id);
                            if (reason === "time") return messageEmbed(false, "ORANGE", "Closed due to time", message, Discord);
                            else if (reason === "done") {
                                playqueue(firstVideo, message, Discord, serverQueue, voiceChannel);
                            } else if (reason === "reason") return messageEmbed(false, "ORANGE", "Closed music selection", message, Discord);
                        });
                    } catch {
                        return messageEmbed(false, "RED", `I cannot find the video you are looking for!`, message, Discord);
                    }
                }
                break;
            case "pause":
            case "paws":
                if (!serverQueue.playing) return messageEmbed(false, "RED", `The music is already paused!`, message, Discord);
                serverQueue.playing = false;
                serverQueue.connection.dispatcher.pause();
                messageEmbed(serverQueue.antispam, "GREEN", `I have paused the music **[${serverQueue.songs[0].songauthor}](${serverQueue.songs[0].channel}) | [${serverQueue.songs[0].title}](${serverQueue.songs[0].url})** [<@!${serverQueue.songs[0].authorid}>]`, message, Discord);
                break;
            case "resume":
            case "res":
                if (serverQueue.playing) return messageEmbed(false, "RED", `Music is already playing!`, message, Discord);
                serverQueue.playing = true;
                serverQueue.connection.dispatcher.resume();
                messageEmbed(serverQueue.antispam, "GREEN", `Music resumed **[${serverQueue.songs[0].songauthor}](${serverQueue.songs[0].channel}) | [${serverQueue.songs[0].title}](${serverQueue.songs[0].url})** [<@!${serverQueue.songs[0].authorid}>]`, message, Discord);
                break;
            case "skip":
            case "s":
                if (!serverQueue.playing) return messageEmbed(false, "RED", `There is nothing playing right now!`, message, Discord);
                serverQueue.connection.dispatcher.end();
                messageEmbed(serverQueue.antispam, "GREEN", `I have skipped **[${serverQueue.songs[0].songauthor}](${serverQueue.songs[0].channel}) | [${serverQueue.songs[0].title}](${serverQueue.songs[0].url})** [<@!${serverQueue.songs[0].authorid}>]`, message, Discord);
                break;
            case "disconnect":
            case "d":
                serverQueue.voiceChannel.leave();
                messageEmbed(false, "GREEN", "Disconnected", message, Discord);
                break;
            case "volume":
            case "v":
                if (!args[2]) return messageEmbed(serverQueue.antispam, "GREEN", `The volume is at ${serverQueue.volume}/100`, message, Discord);
                if (isNaN(args[2]) || args[2] > 100 || args[2] < 0) return messageEmbed(false, "RED", `'${args[2]}' is either not a number or bigger than 100 or less than 0!`, message, Discord);
                serverQueue.volume = args[2];
                serverQueue.connection.dispatcher.setVolumeLogarithmic(args[2]/100);
                messageEmbed(false, "GREEN", `You have successfully set the volume to ${serverQueue.volume}/100`, message, Discord);
                break;
            case "loop":
            case "l":
                if (args[2] && (args[2] === "none" || args[2] === "queue" || args[2] === "song")) serverQueue.loop = args[2];
                else if (serverQueue.loop === "none") serverQueue.loop = "queue";
                else if (serverQueue.loop === "queue") serverQueue.loop = "song";
                else if (serverQueue.loop === "song") serverQueue.loop = "none";
                messageEmbed(false, "GREEN", `You have set loop to \`${serverQueue.loop}\`.`, message, Discord);
                break;
            /*
            TODO: Uncomment when bug is fixed
            case "remove":
            case "r":
                if (!args[2]) return messageEmbed(false, "RED", "You must include a number!");
                if (isNaN(args[2]) || args[2] > serverQueue.songs.length || args[2] <= 0) return messageEmbed(false, "RED", `'${args[2]}' is either not a number or bigger than the serverqueue or less than 0!`, message, Discord);
                let song1 = await serverQueue.songs[args[2]-1];
                serverQueue.songs = await serverQueue.songs.splice(args[2]-1, 1);
                await messageEmbed(serverQueue.antispam, "GREEN", `You have successfully removed the song **[${song1.songauthor}](${song1.channel}) | [${song1.title}](${song1.url})**`, message, Discord);
                if (serverQueue.songs.length < 1) serverQueue.connection.dispatcher.end();
                break;
            */
            case "antispam":
            case "ap":
                if (args[1] == "false" || args[1] == "true") serverQueue.antispam = JSON.parse(args[1]);
                else serverQueue.antispam = !serverQueue.antispam;
                await messageEmbed(false, "GREEN", `You have set song antispam to \`${serverQueue.antispam}\`.`, message, Discord);
                break; 
            case "deletequeue":
            case "dq":
                serverQueue.songs = [];
                if (serverQueue.connection.dispatcher) serverQueue.connection.dispatcher.end();
                await messageEmbed(false, "GREEN", "I have deleted the queue", message, Discord);
                break;
        }
    }

}

async function play(guild, song, message, Discord) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        try {
            serverQueue.voiceChannel.leave();
            messageEmbed(false, "ORANGE", `Left voice channel for lack of queue`, message, Discord);
        } catch { }
        return;
    }

    dispatcher = await serverQueue.connection.play(await ytdl(song.url, { highWaterMark: 1024 * 1024 * 150 }), { type: 'opus' })
        .on('finish', () => {
            switch (serverQueue.loop) {
                case "none":
                    serverQueue.songs.shift();
                    break;
                case "queue":
                    serverQueue.songs.push(serverQueue.songs[0]);
                    serverQueue.songs.shift();
                    break;
                case "song": 
                    break;
            }
            play(guild, serverQueue.songs[0], message, Discord);
        })
        .on('error', async error => {
            console.log(`There was an error in playing music --- ${error}`);
            messageEmbed(false, "RED", `There was an error in playing the music --- ${error}`, message, Discord)
        });
        await dispatcher.setVolumeLogarithmic(serverQueue.volume/100);
    
    await messageEmbed(serverQueue.antispam, "GREEN", `Now playing **[${song.songauthor}](${song.channel}) | [${song.title}](${song.url})** [<@!${song.authorid}>]`, message, Discord);
}

module.exports = { music };