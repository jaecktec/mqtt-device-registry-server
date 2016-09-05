const DummyAmqpConnection = require("./DummyAmqpConnection");

class DummyAmqp {

    connect() {
        return new Promise((resolve)=> {
            "use strict";
            resolve(DummyAmqpConnection);
        })
    }
}

module.exports = new DummyAmqp();