require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    REST,
    Routes,
    ChannelType,
    MessageFlags,
    ActivityType
} = require("discord.js");

// ======================================================
// 27PRO CONFIG
// ======================================================

const TOKEN = process.env.TOKEN;
const CONFIGURED_CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

const BOT_NAME = "27Pro";
const CREATOR = "iik27";
const COPYRIGHT = "© 2026 iik27. All rights reserved.";

const DEFAULT_WELCOME_MESSAGE =
    "Welcome {user} to **{server}**! You are member #{count}. Enjoy your stay!";

// ======================================================
// BASIC VALIDATION
// ======================================================

if (!TOKEN) {
    console.error("❌ TOKEN is missing from .env");
    process.exit(1);
}

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing from .env");
    process.exit(1);
}

if (!GUILD_ID) {
    console.error("❌ GUILD_ID is missing from .env");
    process.exit(1);
}

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

// ======================================================
// DATABASE MODELS
// ======================================================

const welcomeSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            unique: true,
            required: true
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

        message: {
            type: String,
            default: DEFAULT_WELCOME_MESSAGE
        },

        image: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

const logConfigSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            unique: true,
            required: true
        },

        enabled: {
            type: Boolean,
            default: false
        },

        generalChannelId: {
            type: String,
            default: null
        },

        memberChannelId: {
            type: String,
            default: null
        },

        messageChannelId: {
            type: String,
            default: null
        },

        moderationChannelId: {
            type: String,
            default: null
        },

        roleChannelId: {
            type: String,
            default: null
        },

        channelChannelId: {
            type: String,
            default: null
        },

        serverChannelId: {
            type: String,
            default: null
        },

        botChannelId: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

const warningSchema = new mongoose.Schema(
    {
        guildId: String,
        userId: String,
        moderatorId: String,
        reason: String
    },
    {
        timestamps: true
    }
);

const WelcomeConfig = mongoose.model("WelcomeConfig", welcomeSchema);
const LogConfig = mongoose.model("LogConfig", logConfigSchema);
const Warning = mongoose.model("Warning", warningSchema);

// ======================================================
// HELPERS
// ======================================================

function baseEmbed(color = 0x5865f2) {
    return new EmbedBuilder()
        .setColor(color)
        .setFooter({
            text: `${BOT_NAME} • ${COPYRIGHT}`
        })
        .setTimestamp();
}

function replaceVariables(message, member) {
    return message
        .replaceAll("{user}", `<@${member.id}>`)
        .replaceAll("{username}", member.user.username)
        .replaceAll("{server}", member.guild.name)
        .replaceAll("{count}", member.guild.memberCount.toString());
}

function formatDuration(ms) {
    if (!ms || ms <= 0) return "Unknown";

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;

    return `${seconds}s`;
}

function truncate(text, max = 1000) {
    if (!text) return "None";

    if (text.length <= max) {
        return text;
    }

    return `${text.slice(0, max - 3)}...`;
}

function mentionChannel(channelId) {
    return channelId ? `<#${channelId}>` : "Not configured";
}

async function getLogConfig(guildId) {
    let config = await LogConfig.findOne({ guildId });

    if (!config) {
        config = await LogConfig.create({
            guildId,
            enabled: false
        });
    }

    return config;
}

async function sendLog(guild, type, embed) {
    try {
        const config = await LogConfig.findOne({
            guildId: guild.id
        });

        if (!config || !config.enabled) {
            return;
        }

        const channelMap = {
            general: config.generalChannelId,
            member: config.memberChannelId,
            message: config.messageChannelId,
            moderation: config.moderationChannelId,
            role: config.roleChannelId,
            channel: config.channelChannelId,
            server: config.serverChannelId,
            bot: config.botChannelId
        };

        const channelId =
            channelMap[type] ||
            config.generalChannelId;

        if (!channelId) {
            return;
        }

        const channel = guild.channels.cache.get(channelId);

        if (!channel || !channel.isTextBased()) {
            return;
        }

        await channel.send({
            embeds: [embed]
        });
    } catch (error) {
        console.error(`❌ Failed to send ${type} log:`, error);
    }
}

function isGuildInteraction(interaction) {
    return interaction.inGuild();
}

function botCanModerate(member) {
    const me = member.guild.members.me;

    if (!me) return false;

    return me.roles.highest.position > member.roles.highest.position;
}

// ======================================================
// SLASH COMMANDS
// ======================================================

const commands = [

    // --------------------------------------------------
    // INFORMATION
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show all 27Pro commands."),

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check 27Pro latency."),

    new SlashCommandBuilder()
        .setName("uptime")
        .setDescription("Show how long 27Pro has been online."),

    new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Show information about 27Pro."),

    new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Show information about this server."),

    new SlashCommandBuilder()
        .setName("membercount")
        .setDescription("Show the server member count."),

    new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Show information about a member.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Show a member's avatar.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The member.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("banner")
        .setDescription("Show a user's Discord banner.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("roleinfo")
        .setDescription("Show information about a role.")
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("The role.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("channelinfo")
        .setDescription("Show information about a channel.")
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("The channel.")
                .setRequired(false)
        ),

// --------------------------------------------------
// WELCOME
// --------------------------------------------------

new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure the 27Pro welcome system.")

    // ==================================================
    // SETUP
    // ==================================================

    .addSubcommand(sub =>
        sub
            .setName("setup")
            .setDescription("Enable and configure welcome messages.")

            .addChannelOption(option =>
                option
                    .setName("channel")
                    .setDescription("Welcome channel.")
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )

            .addRoleOption(option =>
                option
                    .setName("role")
                    .setDescription("Optional role to give new members.")
                    .setRequired(false)
            )

            .addStringOption(option =>
                option
                    .setName("message")
                    .setDescription(
                        "Welcome message. Use {user}, {server}, {count}, or {username}."
                    )
                    .setRequired(false)
            )

            .addStringOption(option =>
                option
                    .setName("image")
                    .setDescription("Custom welcome banner/image URL.")
                    .setRequired(false)
            )
    )

    // ==================================================
    // CONFIG
    // ==================================================

    .addSubcommand(sub =>
        sub
            .setName("config")
            .setDescription("View welcome configuration.")
    )

    // ==================================================
    // PREVIEW
    // ==================================================

    .addSubcommand(sub =>
        sub
            .setName("preview")
            .setDescription("Preview the welcome message.")
    )

    // ==================================================
    // TEST
    // ==================================================

    .addSubcommand(sub =>
        sub
            .setName("test")
            .setDescription("Send a test welcome message.")
    )

    // ==================================================
    // DISABLE
    // ==================================================

    .addSubcommand(sub =>
        sub
            .setName("disable")
            .setDescription("Disable welcome messages.")
    ),

    // --------------------------------------------------
    // LOGGING
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("logs")
        .setDescription("Configure 27Pro server logging.")
        .addSubcommand(sub =>
            sub
                .setName("setup")
                .setDescription("Configure a logging channel.")
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Type of logs.")
                        .setRequired(true)
                        .addChoices(
                            { name: "General", value: "general" },
                            { name: "Members", value: "member" },
                            { name: "Messages", value: "message" },
                            { name: "Moderation", value: "moderation" },
                            { name: "Roles", value: "role" },
                            { name: "Channels", value: "channel" },
                            { name: "Server", value: "server" },
                            { name: "Bot", value: "bot" }
                        )
                )
                .addChannelOption(option =>
                    option
                        .setName("channel")
                        .setDescription("The log channel.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("config")
                .setDescription("Show logging configuration.")
        )
        .addSubcommand(sub =>
            sub
                .setName("test")
                .setDescription("Test the logging system.")
        )
        .addSubcommand(sub =>
            sub
                .setName("disable")
                .setDescription("Disable all logging.")
        ),

    // --------------------------------------------------
    // MODERATION
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to warn.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View or clear warnings.")
        .addSubcommand(sub =>
            sub
                .setName("view")
                .setDescription("View warnings.")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("Member.")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("clear")
                .setDescription("Clear warnings.")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("Member.")
                        .setRequired(true)
                )
        ),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user.")
        .addStringOption(option =>
            option
                .setName("userid")
                .setDescription("User ID.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Timeout a member.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("minutes")
                .setDescription("Timeout duration.")
                .setMinValue(1)
                .setMaxValue(40320)
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Remove a member's timeout.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("nick")
        .setDescription("Change a member's nickname.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("nickname")
                .setDescription("New nickname.")
                .setMaxLength(32)
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Delete messages.")
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Number of messages.")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Set channel slowmode.")
        .addIntegerOption(option =>
            option
                .setName("seconds")
                .setDescription("Slowmode seconds.")
                .setMinValue(0)
                .setMaxValue(21600)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Lock the current channel."),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlock the current channel."),

    // --------------------------------------------------
    // ROLE MANAGEMENT
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("role")
        .setDescription("Manage roles.")
        .addSubcommand(sub =>
            sub
                .setName("add")
                .setDescription("Give a role.")
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
                .setDescription("Remove a role.")
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
                        .setDescription("Role.")
                        .setRequired(true)
                )
        ),

    // --------------------------------------------------
    // UTILITY
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("say")
        .setDescription("Make 27Pro say something.")
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("Message.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Send an announcement.")
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("Announcement channel.")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("Announcement.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("poll")
        .setDescription("Create a simple poll.")
        .addStringOption(option =>
            option
                .setName("question")
                .setDescription("Poll question.")
                .setRequired(true)
        ),

    // --------------------------------------------------
    // FUN
    // --------------------------------------------------

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
                .setMinValue(2)
                .setMaxValue(1000)
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Ask the magic 8-ball.")
        .addStringOption(option =>
            option
                .setName("question")
                .setDescription("Your question.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("choose")
        .setDescription("Choose between options.")
        .addStringOption(option =>
            option
                .setName("options")
                .setDescription("Separate options with commas.")
                .setRequired(true)
        )

].map(command => command.toJSON());

// ======================================================
// COMMAND REGISTRATION
// ======================================================

async function registerCommands() {
    try {
        const rest = new REST({
            version: "10"
        }).setToken(TOKEN);

        const applicationId = client.user.id;

        console.log("==========================================");
        console.log("📝 REGISTERING SLASH COMMANDS");
        console.log("==========================================");
        console.log(`🤖 Bot: ${client.user.tag}`);
        console.log(`🆔 Actual Application ID: ${applicationId}`);
        console.log(`🆔 Configured CLIENT_ID: ${CONFIGURED_CLIENT_ID}`);
        console.log(`🏠 Guild ID: ${GUILD_ID}`);
        console.log(`📦 Commands: ${commands.length}`);

        await rest.put(
            Routes.applicationGuildCommands(
                applicationId,
                GUILD_ID
            ),
            {
                body: commands
            }
        );

        console.log("✅ Slash commands registered successfully.");
        console.log("==========================================");

    } catch (error) {
        console.error("❌ Command registration failed:", error);
    }
}

// ======================================================
// READY
// ======================================================

client.once("clientReady", async () => {

    console.log("==========================================");
    console.log(`✅ ${BOT_NAME} IS READY`);
    console.log("==========================================");

    console.log(`🤖 Logged in as: ${client.user.tag}`);
    console.log(`🆔 Application ID: ${client.user.id}`);
    console.log(`🏠 Guilds: ${client.guilds.cache.size}`);
    console.log(`📡 WebSocket ping: ${client.ws.ping}ms`);

    const guild = client.guilds.cache.get(GUILD_ID);

    if (guild) {
        console.log(
            `✅ Target guild found: ${guild.name} (${guild.id})`
        );
    } else {
        console.log("⚠️ Target guild was not found.");
    }

    client.user.setPresence({
        activities: [
            {
                name: `${guild ? guild.name : "your server"} • /help`,
                type: ActivityType.Watching
            }
        ],
        status: "online"
    });

    await registerCommands();

    await sendLog(
        guild,
        "bot",
        baseEmbed(0x57f287)
            .setTitle("🟢 27Pro Online")
            .setDescription(
                `**${BOT_NAME}** is now online and ready.`
            )
            .addFields(
                {
                    name: "Bot",
                    value: client.user.tag,
                    inline: true
                },
                {
                    name: "Guilds",
                    value: `${client.guilds.cache.size}`,
                    inline: true
                }
            )
    );
});

// ======================================================
// WELCOME — MEMBER JOIN
// ======================================================

client.on("guildMemberAdd", async member => {

    try {

        const config = await WelcomeConfig.findOne({
            guildId: member.guild.id
        });

        if (config?.enabled && config.channelId) {

            const channel =
                member.guild.channels.cache.get(config.channelId);

            if (channel && channel.isTextBased()) {

                const message = replaceVariables(
                    config.message || DEFAULT_WELCOME_MESSAGE,
                    member
                );

                const embed = baseEmbed(0x5865f2)
                    .setTitle("👋 Welcome!")
                    .setDescription(message)
                    .setThumbnail(
                        member.user.displayAvatarURL({
                            size: 512
                        })
                    )
                    .addFields({
                        name: "Member",
                        value: `${member}`,
                        inline: true
                    });

                if (config.image) {
                    embed.setImage(config.image);
                }

                await channel.send({
                    content: config.roleId
                        ? `${member} <@&${config.roleId}>`
                        : `${member}`,
                    embeds: [embed]
                });

                if (config.roleId) {

                    const role =
                        member.guild.roles.cache.get(config.roleId);

                    if (
                        role &&
                        member.guild.members.me.roles.highest.position >
                            role.position
                    ) {
                        await member.roles.add(role);
                    }
                }
            }
        }

        await sendLog(
            member.guild,
            "member",
            baseEmbed(0x57f287)
                .setTitle("👋 Member Joined")
                .setThumbnail(
                    member.user.displayAvatarURL({
                        size: 512
                    })
                )
                .addFields(
                    {
                        name: "User",
                        value: `${member}`,
                        inline: true
                    },
                    {
                        name: "Username",
                        value: `\`${member.user.username}\``,
                        inline: true
                    },
                    {
                        name: "User ID",
                        value: `\`${member.id}\``,
                        inline: true
                    },
                    {
                        name: "Account Created",
                        value: `<t:${Math.floor(
                            member.user.createdTimestamp / 1000
                        )}:F>`,
                        inline: false
                    },
                    {
                        name: "Member Count",
                        value: `#${member.guild.memberCount}`,
                        inline: true
                    }
                )
        );

    } catch (error) {
        console.error("❌ guildMemberAdd error:", error);
    }
});

// ======================================================
// MEMBER LEAVE
// ======================================================

client.on("guildMemberRemove", async member => {

    try {

        const joinedAt = member.joinedTimestamp
            ? Date.now() - member.joinedTimestamp
            : null;

        await sendLog(
            member.guild,
            "member",
            baseEmbed(0xed4245)
                .setTitle("🚪 Member Left")
                .setThumbnail(
                    member.user.displayAvatarURL({
                        size: 512
                    })
                )
                .addFields(
                    {
                        name: "User",
                        value: `${member.user.tag}`,
                        inline: true
                    },
                    {
                        name: "User ID",
                        value: `\`${member.id}\``,
                        inline: true
                    },
                    {
                        name: "Joined",
                        value: member.joinedTimestamp
                            ? `<t:${Math.floor(
                                member.joinedTimestamp / 1000
                            )}:F>`
                            : "Unknown",
                        inline: false
                    },
                    {
                        name: "Time in Server",
                        value: joinedAt
                            ? formatDuration(joinedAt)
                            : "Unknown",
                        inline: true
                    }
                )
        );

    } catch (error) {
        console.error("❌ guildMemberRemove error:", error);
    }
});

// ======================================================
// MESSAGE DELETE
// ======================================================

client.on("messageDelete", async message => {

    try {

        if (!message.guild) return;

        if (message.author?.bot) return;

        const content =
            message.content || "No text content.";

        await sendLog(
            message.guild,
            "message",
            baseEmbed(0xed4245)
                .setTitle("🗑️ Message Deleted")
                .addFields(
                    {
                        name: "Author",
                        value: message.author
                            ? `${message.author}`
                            : "Unknown",
                        inline: true
                    },
                    {
                        name: "Channel",
                        value: `${message.channel}`,
                        inline: true
                    },
                    {
                        name: "Content",
                        value: `\`\`\`\n${truncate(
                            content,
                            900
                        )}\n\`\`\``,
                        inline: false
                    }
                )
        );

    } catch (error) {
        console.error("❌ messageDelete error:", error);
    }
});

// ======================================================
// MESSAGE UPDATE
// ======================================================

client.on("messageUpdate", async (oldMessage, newMessage) => {

    try {

        if (!newMessage.guild) return;
        if (newMessage.author?.bot) return;

        const oldContent = oldMessage.content || "";
        const newContent = newMessage.content || "";

        if (oldContent === newContent) return;

        await sendLog(
            newMessage.guild,
            "message",
            baseEmbed(0xfee75c)
                .setTitle("✏️ Message Edited")
                .addFields(
                    {
                        name: "Author",
                        value: newMessage.author
                            ? `${newMessage.author}`
                            : "Unknown",
                        inline: true
                    },
                    {
                        name: "Channel",
                        value: `${newMessage.channel}`,
                        inline: true
                    },
                    {
                        name: "Before",
                        value: `\`\`\`\n${truncate(
                            oldContent,
                            900
                        )}\n\`\`\``
                    },
                    {
                        name: "After",
                        value: `\`\`\`\n${truncate(
                            newContent,
                            900
                        )}\n\`\`\``
                    }
                )
                .setURL(newMessage.url)
        );

    } catch (error) {
        console.error("❌ messageUpdate error:", error);
    }
});

// ======================================================
// ROLE CREATE
// ======================================================

client.on("roleCreate", async role => {

    await sendLog(
        role.guild,
        "role",
        baseEmbed(0x57f287)
            .setTitle("🎭 Role Created")
            .addFields(
                {
                    name: "Role",
                    value: `${role}`,
                    inline: true
                },
                {
                    name: "Role ID",
                    value: `\`${role.id}\``,
                    inline: true
                }
            )
    );
});

// ======================================================
// ROLE DELETE
// ======================================================

client.on("roleDelete", async role => {

    await sendLog(
        role.guild,
        "role",
        baseEmbed(0xed4245)
            .setTitle("🗑️ Role Deleted")
            .addFields(
                {
                    name: "Role",
                    value: `\`${role.name}\``,
                    inline: true
                },
                {
                    name: "Role ID",
                    value: `\`${role.id}\``,
                    inline: true
                }
            )
    );
});

// ======================================================
// ROLE UPDATE
// ======================================================

client.on("roleUpdate", async (oldRole, newRole) => {

    if (
        oldRole.name === newRole.name &&
        oldRole.permissions.bitfield === newRole.permissions.bitfield &&
        oldRole.color === newRole.color
    ) {
        return;
    }

    await sendLog(
        newRole.guild,
        "role",
        baseEmbed(0xfee75c)
            .setTitle("✏️ Role Updated")
            .addFields(
                {
                    name: "Role",
                    value: `${newRole}`,
                    inline: true
                },
                {
                    name: "Before",
                    value: oldRole.name,
                    inline: true
                },
                {
                    name: "After",
                    value: newRole.name,
                    inline: true
                }
            )
    );
});

// ======================================================
// CHANNEL CREATE
// ======================================================

client.on("channelCreate", async channel => {

    if (!channel.guild) return;

    await sendLog(
        channel.guild,
        "channel",
        baseEmbed(0x57f287)
            .setTitle("📁 Channel Created")
            .addFields(
                {
                    name: "Channel",
                    value: `${channel}`,
                    inline: true
                },
                {
                    name: "Type",
                    value: `${channel.type}`,
                    inline: true
                }
            )
    );
});

// ======================================================
// CHANNEL DELETE
// ======================================================

client.on("channelDelete", async channel => {

    if (!channel.guild) return;

    await sendLog(
        channel.guild,
        "channel",
        baseEmbed(0xed4245)
            .setTitle("🗑️ Channel Deleted")
            .addFields(
                {
                    name: "Channel",
                    value: `\`${channel.name}\``,
                    inline: true
                },
                {
                    name: "Channel ID",
                    value: `\`${channel.id}\``,
                    inline: true
                }
            )
    );
});

// ======================================================
// CHANNEL UPDATE
// ======================================================

client.on("channelUpdate", async (oldChannel, newChannel) => {

    if (!newChannel.guild) return;

    if (oldChannel.name === newChannel.name) {
        return;
    }

    await sendLog(
        newChannel.guild,
        "channel",
        baseEmbed(0xfee75c)
            .setTitle("✏️ Channel Updated")
            .addFields(
                {
                    name: "Channel",
                    value: `${newChannel}`,
                    inline: true
                },
                {
                    name: "Before",
                    value: oldChannel.name,
                    inline: true
                },
                {
                    name: "After",
                    value: newChannel.name,
                    inline: true
                }
            )
    );
});

// ======================================================
// GUILD UPDATE
// ======================================================

client.on("guildUpdate", async (oldGuild, newGuild) => {

    const changed = [];

    if (oldGuild.name !== newGuild.name) {
        changed.push(
            `**Name:** ${oldGuild.name} → ${newGuild.name}`
        );
    }

    if (oldGuild.icon !== newGuild.icon) {
        changed.push("**Server icon changed.**");
    }

    if (oldGuild.banner !== newGuild.banner) {
        changed.push("**Server banner changed.**");
    }

    if (!changed.length) return;

    await sendLog(
        newGuild,
        "server",
        baseEmbed(0xfee75c)
            .setTitle("🏠 Server Updated")
            .setDescription(changed.join("\n"))
    );
});

// ======================================================
// MEMBER UPDATE
// ======================================================

client.on("guildMemberUpdate", async (oldMember, newMember) => {

    try {

        if (oldMember.nickname !== newMember.nickname) {

            await sendLog(
                newMember.guild,
                "member",
                baseEmbed(0xfee75c)
                    .setTitle("📝 Nickname Changed")
                    .addFields(
                        {
                            name: "User",
                            value: `${newMember}`,
                            inline: true
                        },
                        {
                            name: "Before",
                            value: oldMember.nickname || "None",
                            inline: true
                        },
                        {
                            name: "After",
                            value: newMember.nickname || "None",
                            inline: true
                        }
                    )
            );
        }

        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        const addedRole = newRoles.find(
            role => !oldRoles.has(role.id)
        );

        const removedRole = oldRoles.find(
            role => !newRoles.has(role.id)
        );

        if (addedRole) {

            await sendLog(
                newMember.guild,
                "role",
                baseEmbed(0x57f287)
                    .setTitle("🎭 Role Added")
                    .addFields(
                        {
                            name: "Member",
                            value: `${newMember}`,
                            inline: true
                        },
                        {
                            name: "Role",
                            value: `${addedRole}`,
                            inline: true
                        }
                    )
            );
        }

        if (removedRole) {

            await sendLog(
                newMember.guild,
                "role",
                baseEmbed(0xed4245)
                    .setTitle("🎭 Role Removed")
                    .addFields(
                        {
                            name: "Member",
                            value: `${newMember}`,
                            inline: true
                        },
                        {
                            name: "Role",
                            value: `${removedRole}`,
                            inline: true
                        }
                    )
            );
        }

    } catch (error) {
        console.error("❌ guildMemberUpdate error:", error);
    }
});

// ======================================================
// INTERACTION HANDLER
// ======================================================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (!isGuildInteraction(interaction)) {
        await interaction.reply({
            content: "❌ This command can only be used inside a server.",
            flags: MessageFlags.Ephemeral
        });

        return;
    }

    const command = interaction.commandName;

    console.log(
        `📥 Interaction received: /${command} | ${interaction.user.tag}`
    );

    try {

        // ==================================================
        // HELP
        // ==================================================

        if (command === "help") {

            const embed = baseEmbed()
                .setTitle("🤖 27Pro Command Center")
                .setDescription(
                    "A complete server management and utility system."
                )
                .addFields(
                    {
                        name: "🛡️ Moderation",
                        value:
                            "`/warn` `/warnings` `/kick` `/ban` `/unban`\n" +
                            "`/timeout` `/untimeout` `/nick` `/clear`\n" +
                            "`/slowmode` `/lock` `/unlock`"
                    },
                    {
                        name: "👋 Members",
                        value:
                            "`/welcome` `/userinfo` `/avatar`\n" +
                            "`/membercount` `/banner`"
                    },
                    {
                        name: "📋 Logging",
                        value:
                            "`/logs setup` `/logs config`\n" +
                            "`/logs test` `/logs disable`"
                    },
                    {
                        name: "🎭 Roles",
                        value:
                            "`/role add` `/role remove`\n" +
                            "`/role create` `/role delete` `/roleinfo`"
                    },
                    {
                        name: "📁 Server",
                        value:
                            "`/serverinfo` `/channelinfo`\n" +
                            "`/announce` `/poll` `/say`"
                    },
                    {
                        name: "🎲 Fun",
                        value:
                            "`/8ball` `/coinflip` `/roll` `/choose`"
                    },
                    {
                        name: "🤖 27Pro",
                        value:
                            "`/ping` `/uptime` `/botinfo`"
                    }
                );

            await interaction.reply({
                embeds: [embed]
            });

            return;
        }

        // ==================================================
        // PING
        // ==================================================

        if (command === "ping") {

            const start = Date.now();

            await interaction.reply({
                content: "🏓 **Pong!**"
            });

            const responseTime =
                Date.now() - start;

            await interaction.editReply({
                content:
                    `🏓 **Pong!**\n\n` +
                    `API: **${client.ws.ping}ms**\n` +
                    `Response: **${responseTime}ms**\n\n` +
                    `🤖 **${BOT_NAME}**\n` +
                    `${COPYRIGHT}`
            });

            return;
        }

        // ==================================================
        // UPTIME
        // ==================================================

        if (command === "uptime") {

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle("⏱️ 27Pro Uptime")
                        .setDescription(
                            `27Pro has been online for:\n\n` +
                            `**${formatDuration(process.uptime() * 1000)}**`
                        )
                ]
            });

            return;
        }

        // ==================================================
        // BOT INFO
        // ==================================================

        if (command === "botinfo") {

            const memory =
                process.memoryUsage();

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle("🤖 27Pro")
                        .setThumbnail(
                            client.user.displayAvatarURL({
                                size: 512
                            })
                        )
                        .addFields(
                            {
                                name: "Creator",
                                value: CREATOR,
                                inline: true
                            },
                            {
                                name: "Application ID",
                                value: `\`${client.user.id}\``,
                                inline: true
                            },
                            {
                                name: "Guilds",
                                value: `${client.guilds.cache.size}`,
                                inline: true
                            },
                            {
                                name: "Node.js",
                                value: process.version,
                                inline: true
                            },
                            {
                                name: "Memory",
                                value:
                                    `${Math.round(
                                        memory.rss / 1024 / 1024
                                    )} MB`,
                                inline: true
                            },
                            {
                                name: "Uptime",
                                value:
                                    formatDuration(
                                        process.uptime() * 1000
                                    ),
                                inline: true
                            }
                        )
                ]
            });

            return;
        }

        // ==================================================
        // SERVER INFO
        // ==================================================

        if (command === "serverinfo") {

            const guild = interaction.guild;

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle(`🏠 ${guild.name}`)
                        .setThumbnail(
                            guild.iconURL({
                                size: 512
                            })
                        )
                        .addFields(
                            {
                                name: "Owner",
                                value: `<@${guild.ownerId}>`,
                                inline: true
                            },
                            {
                                name: "Members",
                                value: `${guild.memberCount}`,
                                inline: true
                            },
                            {
                                name: "Channels",
                                value: `${guild.channels.cache.size}`,
                                inline: true
                            },
                            {
                                name: "Roles",
                                value: `${guild.roles.cache.size}`,
                                inline: true
                            },
                            {
                                name: "Created",
                                value:
                                    `<t:${Math.floor(
                                        guild.createdTimestamp / 1000
                                    )}:F>`,
                                inline: false
                            },
                            {
                                name: "Server ID",
                                value: `\`${guild.id}\``,
                                inline: false
                            }
                        )
                ]
            });

            return;
        }

        // ==================================================
        // MEMBER COUNT
        // ==================================================

        if (command === "membercount") {

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle("👥 Member Count")
                        .setDescription(
                            `This server currently has **${interaction.guild.memberCount}** members.`
                        )
                ]
            });

            return;
        }

        // ==================================================
        // USER INFO
        // ==================================================

        if (command === "userinfo") {

            const user =
                interaction.options.getUser("user") ||
                interaction.user;

            const member =
                await interaction.guild.members
                    .fetch(user.id)
                    .catch(() => null);

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle(`👤 ${user.username}`)
                        .setThumbnail(
                            user.displayAvatarURL({
                                size: 512
                            })
                        )
                        .addFields(
                            {
                                name: "User ID",
                                value: `\`${user.id}\``,
                                inline: true
                            },
                            {
                                name: "Username",
                                value: `\`${user.username}\``,
                                inline: true
                            },
                            {
                                name: "Account Created",
                                value:
                                    `<t:${Math.floor(
                                        user.createdTimestamp / 1000
                                    )}:F>`,
                                inline: false
                            },
                            {
                                name: "Joined Server",
                                value:
                                    member?.joinedTimestamp
                                        ? `<t:${Math.floor(
                                            member.joinedTimestamp / 1000
                                        )}:F>`
                                        : "Unknown",
                                inline: false
                            }
                        )
                ]
            });

            return;
        }

        // ==================================================
        // AVATAR
        // ==================================================

        if (command === "avatar") {

            const user =
                interaction.options.getUser("user") ||
                interaction.user;

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle(`🖼️ ${user.username}'s Avatar`)
                        .setImage(
                            user.displayAvatarURL({
                                size: 4096,
                                extension: "png"
                            })
                        )
                ]
            });

            return;
        }

        // ==================================================
        // BANNER
        // ==================================================

        if (command === "banner") {

            const user =
                interaction.options.getUser("user") ||
                interaction.user;

            const fetched =
                await user.fetch();

            if (!fetched.banner) {

                await interaction.reply({
                    content:
                        "❌ This user does not have a Discord banner.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle(`🖼️ ${user.username}'s Banner`)
                        .setImage(
                            fetched.bannerURL({
                                size: 4096,
                                extension: "png"
                            })
                        )
                ]
            });

            return;
        }

        // ==================================================
        // ROLE INFO
        // ==================================================

        if (command === "roleinfo") {

            const role =
                interaction.options.getRole("role");

            await interaction.reply({
                embeds: [
                    baseEmbed(role.color || 0x5865f2)
                        .setTitle(`🎭 ${role.name}`)
                        .addFields(
                            {
                                name: "Role ID",
                                value: `\`${role.id}\``,
                                inline: true
                            },
                            {
                                name: "Members",
                                value: `${role.members.size}`,
                                inline: true
                            },
                            {
                                name: "Position",
                                value: `${role.position}`,
                                inline: true
                            },
                            {
                                name: "Mention",
                                value: `${role}`,
                                inline: true
                            },
                            {
                                name: "Created",
                                value:
                                    `<t:${Math.floor(
                                        role.createdTimestamp / 1000
                                    )}:F>`,
                                inline: false
                            }
                        )
                ]
            });

            return;
        }

        // ==================================================
        // CHANNEL INFO
        // ==================================================

        if (command === "channelinfo") {

            const channel =
                interaction.options.getChannel("channel") ||
                interaction.channel;

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle(`📁 ${channel.name}`)
                        .addFields(
                            {
                                name: "Channel ID",
                                value: `\`${channel.id}\``,
                                inline: true
                            },
                            {
                                name: "Type",
                                value: `${channel.type}`,
                                inline: true
                            },
                            {
                                name: "Mention",
                                value: `${channel}`,
                                inline: true
                            }
                        )
                ]
            });

            return;
        }

        // ==================================================
        // WELCOME
        // ==================================================

        if (command === "welcome") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Server** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const sub =
                interaction.options.getSubcommand();

            if (sub === "setup") {

                const channel =
                    interaction.options.getChannel("channel");

                const role =
                    interaction.options.getRole("role");

                const message =
                    interaction.options.getString("message") ||
                    DEFAULT_WELCOME_MESSAGE;

                const image =
                    interaction.options.getString("image");

                await WelcomeConfig.findOneAndUpdate(
                    {
                        guildId: interaction.guild.id
                    },
                    {
                        guildId: interaction.guild.id,
                        enabled: true,
                        channelId: channel.id,
                        roleId: role?.id || null,
                        message,
                        image: image || null
                    },
                    {
                        upsert: true,
                        new: true
                    }
                );

                await interaction.reply({
                    embeds: [
                        baseEmbed(0x57f287)
                            .setTitle("👋 Welcome System Enabled")
                            .setDescription(
                                `Welcome messages will now be sent in ${channel}.`
                            )
                            .addFields(
                                {
                                    name: "Message",
                                    value: truncate(message, 1000)
                                },
                                {
                                    name: "Role",
                                    value:
                                        role
                                            ? `${role}`
                                            : "No automatic role"
                                }
                            )
                    ]
                });

                return;
            }

            if (sub === "config") {

                const config =
                    await WelcomeConfig.findOne({
                        guildId: interaction.guild.id
                    });

                if (!config || !config.enabled) {

                    await interaction.reply({
                        content:
                            "❌ Welcome system is disabled.",
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await interaction.reply({
                    embeds: [
                        baseEmbed()
                            .setTitle("👋 Welcome Configuration")
                            .addFields(
                                {
                                    name: "Status",
                                    value: "🟢 Enabled",
                                    inline: true
                                },
                                {
                                    name: "Channel",
                                    value:
                                        mentionChannel(
                                            config.channelId
                                        ),
                                    inline: true
                                },
                                {
                                    name: "Role",
                                    value:
                                        config.roleId
                                            ? `<@&${config.roleId}>`
                                            : "None",
                                    inline: true
                                },
                                {
                                    name: "Message",
                                    value:
                                        truncate(
                                            config.message,
                                            1000
                                        )
                                }
                            )
                    ]
                });

                return;
            }

            if (sub === "preview" || sub === "test") {

                const config =
                    await WelcomeConfig.findOne({
                        guildId: interaction.guild.id
                    });

                if (!config || !config.enabled) {

                    await interaction.reply({
                        content:
                            "❌ Welcome system is not configured.",
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                const fakeMember = interaction.member;

                const message =
                    replaceVariables(
                        config.message ||
                        DEFAULT_WELCOME_MESSAGE,
                        fakeMember
                    );

                const embed = baseEmbed()
                    .setTitle("👋 Welcome Preview")
                    .setDescription(message)
                    .setThumbnail(
                        interaction.user.displayAvatarURL({
                            size: 512
                        })
                    );

                if (config.image) {
                    embed.setImage(config.image);
                }

                if (sub === "preview") {

                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });

                } else {

                    const channel =
                        interaction.guild.channels.cache.get(
                            config.channelId
                        );

                    if (!channel) {

                        await interaction.reply({
                            content:
                                "❌ Welcome channel no longer exists.",
                            flags: MessageFlags.Ephemeral
                        });

                        return;
                    }

                    await channel.send({
                        content: `${interaction.user}`,
                        embeds: [embed]
                    });

                    await interaction.reply({
                        content:
                            `✅ Test welcome sent to ${channel}.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            if (sub === "disable") {

                await WelcomeConfig.findOneAndUpdate(
                    {
                        guildId: interaction.guild.id
                    },
                    {
                        enabled: false
                    }
                );

                await interaction.reply({
                    content:
                        "✅ Welcome system disabled.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }
        }

        // ==================================================
        // LOGS
        // ==================================================

        if (command === "logs") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Server** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const sub =
                interaction.options.getSubcommand();

            if (sub === "setup") {

                const type =
                    interaction.options.getString("type");

                const channel =
                    interaction.options.getChannel("channel");

                const fieldMap = {
                    general: "generalChannelId",
                    member: "memberChannelId",
                    message: "messageChannelId",
                    moderation: "moderationChannelId",
                    role: "roleChannelId",
                    channel: "channelChannelId",
                    server: "serverChannelId",
                    bot: "botChannelId"
                };

                const field = fieldMap[type];

                const update = {
                    guildId: interaction.guild.id,
                    enabled: true
                };

                update[field] = channel.id;

                await LogConfig.findOneAndUpdate(
                    {
                        guildId: interaction.guild.id
                    },
                    update,
                    {
                        upsert: true
                    }
                );

                await interaction.reply({
                    embeds: [
                        baseEmbed(0x57f287)
                            .setTitle("📋 Logging Configured")
                            .setDescription(
                                `**${type}** logs will now be sent to ${channel}.`
                            )
                    ]
                });

                return;
            }

            if (sub === "config") {

                const config =
                    await getLogConfig(
                        interaction.guild.id
                    );

                const status =
                    config.enabled
                        ? "🟢 Enabled"
                        : "🔴 Disabled";

                await interaction.reply({
                    embeds: [
                        baseEmbed()
                            .setTitle("📋 27Pro Logging")
                            .addFields(
                                {
                                    name: "Status",
                                    value: status,
                                    inline: true
                                },
                                {
                                    name: "General",
                                    value: mentionChannel(
                                        config.generalChannelId
                                    ),
                                    inline: true
                                },
                                {
                                    name: "Members",
                                    value: mentionChannel(
                                        config.memberChannelId
                                    ),
                                    inline: true
                                },
                                {
                                    name: "Messages",
                                    value: mentionChannel(
                                        config.messageChannelId
                                    ),
                                    inline: true
                                },
                                {
                                    name: "Moderation",
                                    value: mentionChannel(
                                        config.moderationChannelId
                                    ),
                                    inline: true
                                },
                                {
                                    name: "Roles",
                                    value: mentionChannel(
                                        config.roleChannelId
                                    ),
                                    inline: true
                                },
                                {
                                    name: "Channels",
                                    value: mentionChannel(
                                        config.channelChannelId
                                    ),
                                    inline: true
                                },
                                {
                                    name: "Server",
                                    value: mentionChannel(
                                        config.serverChannelId
                                    ),
                                    inline: true
                                },
                                {
                                    name: "Bot",
                                    value: mentionChannel(
                                        config.botChannelId
                                    ),
                                    inline: true
                                }
                            )
                    ]
                });

                return;
            }

            if (sub === "test") {

                const config =
                    await getLogConfig(
                        interaction.guild.id
                    );

                if (!config.enabled) {

                    await interaction.reply({
                        content:
                            "❌ Logging is currently disabled.",
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await sendLog(
                    interaction.guild,
                    "general",
                    baseEmbed(0x57f287)
                        .setTitle("🧪 Logging Test")
                        .setDescription(
                            "If you can see this message, **27Pro logging is working.**"
                        )
                );

                await interaction.reply({
                    content:
                        "✅ Logging test sent.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            if (sub === "disable") {

                await LogConfig.findOneAndUpdate(
                    {
                        guildId: interaction.guild.id
                    },
                    {
                        enabled: false
                    }
                );

                await interaction.reply({
                    content:
                        "✅ All 27Pro logging has been disabled.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }
        }

        // ==================================================
        // WARN
        // ==================================================

        if (command === "warn") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ModerateMembers
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Moderate Members** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const reason =
                interaction.options.getString("reason");

            const member =
                await interaction.guild.members
                    .fetch(user.id)
                    .catch(() => null);

            if (!member) {

                await interaction.reply({
                    content:
                        "❌ Member is not in this server.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            await Warning.create({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                reason
            });

            const count =
                await Warning.countDocuments({
                    guildId: interaction.guild.id,
                    userId: user.id
                });

            await interaction.reply({
                embeds: [
                    baseEmbed(0xfee75c)
                        .setTitle("⚠️ Member Warned")
                        .addFields(
                            {
                                name: "Member",
                                value: `${member}`,
                                inline: true
                            },
                            {
                                name: "Moderator",
                                value: `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: "Total Warnings",
                                value: `${count}`,
                                inline: true
                            },
                            {
                                name: "Reason",
                                value: reason
                            }
                        )
                ]
            });

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0xfee75c)
                    .setTitle("⚠️ Warning Issued")
                    .addFields(
                        {
                            name: "Member",
                            value: `${member}`,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.user}`,
                            inline: true
                        },
                        {
                            name: "Reason",
                            value: reason
                        },
                        {
                            name: "Total Warnings",
                            value: `${count}`,
                            inline: true
                        }
                    )
            );

            return;
        }

        // ==================================================
        // WARNINGS
        // ==================================================

        if (command === "warnings") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ModerateMembers
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Moderate Members** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const sub =
                interaction.options.getSubcommand();

            const user =
                interaction.options.getUser("user");

            if (sub === "view") {

                const warnings =
                    await Warning.find({
                        guildId: interaction.guild.id,
                        userId: user.id
                    }).sort({
                        createdAt: -1
                    });

                if (!warnings.length) {

                    await interaction.reply({
                        embeds: [
                            baseEmbed(0x57f287)
                                .setTitle("⚠️ Warnings")
                                .setDescription(
                                    `${user} has no warnings.`
                                )
                        ]
                    });

                    return;
                }

                const list = warnings
                    .slice(0, 10)
                    .map(
                        (warning, index) =>
                            `**${index + 1}.** ${warning.reason}\n` +
                            `Moderator: <@${warning.moderatorId}>\n` +
                            `<t:${Math.floor(
                                warning.createdAt.getTime() / 1000
                            )}:R>`
                    )
                    .join("\n\n");

                await interaction.reply({
                    embeds: [
                        baseEmbed(0xfee75c)
                            .setTitle(
                                `⚠️ Warnings for ${user.username}`
                            )
                            .setDescription(list)
                            .setFooter({
                                text:
                                    `${warnings.length} warning(s) • ${BOT_NAME}`
                            })
                    ]
                });

                return;
            }

            if (sub === "clear") {

                const result =
                    await Warning.deleteMany({
                        guildId: interaction.guild.id,
                        userId: user.id
                    });

                await interaction.reply({
                    content:
                        `✅ Cleared **${result.deletedCount}** warning(s) from ${user}.`,
                    flags: MessageFlags.Ephemeral
                });

                await sendLog(
                    interaction.guild,
                    "moderation",
                    baseEmbed(0x57f287)
                        .setTitle("🧹 Warnings Cleared")
                        .addFields(
                            {
                                name: "Member",
                                value: `${user}`,
                                inline: true
                            },
                            {
                                name: "Moderator",
                                value: `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: "Cleared",
                                value: `${result.deletedCount}`,
                                inline: true
                            }
                        )
                );

                return;
            }
        }

        // ==================================================
        // KICK
        // ==================================================

        if (command === "kick") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.KickMembers
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Kick Members** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            const member =
                await interaction.guild.members
                    .fetch(user.id)
                    .catch(() => null);

            if (!member) {

                await interaction.reply({
                    content:
                        "❌ Member not found.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            if (
                member.id === interaction.user.id ||
                !botCanModerate(member)
            ) {
                await interaction.reply({
                    content:
                        "❌ I cannot moderate this member because of role hierarchy.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            await member.kick(reason);

            await interaction.reply({
                content:
                    `👢 **${user.tag}** has been kicked.`,
                flags: MessageFlags.Ephemeral
            });

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0xed4245)
                    .setTitle("👢 Member Kicked")
                    .addFields(
                        {
                            name: "Member",
                            value: `${user.tag}`,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.user}`,
                            inline: true
                        },
                        {
                            name: "Reason",
                            value: reason
                        }
                    )
            );

            return;
        }

        // ==================================================
        // BAN
        // ==================================================

        if (command === "ban") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.BanMembers
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Ban Members** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            const member =
                await interaction.guild.members
                    .fetch(user.id)
                    .catch(() => null);

            if (
                member &&
                !botCanModerate(member)
            ) {
                await interaction.reply({
                    content:
                        "❌ I cannot ban this member because of role hierarchy.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            await interaction.guild.members.ban(
                user.id,
                {
                    reason
                }
            );

            await interaction.reply({
                content:
                    `🔨 **${user.tag}** has been banned.`,
                flags: MessageFlags.Ephemeral
            });

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0xed4245)
                    .setTitle("🔨 Member Banned")
                    .addFields(
                        {
                            name: "User",
                            value: `${user.tag}`,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.user}`,
                            inline: true
                        },
                        {
                            name: "Reason",
                            value: reason
                        }
                    )
            );

            return;
        }

        // ==================================================
        // UNBAN
        // ==================================================

        if (command === "unban") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.BanMembers
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Ban Members** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const userId =
                interaction.options.getString("userid");

            await interaction.guild.members.unban(
                userId
            );

            await interaction.reply({
                content:
                    `🔓 User \`${userId}\` has been unbanned.`,
                flags: MessageFlags.Ephemeral
            });

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0x57f287)
                    .setTitle("🔓 Member Unbanned")
                    .addFields(
                        {
                            name: "User ID",
                            value: `\`${userId}\``,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.user}`,
                            inline: true
                        }
                    )
            );

            return;
        }

        // ==================================================
        // TIMEOUT
        // ==================================================

        if (command === "timeout") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ModerateMembers
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Moderate Members** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const minutes =
                interaction.options.getInteger("minutes");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            const member =
                await interaction.guild.members
                    .fetch(user.id);

            if (!botCanModerate(member)) {

                await interaction.reply({
                    content:
                        "❌ I cannot timeout this member because of role hierarchy.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            await member.timeout(
                minutes * 60 * 1000,
                reason
            );

            await interaction.reply({
                content:
                    `⏱️ ${member} has been timed out for **${minutes} minutes**.`,
                    flags: MessageFlags.Ephemeral
            });

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0xfee75c)
                    .setTitle("⏱️ Member Timed Out")
                    .addFields(
                        {
                            name: "Member",
                            value: `${member}`,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.user}`,
                            inline: true
                        },
                        {
                            name: "Duration",
                            value: `${minutes} minutes`,
                            inline: true
                        },
                        {
                            name: "Reason",
                            value: reason
                        }
                    )
            );

            return;
        }

        // ==================================================
        // UNTIMEOUT
        // ==================================================

        if (command === "untimeout") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ModerateMembers
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Moderate Members** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const member =
                await interaction.guild.members
                    .fetch(user.id);

            await member.timeout(null);

            await interaction.reply({
                content:
                    `✅ Timeout removed from ${member}.`,
                flags: MessageFlags.Ephemeral
            });

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0x57f287)
                    .setTitle("⏱️ Timeout Removed")
                    .addFields(
                        {
                            name: "Member",
                            value: `${member}`,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.user}`,
                            inline: true
                        }
                    )
            );

            return;
        }

        // ==================================================
        // NICKNAME
        // ==================================================

        if (command === "nick") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageNicknames
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Nicknames** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const nickname =
                interaction.options.getString("nickname");

            const member =
                await interaction.guild.members
                    .fetch(user.id);

            const oldNickname =
                member.nickname || user.username;

            await member.setNickname(
                nickname || null
            );

            await interaction.reply({
                content:
                    `✅ Nickname updated for ${member}.`,
                flags: MessageFlags.Ephemeral
            });

            await sendLog(
                interaction.guild,
                "member",
                baseEmbed(0xfee75c)
                    .setTitle("📝 Nickname Changed")
                    .addFields(
                        {
                            name: "Member",
                            value: `${member}`,
                            inline: true
                        },
                        {
                            name: "Before",
                            value: oldNickname,
                            inline: true
                        },
                        {
                            name: "After",
                            value:
                                nickname || user.username,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.user}`
                        }
                    )
            );

            return;
        }

        // ==================================================
        // CLEAR
        // ==================================================

        if (command === "clear") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageMessages
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Messages** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const amount =
                interaction.options.getInteger("amount");

            const deleted =
                await interaction.channel.bulkDelete(
                    amount,
                    true
                );

            await interaction.reply({
                content:
                    `🧹 Deleted **${deleted.size}** messages.`,
                flags: MessageFlags.Ephemeral
            });

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0xed4245)
                    .setTitle("🧹 Messages Cleared")
                    .addFields(
                        {
                            name: "Channel",
                            value: `${interaction.channel}`,
                            inline: true
                        },
                        {
                            name: "Amount",
                            value: `${deleted.size}`,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.user}`,
                            inline: true
                        }
                    )
            );

            return;
        }

        // ==================================================
        // SLOWMODE
        // ==================================================

        if (command === "slowmode") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Channels** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const seconds =
                interaction.options.getInteger("seconds");

            await interaction.channel.setRateLimitPerUser(
                seconds
            );

            await interaction.reply({
                content:
                    seconds === 0
                        ? "✅ Slowmode disabled."
                        : `🐌 Slowmode set to **${seconds} seconds**.`,
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        // ==================================================
        // LOCK
        // ==================================================

        if (command === "lock") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Channels** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            await interaction.channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: false
                }
            );

            await interaction.reply({
                embeds: [
                    baseEmbed(0xed4245)
                        .setTitle("🔒 Channel Locked")
                        .setDescription(
                            `${interaction.channel} has been locked.`
                        )
                ]
            });

            return;
        }

        // ==================================================
        // UNLOCK
        // ==================================================

        if (command === "unlock") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Channels** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            await interaction.channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: null
                }
            );

            await interaction.reply({
                embeds: [
                    baseEmbed(0x57f287)
                        .setTitle("🔓 Channel Unlocked")
                        .setDescription(
                            `${interaction.channel} has been unlocked.`
                        )
                ]
            });

            return;
        }

        // ==================================================
        // ROLE
        // ==================================================

        if (command === "role") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Roles** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const sub =
                interaction.options.getSubcommand();

            if (sub === "add") {

                const user =
                    interaction.options.getUser("user");

                const role =
                    interaction.options.getRole("role");

                const member =
                    await interaction.guild.members
                        .fetch(user.id);

                if (
                    role.position >=
                    interaction.guild.members.me.roles.highest.position
                ) {
                    await interaction.reply({
                        content:
                            "❌ That role is higher than or equal to my highest role.",
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await member.roles.add(role);

                await interaction.reply({
                    content:
                        `✅ Added ${role} to ${member}.`,
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            if (sub === "remove") {

                const user =
                    interaction.options.getUser("user");

                const role =
                    interaction.options.getRole("role");

                const member =
                    await interaction.guild.members
                        .fetch(user.id);

                await member.roles.remove(role);

                await interaction.reply({
                    content:
                        `✅ Removed ${role} from ${member}.`,
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            if (sub === "create") {

                const name =
                    interaction.options.getString("name");

                const role =
                    await interaction.guild.roles.create({
                        name
                    });

                await interaction.reply({
                    content:
                        `✅ Created ${role}.`,
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            if (sub === "delete") {

                const role =
                    interaction.options.getRole("role");

                if (
                    role.position >=
                    interaction.guild.members.me.roles.highest.position
                ) {
                    await interaction.reply({
                        content:
                            "❌ I cannot delete a role above my highest role.",
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await role.delete();

                await interaction.reply({
                    content:
                        `🗑️ Role **${role.name}** deleted.`,
                    flags: MessageFlags.Ephemeral
                });

                return;
            }
        }

        // ==================================================
        // SAY
        // ==================================================

        if (command === "say") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageMessages
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Messages** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const message =
                interaction.options.getString("message");

            await interaction.reply({
                content: "✅ Message sent.",
                flags: MessageFlags.Ephemeral
            });

            await interaction.channel.send({
                content: message,
                allowedMentions: {
                    parse: []
                }
            });

            return;
        }

        // ==================================================
        // ANNOUNCE
        // ==================================================

if (command === "announce") {

    if (
        !interaction.member.permissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        await interaction.reply({
            content: "❌ You need **Manage Server** permission.",
            flags: MessageFlags.Ephemeral
        });

        return;
    }

    const channel =
        interaction.options.getChannel("channel");

    const message =
        interaction.options.getString("message");

    if (!channel || !channel.isTextBased()) {
        await interaction.reply({
            content: "❌ That is not a valid text channel.",
            flags: MessageFlags.Ephemeral
        });

        return;
    }

    const embed = baseEmbed(0x5865f2)
        .setTitle("📢 Announcement")
        .setDescription(message)
        .addFields({
            name: "Posted by",
            value: `${interaction.user}`
        });

    await channel.send({
        content: "@everyone",
        embeds: [embed],
        allowedMentions: {
            parse: ["everyone"]
        }
    });

    await interaction.reply({
        content: `✅ Announcement sent to ${channel}.`,
        flags: MessageFlags.Ephemeral
    });

    return;
}
        // ==================================================
        // POLL
        // ==================================================

        if (command === "poll") {

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageMessages
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ You need **Manage Messages** permission.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const question =
                interaction.options.getString("question");

            const message =
                await interaction.channel.send({
                    embeds: [
                        baseEmbed()
                            .setTitle("📊 Poll")
                            .setDescription(
                                `**${question}**\n\n` +
                                "👍 Yes\n" +
                                "👎 No"
                            )
                            .addFields({
                                name: "Created by",
                                value: `${interaction.user}`
                            })
                    ]
                });

            await message.react("👍");
            await message.react("👎");

            await interaction.reply({
                content:
                    "✅ Poll created.",
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        // ==================================================
        // COINFLIP
        // ==================================================

        if (command === "coinflip") {

            const result =
                Math.random() < 0.5
                    ? "🪙 Heads"
                    : "🪙 Tails";

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle("🪙 Coin Flip")
                        .setDescription(
                            `The coin landed on **${result}**.`
                        )
                ]
            });

            return;
        }

        // ==================================================
        // ROLL
        // ==================================================

        if (command === "roll") {

            const sides =
                interaction.options.getInteger("sides") || 6;

            const result =
                Math.floor(Math.random() * sides) + 1;

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle("🎲 Dice Roll")
                        .setDescription(
                            `You rolled **${result}** on a **d${sides}**.`
                        )
                ]
            });

            return;
        }

        // ==================================================
        // 8BALL
        // ==================================================

        if (command === "8ball") {

            const question =
                interaction.options.getString("question");

            const answers = [
                "Absolutely.",
                "Definitely.",
                "Most likely.",
                "It seems so.",
                "Ask again later.",
                "I'm not sure.",
                "Probably not.",
                "Very unlikely.",
                "No."
            ];

            const answer =
                answers[
                    Math.floor(
                        Math.random() * answers.length
                    )
                ];

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle("🎱 Magic 8-Ball")
                        .addFields(
                            {
                                name: "Question",
                                value: question
                            },
                            {
                                name: "Answer",
                                value: answer
                            }
                        )
                ]
            });

            return;
        }

        // ==================================================
        // CHOOSE
        // ==================================================

        if (command === "choose") {

            const options =
                interaction.options
                    .getString("options")
                    .split(",")
                    .map(option => option.trim())
                    .filter(Boolean);

            if (options.length < 2) {

                await interaction.reply({
                    content:
                        "❌ Give me at least two options separated by commas.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const chosen =
                options[
                    Math.floor(
                        Math.random() * options.length
                    )
                ];

            await interaction.reply({
                embeds: [
                    baseEmbed()
                        .setTitle("🎯 Choice")
                        .setDescription(
                            `I choose **${chosen}**.`
                        )
                ]
            });

            return;
        }

    } catch (error) {

        console.error(
            `❌ Error in /${command}:`,
            error
        );

        const errorMessage =
            "❌ Something went wrong while processing that command.";

        try {

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                await interaction.editReply({
                    content: errorMessage,
                    embeds: []
                });

            } else {

                await interaction.reply({
                    content: errorMessage,
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (replyError) {

            console.error(
                "❌ Failed to send error response:",
                replyError
            );
        }
    }
});

// ======================================================
// DEBUG EVENTS
// ======================================================

client.on("debug", message => {
    if (
        message.includes("Heartbeat") ||
        message.includes("heartbeat")
    ) {
        return;
    }

    console.log(`🔧 Discord Debug: ${message}`);
});

client.on("warn", message => {
    console.warn(`⚠️ Discord Warning: ${message}`);
});

client.on("error", error => {
    console.error("❌ Discord Client Error:", error);
});

client.on("shardError", error => {
    console.error("❌ Discord Shard Error:", error);
});

client.on("shardReady", shardId => {
    console.log(`✅ Discord shard ${shardId} ready.`);
});

client.on("shardReconnecting", shardId => {
    console.log(`🔄 Discord shard ${shardId} reconnecting.`);
});

client.on("shardDisconnect", (event, shardId) => {
    console.log(
        `🔌 Discord shard ${shardId} disconnected.`,
        event?.code
    );
});

// ======================================================
// HOSTINGER WEB SERVER
// ======================================================

const server = http.createServer((req, res) => {

    res.writeHead(200, {
        "Content-Type": "application/json"
    });

    res.end(
        JSON.stringify({
            status: "online",
            bot: BOT_NAME,
            creator: CREATOR,
            discord: client.user
                ? client.user.tag
                : null,
            guilds: client.guilds.cache.size,
            uptime: process.uptime()
        })
    );
});

server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `🌐 Web server listening on port ${PORT}`
        );
    }
);

// ======================================================
// PROCESS ERROR HANDLING
// ======================================================

process.on("unhandledRejection", error => {
    console.error(
        "❌ Unhandled Promise Rejection:",
        error
    );
});

process.on("uncaughtException", error => {
    console.error(
        "❌ Uncaught Exception:",
        error
    );
});

// ============================================================
// GRACEFUL SHUTDOWN
// 27Pro • © 2026 iik27
// ============================================================

let shuttingDown = false;

async function gracefulShutdown(signal) {

    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log("");
    console.log("==========================================");
    console.log(`🛑 ${signal} received`);
    console.log("🛑 Shutting down 27Pro cleanly...");
    console.log("==========================================");

    // --------------------------------------------------------
    // CLOSE HTTP SERVER
    // --------------------------------------------------------

    try {

        if (typeof server !== "undefined" && server) {

            await new Promise(resolve => {

                let finished = false;

                const finish = () => {

                    if (finished) return;

                    finished = true;
                    resolve();
                };

                server.close(() => {

                    console.log(
                        "🌐 HTTP server closed."
                    );

                    finish();
                });

                // Don't wait forever
                setTimeout(() => {

                    console.log(
                        "⚠️ HTTP server close timeout."
                    );

                    finish();

                }, 5000);
            });
        }

    } catch (error) {

        console.error(
            "❌ HTTP server shutdown error:",
            error
        );
    }

    // --------------------------------------------------------
    // CLOSE DISCORD
    // --------------------------------------------------------

    try {

        if (client) {

            client.destroy();

            console.log(
                "🤖 Discord client closed."
            );
        }

    } catch (error) {

        console.error(
            "❌ Discord shutdown error:",
            error
        );
    }

    // --------------------------------------------------------
    // CLOSE MONGODB
    // --------------------------------------------------------

    try {

        if (
            mongoose.connection &&
            mongoose.connection.readyState !== 0
        ) {

            await mongoose.connection.close();

            console.log(
                "🍃 MongoDB connection closed."
            );
        }

    } catch (error) {

        console.error(
            "❌ MongoDB shutdown error:",
            error
        );
    }

    console.log("");
    console.log(
        "✅ 27Pro shutdown complete."
    );

    // Let Hostinger restart the application
    process.exit(0);
}

process.once("SIGTERM", () => {
    gracefulShutdown("SIGTERM");
});

process.once("SIGINT", () => {
    gracefulShutdown("SIGINT");
});

// ======================================================
// STARTUP
// ======================================================

async function start() {

    try {

        console.log("==========================================");
        console.log("🚀 STARTING 27PRO");
        console.log("==========================================");

        console.log("🔌 Connecting to MongoDB...");

        await mongoose.connect(MONGODB_URI);

        console.log("✅ MongoDB connected.");

        console.log("🔑 Logging into Discord...");

        await client.login(TOKEN);

    } catch (error) {

        console.error(
            "❌ Startup failed:",
            error
        );

        process.exit(1);
    }
}

start();
