import mongoose, {Schema} from "mongoose/";


var NodeShema = new Schema({
    id: String,
    devices: [{ type: Schema.Types.ObjectId, ref: 'Device'}],
    lastSeen: {type: Date},
    disconnected: {type: Date}
});

var DeviceShema = new Schema({
    id: String,
    sensor: Boolean,
    values: [{ type: Schema.Types.ObjectId, ref: 'Value'}]
});

var ValueSchema = new Schema({
    updated: {type: Date, default: Date.now},
    message: Schema.Types.Mixed
});

mongoose.model('Value', ValueSchema);
mongoose.model('Node', NodeShema);
mongoose.model('Device', DeviceShema);

export default {
    Value: mongoose.model('Value'),
    Node: mongoose.model('Node'),
    Device: mongoose.model('Device')
}