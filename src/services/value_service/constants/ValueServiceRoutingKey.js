/**
 * Created by const on 05.09.2016.
 */
class ValueServiceRoutingKey {
    static get ROUTING_KEY_VALUE_NEW() {
        return "dr.api.value.new";
    }

    static get ROUTING_KEY_RPC_GET_VALUE() {
        return "dr.api.rpc.value.get";
    }

    static get ROUTING_KEY_VALUE_NEW_STORED() {
        return "dr.api.value.new.stored"
    }

}

module.exports = ValueServiceRoutingKey;