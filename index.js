const dotenv = require('dotenv');
const express = require('express');
const DiscordRPC = require('discord-rpc');
const readline = require('readline');
const axios = require('axios');
const sharp = require('sharp');

dotenv.config();
const port = process.env.PORT;
const app = express();
const clientId = process.env.DISCORD_CLIENT_ID;
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
const activity = {};
let activityTimer;
const activityInterval = (Number(process.env.DISCORD_INTERVAL) > 0) ? process.env.DISCORD_INTERVAL * 1000 : 15e3;
const services = ['anilist', 'myanimelist', 'kitsu'];
let customCover = Boolean(process.env.DISCORD_AUTHORIZATION) && envBool(process.env.SHOW_COVER);
const url = `https://discordapp.com/api/oauth2/applications/${clientId}/assets`;
let assets = [];
const assetsLimit = parseInt(process.env.DISCORD_ASSET_LIMIT) || 140;

axios.defaults.headers.common['origin'] = 'https://discordapp.com';
axios.defaults.headers.common['referer'] = `https://discordapp.com/developers/applications/${clientId}/rich-presence/assets`;
axios.defaults.headers.common['cache-control'] = 'no-cache';
axios.defaults.headers.common['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.306 Chrome/78.0.3904.130 Electron/7.1.11 Safari/537.36';

rpc.on('ready', () => console.log(`discord-rpc-taiga is using clientId: ${clientId}`));
rpc.on('error', console.error);
rpc.on('disconnected', () => console.log('discord disconnected'));

app.use(express.urlencoded({ extended: false }));
app.get('/', (req, res) => res.send('discord-rpc-taiga'));

app.post('/taiga', (req, res) => {
    switch (req.body.playstatus) {
        case 'playing':
            break;
        case 'stopped':
            stopActivity();
            return res.send('Stop');
        case 'updated':
            return res.send('Update');
        default:
            console.log('Unknown request');
            return res.send('Unknown request');
    }

    const anime = req.body;
    let service = 'anilist';
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

    if (customCover && anime.id && anime.picurl) uploadCover(anime, service);
    startActivity();
    res.send('Start');
});

app.get('/taiga/start', (req, res) => {
    testActivity();
    res.send('Start');
});

app.get('/taiga/stop', (req, res) => {
    stopActivity();
    res.send('Stop');
});

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', (str, key) => {
    if (key.sequence === '\u0003') {
        return process.exit();
    }

    switch (str) {
        case 's':
            return testActivity();
        case 'x':
            return stopActivity();
        case 'q':
            return process.exit();
    }
});

startApp();

async function startApp() {
    if (customCover) {
        let res;
        try {
            res = await axios.get(url);
        } catch (error) {
            errorAxios(error, 'Getting cover list');
        }

        if (!res || !Array.isArray(res.data)) {
            console.log('There is a problem with discord.');
            disableCover();
        } else {
            const assetsDefault = services.slice(0);
            assetsDefault.push('default');
            assets = res.data.filter(asset => !assetsDefault.includes(asset.name));
        }
    }

    await rpc.login({ clientId }).catch(console.error);
    app.listen(port, () => console.log(`discord-rpc-taiga is listening at http://localhost:${port}`));
}

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

function testActivity() {
    activity.details        = 'A Random Anime';
    activity.state          = 'Episode 0/0';
    activity.largeImageKey  = 'default';
    activity.largeImageText = activity.details;
    activity.smallImageKey  = 'anilist';
    activity.smallImageText = activity.smallImageKey;
    activity.startTimestamp = Date.now();

    startActivity();
}

function errorAxios(err, act) {
    if (err.response) return console.log(`${act} failed.`, err.response.status, err.response.statusText);
    if (err.request) return console.log(`${act} failed, no response.`);
    if (err.message) return console.error(err.message);
    console.error(err);
}

function disableCover() {
    customCover = false;
    console.log('Custom cover is disabled!');
}

function imgLarge(url, service) {
    switch (service) {
        case 'anilist':
            return url.replace('medium', 'large');
        case 'myanimelist':
            return url.replace('.jpg', 'l.jpg');
        case 'kitsu':
            return url.replace('small', 'large');
        default:
            return url;
    }
}

async function uploadCover(anime, service) {
    const new_asset = {
        name: `${service}_${anime.id}`,
        image: '',
        type: 1
    }
    if (assets.some(asset => asset.name === new_asset.name)) {
        activity.largeImageKey = new_asset.name;
        return;
    }

    const imgUrl = imgLarge(anime.picurl, service);
    let res;
    try {
        res = await axios.get(imgUrl, { responseType: 'arraybuffer' });
    } catch (error) {
        return errorAxios(error, 'Getting cover image');
    }

    if (!res) return console.log(`There is a problem with ${service}.`);

    const typeAllow = ['image/png', 'image/jpeg'];

    if (!res.headers['content-type'] || !res.headers['content-length']) {
        return console.log('Image link is not supported.');
    }

    if (!typeAllow.includes(res.headers['content-type'])) {
        return console.log('Image type is not supported.');
    }

    let img = res.data;
    if (envBool(process.env.RESIZE_COVER)) {
        try {
            img = await sharp(res.data).metadata()
                .then(({ width }) => {
                    if (width >= 512) return res.data;
                    return sharp(res.data).resize(512).toBuffer();
                });
        } catch (error) {
            console.error(error);
        }
    }
    new_asset.image = `data:${res.headers['content-type']};base64,${img.toString('base64')}`;

    if (assets.length >= assetsLimit) {
        const asset = assets.shift();
        const url_asset = `${url}/${asset.id}`;
        let res;
        try {
            res = await axios.delete(url_asset, { headers: { 'authorization': process.env.DISCORD_AUTHORIZATION }});
        } catch (error) {
            errorAxios(error, 'Deleting cover image');
            return disableCover();
        }
    }

    res = undefined;
    try {
        res = await axios.post(url, new_asset, { headers: { 'authorization': process.env.DISCORD_AUTHORIZATION }});
    } catch (error) {
        errorAxios(error, 'Uploading cover image');
        return disableCover();
    }

    if (!res || !res.data.id || !res.data.name) {
        console.log('There is a problem with discord.');
        return disableCover();
    }

    assets.push(res.data);
    activity.largeImageKey = res.data.name;
}
