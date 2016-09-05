/**
 * Created by const on 05.09.2016.
 */
class MqttGatewayRoutingKey {
    static get DEVICE_ROUTING_KEY() {
        return "dr.api.device";
    }

    static get DEVICE_VALUE_ROUTING_KEY() {
        return "dr.api.value";
    }

    static get NODE_ROUTING_KEY(){
        return "dr.api.node";
    }
}

module.exports = MqttGatewayRoutingKey;