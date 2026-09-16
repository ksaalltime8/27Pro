const mongoose = require("mongoose");

const WelcomeConfigSchema = new mongoose.Schema({

    guildId: {
        type: String,
        required: true,
        unique: true
    },

    enabled: {
        type: Boolean,
        default: false
    },

    channelId: {
        type: String,
        default: null
    },

    roleId: {
        type: String,
        default: null
    },

    image: {
        type: String,
        default: null
    },

    message: {
        type: String,
        default: "Welcome {user} to {server}!"
    }

});

const WelcomeConfig = mongoose.model(
    "WelcomeConfig",
    WelcomeConfigSchema
);

module.exports = {
    WelcomeConfig
};