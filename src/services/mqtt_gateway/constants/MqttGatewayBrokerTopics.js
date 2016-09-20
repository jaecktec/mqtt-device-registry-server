/**
 * Created by Constantin Jaeck on 18.09.2016.
 */
class MqttGatewayBrokerTopics {
    static get TOPIC_REGISTER() {
        return "dr/register/+";
    }

    static get TOPIC_DEVICE() {
        return "dr/device/+/+";
    }

    static get TOPIC_UNREGISTER() {
        return "dr/unregister/+";
    }

    static get TOPIC_UPDATE_REGISTER() {
        return "dr/register/update";
    }
}

module.exports = MqttGatewayBrokerTopics;

