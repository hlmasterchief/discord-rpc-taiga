const dotenv = require('dotenv');
const express = require('express');
const DiscordRPC = require('discord-rpc');

dotenv.config();
const port = process.env.PORT;
const app = express();
const clientId = process.env.DISCORD_CLIENT_ID;
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
const activity = {};
let activityTimer;
const activityInterval = (Number(process.env.DISCORD_INTERVAL) > 0) ? process.env.DISCORD_INTERVAL * 1000 : 15e3;
const services = ['anilist', 'myanimelist', 'kitsu'];
let service = 'anilist';

rpc.login({ clientId }).catch(console.error);
rpc.on('ready', () => console.log(`discord-rpc-taiga is using clientId: ${clientId}`));
rpc.on('error', console.error);

app.use(express.urlencoded({ extended: false }));
app.get('/', (req, res) => res.send('discord-rpc-taiga'));

app.post('/taiga', (req, res) => {
    switch (req.body.playstatus) {
        case 'playing':
            break;
        case 'stopped':
            stopActivity();
            return res.send('Stop');
        default:
            console.log('Problem');
            return res.send('Problem');
    }

    const anime = req.body;
    services.forEach(element => {
        if (anime.picurl && anime.picurl.includes(element)) service = element;
    });
    let state = `Episode ${anime.ep}/${anime.eptotal}`;
    if (envBool(process.env.SHOW_GROUP) && anime.group) state += ` by ${anime.group}`;
    let smallImageText = service;
    if (envBool(process.env.SHOW_USERNAME) && anime.user) smallImageText = `${anime.user} at ${service}`;

    activity.details        = anime.name;
    activity.state          = state;
    activity.largeImageKey  = 'default';
    activity.largeImageText = activity.details;
    activity.smallImageKey  = service;
    activity.smallImageText = smallImageText;
    activity.startTimestamp = Date.now();

    startActivity();
    res.send('Start');
});

app.get('/taiga/start', (req, res) => {
    activity.details        = 'A Random Anime';
    activity.state          = 'Episode 0/0';
    activity.largeImageKey  = 'default';
    activity.largeImageText = activity.details;
    activity.smallImageKey  = service;
    activity.smallImageText = service;
    activity.startTimestamp = Date.now();

    startActivity();
    res.send('Start');
});

app.get('/taiga/stop', (req, res) => {
    stopActivity();
    res.send('Stop');
});

app.listen(port, () => console.log(`discord-rpc-taiga is listening at http://localhost:${port}`));

function startActivity() {
    if (activityTimer) clearInterval(activityTimer);
    rpc.setActivity(activity);
    activityTimer = setInterval(() => rpc.setActivity(activity), activityInterval);
}

function stopActivity() {
    if (activityTimer) clearInterval(activityTimer);
    rpc.clearActivity();
}

function envBool(string) {
    if (string === 'true') return true;
    return false;
}
