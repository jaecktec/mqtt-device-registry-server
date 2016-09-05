const DummyAmqpChannel = require("./DummyAmqpChannel");

class DummyAmqpConnection {
    createConfirmChannel() {
        return new Promise((resolve)=> resolve(DummyAmqpChannel));
    }
}

module.exports = new DummyAmqpConnection();