class HelloWorld {
  constructor(register) {
    this.register = register;
    register.registCommand('!helloworld', this.helloworldHandle.bind(this));
  }
  
  helloworldHandle(message) {
    message.reply("hello, world!");
  }
}

module.exports = HelloWorld;
