// models/monitoredMessage.js
const mongoose = require('mongoose');

const monitoredMessageSchema = new mongoose.Schema({
    guildId: String,
    channelId: String,
    messageId: String,
    inviteCode: String,
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MonitoredMessage', monitoredMessageSchema);