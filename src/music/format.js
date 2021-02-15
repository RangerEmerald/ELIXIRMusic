class Queue {
    constructor(textChannel, voiceChannel, connection, songs, volume, playing, loop, antispam) {
        this.textChannel = textChannel;
        this.voiceChannel = voiceChannel;
        this.connection = connection;
        this.songs = songs;
        this.volume = volume;
        this.playing = playing;
        this.loop = loop;
        this.antispam = antispam;
    }
}

module.exports = { Queue };