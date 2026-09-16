require("dotenv").config();

const express = require("express");
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

// ======================================================
// ENVIRONMENT VARIABLES
// ======================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

// ======================================================
// CHECK REQUIRED VARIABLES
// ======================================================

if (!TOKEN) {
    console.error("❌ TOKEN is missing");
}

if (!CLIENT_ID) {
    console.error("❌ CLIENT_ID is missing");
}

if (!GUILD_ID) {
    console.error("❌ GUILD_ID is missing");
}

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing");
}

// ======================================================
// EXPRESS / HOSTINGER BACKEND
// ======================================================

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.status(200).send("K7Devs Discord Bot is online!");
});

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "online",
        bot: client.isReady() ? "connected" : "connecting",
        database:
            mongoose.connection.readyState === 1
                ? "connected"
                : "disconnected"
    });
});

// IMPORTANT:
// Start the HTTP server immediately.
// Hostinger requires listen() to happen quickly.

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Backend listening on port ${PORT}`);
    console.log(`🌐 http://0.0.0.0:${PORT}`);
});

server.on("error", (error) => {
    console.error("❌ HTTP server error:", error);
});

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ======================================================
// MONGODB SCHEMA
// ======================================================

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

const WelcomeConfig = mongoose.model(
    "WelcomeConfig",
    WelcomeConfigSchema
);

// ======================================================
// WELCOME COMMAND
// ======================================================

const welcomeCommand = new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure the welcome system")

    // SETUP
    .addSubcommand(subcommand =>
        subcommand
            .setName("setup")
            .setDescription("Setup the welcome system")

            .addChannelOption(option =>
                option
                    .setName("channel")
                    .setDescription("Welcome channel")
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )

            .addRoleOption(option =>
                option
                    .setName("role")
                    .setDescription("Role given to new members")
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("image")
                    .setDescription("Welcome image URL")
                    .setRequired(true)
            )

            .addStringOption(option =>
                option
                    .setName("message")
                    .setDescription("Welcome message")
                    .setRequired(true)
            )
    )

    // CONFIG
    .addSubcommand(subcommand =>
        subcommand
            .setName("config")
            .setDescription("View the current welcome configuration")
    )

    // DISABLE
    .addSubcommand(subcommand =>
        subcommand
            .setName("disable")
            .setDescription("Disable the welcome system")
    )

    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild
    );

// ======================================================
// REGISTER SLASH COMMAND
// ======================================================

async function registerCommands() {
    try {
        if (!CLIENT_ID || !GUILD_ID || !TOKEN) {
            console.error(
                "❌ Cannot register commands: missing CLIENT_ID, GUILD_ID or TOKEN."
            );
            return;
        }

        const rest = new REST({ version: "10" }).setToken(TOKEN);

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

        console.log("✅ /welcome command registered.");
    } catch (error) {
        console.error(
            "❌ Failed to register slash commands:",
            error
        );
    }
}

// ======================================================
// DISCORD READY
// ======================================================

client.once("ready", () => {
    console.log(
        `🤖 Logged in as ${client.user.tag}`
    );

    console.log(
        `🏠 Servers: ${client.guilds.cache.size}`
    );
});

// ======================================================
// WELCOME COMMAND HANDLER
// ======================================================

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName !== "welcome") return;

    if (!interaction.guild) {
        return interaction.reply({
            content: "❌ This command can only be used inside a server.",
            ephemeral: true
        });
    }

    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return interaction.reply({
            content:
                "❌ You need the **Manage Server** permission to use this.",
            ephemeral: true
        });
    }

    const subcommand = interaction.options.getSubcommand();

    // ==================================================
    // SETUP
    // ==================================================

    if (subcommand === "setup") {
        const channel =
            interaction.options.getChannel("channel");

        const role =
            interaction.options.getRole("role");

        const image =
            interaction.options.getString("image");

        const message =
            interaction.options.getString("message");

        // Validate image URL
        try {
            const url = new URL(image);

            if (
                url.protocol !== "http:" &&
                url.protocol !== "https:"
            ) {
                throw new Error("Invalid protocol");
            }
        } catch {
            return interaction.reply({
                content:
                    "❌ Please provide a valid HTTP/HTTPS image URL.",
                ephemeral: true
            });
        }

        // Check bot's role
        const botMember =
            interaction.guild.members.me;

        if (!botMember) {
            return interaction.reply({
                content:
                    "❌ I couldn't find my server member information.",
                ephemeral: true
            });
        }

        if (
            role.position >=
            botMember.roles.highest.position
        ) {
            return interaction.reply({
                content:
                    "❌ I cannot give that role because it is above or equal to my highest role.\n\nMove my bot role **above** the welcome role in Server Settings → Roles.",
                ephemeral: true
            });
        }

        try {
            await WelcomeConfig.findOneAndUpdate(
                {
                    guildId: interaction.guild.id
                },
                {
                    guildId: interaction.guild.id,
                    enabled: true,
                    channelId: channel.id,
                    roleId: role.id,
                    image: image,
                    message: message
                },
                {
                    upsert: true,
                    new: true
                }
            );

            const embed = new EmbedBuilder()
                .setTitle("✅ Welcome System Enabled")
                .setColor(0x8b0000)
                .addFields(
                    {
                        name: "Channel",
                        value: `<#${channel.id}>`,
                        inline: true
                    },
                    {
                        name: "Role",
                        value: `<@&${role.id}>`,
                        inline: true
                    },
                    {
                        name: "Message",
                        value: message
                    }
                )
                .setTimestamp();

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error(
                "❌ Welcome setup error:",
                error
            );

            return interaction.reply({
                content:
                    "❌ Something went wrong while saving the welcome configuration.",
                ephemeral: true
            });
        }
    }

    // ==================================================
    // CONFIG
    // ==================================================

    if (subcommand === "config") {
        try {
            const config =
                await WelcomeConfig.findOne({
                    guildId: interaction.guild.id
                });

            if (!config || !config.enabled) {
                return interaction.reply({
                    content:
                        "❌ The welcome system is currently disabled.",
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle("⚙️ Welcome Configuration")
                .setColor(0x8b0000)
                .addFields(
                    {
                        name: "Status",
                        value: "🟢 Enabled",
                        inline: true
                    },
                    {
                        name: "Channel",
                        value: config.channelId
                            ? `<#${config.channelId}>`
                            : "Not configured",
                        inline: true
                    },
                    {
                        name: "Role",
                        value: config.roleId
                            ? `<@&${config.roleId}>`
                            : "Not configured",
                        inline: true
                    },
                    {
                        name: "Message",
                        value:
                            config.message ||
                            "Not configured"
                    }
                )
                .setTimestamp();

            if (config.image) {
                embed.setImage(config.image);
            }

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            console.error(
                "❌ Welcome config error:",
                error
            );

            return interaction.reply({
                content:
                    "❌ Could not retrieve the welcome configuration.",
                ephemeral: true
            });
        }
    }

    // ==================================================
    // DISABLE
    // ==================================================

    if (subcommand === "disable") {
        try {
            const config =
                await WelcomeConfig.findOneAndUpdate(
                    {
                        guildId: interaction.guild.id
                    },
                    {
                        enabled: false
                    },
                    {
                        new: true
                    }
                );

            if (!config) {
                return interaction.reply({
                    content:
                        "❌ There is no welcome configuration for this server.",
                    ephemeral: true
                });
            }

            return interaction.reply({
                content:
                    "✅ The welcome system has been disabled.",
                ephemeral: true
            });

        } catch (error) {
            console.error(
                "❌ Welcome disable error:",
                error
            );

            return interaction.reply({
                content:
                    "❌ Could not disable the welcome system.",
                ephemeral: true
            });
        }
    }
});

// ======================================================
// NEW MEMBER
// ======================================================

client.on("guildMemberAdd", async member => {
    try {
        console.log(
            `👤 New member: ${member.user.tag} joined ${member.guild.name}`
        );

        const config =
            await WelcomeConfig.findOne({
                guildId: member.guild.id,
                enabled: true
            });

        if (!config) {
            console.log(
                `ℹ️ No welcome configuration for ${member.guild.name}`
            );
            return;
        }

        // ==============================================
        // GIVE ROLE
        // ==============================================

        if (config.roleId) {
            try {
                const role =
                    member.guild.roles.cache.get(
                        config.roleId
                    );

                if (role) {
                    await member.roles.add(role);

                    console.log(
                        `✅ Gave ${role.name} to ${member.user.tag}`
                    );
                } else {
                    console.log(
                        "⚠️ Welcome role no longer exists."
                    );
                }

            } catch (roleError) {
                console.error(
                    "❌ Could not give welcome role:",
                    roleError
                );
            }
        }

        // ==============================================
        // WELCOME CHANNEL
        // ==============================================

        const channel =
            member.guild.channels.cache.get(
                config.channelId
            );

        if (!channel) {
            console.log(
                "⚠️ Welcome channel no longer exists."
            );
            return;
        }

        // ==============================================
        // MESSAGE VARIABLES
        // ==============================================

        let welcomeMessage =
            config.message ||
            "Welcome {user} to {server}!";

        welcomeMessage =
            welcomeMessage
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

        // ==============================================
        // EMBED
        // ==============================================

        const embed = new EmbedBuilder()
            .setTitle("Welcome")
            .setDescription(welcomeMessage)
            .setColor(0x8b0000)
            .setThumbnail(
                member.user.displayAvatarURL({
                    dynamic: true,
                    size: 256
                })
            )
            .setFooter({
                text: member.guild.name
            })
            .setTimestamp();

        if (config.image) {
            embed.setImage(config.image);
        }

        // ==============================================
        // SEND
        // ==============================================

        await channel.send({
            content: `<@${member.id}>`,
            embeds: [embed]
        });

        console.log(
            `✅ Welcome message sent for ${member.user.tag}`
        );

    } catch (error) {
        console.error(
            "❌ Welcome system error:",
            error
        );
    }
});

// ======================================================
// MONGODB CONNECTION
// ======================================================

async function connectDatabase() {
    if (!MONGODB_URI) {
        console.error(
            "❌ MONGODB_URI is missing. Database disabled."
        );
        return;
    }

    try {
        await mongoose.connect(MONGODB_URI);

        console.log("🗄️ MongoDB connected successfully.");

    } catch (error) {
        console.error(
            "❌ MongoDB connection failed:",
            error
        );
    }
}

// ======================================================
// START DISCORD BOT
// ======================================================

async function startBot() {
    try {
        await connectDatabase();

        await registerCommands();

        if (!TOKEN) {
            console.error(
                "❌ TOKEN is missing. Discord bot cannot start."
            );
            return;
        }

        await client.login(TOKEN);

    } catch (error) {
        console.error(
            "❌ Bot startup error:",
            error
        );
    }
}

// ======================================================
// START
// ======================================================

startBot();
