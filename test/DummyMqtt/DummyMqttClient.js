/**
 * Created by Constantin Jaeck on 18.09.2016.
 */
const debug = require('debug')('mqtt-device-registry.test.DummyMqttClient');
const mqtt_regex = require("mqtt-regex");

class DummyMqttClient {
    constructor() {
        this.subscriptions = [];
        this.onceSubscriptions = [];
    }

    subscribe(topic) {
        this.subscriptions.push(mqtt_regex(topic).regex);
    }

    subscribeOnce(topic, handler) {
        this.onceSubscriptions.push({topic: mqtt_regex(topic).regex, handler: handler});
    }

    on(handlerType, handler) {
        switch (handlerType) {
            case 'message':
                this.messageHandler = handler; //function(topic, message)
                break;
            default:
                throw new Error("Handler Type not supported");
        }
    }

    publish(topic, message) {
        if (this.subscriptions.filter((subscription) => topic.match(subscription)).length > 0 && this.messageHandler) {
            debug("Publishing to channel %s", topic, message);
            this.messageHandler(topic, message);
        }

        this.onceSubscriptions
            .filter((subs)=>topic.match(subs.topic))
            .map((subs)=>subs.handler)
            .forEach(handler => handler(topic, message));
        this.onceSubscriptions = this.onceSubscriptions.filter((subs)=>!topic.match(subs.topic));
    }

}

module.exports = new DummyMqttClient();