/**
 * Created by const on 28.10.2016.
 */

const co = require("co");
const uuid = require('uuid');
const AmqpHelper = require("../../src/helper/AmqpHelper");

class AmqpTestHelper {

    static publish(channel, exchange, routingKey, message) {
        return channel.publish(exchange, routingKey, AmqpHelper.objToBuffer(message));
    }

    static createQueueAndBindOnce(channel,
                                  afterBindHandler,
                                  exchange,
                                  routingKey) {

        return new Promise((resolve)=> {
            let consumerTag = uuid.v4();
            channel.assertQueue(null, {exclusive: true, autoDelete: true}).then((queue)=> {
                channel.bindQueue(
                    queue.queue,
                    exchange,
                    routingKey).then(()=> {
                    channel.consume(
                        queue.queue,
                        (msg)=> {
                            channel.cancel(consumerTag);
                            resolve(AmqpHelper.bufferToObj(msg.content));
                        }, {noAck: true, consumerTag: consumerTag, exclusive: true})
                        .then(()=> afterBindHandler());
                });
            });
        });
    }
}

module.exports = AmqpTestHelper;