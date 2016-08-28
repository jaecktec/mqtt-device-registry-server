const assert = require('assert');

/**
 * Class to handle the MQTT Messages, subscibes to topics:
 */
class MqttHandler {

    constructor(
        deviceRegisterCallback,
        unregisterCallback,
        messageRecievedCallback) {
        this.deviceRegisterCallback = deviceRegisterCallback ? deviceRegisterCallback : ()=> {
        };
        this.unregisterCallback = unregisterCallback ? unregisterCallback : ()=> {
        };
        this.messageRecievedCallback = messageRecievedCallback ? messageRecievedCallback : ()=> {
        };
    }

    /**
     * Value Updated
     *
     * Topics
     *
     * dr/device/{nodeId}/{deviceId}
     *
     * @param match
     * @param message
     * @private
     */
    __handleDevice(match, message) {
        let nodeId = match[2];
        let deviceId = match[3];

        // verifying message
        assert(!(nodeId === undefined || nodeId === null));
        assert(!(deviceId === undefined || deviceId === null));
        assert(!(message === undefined || message === null));

        // calling callback
        this.messageRecievedCallback({
            id: nodeId,
            device: {
                id: deviceId,
                message: message
            }
        })
    }

    /**
     * new Device or device updated
     *
     * Topics:
     *
     * dr/register/{nodeId}
     *
     * @param match
     * @param message
     * @private
     */
    __handleRegister(match, message) {
        let nodeId = match[2];

        // verifying message
        assert(!(nodeId === undefined || nodeId === null));

        // calling callback
        this.deviceRegisterCallback({
            id: nodeId,
            device: {
                id: message.uuid,
                unit: message.unit,
                sensor: message.sensor == 1 ? true : false
            }
        })
    }

    /**
     * device unregistered (lwt)
     *
     * Topics:
     *
     * dr/unregister/{nodeId}
     *
     * @param match
     * @param message
     * @private
     */
    __handleUnregister(match, message) {
        let nodeId = match[2];

        // verifying message
        assert(nodeId === undefined || nodeId === null);

        // calling callback
        this.unregisterCallback({
            id: nodeId
        });
    }

    /**
     * handler for topics:
     * dr/register/+
     * dr/device/+/+
     * dr/unregister/+
     *
     * @param topic
     * @param msg
     */
    handle(topic, msg) {
        try {
            let rawMsg = new String(msg).replace('\u0000', '');
            let message = undefined;
            try {
                message = JSON.parse(rawMsg);
            } catch (e) {
                message = {};
            }
            var match = topic.match(/^dr\/(\w+)\/([^\/]+)\/?([^\/]*)$/i);
            switch (match[1]) {
                // value update
                case 'device':
                    this.__handleDevice(match, message);
                    break;
                // new device
                case 'register':
                    if (match[2] == 'update') break;
                    this.__handleRegister(match, message);
                    break;
                // node unregister
                case 'unregister':
                    this.__handleUnregister(match, message);
                    break;
                default:
                    console.log("couldnt parse " + match[0]);
            }
        } catch (e) {
            console.log(e);
        }
    }
}

module.exports = MqttHandler;