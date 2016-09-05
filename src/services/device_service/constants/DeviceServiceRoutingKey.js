/**
 * Created by const on 05.09.2016.
 */
class DeviceServiceRoutingKey {
    static get ROUTING_KEY_DEVICE_CONNECT() {
        return "dr.api.device.connect";
    }

    static get  ROUTING_KEY_DEVICE_UPDATE() {
        return "dr.api.device.update";
    }
}

module.exports = DeviceServiceRoutingKey;