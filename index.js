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

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);

/////////////////////////////
//         Register        //
/////////////////////////////

class Register extends EventEmitter {
  constructor(options) {
    super();
    this.commands = options.commands;
  }
  registCommand(commandname, options, commandHandler) {
    if (commandHandler === undefined) commandHandler = options;
    if (commandname in this.commands) throw new Error(`Command "${commandname}" already exist!`);
    this.commands[commandname] = commandHandler;
  }
  unregistCommand(commandname, commandHandler) {
    if (commandname in this.commands) delete this.commands.commandname;
    else throw new Error('this command already exist!');
  }
  registEvent(eventname, cb) {
    this.on(eventname, cb);
  }
}

/////////////////////////////
//       PluginLoader      //
/////////////////////////////

class PluginLoader {
  constructor() {
    this.settings = {};
    this.bot = new Discord.Client(); // 用來與 discord 溝通的 bot
    this.commands = {}; // 指令表
    this.register = new Register({ commands: this.commands});
    this.plugins = {};
    this.bot.on('ready', this.botReadyHandle.bind(this)); // 設定 bot 的 onReady callback
    this.bot.on('message', this.botMessagehandle.bind(this)); // 設定 bot 的 onMessage callback
    // 註冊程式於任何情況下離開都必須呼叫 exitHandle
    process.on('exit', this.exitHandle.bind(this, {cleanup:true}));
    process.on('SIGINT', this.exitHandle.bind(this, {cleanup:true,exit:true}));
    process.on('SIGUSR1', this.exitHandle.bind(this, {cleanup:true,exit:true}));
    process.on('SIGUSR2', this.exitHandle.bind(this, {cleanup:true,exit:true}));
    process.on('uncaughtException', this.exitHandle.bind(this, {cleanup:true,exit:true}));
  }
  
  async start() {
    // 讀取設定檔案
    await this.loadSettings();
    // 載入插件
    await this.loadPlugins(this.settings.pluginFolderPath);
    // Bot 登入
    this.bot.login(this.settings.token);
    // 啟用插件
    this.startPlugins();
  }
  
  async loadSettings() {
    let settingFile, settings;
    //
    try {
      settingFile = await readFile('./settings.json');
    } catch (err) {
      console.error(`Bot 啟動失敗。原因: 無法讀取設定檔案。`);
      return;
    }
    //
    try {
      settings = this.settings = JSON.parse(settingFile);
    } catch (err) {
      console.error(`Bot 啟動失敗。原因: 設定檔案並不是合法的 json。`);
      return;
    }
    //
    settings = _.defaults(settings, {
      name: "", 
      token: "",
    });
    //
    
  }
  
  async loadPlugins(pluginFolderPath) {
    // 讀取插件檔案
    let filenames = await readdir(pluginFolderPath);
    for (let filename of filenames) {
      if (filename.endsWith('js')) { // 僅有 js 結尾的可能為插件檔案
        try {
          // 嘗試載入插件
          let pluginPath = path.join(pluginFolderPath, filename);
          let {Plugin} = require('./' + pluginPath);
		  if (Plugin == undefined) continue; // not a plugin, ignore
          let plugin = new Plugin();
          this.plugins[filename] = plugin;
        } catch (e) {
          console.error(`插件 ${filename} 無法載入，已略過。原因: ${e}`);
        }
      }
    }
  }
  
  // 啟用插件
  startPlugins() {
    for (let key in this.plugins) {
      let plugin = this.plugins[key];
      plugin.start(this.register);
    }
  }
  
  // 當 bot 登入成功後的 callback
  botReadyHandle() {
    let botname = this.settings.name
    console.log(`${botname} 已啟動`);
    this.bot.user.setActivity(botname);
  }
  
  // 當 bot 收到 message 的 callback
  botMessagehandle(message) {
    let bot = this.bot;
    if (message.author.bot) return;
    let message_slices = message.content.match(/(".+?"|\S+?)+/g);
    if (message_slices == null) return; // 訊息不需處理
    let commandname = message_slices[0];
    let arg = message_slices;
    // 保證參數必定是 message 的參考
    arg.unshift(message);
    // 執行命令
    if (commandname in this.commands) this.commands[commandname].apply(null, arg);
  }
  
  // 當程式離開的 callback
  exitHandle(options, err) {
    if (options.cleanup) this.register.emit('exit');
    if (err) console.log(err.stack);
    if (options.exit) process.exit();
  }
}
//
let pluginLoader = new PluginLoader();
pluginLoader.start();
