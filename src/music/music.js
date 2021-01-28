const ytdl = require('ytdl-core-discord');
const Youtube = require('simple-youtube-api');

let youtube = new Youtube(process.env.YOUTUBE_API_KEY);
let backupyoutube = new Youtube(process.env.BACKUP_YOUTUBE_API_KEY);

const queue = new Map();

async function messageEmbed(color, whatmsg, message, Discord) {
    const messageEmbed = new Discord.MessageEmbed() 
        .setColor(color)
        .setDescription(whatmsg)
    
    message.channel.send(messageEmbed);
}

async function commands(args) {
    if (args[1] === "queue") return false; //Not working
    else if (args[1] === "play" || args[1] === "pause" || args[1] === "resume" || args[1] === "disconnect" || args[1] === "skip" || args[1] === "volume") return true;
    else return false;
}

async function playqueue(firstVideo, message, Discord, serverQueue, voiceChannel) {
    if (firstVideo.player_response.videoDetails.isLiveContent) return messageEmbed("RED", `I currently cannot play live content!`, message, Discord);
    song = {
        id: firstVideo.player_response.videoDetails.videoId,
        title: firstVideo.player_response.videoDetails.title,
        url: `https://www.youtube.com/watch?v=${firstVideo.player_response.videoDetails.videoId}`,
        slength: firstVideo.player_response.videoDetails.lengthSeconds,
        songauthor: firstVideo.player_response.videoDetails.author,
        channel: `https://www.youtube.com/channel/${firstVideo.player_response.videoDetails.channelId}`,
        authorid: message.author.id,
        authortag: message.member.user.tag
    }

    if (!serverQueue || serverQueue.songs.length < 1) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null, 
            songs: [],
            volume: 100,
            playing: true
        }
        queue.set(message.guild.id, queueConstruct);

        queueConstruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(message.guild, queueConstruct.songs[0], message, Discord);
        } catch (err) {
            console.log(`There was an error connecting in a voice channel --- ${err}`);
            queue.delete(message.guild.id);
            return messageEmbed("RED", "There was an error in connecting to a voice channel", message, Discord);
        }

    } else {
        serverQueue.songs.push(song);
        return messageEmbed("GREEN", `**[${song.songauthor} | ${song.title}](${song.url})** has been added to the queue. [<@!${song.authorid}>]`, message, Discord)
    }
}

async function music(message, args, client, Discord) {
    const serverQueue = queue.get(message.guild.id);
    let searchString = message.content.split(" ").slice(2).join(" ");
    if (searchString.startsWith("<") && searchString.endsWith(">")) searchString = searchString.substring(1, searchString.length-1);
    if (serverQueue && client.guilds.cache.get(message.guild.id).voice.channel.id !== message.member.voice.channel.id && commands(args)) return messageEmbed("RED", "You need to be in the same voice channel as me in order to use my commands!", message, Discord);
    if (args[1] === "play") {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return messageEmbed("RED", "You must first be in a voice channel!", message, Discord);

        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) return messageEmbed("RED", "I do not have permission to connect to that voice channel!", message, Discord);
        else if (!permissions.has('SPEAK')) return messageEmbed("RED", "I do not have permission to speak in that voice channel!", message, Discord);
        
        let firstVideo = null;
        try {
            firstVideo = await ytdl.getInfo(searchString);
            playqueue(firstVideo, message, Discord, serverQueue, voiceChannel);
        } catch {
            try {
                const vidAr = [];
                var videos = await youtube.searchVideos(searchString, 5);
                for (var i = 0; i < 5; i++) {
                    let vid2 = await ytdl.getInfo(videos[i].id);
                    vidAr.push(`+ ${i+1}) ${vid2.player_response.videoDetails.author} | ${vid2.player_response.videoDetails.title} - ${new Date(vid2.player_response.videoDetails.lengthSeconds*1000).toISOString().substr(11, 8)}`);
                }
                message.channel.send(`\`\`\`diff\n${vidAr.join("\n")}\n-Type one of the numbers to pick a song. Type "stop" to stop.\`\`\``);
                const collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 60000 });
                await collector.on('collect', async message2 => {
                    if (message2.content === "stop") collector.stop('reason');
                    else if (isNaN(message2)) messageEmbed("RED", `You must choose one of those numbers!`, message2, Discord);
                    else if (0 > message2.content || 5 < message2.content) messageEmbed("RED", `You must choose a number between 1 and 5!`, message2, Discord);
                    else {
                        firstVideo = await ytdl.getInfo(videos[Number(message2.content)-1].id);
                        if (firstVideo.player_response.videoDetails.isLiveContent) messageEmbed("RED", `That is live content! You must choose a video that is not live!`, message, Discord);
                        else {
                            collector.stop('done');
                        }
                    }
                });
                collector.on('end', async (collected, reason) => {
                    if (reason === "time") return messageEmbed("ORANGE", "Closed due to time", message, Discord);
                    else if (reason === "done") {
                        playqueue(firstVideo, message, Discord, serverQueue, voiceChannel);
                    } else if (reason === "reason") return messageEmbed("ORANGE", "Closed music selection", message, Discord);
                });
            } catch (err) {
                console.log(`There was an error --- ${err}`);
                return messageEmbed("RED", `I cannot find the video you are looking for!`, message, Discord);
            }
        }
        
    } else if (args[1] === "queue") {
        let queueArray = [];
        let queuelength = 0;
        if (!serverQueue) return messageEmbed("RED", 'There is nothing in the queue right now!', message, Discord);
        for (var i = 0; i < serverQueue.songs.length; i++) {
            queuelength += Number(serverQueue.songs[i].slength);
            queueArray.push(`+ ${i+1}) ${serverQueue.songs[i].songauthor} | ${serverQueue.songs[i].title} - ${new Date(serverQueue.songs[i].slength*1000).toISOString().substr(11, 8)} - ${serverQueue.songs[i].authortag}`);
            if (i === 0) {
                queueArray.pop();
                queueArray.push(`+ ${i+1}) ${serverQueue.songs[i].songauthor} | ${serverQueue.songs[i].title} - ${new Date(serverQueue.songs[i].slength*1000).toISOString().substr(11, 8)} - ${serverQueue.songs[i].authortag} <-- Current Song`);
            }
        }
        message.channel.send(`\`\`\`diff\n${queueArray.join("\n")}\n- This is the end of the queue! Do e.play [yt link] to add more songs! \n- The length of the queue is ${new Date(queuelength*1000).toISOString().substr(11, 8)}\`\`\``);
    } else if (args[1] === "pause") {
        if (!message.member.voice.channel) return messageEmbed("RED", "You need to be in a voice channel in order to stop the music!", message, message, Discord);
        if (!serverQueue) return messageEmbed("RED", 'There is nothing playing right now!', message, Discord);
        if (!serverQueue.playing) return messageEmbed("RED", `Music is already playing!`, message, Discord);
        serverQueue.playing = false;
        serverQueue.connection.dispatcher.pause();
        messageEmbed("GREEN", `I have paused the music (**[${serverQueue.songs[0].title}](${serverQueue.songs[0].url})** [<@!${serverQueue.songs[0].authorid}>])`, message, Discord);
    } else if (args[1] === "skip") {
        if (!message.member.voice.channel) return messageEmbed("RED", "You must be in a voice channel to skip!", message, message, Discord);
        else if (!serverQueue) return messageEmbed("RED", "There is nothing playing right now!", message, Discord);
        serverQueue.connection.dispatcher.end();
        messageEmbed("GREEN", `I have skipped the music. (**[${serverQueue.songs[0].title}](${serverQueue.songs[0].url})** [<@!${serverQueue.songs[0].authorid}>])`, message, Discord);
    } else if (args[1] === "resume") {
        if (!message.member.voice.channel) return messageEmbed("RED", "You need to be in a voice channel in order to stop the music!", message, message, Discord);
        if (!serverQueue) return messageEmbed("RED", 'There is nothing playing right now!', message, Discord);
        if (serverQueue.playing) return messageEmbed("RED", `Music is already playing!`, message, Discord);
        serverQueue.playing = true;
        serverQueue.connection.dispatcher.resume();
        messageEmbed("GREEN", `Music resumed (**[${serverQueue.songs[0].title}](${serverQueue.songs[0].url})** [<@!${serverQueue.songs[0].authorid}>])`, message, Discord);
    } else if (args[1] === "disconnect") {
        if (!message.member.voice.channel) return messageEmbed("RED", "You need to be in a voice channel in order to stop the music!", message, message, Discord);
        if (!serverQueue) return messageEmbed("RED", 'There is nothing playing right now!', message, Discord);
        serverQueue.connection.dispatcher.end();
        serverQueue.voiceChannel.leave();
        queue.delete(message.guild.id);
        messageEmbed("GREEN", "Disconnected", message, Discord);
    } else if (args[1] === "volume") {
        if (!message.member.voice.channel) return messageEmbed("RED", "You need to be in a voice channel in order to change the volume!", message, message, Discord);
        if (!serverQueue) return messageEmbed("RED", 'There is nothing playing right now!', message, Discord);
        if (isNaN(args[2]) || args[2] > 100 || args[2] < 0) return messageEmbed("RED", `'${args[2]}' is either not a number or bigger than 100 or less than 0!`, message, Discord);
        if (!args[2]) return messageEmbed("GREEN", `The volume is at ${serverQueue.volume}/100`, message, Discord);
        serverQueue.volume = args[2];
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[2]/100);
        messageEmbed("GREEN", `You have successfully set the volume to ${serverQueue.volume}/100`, message, Discord);
    }
}

async function play(guild, song, message, Discord) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        try {
            serverQueue.voiceChannel.leave();
            queue.delete(guild.id);
            messageEmbed("ORANGE", `Left voice channel for lack of queue`, message, Discord);
        } catch (err) { }
        return;
    }

    const dispatcher = await serverQueue.connection.play(await ytdl(song.url, { highWaterMark: 1024 * 1024 * 100 }), { type: 'opus' })
            .on('finish', () => {
                serverQueue.songs.shift();
                play(guild, serverQueue.songs[0], message, Discord);
            })
            .on('error', async error => {
                console.log(`There was an error in playing music --- ${error}`);
                messageEmbed("RED", `There was an error in playing the music --- ${error}`, message, Discord)
            });
        await dispatcher.setVolumeLogarithmic(serverQueue.volume/100);
    
    await messageEmbed("GREEN", `Now playing **[${song.songauthor}](${song.channel}) | [${song.title}](${song.url})** [<@!${song.authorid}>]`, message, Discord);
}

module.exports = {music};