const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    blacklistedServerId: { type: String, required: true },
    reason: { type: String, required: true },
    blacklistedBy: { type: String, required: true } // ID of the user who blacklisted
});

module.exports = mongoose.model('Blacklist', blacklistSchema);