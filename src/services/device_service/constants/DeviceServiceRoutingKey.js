/**
 * Created by const on 05.09.2016.
 */
class DeviceServiceRoutingKey {
    static get ROUTING_KEY_DEVICE_CONNECT() {
        return "dr.api.device.connect";
    }

    static get ROUTING_KEY_DEVICE_CONNECT_STORED() {
        return "dr.api.device.connect.stored";
    }

    static get  ROUTING_KEY_DEVICE_UPDATE() {
        return "dr.api.device.update";
    }

    static get  ROUTING_KEY_DEVICE_UPDATE_STORED() {
        return "dr.api.device.update.stored";
    }

    static get ROUTING_KEY_RPC_GET_DEVICE() {
        return "dr.api.rpc.device.get"
    }

    static get ROUTING_KEY_RPC_SET_DEVICE_STORAGE() {
        return "dr.api.rpc.device.set"
    }
}

module.exports = DeviceServiceRoutingKey;