require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");
const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    REST,
    Routes
} = require("discord.js");

// ============================================================
// CONFIG
// ============================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGODB_URI = process.env.MONGODB_URI;

const PORT = Number(process.env.PORT) || 5000;

// ============================================================
// START HOSTINGER HTTP SERVER FIRST
// ============================================================

const httpServer = http.createServer((req, res) => {

    // Health check
    if (req.url === "/" || req.url === "/api/health") {

        const response = {
            status: "online",
            bot: client?.isReady() ? "online" : "starting",
            database:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected",
            timestamp: new Date().toISOString()
        };

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify(response, null, 2));

        return;
    }

    res.writeHead(404, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
        error: "Not found"
    }));
});

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log("======================================");
    console.log(`🌐 Hostinger server running on port ${PORT}`);
    console.log("======================================");
});

httpServer.on("error", error => {
    console.error("❌ HTTP server error:", error);
});

// ============================================================
// CHECK ENVIRONMENT
// ============================================================

console.log("======================================");
console.log("🚀 K7Devs Discord Bot Starting...");
console.log("======================================");

console.log(
    `TOKEN: ${TOKEN ? "FOUND" : "MISSING"}`
);

console.log(
    `CLIENT_ID: ${CLIENT_ID ? "FOUND" : "MISSING"}`
);

console.log(
    `GUILD_ID: ${GUILD_ID ? "FOUND" : "MISSING"}`
);

console.log(
    `MONGODB_URI: ${MONGODB_URI ? "FOUND" : "MISSING"}`
);

console.log(
    `PORT: ${PORT}`
);

// ============================================================
// DISCORD CLIENT
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ============================================================
// DATABASE
// ============================================================

const WelcomeConfigSchema = new mongoose.Schema(
    {
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
    },
    {
        timestamps: true
    }
);

const WelcomeConfig =
    mongoose.models.WelcomeConfig ||
    mongoose.model(
        "WelcomeConfig",
        WelcomeConfigSchema
    );

// ============================================================
// MONGODB
// ============================================================

async function connectMongoDB() {

    if (!MONGODB_URI) {
        console.log(
            "⚠️ MONGODB_URI is missing."
        );

        return false;
    }

    try {

        await mongoose.connect(MONGODB_URI);

        console.log(
            "✅ MongoDB connected."
        );

        return true;

    } catch (error) {

        console.error(
            "❌ MongoDB connection failed:"
        );

        console.error(error.message);

        return false;
    }
}

// ============================================================
// SLASH COMMAND
// ============================================================

const welcomeCommand =
    new SlashCommandBuilder()
        .setName("welcome")
        .setDescription("Configure the welcome system")

        // SETUP
        .addSubcommand(subcommand =>
            subcommand
                .setName("setup")
                .setDescription(
                    "Configure the welcome system"
                )

                .addChannelOption(option =>
                    option
                        .setName("channel")
                        .setDescription(
                            "Welcome channel"
                        )
                        .addChannelTypes(
                            ChannelType.GuildText
                        )
                        .setRequired(true)
                )

                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription(
                            "Role to give new members"
                        )
                        .setRequired(true)
                )

                .addStringOption(option =>
                    option
                        .setName("image")
                        .setDescription(
                            "Welcome image URL"
                        )
                        .setRequired(true)
                )

                .addStringOption(option =>
                    option
                        .setName("message")
                        .setDescription(
                            "Welcome message"
                        )
                        .setRequired(true)
                )
        )

        // CONFIG
        .addSubcommand(subcommand =>
            subcommand
                .setName("config")
                .setDescription(
                    "View welcome configuration"
                )
        )

        // DISABLE
        .addSubcommand(subcommand =>
            subcommand
                .setName("disable")
                .setDescription(
                    "Disable welcome messages"
                )
        );

// ============================================================
// REGISTER COMMAND
// ============================================================

async function registerCommands() {

    if (!TOKEN) {
        console.log(
            "❌ Cannot register commands: TOKEN missing."
        );
        return;
    }

    if (!CLIENT_ID) {
        console.log(
            "❌ Cannot register commands: CLIENT_ID missing."
        );
        return;
    }

    if (!GUILD_ID) {
        console.log(
            "❌ Cannot register commands: GUILD_ID missing."
        );
        return;
    }

    try {

        const rest =
            new REST({
                version: "10"
            }).setToken(TOKEN);

        await rest.put(
            Routes.applicationGuildCommands(
                CLIENT_ID,
                GUILD_ID
            ),
            {
                body: [
                    welcomeCommand.toJSON()
                ]
            }
        );

        console.log(
            "✅ /welcome command registered."
        );

    } catch (error) {

        console.error(
            "❌ Slash command registration failed:"
        );

        console.error(error.message);
    }
}

// ============================================================
// BOT READY
// ============================================================

client.once("ready", async () => {

    console.log("======================================");

    console.log(
        `🤖 Discord connected as ${client.user.tag}`
    );

    console.log(
        `🏠 Servers: ${client.guilds.cache.size}`
    );

    console.log(
        "======================================"
    );

    await registerCommands();
});

// ============================================================
// WELCOME COMMAND
// ============================================================

client.on(
    "interactionCreate",
    async interaction => {

        if (!interaction.isChatInputCommand()) {
            return;
        }

        if (
            interaction.commandName !==
            "welcome"
        ) {
            return;
        }

        if (!interaction.guild) {

            await interaction.reply({
                content:
                    "❌ This command can only be used inside a server.",
                ephemeral: true
            });

            return;
        }

        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {

            await interaction.reply({
                content:
                    "❌ You need **Manage Server** permission.",
                ephemeral: true
            });

            return;
        }

        const subcommand =
            interaction.options.getSubcommand();

        // ====================================================
        // SETUP
        // ====================================================

        if (
            subcommand === "setup"
        ) {

            const channel =
                interaction.options.getChannel(
                    "channel"
                );

            const role =
                interaction.options.getRole(
                    "role"
                );

            const image =
                interaction.options.getString(
                    "image"
                );

            const message =
                interaction.options.getString(
                    "message"
                );

            // Validate image
            try {

                const url =
                    new URL(image);

                if (
                    url.protocol !== "http:" &&
                    url.protocol !== "https:"
                ) {
                    throw new Error(
                        "Invalid protocol"
                    );
                }

            } catch {

                await interaction.reply({
                    content:
                        "❌ The image must be a valid HTTP/HTTPS URL.",
                    ephemeral: true
                });

                return;
            }

            // Check bot role
            const botMember =
                interaction.guild.members.me;

            if (!botMember) {

                await interaction.reply({
                    content:
                        "❌ I cannot find my bot member.",
                    ephemeral: true
                });

                return;
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {

                await interaction.reply({
                    content:
                        "❌ My bot role must be ABOVE the welcome role.",
                    ephemeral: true
                });

                return;
            }

            try {

                await WelcomeConfig.findOneAndUpdate(
                    {
                        guildId:
                            interaction.guild.id
                    },
                    {
                        guildId:
                            interaction.guild.id,

                        enabled: true,

                        channelId:
                            channel.id,

                        roleId:
                            role.id,

                        image: image,

                        message: message
                    },
                    {
                        upsert: true,
                        new: true
                    }
                );

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "Welcome System Enabled"
                        )
                        .setColor(
                            0x8b0000
                        )
                        .addFields(
                            {
                                name:
                                    "Channel",
                                value:
                                    `<#${channel.id}>`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Role",
                                value:
                                    `<@&${role.id}>`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Message",
                                value:
                                    message
                            }
                        )
                        .setTimestamp();

                await interaction.reply({
                    embeds: [
                        embed
                    ],
                    ephemeral:
                        true
                });

                console.log(
                    `✅ Welcome system configured for ${interaction.guild.name}`
                );

            } catch (error) {

                console.error(
                    "❌ Setup error:",
                    error
                );

                await interaction.reply({
                    content:
                        "❌ Failed to save welcome settings.",
                    ephemeral:
                        true
                });
            }

            return;
        }

        // ====================================================
        // CONFIG
        // ====================================================

        if (
            subcommand === "config"
        ) {

            try {

                const config =
                    await WelcomeConfig.findOne({
                        guildId:
                            interaction.guild.id
                    });

                if (
                    !config ||
                    !config.enabled
                ) {

                    await interaction.reply({
                        content:
                            "❌ Welcome system is disabled.",
                        ephemeral:
                            true
                    });

                    return;
                }

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "Welcome Configuration"
                        )
                        .setColor(
                            0x8b0000
                        )
                        .addFields(
                            {
                                name:
                                    "Status",
                                value:
                                    "🟢 Enabled",
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Channel",
                                value:
                                    `<#${config.channelId}>`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Role",
                                value:
                                    `<@&${config.roleId}>`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Message",
                                value:
                                    config.message
                            }
                        );

                if (config.image) {
                    embed.setImage(
                        config.image
                    );
                }

                await interaction.reply({
                    embeds: [
                        embed
                    ],
                    ephemeral:
                        true
                });

            } catch (error) {

                console.error(
                    "❌ Config error:",
                    error
                );

                await interaction.reply({
                    content:
                        "❌ Failed to load configuration.",
                    ephemeral:
                        true
                });
            }

            return;
        }

        // ====================================================
        // DISABLE
        // ====================================================

        if (
            subcommand === "disable"
        ) {

            try {

                const config =
                    await WelcomeConfig.findOneAndUpdate(
                        {
                            guildId:
                                interaction.guild.id
                        },
                        {
                            enabled:
                                false
                        },
                        {
                            new:
                                true
                        }
                    );

                if (!config) {

                    await interaction.reply({
                        content:
                            "❌ No welcome configuration exists.",
                        ephemeral:
                            true
                    });

                    return;
                }

                await interaction.reply({
                    content:
                        "✅ Welcome system disabled.",
                    ephemeral:
                        true
                });

            } catch (error) {

                console.error(
                    "❌ Disable error:",
                    error
                );

                await interaction.reply({
                    content:
                        "❌ Failed to disable welcome system.",
                    ephemeral:
                        true
                });
            }
        }
    }
);

// ============================================================
// MEMBER JOIN
// ============================================================

client.on(
    "guildMemberAdd",
    async member => {

        console.log(
            `👤 ${member.user.tag} joined ${member.guild.name}`
        );

        try {

            const config =
                await WelcomeConfig.findOne({
                    guildId:
                        member.guild.id,

                    enabled:
                        true
                });

            if (!config) {

                console.log(
                    "ℹ️ Welcome system is not configured."
                );

                return;
            }

            // =================================================
            // ROLE
            // =================================================

            if (config.roleId) {

                try {

                    const role =
                        member.guild.roles.cache.get(
                            config.roleId
                        );

                    if (!role) {

                        console.log(
                            "⚠️ Welcome role not found."
                        );

                    } else {

                        await member.roles.add(
                            role
                        );

                        console.log(
                            `✅ Role "${role.name}" given to ${member.user.tag}`
                        );
                    }

                } catch (error) {

                    console.error(
                        "❌ Role assignment failed:",
                        error.message
                    );
                }
            }

            // =================================================
            // CHANNEL
            // =================================================

            const channel =
                member.guild.channels.cache.get(
                    config.channelId
                );

            if (!channel) {

                console.log(
                    "⚠️ Welcome channel not found."
                );

                return;
            }

            // =================================================
            // MESSAGE
            // =================================================

            let message =
                config.message ||
                "Welcome {user} to {server}!";

            message =
                message
                    .replace(
                        /{user}/g,
                        `<@${member.id}>`
                    )
                    .replace(
                        /{username}/g,
                        member.user.username
                    )
                    .replace(
                        /{server}/g,
                        member.guild.name
                    );

            // =================================================
            // EMBED
            // =================================================

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        "Welcome!"
                    )
                    .setDescription(
                        message
                    )
                    .setColor(
                        0x8b0000
                    )
                    .setThumbnail(
                        member.user.displayAvatarURL({
                            size: 256
                        })
                    )
                    .setFooter({
                        text:
                            member.guild.name
                    })
                    .setTimestamp();

            if (config.image) {

                embed.setImage(
                    config.image
                );
            }

            // =================================================
            // SEND
            // =================================================

            await channel.send({
                content:
                    `<@${member.id}>`,
                embeds: [
                    embed
                ]
            });

            console.log(
                `✅ Welcome message sent for ${member.user.tag}`
            );

        } catch (error) {

            console.error(
                "❌ Member welcome error:",
                error
            );
        }
    }
);

// ============================================================
// DISCORD ERROR HANDLING
// ============================================================

client.on(
    "error",
    error => {

        console.error(
            "❌ Discord client error:",
            error
        );
    }
);

client.on(
    "shardError",
    error => {

        console.error(
            "❌ Discord WebSocket error:",
            error
        );
    }
);

// ============================================================
// LOGIN
// ============================================================

async function startDiscord() {

    if (!TOKEN) {

        console.error(
            "❌ TOKEN is missing."
        );

        return;
    }

    try {

        console.log(
            "🔌 Connecting to Discord..."
        );

        await client.login(
            TOKEN
        );

    } catch (error) {

        console.error(
            "❌ Discord login failed:"
        );

        console.error(
            error.message
        );
    }
}

// ============================================================
// START
// ============================================================

startDiscord();
