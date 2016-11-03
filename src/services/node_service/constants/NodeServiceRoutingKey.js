/**
 * Created by const on 05.09.2016.
 */
class NodeServiceRoutingKey {
    static get ROUTING_KEY_NODE_CONNECTED() {
        return "dr.api.node.connect";
    }

    static get ROUTING_KEY_NODE_CONNECTED_STORED() {
        return "dr.api.node.connect.stored";
    }

    static get ROUTING_KEY_NODE_DISCONNECTED_ROUTING_KEY(){
        return "dr.api.node.disconnect";
    }

    static get ROUTING_KEY_NODE_DISCONNECTED_STORED_ROUTING_KEY() {
        return "dr.api.node.disconnect.stored";
    }

    static get ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY(){
        return "dr.api.node.update";
    }

    static get ROUTING_KEY_NODE_RECONNECTED_STORED_ROUTING_KEY() {
        return "dr.api.node.update.stored"
    }

    static get ROUTING_KEY_RPC_GET_NODE() {
        return "dr.api.rpc.node.get";
    }
}

module.exports = NodeServiceRoutingKey;