const co = require("co");

/**
 * Exchange names and creation fn for the Exchanges
 */
class AmqpExchanges {

    /**
     *
     * @returns {string} "dr.mqtt"
     */
    static get MQTT_GATEWAY_EXCHANGE() {
        return "dr.mqtt";
    }

    /**
     *
     * @returns {string}
     */
    static get NODE_API_EXCHANGE() {
        return "dr.api.node";
    }

    /**
     *
     * @returns {string}
     */
    static get DEVICE_API_EXCHANGE() {
        return "dr.api.device";
    }

    /**
     *
     * @returns {string}
     */
    static get VALUE_API_EXCHANGE() {
        return "dr.api.value";
    }

    /**
     *
     * @returns {string}
     */
    static get RPC_RETURN_EXCHANGE() {
        return "dr.rpc";
    }

    /**
     * Creates all Exchanges
     * @param channel
     * @returns {Promise}
     */
    static createExchanges(channel) {
        return co.wrap(function*() {
            yield [channel.assertExchange(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, 'direct', {}),
                channel.assertExchange(AmqpExchanges.NODE_API_EXCHANGE, 'direct', {}),
                channel.assertExchange(AmqpExchanges.DEVICE_API_EXCHANGE, 'direct', {}),
                channel.assertExchange(AmqpExchanges.VALUE_API_EXCHANGE, 'direct', {}),
                channel.assertExchange(AmqpExchanges.RPC_RETURN_EXCHANGE, 'direct', {})];
            return yield Promise.resolve();
        })();
    }
}
module.exports = AmqpExchanges;