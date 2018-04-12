/////////////////////////////
//          Modules        //
/////////////////////////////

const EventEmitter = require('events');
const fs = require('fs');
const util = require('util');
const path = require('path');

/////////////////////////////
//   Third Party Modules   //
/////////////////////////////

const _ = require('lodash');
const Discord = require('discord.js');

/////////////////////////////
//    Promisify Function   //
/////////////////////////////

const mkdir = util.promisify(fs.mkdir);
const appendFile = util.promisify(fs.appendFile);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);
const rename = util.promisify(fs.rename);

///////////////////////
//  Constant Values  //
///////////////////////

const SETTINGS_FILENAME = "settings.json";
const DEFAULT_SETTINGS = {
  name: "Discord Pluginbot", 
  token: "YOUR_DISCORD_BOT_TOKEN", 
  pluginFolderPath: "./plugins", 
};

/////////////////////////////
//         Register        //
/////////////////////////////

class Register {
  constructor(pluginLoader, pluginName) {
    this.pluginName = pluginName;
    this.registCommand = (commandName, commandHandler) => {
      return pluginLoader.registCommand(this.pluginName, commandName, commandHandler);
    }
    this.unregistCommand = (commandName) => {
      return pluginLoader.unregistCommand(this.pluginName, commandName);
    }
    this.registEvent = (eventname, cb) => {
      pluginLoader.on(eventname, cb);
    }
  }
}

////////////////////////////////////////////////////////////////////////
//                               Logger                               //
////////////////////////////////////////////////////////////////////////

class Logger {
  constructor() {
    this.logFilename = `discordbot-pluginloader-${(new Date()).toISOString()}.log`;
    this.initialize();
  }

  initialize() {
    try {
      fs.mkdirSync('logs');
    } catch (ok) {} // it's ok
  }

  async writeLog(log) {
    return appendFile(path.join('./', 'logs', this.logFilename), log + '\n', 'utf8');
  }

  async writeLogs(logs) {
    let packLog = "";
    for (let log in logs) {
      packLog += logs + "\n";
    }
    return this.writeLog(packLog.slice(0, -1));
  }

  debug() {
    console.info(`[Debug] ${arguments[0]}`);
  }

  log() {
    this.info.call(null, arguments);
  }

  formatMessage(type, message) {
    let msg = `[${new Date().toISOString().replace('T', ' ').replace(/\..+/, "")}][${type}] ${message}`;
    return msg;
  }

  formatMessages(type, messages) {
    let msgs = [];
    for (let msg of messages) {
      msgs.push(this.formatMessage(type, msg));
    }
    return msgs;
  }
 
  info() {
    let messages = this.formatMessages("Info", arguments);
    for (let message of messages) {
      console.log(message);
    }
    this.writeLogs(messages);
  }

  error() {
    let messages = this.formatMessages("Error", arguments);
    for (let message of messages) {
      console.log(message);
    }
    this.writeLogs(messages);
  }

  warn() {
    let messages = this.formatMessages("Warn", arguments);
    for (let message of messages) {
      console.log(message);
    }
    this.writeLogs(messages);
  }

  fatal() {
    let messages = this.formatMessages("Fatal", arguments);
    for (let message of messages) {
      console.log(message);
    }
    this.writeLogs(messages);
  }
}

/////////////////////////////
//       PluginLoader      //
/////////////////////////////

class PluginLoader extends EventEmitter {
  constructor() {
    super();
    //
    this.settings = {};
    this.bot = new Discord.Client(); // bot interact with discord
    this.logger = new Logger();
    this.plugins = {};

    // events
    this.bot.on('ready', this.botReadyHandle.bind(this)); // 設定 bot 的 onReady callback
    this.bot.on('message', this.botMessagehandle.bind(this)); // 設定 bot 的 onMessage callback

    // must call function 'exitHandle' anyway bot terminate
    process.on('exit', this.exitHandle.bind(this, { cleanup: true }));
    process.on('SIGINT', this.exitHandle.bind(this, { cleanup: true, exit: true }));
    process.on('SIGUSR1', this.exitHandle.bind(this, { cleanup: true, exit: true }));
    process.on('SIGUSR2', this.exitHandle.bind(this, { cleanup: true, exit: true }));
    process.on('uncaughtException', this.exitHandle.bind(this, { cleanup:true, exit:true }));
  }

  ////////////
  //  Load  //
  ////////////
  
  async createSettingFile() {
    // check the setting file exist
    let settingFileFullPath = path.join(__dirname, SETTINGS_FILENAME);
    this.logger.debug(`setting file full path = ${settingFileFullPath}`);
    //
    let oldSettingFileFullPath = settingFileFullPath;
    let pathParseObj = path.parse(oldSettingFileFullPath);
    oldSettingFileFullPath = path.join(pathParseObj.dir, pathParseObj.name + "_old", pathParseObj.ext);
    // if setting file exist, just rename it
    try {
      await rename(settingFileFullPath, oldSettingFileFullPath);
    } catch (ok) {} // old file not exist, it's ok
    // create new setting file
    await writeFile(settingFileFullPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  }

  async loadSettings() {
    let settings, settingFile;
    //
    try {
      settingFile = await readFile(SETTINGS_FILENAME);
    } catch (err) {
      this.logger.fatal(`Can't read setting file "${SETTINGS_FILENAME}", program will automatic trying to create one.`);
      await this.createSettingFile(); // try to create one
      this.exitHandle({ exit: true }); // exit
    }
    //
    try {
      this.settings = JSON.parse(settingFile);
    } catch (err) {
      this.logger.fatal(`setting file is not a vaild json`);
      this.exitHandle({ exit: true }); // exit
    }
  }

  async loadPlugins() {
    let pluginFolderPath = this.settings.pluginFolderPath;
    // 讀取插件檔案
    let pluginFolderNames = await readdir(pluginFolderPath);
    for (let pluginFolderName of pluginFolderNames) {
      let filestat = fs.lstatSync(path.join(pluginFolderPath, pluginFolderName));
      if (filestat.isDirectory()) { // may a plugin, try to load
        const pluginName = pluginFolderName;
        try {
          let Plugin = require("./" + path.join(pluginFolderPath, pluginFolderName));
          if (typeof Plugin != 'function') continue; // not a plugin, ignore
          this.plugins[pluginName] = { instance: null, commands: {} };
          this.plugins[pluginName].instance = new Plugin(new Register(this, pluginName));
          this.logger.info(`plugin "${pluginName}" load success`);
        } catch (e) {
          this.logger.warn(`Can't load plugin "${pluginName}", ignore. Error: ${e}`);
        }
      }
    }
  }

  ////////////////////
  //  Register API  //
  ////////////////////

  registCommand(pluginName, commandName, commandHandler) {
    this.plugins[pluginName].commands[commandName] = commandHandler;
  }

  unregistCommand(pluginName, commandName) {
    delete this.plugins[pluginName].commands[commandName];
  }

  ////////////
  //  Main  //
  ////////////

  async start() {
    await this.loadSettings();
    await this.loadPlugins();
    this.bot.login(this.settings.token);
    this.emit('ready'); // ready event;
  }
  
  // 當 bot 登入成功後的 callback
  botReadyHandle() {
    let botname = this.settings.name
    this.bot.user.setActivity(botname);
    this.logger.info(`${botname} 已啟動`);
  }
  
  // 當 bot 收到 message 的 callback
  botMessagehandle(message) {
    this.logger.info(`Received message ${message.cleanContent}`);
    let bot = this.bot;
    if (message.author.bot) return; // don't process bot message
    let messageSlices = message.content.match(/(".+?"|\S+?)+/g);
    if (messageSlices == null) return; // 訊息不需處理
    let commandname = messageSlices[0];
    let arg = messageSlices;
    // 保證參數必定是 message 的參考
    arg.unshift(message);
    // 執行命令
    for (let pluginName in this.plugins) {
      let plugin = this.plugins[pluginName];
      if (commandname in plugin.commands) {
        try {
          plugin.commands[commandname].apply(null, arg);
        } catch (e) {
          this.logger.warn(`${pluginName}:${commandname} execution fail.`);
          this.logger.warn(e);
        }
      }
    }
  }
  
  // 當程式離開的 callback
  exitHandle(options, err) {
    if (options.cleanup) {
      try {
       this.emit('exit'); 
      } catch (ok) {} // just ignore
    }
    if (err) this.logger.error(err.stack);
    if (options.exit) process.exit();
  }
}
//
let pluginLoader = new PluginLoader();
pluginLoader.start();
