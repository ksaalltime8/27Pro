// ============================================================
// 27PRO — ALL-IN-ONE DISCORD BOT
// ============================================================
// Features:
// 👋 Welcome system
// 🛡️ Moderation
// ⚙️ Server information
// 🔧 Utility commands
// 🎭 Role management
// 🎲 Fun commands
// 🗄️ MongoDB persistence
// 🌐 Hostinger health server
//
// IMPORTANT:
// - Keep your real TOKEN and MONGODB_URI private.
// - Enable Server Members Intent in Discord Developer Portal.
// - Put the 27Pro bot role ABOVE roles it needs to manage.
// ============================================================

require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");

const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    EmbedBuilder,
    SlashCommandBuilder,
    REST,
    Routes,
    ChannelType
} = require("discord.js");

// ============================================================
// CONFIG
// ============================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGODB_URI = process.env.MONGODB_URI;

const PORT = process.env.PORT || 5000;

const BOT_NAME = "27Pro";
const BOT_FOOTER = "27Pro • Made by iik27";

const DEFAULT_WELCOME_MESSAGE =
    "Welcome {user} to **{server}**! You are member #{count}. Enjoy your stay!";

// ============================================================
// ENV CHECK
// ============================================================

console.log("==========================================");
console.log("          27PRO STARTUP CHECK");
console.log("==========================================");

console.log("TOKEN:", TOKEN ? "FOUND" : "MISSING");
console.log("CLIENT_ID:", CLIENT_ID ? "FOUND" : "MISSING");
console.log("GUILD_ID:", GUILD_ID ? "FOUND" : "MISSING");
console.log("MONGODB_URI:", MONGODB_URI ? "FOUND" : "MISSING");
console.log("PORT:", PORT);

if (!TOKEN) {
    console.error("❌ TOKEN is missing.");
}

if (!CLIENT_ID) {
    console.warn("⚠️ CLIENT_ID is missing. The bot will use client.user.id.");
}

if (!GUILD_ID) {
    console.error("❌ GUILD_ID is missing.");
}

if (!MONGODB_URI) {
    console.warn("⚠️ MONGODB_URI is missing. MongoDB features will be disabled.");
}

// ============================================================
// HOSTINGER HTTP SERVER
// ============================================================

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "application/json"
    });

    res.end(
        JSON.stringify({
            status: "online",
            bot: BOT_NAME,
            message: "27Pro Discord Bot is online.",
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString()
        })
    );
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Hostinger server listening on port ${PORT}`);
});

// ============================================================
// DISCORD CLIENT
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// ============================================================
// MONGODB SCHEMAS
// ============================================================

const welcomeSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            required: true,
            unique: true
        },

        enabled: {
            type: Boolean,
            default: true
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
            default: DEFAULT_WELCOME_MESSAGE
        }
    },
    {
        timestamps: true
    }
);

const warningSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            required: true
        },

        userId: {
            type: String,
            required: true
        },

        moderatorId: {
            type: String,
            required: true
        },

        reason: {
            type: String,
            default: "No reason provided"
        }
    },
    {
        timestamps: true
    }
);

const guildSettingsSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            required: true,
            unique: true
        }
    },
    {
        timestamps: true
    }
);

const WelcomeConfig = mongoose.model(
    "WelcomeConfig",
    welcomeSchema
);

const Warning = mongoose.model(
    "Warning",
    warningSchema
);

const GuildSettings = mongoose.model(
    "GuildSettings",
    guildSettingsSchema
);

// ============================================================
// DATABASE
// ============================================================

async function connectDatabase() {
    if (!MONGODB_URI) {
        console.warn("⚠️ MongoDB disabled.");
        return;
    }

    try {
        await mongoose.connect(MONGODB_URI);

        console.log("✅ MongoDB connected.");
    } catch (error) {
        console.error("❌ MongoDB connection failed:");
        console.error(error.message);
    }
}

// ============================================================
// HELPERS
// ============================================================

function replaceVariables(message, member) {
    if (!message) {
        return DEFAULT_WELCOME_MESSAGE;
    }

    return message
        .replaceAll("{user}", `<@${member.id}>`)
        .replaceAll("{username}", member.user.username)
        .replaceAll(
            "{displayname}",
            member.displayName || member.user.username
        )
        .replaceAll("{server}", member.guild.name)
        .replaceAll("{count}", member.guild.memberCount.toString())
        .replaceAll("{id}", member.id);
}

function createBaseEmbed() {
    return new EmbedBuilder()
        .setColor("#ff003c")
        .setFooter({
            text: BOT_FOOTER
        })
        .setTimestamp();
}

function isGuildInteraction(interaction) {
    return Boolean(interaction.guild && interaction.guildId);
}

function canModerateMember(interaction, targetMember) {
    if (!targetMember) {
        return {
            allowed: false,
            reason: "That member could not be found."
        };
    }

    if (targetMember.id === interaction.guild.ownerId) {
        return {
            allowed: false,
            reason: "You cannot moderate the server owner."
        };
    }

    if (targetMember.id === interaction.user.id) {
        return {
            allowed: false,
            reason: "You cannot moderate yourself."
        };
    }

    const executor = interaction.member;

    if (
        interaction.user.id !== interaction.guild.ownerId &&
        targetMember.roles.highest.position >=
            executor.roles.highest.position
    ) {
        return {
            allowed: false,
            reason: "That member has an equal or higher role than you."
        };
    }

    const botMember = interaction.guild.members.me;

    if (!botMember) {
        return {
            allowed: false,
            reason: "I could not determine my server permissions."
        };
    }

    if (
        targetMember.roles.highest.position >=
        botMember.roles.highest.position
    ) {
        return {
            allowed: false,
            reason: "That member has an equal or higher role than 27Pro."
        };
    }

    return {
        allowed: true
    };
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h`;
    }

    const days = Math.floor(hours / 24);

    return `${days}d`;
}

function getRoleMention(role) {
    return role ? `<@&${role.id}>` : "None";
}

function getChannelMention(channel) {
    return channel ? `<#${channel.id}>` : "None";
}

// ============================================================
// SLASH COMMANDS
// ============================================================

const commands = [

    // ========================================================
    // WELCOME
    // ========================================================

    new SlashCommandBuilder()
        .setName("welcome")
        .setDescription("Manage the 27Pro welcome system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub =>
            sub
                .setName("setup")
                .setDescription("Configure the welcome system.")
                .addChannelOption(option =>
                    option
                        .setName("channel")
                        .setDescription("Welcome channel.")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription("Role to automatically give new members.")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("image")
                        .setDescription("Welcome image URL.")
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName("message")
                        .setDescription("Welcome message.")
                        .setRequired(false)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("config")
                .setDescription("View the current welcome configuration.")
        )

        .addSubcommand(sub =>
            sub
                .setName("preview")
                .setDescription("Preview the welcome message.")
        )

        .addSubcommand(sub =>
            sub
                .setName("test")
                .setDescription("Send a real welcome test.")
        )

        .addSubcommand(sub =>
            sub
                .setName("disable")
                .setDescription("Disable the welcome system.")
        ),

    // ========================================================
    // MODERATION
    // ========================================================

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member.")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to ban.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Ban reason.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user.")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option
                .setName("userid")
                .setDescription("User ID.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member.")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to kick.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Kick reason.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Timeout a member.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to timeout.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("minutes")
                .setDescription("Timeout duration in minutes.")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Timeout reason.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Remove a member's timeout.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to untimeout.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to warn.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Warning reason.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View a member's warnings.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Delete messages from a channel.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Number of messages.")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Set channel slowmode.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption(option =>
            option
                .setName("seconds")
                .setDescription("Slowmode seconds. 0 disables it.")
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Lock the current channel.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlock the current channel.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    // ========================================================
    // SERVER
    // ========================================================

    new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Display server information."),

    new SlashCommandBuilder()
        .setName("membercount")
        .setDescription("Display the server member count."),

    new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Display user information.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("roleinfo")
        .setDescription("Display role information.")
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("Role.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("channelinfo")
        .setDescription("Display channel information.")
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("Channel.")
                .setRequired(false)
        ),

    // ========================================================
    // UTILITY
    // ========================================================

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check 27Pro latency."),

    new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Display 27Pro information."),

    new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Show a user's avatar.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("banner")
        .setDescription("Show a user's banner.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("say")
        .setDescription("Make 27Pro send a message.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("Message to send.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Send an announcement embed.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option
                .setName("title")
                .setDescription("Announcement title.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("Announcement message.")
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("Announcement channel.")
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText)
        ),

    new SlashCommandBuilder()
        .setName("poll")
        .setDescription("Create a yes/no poll.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option
                .setName("question")
                .setDescription("Poll question.")
                .setRequired(true)
        ),

    // ========================================================
    // ROLES
    // ========================================================

    new SlashCommandBuilder()
        .setName("role")
        .setDescription("Manage server roles.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

        .addSubcommand(sub =>
            sub
                .setName("add")
                .setDescription("Give a role to a member.")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("Member.")
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription("Role.")
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("remove")
                .setDescription("Remove a role from a member.")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("Member.")
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription("Role.")
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("create")
                .setDescription("Create a role.")
                .addStringOption(option =>
                    option
                        .setName("name")
                        .setDescription("Role name.")
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("delete")
                .setDescription("Delete a role.")
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription("Role to delete.")
                        .setRequired(true)
                )
        ),

    // ========================================================
    // FUN
    // ========================================================

    new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Ask the magic 8-ball a question.")
        .addStringOption(option =>
            option
                .setName("question")
                .setDescription("Your question.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Flip a coin."),

    new SlashCommandBuilder()
        .setName("roll")
        .setDescription("Roll a dice.")
        .addIntegerOption(option =>
            option
                .setName("sides")
                .setDescription("Number of sides.")
                .setRequired(false)
                .setMinValue(2)
                .setMaxValue(1000)
        ),

    new SlashCommandBuilder()
        .setName("choose")
        .setDescription("Choose between options.")
        .addStringOption(option =>
            option
                .setName("options")
                .setDescription("Separate options using commas.")
                .setRequired(true)
        )

].map(command => command.toJSON());

// ============================================================
// REGISTER COMMANDS
// ============================================================

async function registerCommands() {

    if (!TOKEN) {
        console.error(
            "❌ Cannot register commands: TOKEN is missing."
        );
        return false;
    }

    if (!GUILD_ID) {
        console.error(
            "❌ Cannot register commands: GUILD_ID is missing."
        );
        return false;
    }

    if (!client.user) {
        console.error(
            "❌ Cannot register commands: Discord client is not ready."
        );
        return false;
    }

    try {

        const rest =
            new REST({
                version: "10"
            }).setToken(TOKEN);

        // IMPORTANT:
        // Use the application ID belonging to the token
        // that actually logged into Discord.
        const applicationId =
            client.user.id;

        console.log("==========================================");
        console.log("🔄 REGISTERING 27PRO COMMANDS");
        console.log("==========================================");

        console.log(
            "Actual Application ID:",
            applicationId
        );

        console.log(
            "Configured CLIENT_ID:",
            CLIENT_ID || "MISSING"
        );

        console.log(
            "Guild ID:",
            GUILD_ID
        );

        console.log(
            "Commands:",
            commands.length
        );

        if (
            CLIENT_ID &&
            CLIENT_ID !== applicationId
        ) {
            console.warn(
                "⚠️ CLIENT_ID does not match the bot authenticated by TOKEN."
            );

            console.warn(
                "⚠️ Using the authenticated bot's ID instead."
            );
        }

        await rest.put(
            Routes.applicationGuildCommands(
                applicationId,
                GUILD_ID
            ),
            {
                body: commands
            }
        );

        console.log(
            `✅ Successfully registered ${commands.length} commands.`
        );

        // Verify commands actually exist on Discord.
        const registered =
            await rest.get(
                Routes.applicationGuildCommands(
                    applicationId,
                    GUILD_ID
                )
            );

        console.log(
            `✅ Discord currently has ${registered.length} guild commands.`
        );

        console.log(
            "Registered:",
            registered
                .map(command => command.name)
                .join(", ")
        );

        console.log("==========================================");

        return true;

    } catch (error) {

        console.error(
            "❌ COMMAND REGISTRATION FAILED:"
        );

        console.error(error);

        return false;
    }
}

// ============================================================
// READY
// ============================================================

client.once("ready", async () => {

    console.log("==========================================");
    console.log(`🤖 ${BOT_NAME} IS ONLINE`);
    console.log("==========================================");

    console.log(
        `👤 Username: ${client.user.tag}`
    );

    console.log(
        `🆔 REAL Application ID: ${client.user.id}`
    );

    console.log(
        `🏠 Guilds: ${client.guilds.cache.size}`
    );

    console.log(
        `📡 Discord Ping: ${client.ws.ping}ms`
    );

    const guild =
        client.guilds.cache.get(GUILD_ID);

    if (guild) {

        console.log(
            `✅ Target guild found: ${guild.name}`
        );

        console.log(
            `🆔 Target guild ID: ${guild.id}`
        );

    } else {

        console.error(
            "❌ TARGET GUILD NOT FOUND."
        );

        console.error(
            "The GUILD_ID does not appear to be a server this bot is in."
        );
    }

    console.log("==========================================");

    client.user.setPresence({
        activities: [
            {
                name: "iik27 on top",
                type: 3
            }
        ],
        status: "online"
    });

    await registerCommands();
});

// ============================================================
// INTERACTION HANDLER
// ============================================================

client.on(
    "interactionCreate",
    async interaction => {

        console.log("==========================================");
        console.log(
            "📥 DISCORD INTERACTION RECEIVED"
        );

        console.log(
            "Type:",
            interaction.type
        );

        console.log(
            "Command:",
            interaction.commandName || "unknown"
        );

        console.log(
            "User:",
            interaction.user?.tag || "unknown"
        );

        console.log(
            "User ID:",
            interaction.user?.id || "unknown"
        );

        console.log(
            "Guild ID:",
            interaction.guildId || "DM"
        );

        console.log(
            "Interaction ID:",
            interaction.id
        );

        console.log("==========================================");

        if (!interaction.isChatInputCommand()) {
            console.log(
                "ℹ️ Interaction is not a slash command."
            );

            return;
        }

        try {

            if (!isGuildInteraction(interaction)) {

                await interaction.reply({
                    content:
                        "❌ This command can only be used inside a server.",
                    ephemeral: true
                });

                return;
            }

            const command =
                interaction.commandName;

            // ====================================================
            // WELCOME
            // ====================================================

            if (command === "welcome") {

                await interaction.deferReply({
                    ephemeral: true
                });

                const subcommand =
                    interaction.options.getSubcommand();

                if (subcommand === "setup") {

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

                    const config =
                        await WelcomeConfig.findOneAndUpdate(
                            {
                                guildId:
                                    interaction.guildId
                            },
                            {
                                guildId:
                                    interaction.guildId,

                                enabled: true,

                                channelId:
                                    channel.id,

                                roleId:
                                    role
                                        ? role.id
                                        : null,

                                image:
                                    image || null,

                                message:
                                    message ||
                                    DEFAULT_WELCOME_MESSAGE
                            },
                            {
                                upsert: true,
                                new: true
                            }
                        );

                    await interaction.editReply({
                        content:
                            `✅ **27Pro Welcome System Configured**\n\n` +
                            `**Channel:** ${getChannelMention(channel)}\n` +
                            `**Role:** ${getRoleMention(role)}\n` +
                            `**Image:** ${config.image || "None"}\n` +
                            `**Message:** ${config.message}`
                    });

                    return;
                }

                if (subcommand === "config") {

                    const config =
                        await WelcomeConfig.findOne({
                            guildId:
                                interaction.guildId
                        });

                    if (!config) {

                        await interaction.editReply({
                            content:
                                "❌ The welcome system has not been configured yet."
                        });

                        return;
                    }

                    const channel =
                        interaction.guild.channels.cache.get(
                            config.channelId
                        );

                    const role =
                        config.roleId
                            ? interaction.guild.roles.cache.get(
                                config.roleId
                            )
                            : null;

                    const embed =
                        createBaseEmbed()
                            .setTitle(
                                "👋 27Pro Welcome Configuration"
                            )
                            .addFields(
                                {
                                    name: "Status",
                                    value:
                                        config.enabled
                                            ? "🟢 Enabled"
                                            : "🔴 Disabled",
                                    inline: true
                                },
                                {
                                    name: "Channel",
                                    value:
                                        getChannelMention(
                                            channel
                                        ),
                                    inline: true
                                },
                                {
                                    name: "Role",
                                    value:
                                        getRoleMention(
                                            role
                                        ),
                                    inline: true
                                },
                                {
                                    name: "Message",
                                    value:
                                        config.message ||
                                        DEFAULT_WELCOME_MESSAGE
                                }
                            );

                    if (config.image) {
                        embed.setImage(
                            config.image
                        );
                    }

                    await interaction.editReply({
                        embeds: [embed]
                    });

                    return;
                }

                if (subcommand === "preview") {

                    const config =
                        await WelcomeConfig.findOne({
                            guildId:
                                interaction.guildId
                        });

                    if (!config) {

                        await interaction.editReply({
                            content:
                                "❌ Configure the welcome system first with `/welcome setup`."
                        });

                        return;
                    }

                    const fakeMember =
                        interaction.member;

                    const welcomeText =
                        replaceVariables(
                            config.message,
                            fakeMember
                        );

                    const embed =
                        createBaseEmbed()
                            .setTitle(
                                "👋 Welcome to " +
                                interaction.guild.name
                            )
                            .setDescription(
                                welcomeText
                            )
                            .setThumbnail(
                                fakeMember.user.displayAvatarURL(
                                    {
                                        size: 256
                                    }
                                )
                            );

                    if (config.image) {
                        embed.setImage(
                            config.image
                        );
                    }

                    await interaction.editReply({
                        content: "Preview:",
                        embeds: [embed]
                    });

                    return;
                }

                if (subcommand === "test") {

                    const config =
                        await WelcomeConfig.findOne({
                            guildId:
                                interaction.guildId
                        });

                    if (
                        !config ||
                        !config.channelId
                    ) {

                        await interaction.editReply({
                            content:
                                "❌ Configure the welcome system first."
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

                    const welcomeText =
                        replaceVariables(
                            config.message,
                            interaction.member
                        );

                    const embed =
                        createBaseEmbed()
                            .setTitle(
                                "👋 Welcome to " +
                                interaction.guild.name
                            )
                            .setDescription(
                                welcomeText
                            )
                            .setThumbnail(
                                interaction.user.displayAvatarURL(
                                    {
                                        size: 256
                                    }
                                )
                            );

                    if (config.image) {
                        embed.setImage(
                            config.image
                        );
                    }

                    await channel.send({
                        content:
                            `<@${interaction.user.id}>`,
                        embeds: [embed]
                    });

                    await interaction.editReply({
                        content:
                            `✅ Test welcome sent to ${channel}.`
                    });

                    return;
                }

                if (subcommand === "disable") {

                    await WelcomeConfig.findOneAndUpdate(
                        {
                            guildId:
                                interaction.guildId
                        },
                        {
                            enabled: false
                        },
                        {
                            upsert: true
                        }
                    );

                    await interaction.editReply({
                        content:
                            "🔴 27Pro welcome system has been disabled."
                    });

                    return;
                }
            }

            // ====================================================
            // BAN
            // ====================================================

            if (command === "ban") {

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                const reason =
                    interaction.options.getString(
                        "reason"
                    ) ||
                    "No reason provided";

                const member =
                    await interaction.guild.members
                        .fetch(user.id)
                        .catch(() => null);

                const check =
                    canModerateMember(
                        interaction,
                        member
                    );

                if (!check.allowed) {

                    await interaction.reply({
                        content:
                            `❌ ${check.reason}`,
                        ephemeral: true
                    });

                    return;
                }

                await member.ban({
                    reason
                });

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            "🔨 Member Banned"
                        )
                        .addFields(
                            {
                                name: "User",
                                value:
                                    `${user.tag}`,
                                inline: true
                            },
                            {
                                name: "Moderator",
                                value:
                                    `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: "Reason",
                                value:
                                    reason
                            }
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // UNBAN
            // ====================================================

            if (command === "unban") {

                const userId =
                    interaction.options.getString(
                        "userid"
                    );

                try {

                    const user =
                        await interaction.guild.bans.fetch(
                            userId
                        );

                    await interaction.guild.members.unban(
                        userId
                    );

                    await interaction.reply({
                        content:
                            `✅ **${user.user.tag}** has been unbanned.`
                    });

                } catch {

                    await interaction.reply({
                        content:
                            "❌ I could not find a ban for that user ID.",
                        ephemeral: true
                    });
                }

                return;
            }

            // ====================================================
            // KICK
            // ====================================================

            if (command === "kick") {

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                const reason =
                    interaction.options.getString(
                        "reason"
                    ) ||
                    "No reason provided";

                const member =
                    await interaction.guild.members
                        .fetch(user.id)
                        .catch(() => null);

                const check =
                    canModerateMember(
                        interaction,
                        member
                    );

                if (!check.allowed) {

                    await interaction.reply({
                        content:
                            `❌ ${check.reason}`,
                        ephemeral: true
                    });

                    return;
                }

                await member.kick(reason);

                await interaction.reply({
                    content:
                        `👢 **${user.tag}** has been kicked.\n**Reason:** ${reason}`
                });

                return;
            }

            // ====================================================
            // TIMEOUT
            // ====================================================

            if (command === "timeout") {

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                const minutes =
                    interaction.options.getInteger(
                        "minutes"
                    );

                const reason =
                    interaction.options.getString(
                        "reason"
                    ) ||
                    "No reason provided";

                const member =
                    await interaction.guild.members
                        .fetch(user.id)
                        .catch(() => null);

                const check =
                    canModerateMember(
                        interaction,
                        member
                    );

                if (!check.allowed) {

                    await interaction.reply({
                        content:
                            `❌ ${check.reason}`,
                        ephemeral: true
                    });

                    return;
                }

                await member.timeout(
                    minutes * 60 * 1000,
                    reason
                );

                await interaction.reply({
                    content:
                        `⏱️ **${user.tag}** has been timed out for **${minutes} minutes**.\n**Reason:** ${reason}`
                });

                return;
            }

            // ====================================================
            // UNTIMEOUT
            // ====================================================

            if (command === "untimeout") {

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                const member =
                    await interaction.guild.members
                        .fetch(user.id)
                        .catch(() => null);

                if (!member) {

                    await interaction.reply({
                        content:
                            "❌ Member not found.",
                        ephemeral: true
                    });

                    return;
                }

                await member.timeout(null);

                await interaction.reply({
                    content:
                        `✅ Timeout removed from **${user.tag}**.`
                });

                return;
            }

            // ====================================================
            // WARN
            // ====================================================

            if (command === "warn") {

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                const reason =
                    interaction.options.getString(
                        "reason"
                    ) ||
                    "No reason provided";

                const member =
                    await interaction.guild.members
                        .fetch(user.id)
                        .catch(() => null);

                const check =
                    canModerateMember(
                        interaction,
                        member
                    );

                if (!check.allowed) {

                    await interaction.reply({
                        content:
                            `❌ ${check.reason}`,
                        ephemeral: true
                    });

                    return;
                }

                if (
                    mongoose.connection.readyState !== 1
                ) {

                    await interaction.reply({
                        content:
                            "❌ MongoDB is currently unavailable.",
                        ephemeral: true
                    });

                    return;
                }

                await Warning.create({
                    guildId:
                        interaction.guildId,
                    userId:
                        user.id,
                    moderatorId:
                        interaction.user.id,
                    reason
                });

                const count =
                    await Warning.countDocuments({
                        guildId:
                            interaction.guildId,
                        userId:
                            user.id
                    });

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            "⚠️ Member Warned"
                        )
                        .setThumbnail(
                            user.displayAvatarURL(
                                {
                                    size: 256
                                }
                            )
                        )
                        .addFields(
                            {
                                name: "User",
                                value:
                                    `${user}`,
                                inline: true
                            },
                            {
                                name: "Warnings",
                                value:
                                    `${count}`,
                                inline: true
                            },
                            {
                                name: "Moderator",
                                value:
                                    `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: "Reason",
                                value:
                                    reason
                            }
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // WARNINGS
            // ====================================================

            if (command === "warnings") {

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                if (
                    mongoose.connection.readyState !== 1
                ) {

                    await interaction.reply({
                        content:
                            "❌ MongoDB is currently unavailable.",
                        ephemeral: true
                    });

                    return;
                }

                const warnings =
                    await Warning.find({
                        guildId:
                            interaction.guildId,
                        userId:
                            user.id
                    })
                    .sort({
                        createdAt: -1
                    })
                    .limit(10);

                if (!warnings.length) {

                    await interaction.reply({
                        content:
                            `✅ **${user.tag}** has no warnings.`
                    });

                    return;
                }

                const text =
                    warnings
                        .map(
                            (warning, index) =>
                                `**${index + 1}.** ${warning.reason}\n` +
                                `Moderator: <@${warning.moderatorId}>`
                        )
                        .join("\n\n");

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            `⚠️ Warnings — ${user.tag}`
                        )
                        .setDescription(
                            text
                        )
                        .setFooter({
                            text:
                                `${BOT_FOOTER} • Showing latest 10`
                        });

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // CLEAR
            // ====================================================

            if (command === "clear") {

                const amount =
                    interaction.options.getInteger(
                        "amount"
                    );

                if (
                    !interaction.channel.isTextBased()
                ) {

                    await interaction.reply({
                        content:
                            "❌ This command cannot be used here.",
                        ephemeral: true
                    });

                    return;
                }

                const deleted =
                    await interaction.channel.bulkDelete(
                        amount,
                        true
                    );

                await interaction.reply({
                    content:
                        `🧹 Deleted **${deleted.size}** messages.`,
                    ephemeral: true
                });

                return;
            }

            // ====================================================
            // SLOWMODE
            // ====================================================

            if (command === "slowmode") {

                const seconds =
                    interaction.options.getInteger(
                        "seconds"
                    );

                if (
                    !interaction.channel.isTextBased()
                ) {

                    await interaction.reply({
                        content:
                            "❌ This channel does not support slowmode.",
                        ephemeral: true
                    });

                    return;
                }

                await interaction.channel.setRateLimitPerUser(
                    seconds
                );

                await interaction.reply({
                    content:
                        seconds === 0
                            ? "🚀 Slowmode disabled."
                            : `🐢 Slowmode set to **${seconds} seconds**.`
                });

                return;
            }

            // ====================================================
            // LOCK
            // ====================================================

            if (command === "lock") {

                await interaction.channel.permissionOverwrites.edit(
                    interaction.guild.roles.everyone,
                    {
                        SendMessages: false
                    }
                );

                await interaction.reply({
                    content:
                        "🔒 This channel has been locked."
                });

                return;
            }

            // ====================================================
            // UNLOCK
            // ====================================================

            if (command === "unlock") {

                await interaction.channel.permissionOverwrites.edit(
                    interaction.guild.roles.everyone,
                    {
                        SendMessages: null
                    }
                );

                await interaction.reply({
                    content:
                        "🔓 This channel has been unlocked."
                });

                return;
            }

            // ====================================================
            // SERVER INFO
            // ====================================================

            if (command === "serverinfo") {

                const guild =
                    interaction.guild;

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            `🖥️ ${guild.name}`
                        )
                        .setThumbnail(
                            guild.iconURL({
                                size: 256
                            })
                        )
                        .addFields(
                            {
                                name: "Owner",
                                value:
                                    `<@${guild.ownerId}>`,
                                inline: true
                            },
                            {
                                name: "Members",
                                value:
                                    `${guild.memberCount}`,
                                inline: true
                            },
                            {
                                name: "Channels",
                                value:
                                    `${guild.channels.cache.size}`,
                                inline: true
                            },
                            {
                                name: "Roles",
                                value:
                                    `${guild.roles.cache.size}`,
                                inline: true
                            },
                            {
                                name: "Server ID",
                                value:
                                    guild.id,
                                inline: true
                            },
                            {
                                name: "Created",
                                value:
                                    `<t:${Math.floor(
                                        guild.createdTimestamp / 1000
                                    )}:F>`,
                                inline: true
                            }
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // MEMBER COUNT
            // ====================================================

            if (command === "membercount") {

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            "👥 Server Members"
                        )
                        .setDescription(
                            `This server currently has **${interaction.guild.memberCount}** members.`
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // USER INFO
            // ====================================================

            if (command === "userinfo") {

                const user =
                    interaction.options.getUser(
                        "user"
                    ) ||
                    interaction.user;

                const member =
                    await interaction.guild.members
                        .fetch(user.id)
                        .catch(() => null);

                const roles =
                    member
                        ? member.roles.cache
                            .filter(
                                role =>
                                    role.id !==
                                    interaction.guild.id
                            )
                            .map(
                                role =>
                                    role.toString()
                            )
                            .join(", ")
                        : "None";

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            `👤 ${user.tag}`
                        )
                        .setThumbnail(
                            user.displayAvatarURL({
                                size: 512
                            })
                        )
                        .addFields(
                            {
                                name: "Username",
                                value:
                                    user.username,
                                inline: true
                            },
                            {
                                name: "User ID",
                                value:
                                    user.id,
                                inline: true
                            },
                            {
                                name:
                                    "Account Created",
                                value:
                                    `<t:${Math.floor(
                                        user.createdTimestamp / 1000
                                    )}:F>`,
                                inline: true
                            },
                            {
                                name:
                                    "Joined Server",
                                value:
                                    member
                                        ? `<t:${Math.floor(
                                            member.joinedTimestamp / 1000
                                        )}:F>`
                                        : "Not in server",
                                inline: true
                            },
                            {
                                name: "Roles",
                                value:
                                    roles ||
                                    "None"
                            }
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // ROLE INFO
            // ====================================================

            if (command === "roleinfo") {

                const role =
                    interaction.options.getRole(
                        "role"
                    );

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            `🎭 ${role.name}`
                        )
                        .addFields(
                            {
                                name: "Role ID",
                                value:
                                    role.id,
                                inline: true
                            },
                            {
                                name: "Members",
                                value:
                                    `${role.members.size}`,
                                inline: true
                            },
                            {
                                name: "Position",
                                value:
                                    `${role.position}`,
                                inline: true
                            },
                            {
                                name: "Mentionable",
                                value:
                                    role.mentionable
                                        ? "Yes"
                                        : "No",
                                inline: true
                            },
                            {
                                name: "Hoisted",
                                value:
                                    role.hoist
                                        ? "Yes"
                                        : "No",
                                inline: true
                            }
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // CHANNEL INFO
            // ====================================================

            if (command === "channelinfo") {

                const channel =
                    interaction.options.getChannel(
                        "channel"
                    ) ||
                    interaction.channel;

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            `📺 ${channel.name}`
                        )
                        .addFields(
                            {
                                name: "Channel ID",
                                value:
                                    channel.id,
                                inline: true
                            },
                            {
                                name: "Type",
                                value:
                                    `${channel.type}`,
                                inline: true
                            },
                            {
                                name: "Created",
                                value:
                                    `<t:${Math.floor(
                                        channel.createdTimestamp / 1000
                                    )}:F>`,
                                inline: true
                            }
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // PING
            // ====================================================

            if (command === "ping") {

                console.log(
                    "🏓 /ping received."
                );

                try {

                    const start =
                        Date.now();

                    await interaction.reply({
                        content:
                            "🏓 **Pong!**"
                    });

                    const responseTime =
                        Date.now() - start;

                    console.log(
                        `✅ /ping replied successfully in ${responseTime}ms`
                    );

                    await interaction.editReply({
                        content:
                            `🏓 **Pong!**\n` +
                            `API: **${client.ws.ping}ms**\n` +
                            `Response: **${responseTime}ms**`
                    });

                    console.log(
                        "✅ /ping editReply successful."
                    );

                } catch (error) {

                    console.error(
                        "❌ /ping FAILED:"
                    );

                    console.error(error);
                }

                return;
            }

            // ====================================================
            // BOT INFO
            // ====================================================

            if (command === "botinfo") {

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            "🤖 27Pro"
                        )
                        .setDescription(
                            "A multipurpose Discord bot built for modern communities."
                        )
                        .addFields(
                            {
                                name: "Version",
                                value:
                                    "1.0.0",
                                inline: true
                            },
                            {
                                name: "Servers",
                                value:
                                    `${client.guilds.cache.size}`,
                                inline: true
                            },
                            {
                                name: "Uptime",
                                value:
                                    formatDuration(
                                        process.uptime() *
                                        1000
                                    ),
                                inline: true
                            },
                            {
                                name: "Latency",
                                value:
                                    `${client.ws.ping}ms`,
                                inline: true
                            },
                            {
                                name: "Database",
                                value:
                                    mongoose.connection.readyState ===
                                    1
                                        ? "🟢 Connected"
                                        : "🔴 Offline",
                                inline: true
                            }
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // AVATAR
            // ====================================================

            if (command === "avatar") {

                const user =
                    interaction.options.getUser(
                        "user"
                    ) ||
                    interaction.user;

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            `🖼️ ${user.tag}'s Avatar`
                        )
                        .setImage(
                            user.displayAvatarURL({
                                size: 1024,
                                extension: "png"
                            })
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // BANNER
            // ====================================================

            if (command === "banner") {

                const user =
                    interaction.options.getUser(
                        "user"
                    ) ||
                    interaction.user;

                const fullUser =
                    await client.users.fetch(
                        user.id,
                        {
                            force: true
                        }
                    );

                if (!fullUser.banner) {

                    await interaction.reply({
                        content:
                            "❌ This user does not have a profile banner.",
                        ephemeral: true
                    });

                    return;
                }

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            `🖼️ ${user.tag}'s Banner`
                        )
                        .setImage(
                            fullUser.bannerURL({
                                size: 1024
                            })
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // SAY
            // ====================================================

            if (command === "say") {

                const message =
                    interaction.options.getString(
                        "message"
                    );

                await interaction.channel.send({
                    content:
                        message
                });

                await interaction.reply({
                    content:
                        "✅ Message sent.",
                    ephemeral: true
                });

                return;
            }

            // ====================================================
            // ANNOUNCE
            // ====================================================

            if (command === "announce") {

                const title =
                    interaction.options.getString(
                        "title"
                    );

                const message =
                    interaction.options.getString(
                        "message"
                    );

                const channel =
                    interaction.options.getChannel(
                        "channel"
                    ) ||
                    interaction.channel;

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            `📢 ${title}`
                        )
                        .setDescription(
                            message
                        )
                        .setAuthor({
                            name:
                                interaction.guild.name,
                            iconURL:
                                interaction.guild.iconURL() ||
                                undefined
                        });

                await channel.send({
                    embeds: [embed]
                });

                await interaction.reply({
                    content:
                        `✅ Announcement sent to ${channel}.`,
                    ephemeral: true
                });

                return;
            }

            // ====================================================
            // POLL
            // ====================================================

            if (command === "poll") {

                const question =
                    interaction.options.getString(
                        "question"
                    );

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            "📊 Poll"
                        )
                        .setDescription(
                            `**${question}**\n\n` +
                            "👍 Yes\n" +
                            "👎 No"
                        )
                        .setFooter({
                            text:
                                `${BOT_FOOTER} • Poll`
                        });

                const message =
                    await interaction.channel.send({
                        embeds: [embed]
                    });

                await message.react("👍");
                await message.react("👎");

                await interaction.reply({
                    content:
                        "✅ Poll created.",
                    ephemeral: true
                });

                return;
            }

            // ====================================================
            // ROLE COMMAND
            // ====================================================

            if (command === "role") {

                const subcommand =
                    interaction.options.getSubcommand();

                const botMember =
                    interaction.guild.members.me;

                if (!botMember) {

                    await interaction.reply({
                        content:
                            "❌ I could not determine my server member information.",
                        ephemeral: true
                    });

                    return;
                }

                if (subcommand === "add") {

                    const user =
                        interaction.options.getUser(
                            "user"
                        );

                    const role =
                        interaction.options.getRole(
                            "role"
                        );

                    const member =
                        await interaction.guild.members
                            .fetch(user.id)
                            .catch(() => null);

                    if (!member) {

                        await interaction.reply({
                            content:
                                "❌ Member not found.",
                            ephemeral: true
                        });

                        return;
                    }

                    if (role.managed) {

                        await interaction.reply({
                            content:
                                "❌ I cannot manage an integration/bot role.",
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
                                "❌ That role is above or equal to my highest role.",
                            ephemeral: true
                        });

                        return;
                    }

                    await member.roles.add(role);

                    await interaction.reply({
                        content:
                            `✅ Added ${role} to **${user.tag}**.`
                    });

                    return;
                }

                if (subcommand === "remove") {

                    const user =
                        interaction.options.getUser(
                            "user"
                        );

                    const role =
                        interaction.options.getRole(
                            "role"
                        );

                    const member =
                        await interaction.guild.members
                            .fetch(user.id)
                            .catch(() => null);

                    if (!member) {

                        await interaction.reply({
                            content:
                                "❌ Member not found.",
                            ephemeral: true
                        });

                        return;
                    }

                    if (role.managed) {

                        await interaction.reply({
                            content:
                                "❌ I cannot manage an integration/bot role.",
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
                                "❌ That role is above or equal to my highest role.",
                            ephemeral: true
                        });

                        return;
                    }

                    await member.roles.remove(role);

                    await interaction.reply({
                        content:
                            `✅ Removed ${role} from **${user.tag}**.`
                    });

                    return;
                }

                if (subcommand === "create") {

                    const name =
                        interaction.options.getString(
                            "name"
                        );

                    const role =
                        await interaction.guild.roles.create({
                            name,
                            reason:
                                `Created by ${interaction.user.tag}`
                        });

                    await interaction.reply({
                        content:
                            `✅ Created ${role}.`
                    });

                    return;
                }

                if (subcommand === "delete") {

                    const role =
                        interaction.options.getRole(
                            "role"
                        );

                    if (role.managed) {

                        await interaction.reply({
                            content:
                                "❌ I cannot delete a managed role.",
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
                                "❌ That role is above or equal to my highest role.",
                            ephemeral: true
                        });

                        return;
                    }

                    const roleName =
                        role.name;

                    await role.delete(
                        `Deleted by ${interaction.user.tag}`
                    );

                    await interaction.reply({
                        content:
                            `🗑️ Role **${roleName}** deleted.`
                    });

                    return;
                }
            }

            // ====================================================
            // 8BALL
            // ====================================================

            if (command === "8ball") {

                const answers = [
                    "Yes.",
                    "No.",
                    "Definitely.",
                    "Probably.",
                    "Probably not.",
                    "Absolutely not.",
                    "Without a doubt.",
                    "Ask again later.",
                    "The answer is unclear.",
                    "Maybe.",
                    "I wouldn't count on it."
                ];

                const answer =
                    answers[
                        Math.floor(
                            Math.random() *
                            answers.length
                        )
                    ];

                const embed =
                    createBaseEmbed()
                        .setTitle(
                            "🎱 Magic 8-Ball"
                        )
                        .addFields(
                            {
                                name: "Question",
                                value:
                                    interaction.options.getString(
                                        "question"
                                    )
                            },
                            {
                                name: "Answer",
                                value:
                                    answer
                            }
                        );

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ====================================================
            // COINFLIP
            // ====================================================

            if (command === "coinflip") {

                const result =
                    Math.random() < 0.5
                        ? "Heads 🪙"
                        : "Tails 🪙";

                await interaction.reply({
                    content:
                        `🪙 **${result}**`
                });

                return;
            }

            // ====================================================
            // ROLL
            // ====================================================

            if (command === "roll") {

                const sides =
                    interaction.options.getInteger(
                        "sides"
                    ) ||
                    6;

                const result =
                    Math.floor(
                        Math.random() *
                        sides
                    ) + 1;

                await interaction.reply({
                    content:
                        `🎲 You rolled **${result}** on a **d${sides}**.`
                });

                return;
            }

            // ====================================================
            // CHOOSE
            // ====================================================

            if (command === "choose") {

                const options =
                    interaction.options
                        .getString("options")
                        .split(",")
                        .map(
                            option =>
                                option.trim()
                        )
                        .filter(Boolean);

                if (options.length < 2) {

                    await interaction.reply({
                        content:
                            "❌ Give me at least two options separated by commas.",
                        ephemeral: true
                    });

                    return;
                }

                const choice =
                    options[
                        Math.floor(
                            Math.random() *
                            options.length
                        )
                    ];

                await interaction.reply({
                    content:
                        `🎯 I choose: **${choice}**`
                });

                return;
            }

            // ====================================================
            // UNKNOWN COMMAND
            // ====================================================

            console.warn(
                `⚠️ No handler exists for /${command}`
            );

            if (!interaction.replied && !interaction.deferred) {

                await interaction.reply({
                    content:
                        "❌ This command is not implemented.",
                    ephemeral: true
                });
            }

        } catch (error) {

            console.error(
                `❌ Command error [${interaction.commandName}]:`
            );

            console.error(error);

            try {

                if (interaction.deferred) {

                    await interaction.editReply({
                        content:
                            "❌ Something went wrong while executing this command."
                    });

                } else if (!interaction.replied) {

                    await interaction.reply({
                        content:
                            "❌ Something went wrong while executing this command.",
                        ephemeral: true
                    });

                } else {

                    await interaction.followUp({
                        content:
                            "❌ Something went wrong while executing this command.",
                        ephemeral: true
                    });
                }

            } catch (replyError) {

                console.error(
                    "❌ Could not send error response:"
                );

                console.error(
                    replyError
                );
            }
        }
    }
);

// ============================================================
// WELCOME NEW MEMBERS
// ============================================================

client.on(
    "guildMemberAdd",
    async member => {

        console.log(
            `👋 New member: ${member.user.tag} joined ${member.guild.name}`
        );

        try {

            if (
                mongoose.connection.readyState !== 1
            ) {
                console.warn(
                    "⚠️ MongoDB unavailable. Welcome system skipped."
                );

                return;
            }

            const config =
                await WelcomeConfig.findOne({
                    guildId:
                        member.guild.id
                });

            if (
                !config ||
                !config.enabled
            ) {
                return;
            }

            let roleResult =
                "No role configured.";

            // ====================================================
            // AUTO ROLE
            // ====================================================

            if (config.roleId) {

                const role =
                    member.guild.roles.cache.get(
                        config.roleId
                    );

                const botMember =
                    member.guild.members.me;

                if (
                    role &&
                    botMember
                ) {

                    if (
                        role.position <
                        botMember.roles.highest.position
                    ) {

                        try {

                            await member.roles.add(
                                role,
                                "27Pro automatic welcome role"
                            );

                            roleResult =
                                `Role assigned: ${role.name}`;

                        } catch (error) {

                            console.error(
                                "❌ Could not assign welcome role:",
                                error.message
                            );

                            roleResult =
                                "Could not assign welcome role.";
                        }

                    } else {

                        roleResult =
                            "Welcome role is above 27Pro's role.";
                    }
                }
            }

            // ====================================================
            // WELCOME CHANNEL
            // ====================================================

            const channel =
                member.guild.channels.cache.get(
                    config.channelId
                );

            if (
                !channel ||
                !channel.isTextBased()
            ) {

                console.error(
                    "❌ Welcome channel not found."
                );

                return;
            }

            const welcomeText =
                replaceVariables(
                    config.message,
                    member
                );

            const embed =
                createBaseEmbed()
                    .setTitle(
                        `👋 Welcome to ${member.guild.name}`
                    )
                    .setDescription(
                        welcomeText
                    )
                    .setThumbnail(
                        member.user.displayAvatarURL({
                            size: 512
                        })
                    )
                    .addFields(
                        {
                            name: "👤 Member",
                            value:
                                `${member}`,
                            inline: true
                        },
                        {
                            name: "👥 Members",
                            value:
                                `${member.guild.memberCount}`,
                            inline: true
                        }
                    );

            if (config.image) {
                embed.setImage(
                    config.image
                );
            }

            await channel.send({
                content:
                    `<@${member.id}>`,
                embeds: [embed]
            });

            console.log(
                `✅ Welcome sent for ${member.user.tag}`
            );

            console.log(
                `🎭 ${roleResult}`
            );

        } catch (error) {

            console.error(
                "❌ Welcome system error:",
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
            "❌ Discord client error:",
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

client.on(
    "shardError",
    error => {

        console.error(
            "❌ Discord shard error:",
            error
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
            "❌ Unhandled promise rejection:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {

        console.error(
            "❌ Uncaught exception:",
            error
        );
    }
);

// ============================================================
// START BOT
// ============================================================

async function startBot() {

    try {

        await connectDatabase();

        if (!TOKEN) {

            console.error(
                "❌ Bot cannot start without TOKEN."
            );

            return;
        }

        if (!GUILD_ID) {

            console.error(
                "❌ Bot cannot register commands without GUILD_ID."
            );

            return;
        }

        console.log(
            "🔄 Connecting 27Pro to Discord..."
        );

        await client.login(
            TOKEN
        );

    } catch (error) {

        console.error(
            "❌ Discord login failed:"
        );

        console.error(
            error
        );
    }
}

startBot();
