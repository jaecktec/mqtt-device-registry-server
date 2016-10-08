var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = mongoose.model('Device', new Schema({
    id: String,
    sensor: Boolean,
    unit: String,
    nodeId: String,
    store: {
        maxCount: Number,
        maxAgeMs: Number
    }
}));