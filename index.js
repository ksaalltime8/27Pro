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
    Routes,
    ActivityType
} = require("discord.js");

// ============================================================
// 27PRO — ENVIRONMENT
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

        res.end(
            JSON.stringify({
                status: "online",
                bot: client.isReady() ? "online" : "starting",
                database:
                    mongoose.connection.readyState === 1
                        ? "connected"
                        : "disconnected",
                uptime: Math.floor(process.uptime())
            })
        );

        return;
    }

    res.writeHead(404);

    res.end(
        JSON.stringify({
            error: "Not found"
        })
    );
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 27Pro HTTP server listening on port ${PORT}`);
});

// ============================================================
// MONGODB SCHEMA
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
            default: "Welcome {user} to **{server}**!"
        },

        color: {
            type: String,
            default: "#8B0000"
        }
    },
    {
        timestamps: true
    }
);

const WelcomeConfig =
    mongoose.models.WelcomeConfig ||
    mongoose.model("WelcomeConfig", WelcomeConfigSchema);

// ============================================================
// DATABASE
// ============================================================

async function connectDatabase() {
    if (!MONGODB_URI) {
        console.error("❌ MONGODB_URI is missing.");
        return;
    }

    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000
        });

        console.log("✅ MongoDB connected.");
    } catch (error) {
        console.error("❌ MongoDB connection failed:");
        console.error(error.message);
    }
}

// ============================================================
// COLOR HELPER
// ============================================================

function getColor(color) {
    if (!color) {
        return 0x8B0000;
    }

    const cleaned = color.replace("#", "");

    if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
        return 0x8B0000;
    }

    return parseInt(cleaned, 16);
}

// ============================================================
// MESSAGE VARIABLES
// ============================================================

function formatMessage(message, member) {
    return message
        .replaceAll("{user}", `<@${member.id}>`)
        .replaceAll("{username}", member.user.username)
        .replaceAll("{displayname}", member.displayName)
        .replaceAll("{server}", member.guild.name)
        .replaceAll("{count}", member.guild.memberCount.toString())
        .replaceAll("{id}", member.id);
}

// ============================================================
// WELCOME EMBED
// ============================================================

function createWelcomeEmbed(config, member) {
    const message = formatMessage(
        config.message ||
            "Welcome {user} to **{server}**!",
        member
    );

    const embed = new EmbedBuilder()
        .setTitle("✦ Welcome to the server")
        .setDescription(message)
        .setColor(getColor(config.color))
        .setThumbnail(
            member.user.displayAvatarURL({
                extension: "png",
                size: 256
            })
        )
        .addFields(
            {
                name: "👤 Member",
                value: `<@${member.id}>`,
                inline: true
            },
            {
                name: "🔢 Member #",
                value: `${member.guild.memberCount}`,
                inline: true
            },
            {
                name: "📅 Account",
                value:
                    `<t:${Math.floor(
                        member.user.createdTimestamp / 1000
                    )}:R>`,
                inline: true
            }
        )
        .setFooter({
            text: `${member.guild.name} • 27Pro`
        })
        .setTimestamp();

    if (config.image) {
        embed.setImage(config.image);
    }

    return embed;
}

// ============================================================
// /WELCOME COMMAND
// ============================================================

const welcomeCommand =
    new SlashCommandBuilder()
        .setName("welcome")
        .setDescription(
            "Manage the 27Pro welcome system"
        )

        // ----------------------------------------------------
        // SETUP
        // ----------------------------------------------------

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
                            "Channel for welcome messages"
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

                .addStringOption(option =>
                    option
                        .setName("color")
                        .setDescription(
                            "Embed color, example: #8B0000"
                        )
                        .setRequired(false)
                )
        )

        // ----------------------------------------------------
        // CONFIG
        // ----------------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName("config")
                .setDescription(
                    "View welcome configuration"
                )
        )

        // ----------------------------------------------------
        // TEST
        // ----------------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName("test")
                .setDescription(
                    "Send a test welcome message"
                )
        )

        // ----------------------------------------------------
        // PREVIEW
        // ----------------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName("preview")
                .setDescription(
                    "Preview the welcome message"
                )
        )

        // ----------------------------------------------------
        // DISABLE
        // ----------------------------------------------------

        .addSubcommand(subcommand =>
            subcommand
                .setName("disable")
                .setDescription(
                    "Disable the welcome system"
                )
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        );

// ============================================================
// /PING
// ============================================================

const pingCommand =
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription(
            "Check 27Pro latency"
        );

// ============================================================
// /BOTINFO
// ============================================================

const botInfoCommand =
    new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription(
            "Show 27Pro information"
        );

// ============================================================
// REGISTER SLASH COMMANDS
// ============================================================

async function registerCommands() {
    try {
        if (!TOKEN) {
            throw new Error("TOKEN is missing");
        }

        if (!CLIENT_ID) {
            throw new Error("CLIENT_ID is missing");
        }

        if (!GUILD_ID) {
            throw new Error("GUILD_ID is missing");
        }

        const rest = new REST({
            version: "10"
        }).setToken(TOKEN);

        await rest.put(
            Routes.applicationGuildCommands(
                CLIENT_ID,
                GUILD_ID
            ),
            {
                body: [
                    welcomeCommand.toJSON(),
                    pingCommand.toJSON(),
                    botInfoCommand.toJSON()
                ]
            }
        );

        console.log(
            "✅ 27Pro slash commands registered."
        );
    } catch (error) {
        console.error(
            "❌ Command registration failed:"
        );

        console.error(error.message);
    }
}

// ============================================================
// BOT READY
// ============================================================

client.once("ready", async () => {
    console.log("");
    console.log("======================================");
    console.log("          27PRO BOT ONLINE");
    console.log("======================================");

    console.log(
        `🤖 Bot: ${client.user.tag}`
    );

    console.log(
        `🆔 ID: ${client.user.id}`
    );

    console.log(
        `🏠 Servers: ${client.guilds.cache.size}`
    );

    console.log(
        `👥 Users: ${client.guilds.cache.reduce(
            (total, guild) =>
                total + guild.memberCount,
            0
        )}`
    );

    console.log(
        `📡 Ping: ${client.ws.ping}ms`
    );

    console.log("======================================");
    console.log("");

    await registerCommands();

    client.user.setPresence({
        activities: [
            {
                name: "your server",
                type: ActivityType.Watching
            }
        ],
        status: "online"
    });
});

// ============================================================
// INTERACTIONS
// ============================================================

client.on(
    "interactionCreate",
    async interaction => {

        // ====================================================
        // PING
        // ====================================================

        if (
            interaction.isChatInputCommand() &&
            interaction.commandName === "ping"
        ) {

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🏓 Pong!")
                        .setDescription(
                            `27Pro WebSocket latency: **${client.ws.ping}ms**`
                        )
                        .setColor(0x8B0000)
                        .setFooter({
                            text: "27Pro"
                        })
                        .setTimestamp()
                ],
                ephemeral: true
            });

            return;
        }

        // ====================================================
        // BOTINFO
        // ====================================================

        if (
            interaction.isChatInputCommand() &&
            interaction.commandName === "botinfo"
        ) {

            const uptime =
                Math.floor(process.uptime());

            const hours =
                Math.floor(uptime / 3600);

            const minutes =
                Math.floor(
                    (uptime % 3600) / 60
                );

            const seconds =
                uptime % 60;

            const totalUsers =
                client.guilds.cache.reduce(
                    (total, guild) =>
                        total + guild.memberCount,
                    0
                );

            const embed =
                new EmbedBuilder()
                    .setTitle("🤖 27Pro")
                    .setDescription(
                        "All-in-one Discord welcome & utility bot."
                    )
                    .setColor(0x8B0000)
                    .addFields(
                        {
                            name: "🏠 Servers",
                            value:
                                `${client.guilds.cache.size}`,
                            inline: true
                        },
                        {
                            name: "👥 Users",
                            value:
                                `${totalUsers}`,
                            inline: true
                        },
                        {
                            name: "📡 Ping",
                            value:
                                `${client.ws.ping}ms`,
                            inline: true
                        },
                        {
                            name: "⏱️ Uptime",
                            value:
                                `${hours}h ${minutes}m ${seconds}s`,
                            inline: true
                        },
                        {
                            name: "💾 Database",
                            value:
                                mongoose.connection
                                    .readyState === 1
                                    ? "🟢 Connected"
                                    : "🔴 Disconnected",
                            inline: true
                        },
                        {
                            name: "⚡ Runtime",
                            value:
                                "Hostinger Node.js",
                            inline: true
                        }
                    )
                    .setFooter({
                        text:
                            "27Pro • Made by iik27"
                    })
                    .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

            return;
        }

        // ====================================================
        // ONLY HANDLE /WELCOME BELOW
        // ====================================================

        if (
            !interaction.isChatInputCommand() ||
            interaction.commandName !== "welcome"
        ) {
            return;
        }

        // ====================================================
        // IMMEDIATE DISCORD ACK
        // ====================================================

        try {
            await interaction.deferReply({
                ephemeral: true
            });
        } catch (error) {
            console.error(
                "❌ Interaction acknowledgement failed:",
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

            const color =
                interaction.options.getString(
                    "color"
                ) || "#8B0000";

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
                    throw new Error();
                }

            } catch {

                await interaction.editReply({
                    content:
                        "❌ Please provide a valid HTTP/HTTPS image URL."
                });

                return;
            }

            // ------------------------------------------------
            // COLOR VALIDATION
            // ------------------------------------------------

            if (
                !/^#[0-9A-Fa-f]{6}$/.test(color)
            ) {

                await interaction.editReply({
                    content:
                        "❌ Color must look like `#8B0000`."
                });

                return;
            }

            // ------------------------------------------------
            // BOT MEMBER
            // ------------------------------------------------

            const botMember =
                interaction.guild.members.me;

            if (!botMember) {

                await interaction.editReply({
                    content:
                        "❌ I couldn't find 27Pro in this server."
                });

                return;
            }

            // ------------------------------------------------
            // ROLE VALIDATION
            // ------------------------------------------------

            if (
                role.id === interaction.guild.id
            ) {

                await interaction.editReply({
                    content:
                        "❌ You cannot use @everyone as the welcome role."
                });

                return;
            }

            if (role.managed) {

                await interaction.editReply({
                    content:
                        "❌ That role is managed by an integration and cannot be assigned."
                });

                return;
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {

                await interaction.editReply({
                    content:
                        "❌ 27Pro's bot role must be **above** the welcome role."
                });

                return;
            }

            // ------------------------------------------------
            // CHANNEL PERMISSIONS
            // ------------------------------------------------

            const permissions =
                channel.permissionsFor(
                    botMember
                );

            if (
                !permissions?.has(
                    [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.EmbedLinks
                    ]
                )
            ) {

                await interaction.editReply({
                    content:
                        "❌ 27Pro needs **View Channel**, **Send Messages**, and **Embed Links** permissions in that channel."
                });

                return;
            }

            // ------------------------------------------------
            // SAVE CONFIGURATION
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
                            message,

                        color:
                            color
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
                            "✅ 27Pro Welcome System Enabled"
                        )
                        .setDescription(
                            "Everything is configured and ready."
                        )
                        .setColor(
                            getColor(color)
                        )
                        .addFields(
                            {
                                name:
                                    "📢 Channel",
                                value:
                                    `<#${channel.id}>`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🎭 Auto Role",
                                value:
                                    `<@&${role.id}>`,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "🎨 Color",
                                value:
                                    color,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "💬 Message",
                                value:
                                    message
                            }
                        )
                        .setFooter({
                            text:
                                "27Pro • Welcome System"
                        })
                        .setTimestamp();

                await interaction.editReply({
                    embeds: [embed]
                });

                console.log(
                    `✅ Welcome configured for ${interaction.guild.name}`
                );

            } catch (error) {

                console.error(
                    "❌ Welcome setup error:",
                    error
                );

                await interaction.editReply({
                    content:
                        "❌ Database error while saving the configuration."
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
                            "❌ The 27Pro welcome system is currently disabled."
                    });

                    return;
                }

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "⚙️ 27Pro Welcome Configuration"
                        )
                        .setColor(
                            getColor(config.color)
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
                                    "Color",
                                value:
                                    config.color ||
                                    "#8B0000",
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
                        )
                        .setFooter({
                            text:
                                "27Pro • Welcome System"
                        })
                        .setTimestamp();

                if (config.image) {
                    embed.setImage(
                        config.image
                    );
                }

                await interaction.editReply({
                    embeds: [embed]
                });

            } catch (error) {

                console.error(
                    "❌ Config error:",
                    error
                );

                await interaction.editReply({
                    content:
                        "❌ Failed to load the configuration."
                });
            }

            return;
        }

        // ====================================================
        // PREVIEW
        // ====================================================

        if (
            subcommand === "preview"
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
                            "❌ Configure the 27Pro welcome system first."
                    });

                    return;
                }

                const embed =
                    createWelcomeEmbed(
                        config,
                        interaction.member
                    );

                await interaction.editReply({
                    content:
                        "👀 **27Pro Welcome Preview**",
                    embeds: [embed]
                });

            } catch (error) {

                console.error(
                    "❌ Preview error:",
                    error
                );

                await interaction.editReply({
                    content:
                        "❌ Failed to create the preview."
                });
            }

            return;
        }

        // ====================================================
        // TEST
        // ====================================================

        if (
            subcommand === "test"
        ) {

            try {

                const config =
                    await WelcomeConfig.findOne({
                        guildId:
                            interaction.guild.id,

                        enabled:
                            true
                    });

                if (!config) {

                    await interaction.editReply({
                        content:
                            "❌ Configure the 27Pro welcome system first."
                    });

                    return;
                }

                const channel =
                    interaction.guild.channels.cache.get(
                        config.channelId
                    );

                if (!channel) {

                    await interaction.editReply({
                        content:
                            "❌ The configured welcome channel no longer exists."
                    });

                    return;
                }

                const embed =
                    createWelcomeEmbed(
                        config,
                        interaction.member
                    );

                await channel.send({
                    content:
                        `🧪 **27Pro Welcome Test**\n<@${interaction.user.id}>`,
                    embeds: [embed]
                });

                await interaction.editReply({
                    content:
                        `✅ Test message sent to <#${channel.id}>.`
                });

            } catch (error) {

                console.error(
                    "❌ Test error:",
                    error
                );

                await interaction.editReply({
                    content:
                        "❌ Failed to send the test message."
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
                            "❌ No 27Pro welcome configuration exists for this server."
                    });

                    return;
                }

                await interaction.editReply({
                    content:
                        "🔴 **27Pro Welcome System Disabled**\n\nNew members will no longer receive the automatic welcome message or role."
                });

                console.log(
                    `🔴 Welcome disabled for ${interaction.guild.name}`
                );

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
            `👤 MEMBER JOINED: ${member.user.tag} → ${member.guild.name}`
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
                    "ℹ️ Welcome system is disabled/not configured."
                );

                return;
            }

            // =================================================
            // AUTOMATIC ROLE
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

                    } else if (role.managed) {

                        console.log(
                            "⚠️ Welcome role is managed."
                        );

                    } else {

                        await member.roles.add(
                            role,
                            "27Pro automatic welcome role"
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
            // WELCOME CHANNEL
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
            // PERMISSIONS
            // =================================================

            const botMember =
                member.guild.members.me;

            if (botMember) {

                const permissions =
                    channel.permissionsFor(
                        botMember
                    );

                if (
                    !permissions?.has(
                        [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    )
                ) {

                    console.log(
                        "❌ Missing permissions in welcome channel."
                    );

                    return;
                }
            }

            // =================================================
            // CREATE EMBED
            // =================================================

            const embed =
                createWelcomeEmbed(
                    config,
                    member
                );

            // =================================================
            // SEND
            // =================================================

            await channel.send({
                content:
                    `<@${member.id}>`,
                embeds: [embed]
            });

            console.log(
                "✅ 27PRO WELCOME MESSAGE SENT"
            );

        } catch (error) {

            console.error(
                "❌ Welcome event error:",
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

client.on(
    "warn",
    warning => {
        console.warn(
            "⚠️ Discord warning:",
            warning
        );
    }
);

// ============================================================
// PROCESS ERRORS
// ============================================================

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "❌ Unhandled Promise Rejection:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {
        console.error(
            "❌ Uncaught Exception:",
            error
        );
    }
);

// ============================================================
// LOGIN
// ============================================================

async function startBot() {

    console.log(
        "🔌 Connecting 27Pro to Discord..."
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
