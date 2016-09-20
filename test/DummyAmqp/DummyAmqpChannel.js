const debug = require("debug")("mqtt-device-registry.test.DummyAmqpChannel");
const uuid = require('uuid');
/**
 *
 */
class DummyAmqpChannel {


    constructor() {
        this.consumes = {};
        this.queueBindings = [];
        this.debugBindToAfterBindings = [];
    }

    clear(queueName) {
        debug("Removing queue consumer and queue bindings wit queueName '%s'", queueName);
        delete this.consumes[queueName];
        this.queueBindings = this.queueBindings.filter((bind) => bind.queueName != queueName);
        this.debugBindToAfterBindings = [];
    }

    //noinspection JSMethodCanBeStatic
    ack() {
        debug("message got acked")
    }

    //noinspection JSMethodCanBeStatic
    reject() {
        debug("message got rejected")
    }

    prefetch() {
    }

    assertQueue() {
        return new Promise((resolve)=> {
            resolve({
                queue: uuid.v4()
            });
        });
    }

    cancel() {
    }

    //noinspection JSMethodCanBeStatic
    assertExchange(name) {
        return {
            exchange: name
        }
    }

    bindQueue(queueName, exchangeName, routingKey) {
        debug("Binding queue '%s' to exchange '%s' with routing key '%s'", queueName, exchangeName, routingKey);
        this.queueBindings.push({
            queueName: queueName,
            exchangeName: exchangeName,
            routingKey: routingKey
        });
        return new Promise((r)=>r())
    }

    consume(queueName, callback) {
        debug("Adding consumer for '" + queueName + "'");
        this.consumes[queueName] = callback;
    }


    publish(exchange, routingKey, msg) {
        "use strict";
        debug("publishing to exchange %s, and routingKey %s", exchange, routingKey, msg);
        let _this = this;
        let binding = this.queueBindings.filter((binding)=>binding.exchangeName == exchange && binding.routingKey == routingKey);
        if (!binding) {
            debug("Couldnt find binding for exchange '" + exchange + "' and routing key '" + routingKey + "'");
            return;
        }

        let debugBindigAfter = [];

        // consumes -> [queueName, handler]
        // bindings -> [{exchangeName + routingKey], queueName]
        let consumer = binding.map((bind)=> {
            if (!_this.consumes[bind.queueName]) debug("No consumer for queue '%s' with exchange '%s' and routing key '%s'", bind.queueName, exchange, routingKey);
            debug("Publishing to queue '%s'", bind.queueName);
            debugBindigAfter.push(bind);
            return _this.consumes[bind.queueName];
        }).filter((c)=>c);
        let consumePromises = consumer.map((consume)=> {
            return consume({content: msg})
        });

        Promise.all(consumePromises).then(()=> {
            this.debugBindToAfterBindings.filter((bind)=> {
                return debugBindigAfter.find((bi)=>bi.queueName == bind.queueName && bi.exchangeName == bind.exchangeName && bi.routingKey == bind.routingKey);
            }).map((bind)=>bind.cb).forEach((cb)=>cb());
        });

        return Promise.all(consumePromises);
    }

    debugBindToAfter(queueName, exchangeName, routingKey, cb) {
        this.debugBindToAfterBindings.push({
            queueName: queueName,
            exchangeName: exchangeName,
            routingKey: routingKey,
            cb: cb
        });
    }
}

module.exports = new DummyAmqpChannel();