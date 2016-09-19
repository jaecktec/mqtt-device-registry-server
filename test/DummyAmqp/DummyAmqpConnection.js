const DummyAmqpChannel = require("./DummyAmqpChannel");

class DummyAmqpConnection {
    createConfirmChannel() {
        return new Promise((resolve)=> resolve(DummyAmqpChannel));
    }

    createChannel() {
        return this.createConfirmChannel();
    }
}

module.exports = new DummyAmqpConnection();