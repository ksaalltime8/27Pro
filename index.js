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
// ENV
// ============================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = Number(process.env.PORT) || 5000;

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
// HOSTINGER HTTP SERVER
// ============================================================

const server = http.createServer((req, res) => {

    res.setHeader("Content-Type", "application/json");

    if (req.url === "/" || req.url === "/api/health") {

        res.writeHead(200);

        res.end(JSON.stringify({
            status: "online",
            bot: client.isReady()
                ? "online"
                : "starting",
            database:
                mongoose.connection.readyState === 1
                    ? "connected"
                    : "disconnected"
        }));

        return;
    }

    res.writeHead(404);

    res.end(JSON.stringify({
        error: "Not found"
    }));
});

server.listen(PORT, "0.0.0.0", () => {

    console.log(
        `🌐 Hostinger server listening on port ${PORT}`
    );

});

// ============================================================
// DATABASE SCHEMA
// ============================================================

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

}, {
    timestamps: true
});

const WelcomeConfig =
    mongoose.models.WelcomeConfig ||
    mongoose.model(
        "WelcomeConfig",
        WelcomeConfigSchema
    );

// ============================================================
// CONNECT DATABASE
// ============================================================

async function connectDatabase() {

    if (!MONGODB_URI) {

        console.error(
            "❌ MONGODB_URI is missing."
        );

        return;
    }

    try {

        await mongoose.connect(
            MONGODB_URI,
            {
                serverSelectionTimeoutMS: 10000
            }
        );

        console.log(
            "✅ MongoDB connected."
        );

    } catch (error) {

        console.error(
            "❌ MongoDB connection failed:"
        );

        console.error(
            error.message
        );
    }
}

// ============================================================
// SLASH COMMAND
// ============================================================

const welcomeCommand =
    new SlashCommandBuilder()
        .setName("welcome")
        .setDescription(
            "Configure the server welcome system"
        )

        // SETUP
        .addSubcommand(subcommand =>
            subcommand
                .setName("setup")
                .setDescription(
                    "Setup the welcome system"
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
                            "Role given to new members"
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
                    "View welcome settings"
                )
        )

        // DISABLE
        .addSubcommand(subcommand =>
            subcommand
                .setName("disable")
                .setDescription(
                    "Disable welcome messages"
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        );

// ============================================================
// REGISTER COMMAND
// ============================================================

async function registerCommands() {

    try {

        if (!TOKEN) {
            throw new Error(
                "TOKEN is missing"
            );
        }

        if (!CLIENT_ID) {
            throw new Error(
                "CLIENT_ID is missing"
            );
        }

        if (!GUILD_ID) {
            throw new Error(
                "GUILD_ID is missing"
            );
        }

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
            "✅ /welcome registered successfully."
        );

    } catch (error) {

        console.error(
            "❌ Command registration failed:"
        );

        console.error(
            error.message
        );
    }
}

// ============================================================
// BOT READY
// ============================================================

client.once("ready", async () => {

    console.log(
        "======================================"
    );

    console.log(
        `🤖 BOT ONLINE: ${client.user.tag}`
    );

    console.log(
        `🏠 SERVERS: ${client.guilds.cache.size}`
    );

    console.log(
        "======================================"
    );

    await registerCommands();

});

// ============================================================
// INTERACTIONS
// ============================================================

client.on(
    "interactionCreate",
    async interaction => {

        if (!interaction.isChatInputCommand()) {
            return;
        }

        if (
            interaction.commandName !== "welcome"
        ) {
            return;
        }

        // ====================================================
        // ACKNOWLEDGE DISCORD IMMEDIATELY
        // ====================================================

        try {

            await interaction.deferReply({
                ephemeral: true
            });

        } catch (error) {

            console.error(
                "❌ Could not acknowledge interaction:",
                error.message
            );

            return;
        }

        // ====================================================
        // SERVER CHECK
        // ====================================================

        if (!interaction.guild) {

            await interaction.editReply({
                content:
                    "❌ This command can only be used inside a server."
            });

            return;
        }

        // ====================================================
        // PERMISSION CHECK
        // ====================================================

        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {

            await interaction.editReply({
                content:
                    "❌ You need the **Manage Server** permission."
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

            // ------------------------------------------------
            // IMAGE VALIDATION
            // ------------------------------------------------

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

                await interaction.editReply({
                    content:
                        "❌ Please provide a valid HTTP/HTTPS image URL."
                });

                return;
            }

            // ------------------------------------------------
            // BOT ROLE CHECK
            // ------------------------------------------------

            const botMember =
                interaction.guild.members.me;

            if (!botMember) {

                await interaction.editReply({
                    content:
                        "❌ I couldn't find my bot member in this server."
                });

                return;
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {

                await interaction.editReply({
                    content:
                        "❌ My bot role must be ABOVE the welcome role."
                });

                return;
            }

            // ------------------------------------------------
            // SAVE
            // ------------------------------------------------

            try {

                await WelcomeConfig.findOneAndUpdate(

                    {
                        guildId:
                            interaction.guild.id
                    },

                    {
                        guildId:
                            interaction.guild.id,

                        enabled:
                            true,

                        channelId:
                            channel.id,

                        roleId:
                            role.id,

                        image:
                            image,

                        message:
                            message
                    },

                    {
                        upsert:
                            true,

                        new:
                            true
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

                await interaction.editReply({
                    embeds: [
                        embed
                    ]
                });

                console.log(
                    "✅ Welcome system configured."
                );

            } catch (error) {

                console.error(
                    "❌ Welcome setup error:",
                    error
                );

                await interaction.editReply({
                    content:
                        "❌ Database error while saving the welcome configuration."
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

                    await interaction.editReply({
                        content:
                            "❌ Welcome system is currently disabled."
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
                                    config.message ||
                                    "Not configured"
                            }
                        );

                if (
                    config.image
                ) {

                    embed.setImage(
                        config.image
                    );
                }

                await interaction.editReply({
                    embeds: [
                        embed
                    ]
                });

            } catch (error) {

                console.error(
                    "❌ Config error:",
                    error
                );

                await interaction.editReply({
                    content:
                        "❌ Failed to load the welcome configuration."
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

                    await interaction.editReply({
                        content:
                            "❌ No welcome configuration exists for this server."
                    });

                    return;
                }

                await interaction.editReply({
                    content:
                        "✅ Welcome system disabled."
                });

            } catch (error) {

                console.error(
                    "❌ Disable error:",
                    error
                );

                await interaction.editReply({
                    content:
                        "❌ Failed to disable the welcome system."
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
            `👤 MEMBER JOINED: ${member.user.tag}`
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
                    "ℹ️ Welcome system is not configured for this server."
                );

                return;
            }

            // =================================================
            // ROLE
            // =================================================

            if (
                config.roleId
            ) {

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
                            `✅ ROLE GIVEN: ${role.name}`
                        );
                    }

                } catch (error) {

                    console.error(
                        "❌ Failed to give role:",
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
            // MESSAGE VARIABLES
            // =================================================

            let message =
                config.message ||
                "Welcome {user} to {server}!";

            message =
                message
                    .replaceAll(
                        "{user}",
                        `<@${member.id}>`
                    )
                    .replaceAll(
                        "{username}",
                        member.user.username
                    )
                    .replaceAll(
                        "{server}",
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

            if (
                config.image
            ) {

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
                "✅ WELCOME MESSAGE SENT"
            );

        } catch (error) {

            console.error(
                "❌ Welcome error:",
                error
            );
        }
    }
);

// ============================================================
// DISCORD ERRORS
// ============================================================

client.on(
    "error",
    error => {

        console.error(
            "❌ Discord error:",
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

async function startBot() {

    console.log(
        "🔌 Connecting to Discord..."
    );

    if (!TOKEN) {

        console.error(
            "❌ TOKEN is missing from Hostinger environment variables."
        );

        return;
    }

    try {

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

connectDatabase();

startBot();
