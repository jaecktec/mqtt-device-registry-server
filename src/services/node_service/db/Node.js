var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = mongoose.model('Node', new Schema({
    id: String,
    first_seen: Date,
    last_seen: Date,
    disconnected: Date
}));