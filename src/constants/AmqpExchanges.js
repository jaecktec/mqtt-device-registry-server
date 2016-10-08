const co = require("co");

class AmqpExchanges {

    /**
     *
     * @returns {string} "dr.mqtt"
     */
    static get MQTT_GATEWAY_EXCHANGE() {
        return "dr.mqtt";
    }

    static get NODE_API_EXCHANGE() {
        return "dr.api.node";
    }

    static get DEVICE_API_EXCHANGE() {
        return "dr.api.device";
    }

    static get VALUE_API_EXCHANGE() {
        return "dr.api.value";
    }

    static get RPC_RETURN_EXCHANGE() {
        return "dr.rpc";
    }

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