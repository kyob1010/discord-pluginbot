# Discord plugin bot

## About
Discord plugin bot is a pluginloader for discord bot.
you can use plugins you want provide some feature with only one bot running.

## Installation
**Node.js 8.0.0 or newer is required.**

First, download this repo, and install dependency modules.
```
git clone https://github.com/kyob1010/discord-pluginbot.git
cd discord-pluginbot
npm install
```

Second, modify your "settings.json".
```
{
  "name": "Discord Pluginbot",
  "token": "YOUR_DISCORD_BOT_TOKEN",
  "pluginFolderPath": "./plugins"
}
```

Third, install plugins.
there is a example plugin for you in plugins folder.

Forth, run this bot.
```
node index.js
```
