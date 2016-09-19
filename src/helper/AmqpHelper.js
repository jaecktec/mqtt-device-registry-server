const co = require("co");
var debug = require('debug')('mqtt-device-registry.AmqpHelper');
class AmqpHelper {

    /**
     * Handling for amqp ack handling
     * @param msg amqp message
     * @param channel amqp channel
     * @param handler method wich should be called. passing arg0: msg, arg1: channel
     */
    static handleAck(msg, channel, handler) {
        return co.wrap(function*(msg, channel, handler) {
            try {
                yield handler(msg, channel);
                channel.ack(msg);
            } catch (error) {
                debug(error);
                channel.reject(msg, true)
            }
        })(msg, channel, handler);
    }

    static bufferToObj(buffer) {
        return JSON.parse(buffer.toString('ascii'));
    }
}

module.exports = AmqpHelper;