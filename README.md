# discord-rpc-taiga
A simple command line program to provide discord rich presence for Taiga.

## Status
Beta. It works but only has limited testing.

## Installation
*Install dependencies*  
`npm install`

*Set up environment variables*  
Rename `.env.example` to `.env` and fill the details or directly add corresponding environment variables
```
PORT=                   // web server port, mandatory, for example 5000
DISCORD_CLIENT_ID=      // discord app client id, mandatory, https://discord.com/developers/applications
DISCORD_INTERVAL=       // discord rich presence update interval, default to 15 seconds
SHOW_USERNAME=          // set to true to show your service username
SHOW_GROUP=             // set to true to show your media release group
DISCORD_AUTHORIZATION=  // authorization token of the account that owns the apps, for anime cover
SHOW_COVER=             // set to true to upload anime cover
DISCORD_ASSET_LIMIT=    // maximum number of anime cover, default to 140
RESIZE_COVER=           // set to true to upscale anime cover to at least 512px
```

*Set up Taiga*
1. Open `Tools > Settings > Sharing > HTTP`
2. Enable `Send HTTP request`
3. Set URL to corresponding local web server port, for example `http://localhost:5000/taiga`
4. Press `Edit format string` and update format string to
```
user=%user%&name=%title%&ep=%episode%&eptotal=$if(%total%,%total%,?)&score=%score%&picurl=%image%&playstatus=%playstatus%&id=%id%&animeurl=%animeurl%&group=%group%
```

*Upload app default image*
1. Go to `https://discord.com/developers/applications`, select your app then `Rich Presence > Art Assets`
2. Upload a asset name `default` for the large image
2. Upload assets for your services (the small image), `anilist`, `myanimelist` or `kitsu`

*Run the app*  
Use `index.bat` or manually run `node index.js`

## Features
- Providing discord rich presence for Taiga
- Customizing your app name and images
- Options to hide your service username and media release group
- Uploading anime cover