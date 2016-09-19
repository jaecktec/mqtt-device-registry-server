class AmqpExchanges{
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
}
module.exports = AmqpExchanges;