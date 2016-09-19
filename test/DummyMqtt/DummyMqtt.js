/**
 * Created by Constantin Jaeck on 18.09.2016.
 */

const DummyMqttClient = require("./DummyMqttClient");

class DummyMqtt {
    //noinspection JSMethodCanBeStatic
    connect() {
        return DummyMqttClient;
    }
}

module.exports = new DummyMqtt();
