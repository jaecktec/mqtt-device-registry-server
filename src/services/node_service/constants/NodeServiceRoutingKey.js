/**
 * Created by const on 05.09.2016.
 */
class NodeServiceRoutingKey {
    static get ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY(){
        return "dr.api.node.connect";
    }

    static get ROUTING_KEY_NODE_DISCONNECTED_ROUTING_KEY(){
        return "dr.api.node.disconnect";
    }
    static get ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY(){
        return "dr.api.node.update";
    }
}

module.exports = NodeServiceRoutingKey;