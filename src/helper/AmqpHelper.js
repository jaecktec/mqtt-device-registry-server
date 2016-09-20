const co = require("co");
const uuid = require('uuid');
const AmqpExchanges = require("../constants/AmqpExchanges");
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

    static objToBuffer(obj) {
        return new Buffer(JSON.stringify(obj));
    }

    static rpcRequest(msg, exchange, routingKey, channel) {
        return new Promise((resolve, reject)=> {
            let correlationId = uuid.v4();
            let consumerTag = uuid.v4();
            channel.assertQueue(null, {exclusive: true, autoDelete: true}).then((queue)=> {
                channel.bindQueue(queue.queue, AmqpExchanges.RPC_RETURN_EXCHANGE, correlationId);
                channel.consume(queue.queue, (msg)=> {
                    channel.cancel(consumerTag);
                    resolve(AmqpHelper.bufferToObj(msg.content));
                }, {noAck: true, consumerTag: consumerTag, exclusive: true});
                channel.publish(exchange, routingKey, AmqpHelper.objToBuffer({
                    correlationId: correlationId,
                    respondToExchange: AmqpExchanges.RPC_RETURN_EXCHANGE,
                    content: msg
                }));
            });
        });
    }

    static rpcRespond(msg, request, channel) {
        let correlationId = request.correlationId; // using correlation id as routing key
        let exchange = request.respondToExchange;
        channel.publish(exchange, correlationId, AmqpHelper.objToBuffer(msg));
    }
}

module.exports = AmqpHelper;