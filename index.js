// ============================================================
// 27PRO - ADVANCED ALL-IN-ONE DISCORD BOT
// © 2026 iik27. All rights reserved.
// ============================================================

require("dotenv").config();

const http = require("http");
const axios = require("axios");
const mongoose = require("mongoose");

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    REST,
    Routes,
    ChannelType,
    MessageFlags,
    ActivityType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    AuditLogEvent
} = require("discord.js");

// ============================================================
// ENV
// ============================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = Number(process.env.PORT || 5500);

if (!TOKEN) {
    console.error("❌ TOKEN missing.");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("❌ CLIENT_ID missing.");
    process.exit(1);
}

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI missing.");
    process.exit(1);
}

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildWebhooks
    ],

    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.GuildMember,
        Partials.User
    ]
});

// ============================================================
// RUNTIME
// ============================================================

const xpCooldowns = new Map();
const spamTracker = new Map();
const duplicateTracker = new Map();
const raidTracker = new Map();
const securityTracker = new Map();
const giveawayTimers = new Map();
const reminderTimers = new Map();

let kickChecker = null;
let shuttingDown = false;

// ============================================================
// SCHEMAS
// ============================================================

const WelcomeConfig =
    mongoose.models.WelcomeConfig ||
    mongoose.model(
        "WelcomeConfig",
        new mongoose.Schema({
            guildId: {
                type: String,
                unique: true,
                index: true
            },

            enabled: {
                type: Boolean,
                default: false
            },

            channelId: String,
            roleId: String,

            message: {
                type: String,
                default:
                    "Welcome {user} to **{server}**! You are member #{count}."
            },

            image: String,

            goodbyeEnabled: {
                type: Boolean,
                default: false
            },

            goodbyeChannelId: String,

            goodbyeMessage: {
                type: String,
                default:
                    "{user} has left **{server}**."
            }
        }, {
            timestamps: true
        })
    );

const LogConfig =
    mongoose.models.LogConfig ||
    mongoose.model(
        "LogConfig",
        new mongoose.Schema({
            guildId: {
                type: String,
                unique: true,
                index: true
            },

            enabled: {
                type: Boolean,
                default: true
            },

            channels: {
                type: mongoose.Schema.Types.Mixed,
                default: {}
            }
        }, {
            timestamps: true
        })
    );

const Warning =
    mongoose.models.Warning ||
    mongoose.model(
        "Warning",
        new mongoose.Schema({
            guildId: String,
            userId: String,
            moderatorId: String,
            reason: String,
            caseId: Number
        }, {
            timestamps: true
        })
    );

const ModCase =
    mongoose.models.ModCase ||
    mongoose.model(
        "ModCase",
        new mongoose.Schema({
            guildId: {
                type: String,
                index: true
            },

            caseId: Number,
            type: String,
            userId: String,
            moderatorId: String,
            reason: String,
            duration: String,

            metadata: {
                type: mongoose.Schema.Types.Mixed,
                default: {}
            }
        }, {
            timestamps: true
        })
    );

ModCase.schema.index({
    guildId: 1,
    caseId: 1
}, {
    unique: true
});

const AutoMod =
    mongoose.models.AutoMod ||
    mongoose.model(
        "AutoMod",
        new mongoose.Schema({
            guildId: {
                type: String,
                unique: true
            },

            enabled: {
                type: Boolean,
                default: false
            },

            antiInvite: {
                type: Boolean,
                default: true
            },

            antiLinks: {
                type: Boolean,
                default: false
            },

            antiSpam: {
                type: Boolean,
                default: true
            },

            antiDuplicate: {
                type: Boolean,
                default: true
            },

            antiCaps: {
                type: Boolean,
                default: true
            },

            antiMentionSpam: {
                type: Boolean,
                default: true
            },

            maxMentions: {
                type: Number,
                default: 5
            },

            maxMessages: {
                type: Number,
                default: 6
            },

            spamWindow: {
                type: Number,
                default: 5000
            },

            duplicateWindow: {
                type: Number,
                default: 10000
            },

            capsPercentage: {
                type: Number,
                default: 70
            },

            blockedWords: {
                type: [String],
                default: []
            },

            punishment: {
                type: String,
                default: "delete"
            },

            timeoutMinutes: {
                type: Number,
                default: 10
            },

            ignoredChannels: {
                type: [String],
                default: []
            },

            ignoredRoles: {
                type: [String],
                default: []
            }
        }, {
            timestamps: true
        })
    );

const TicketConfig =
    mongoose.models.TicketConfig ||
    mongoose.model(
        "TicketConfig",
        new mongoose.Schema({
            guildId: {
                type: String,
                unique: true
            },

            enabled: {
                type: Boolean,
                default: false
            },

            categoryId: String,
            staffRoleId: String,
            transcriptChannelId: String,
            logChannelId: String,

            panelChannelId: String,
            panelMessageId: String,

            ticketCounter: {
                type: Number,
                default: 0
            },

            autoCloseHours: {
                type: Number,
                default: 0
            },

            maxTicketsPerUser: {
                type: Number,
                default: 1
            }
        }, {
            timestamps: true
        })
    );

const Ticket =
    mongoose.models.Ticket ||
    mongoose.model(
        "Ticket",
        new mongoose.Schema({
            guildId: String,

            channelId: {
                type: String,
                unique: true,
                index: true
            },

            userId: String,
            number: Number,

            claimedBy: {
                type: String,
                default: null
            },

            status: {
                type: String,
                default: "open"
            },

            priority: {
                type: String,
                default: "normal"
            },

            closedBy: String,
            closedAt: Date,
            reopenedAt: Date,

            lastActivityAt: {
                type: Date,
                default: Date.now
            }
        }, {
            timestamps: true
        })
    );

const Giveaway =
    mongoose.models.Giveaway ||
    mongoose.model(
        "Giveaway",
        new mongoose.Schema({
            guildId: String,
            channelId: String,
            messageId: String,
            hostId: String,
            prize: String,

            winners: {
                type: Number,
                default: 1
            },

            endAt: Date,

            ended: {
                type: Boolean,
                default: false
            },

            participants: {
                type: [String],
                default: []
            },

            selectedWinners: {
                type: [String],
                default: []
            }
        }, {
            timestamps: true
        })
    );

const Level =
    mongoose.models.Level ||
    mongoose.model(
        "Level",
        new mongoose.Schema({
            guildId: String,
            userId: String,

            xp: {
                type: Number,
                default: 0
            },

            level: {
                type: Number,
                default: 0
            }
        }, {
            timestamps: true
        })
    );

Level.schema.index({
    guildId: 1,
    userId: 1
}, {
    unique: true
});

const Reminder =
    mongoose.models.Reminder ||
    mongoose.model(
        "Reminder",
        new mongoose.Schema({
            guildId: String,
            userId: String,
            channelId: String,
            message: String,
            remindAt: Date,

            sent: {
                type: Boolean,
                default: false
            }
        }, {
            timestamps: true
        })
    );

const RolePanel =
    mongoose.models.RolePanel ||
    mongoose.model(
        "RolePanel",
        new mongoose.Schema({
            guildId: String,
            channelId: String,
            messageId: String,
            roleId: String,
            label: String,
            emoji: String
        }, {
            timestamps: true
        })
    );

const SecurityConfig =
    mongoose.models.SecurityConfig ||
    mongoose.model(
        "SecurityConfig",
        new mongoose.Schema({
            guildId: {
                type: String,
                unique: true
            },

            enabled: {
                type: Boolean,
                default: false
            },

            antiRaid: {
                type: Boolean,
                default: true
            },

            antiNuke: {
                type: Boolean,
                default: true
            },

            antiChannelDelete: {
                type: Boolean,
                default: true
            },

            antiRoleDelete: {
                type: Boolean,
                default: true
            },

            antiWebhook: {
                type: Boolean,
                default: true
            },

            antiBotAdd: {
                type: Boolean,
                default: true
            },

            raidJoinLimit: {
                type: Number,
                default: 10
            },

            raidWindow: {
                type: Number,
                default: 30000
            },

            action: {
                type: String,
                default: "kick"
            },

            trustedUsers: {
                type: [String],
                default: []
            },

            trustedRoles: {
                type: [String],
                default: []
            }
        }, {
            timestamps: true
        })
    );

const KickConfig =
    mongoose.models.KickConfig ||
    mongoose.model(
        "KickConfig",
        new mongoose.Schema({
            guildId: {
                type: String,
                unique: true
            },

            username: String,
            channelId: String,

            enabled: {
                type: Boolean,
                default: true
            },

            mentionRoleId: String,

            mentionEveryone: {
                type: Boolean,
                default: false
            },

            lastLive: {
                type: Boolean,
                default: false
            },

            lastStreamId: String
        }, {
            timestamps: true
        })
    );

// ============================================================
// HELPERS
// ============================================================

function embed(color = 0x5865f2) {
    return new EmbedBuilder()
        .setColor(color)
        .setTimestamp()
        .setFooter({
            text: "27Pro • © 2026 iik27"
        });
}

function truncate(text, length = 1024) {
    if (!text) return "None";

    text = String(text);

    return text.length > length
        ? text.slice(0, length - 3) + "..."
        : text;
}

function formatDuration(ms) {
    let seconds = Math.floor(ms / 1000);

    const days = Math.floor(seconds / 86400);
    seconds %= 86400;

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (seconds || !parts.length) parts.push(`${seconds}s`);

    return parts.join(" ");
}

function replaceVariables(message, member) {
    return String(message || "")
        .replaceAll("{user}", `${member}`)
        .replaceAll("{username}", member.user.username)
        .replaceAll("{server}", member.guild.name)
        .replaceAll(
            "{count}",
            String(member.guild.memberCount)
        )
        .replaceAll("{id}", member.id);
}

function botMember(guild) {
    return guild.members.me;
}

function botCanModerate(member) {
    const me = member.guild.members.me;

    if (!me) return false;
    if (member.id === member.guild.ownerId) return false;
    if (member.id === me.id) return false;

    return (
        me.roles.highest.position >
        member.roles.highest.position
    );
}

function moderatorCanAct(interaction, member) {
    if (
        interaction.guild.ownerId ===
        interaction.user.id
    ) {
        return true;
    }

    return (
        interaction.member.roles.highest.position >
        member.roles.highest.position
    );
}

async function safeReply(interaction, data) {
    try {
        if (
            interaction.replied ||
            interaction.deferred
        ) {
            return await interaction.editReply(data);
        }

        return await interaction.reply(data);
    } catch {}
}

// ============================================================
// CONFIG GETTERS
// ============================================================

async function getLogs(guildId) {
    return (
        await LogConfig.findOne({ guildId }) ||
        await LogConfig.create({
            guildId
        })
    );
}

async function getAutoMod(guildId) {
    return (
        await AutoMod.findOne({ guildId }) ||
        await AutoMod.create({
            guildId
        })
    );
}

async function getSecurity(guildId) {
    return (
        await SecurityConfig.findOne({
            guildId
        }) ||
        await SecurityConfig.create({
            guildId
        })
    );
}

async function getTickets(guildId) {
    return (
        await TicketConfig.findOne({
            guildId
        }) ||
        await TicketConfig.create({
            guildId
        })
    );
}

// ============================================================
// LOGGING
// ============================================================

async function sendLog(guild, type, logEmbed) {
    try {
        const config =
            await getLogs(guild.id);

        if (!config.enabled) return;

        const channelId =
            config.channels?.[type];

        if (!channelId) return;

        const channel =
            guild.channels.cache.get(channelId);

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return;
        }

        await channel.send({
            embeds: [logEmbed]
        });
    } catch (error) {
        console.error(
            `Log error [${type}]:`,
            error.message
        );
    }
}

// ============================================================
// CASES
// ============================================================

async function nextCaseId(guildId) {
    const latest =
        await ModCase.findOne({
            guildId
        }).sort({
            caseId: -1
        });

    return latest
        ? latest.caseId + 1
        : 1;
}

async function createCase(
    guild,
    type,
    userId,
    moderatorId,
    reason,
    duration = null,
    metadata = {}
) {
    const caseId =
        await nextCaseId(guild.id);

    return ModCase.create({
        guildId: guild.id,
        caseId,
        type,
        userId,
        moderatorId,
        reason: reason || "No reason provided.",
        duration,
        metadata
    });
}

// ============================================================
// LEVELING
// ============================================================

function calculateLevel(xp) {
    return Math.floor(
        Math.sqrt(xp / 100)
    );
}

async function addXP(guildId, userId) {
    const amount =
        Math.floor(Math.random() * 11) + 5;

    let data =
        await Level.findOne({
            guildId,
            userId
        });

    if (!data) {
        data = await Level.create({
            guildId,
            userId,
            xp: amount,
            level: 0
        });
    } else {
        const oldLevel = data.level;

        data.xp += amount;
        data.level =
            calculateLevel(data.xp);

        await data.save();

        return {
            data,
            levelUp:
                data.level > oldLevel
        };
    }

    return {
        data,
        levelUp: false
    };
}

// ============================================================
// COMMANDS
// ============================================================

const commands = [

    // ---------------- INFORMATION ----------------

    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show the 27Pro command center"),

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check bot latency"),

    new SlashCommandBuilder()
        .setName("uptime")
        .setDescription("Show bot uptime"),

    new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Show bot information"),

    new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Show server information"),

    new SlashCommandBuilder()
        .setName("membercount")
        .setDescription("Show server member count"),

    new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Show user information")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Show a user's avatar")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("banner")
        .setDescription("Show a user's banner")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    // ---------------- MODERATION ----------------

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("Manage warnings")
        .addSubcommand(s =>
            s.setName("view")
                .setDescription("View warnings")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("Member")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("clear")
                .setDescription("Clear warnings")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("Member")
                        .setRequired(true)
                )
        ),

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("softban")
        .setDescription("Ban and immediately unban a member")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user")
        .addStringOption(o =>
            o.setName("userid")
                .setDescription("User ID")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Timeout a member")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("minutes")
                .setDescription("Minutes")
                .setMinValue(1)
                .setMaxValue(40320)
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Mute a member")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("minutes")
                .setDescription("Minutes")
                .setMinValue(1)
                .setMaxValue(40320)
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("reason")
                .setDescription("Reason")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Remove timeout")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Unmute a member")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("nick")
        .setDescription("Change a nickname")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("nickname")
                .setDescription("Nickname")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Delete messages")
        .addIntegerOption(o =>
            o.setName("amount")
                .setDescription("1-100")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Advanced message purge")
        .addSubcommand(s =>
            s.setName("user")
                .setDescription("Delete messages from a user")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("User")
                        .setRequired(true)
                )
                .addIntegerOption(o =>
                    o.setName("amount")
                        .setDescription("Amount")
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("bots")
                .setDescription("Delete bot messages")
                .addIntegerOption(o =>
                    o.setName("amount")
                        .setDescription("Amount")
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("links")
                .setDescription("Delete messages containing links")
                .addIntegerOption(o =>
                    o.setName("amount")
                        .setDescription("Amount")
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        ),

    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Set channel slowmode")
        .addIntegerOption(o =>
            o.setName("seconds")
                .setDescription("Seconds")
                .setMinValue(0)
                .setMaxValue(21600)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Lock the current channel"),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlock the current channel"),

    new SlashCommandBuilder()
        .setName("case")
        .setDescription("View a moderation case")
        .addIntegerOption(o =>
            o.setName("id")
                .setDescription("Case ID")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("cases")
        .setDescription("View cases")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("history")
        .setDescription("View moderation history")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("modstats")
        .setDescription("View moderator statistics")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Moderator")
                .setRequired(false)
        ),

    // ---------------- ROLES ----------------

    new SlashCommandBuilder()
        .setName("role")
        .setDescription("Manage roles")
        .addSubcommand(s =>
            s.setName("add")
                .setDescription("Add a role")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("User")
                        .setRequired(true)
                )
                .addRoleOption(o =>
                    o.setName("role")
                        .setDescription("Role")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("remove")
                .setDescription("Remove a role")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("User")
                        .setRequired(true)
                )
                .addRoleOption(o =>
                    o.setName("role")
                        .setDescription("Role")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("create")
                .setDescription("Create a role")
                .addStringOption(o =>
                    o.setName("name")
                        .setDescription("Role name")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("delete")
                .setDescription("Delete a role")
                .addRoleOption(o =>
                    o.setName("role")
                        .setDescription("Role")
                        .setRequired(true)
                )
        ),

    // ---------------- WELCOME ----------------

    new SlashCommandBuilder()
        .setName("welcome")
        .setDescription("Welcome system")
        .addSubcommand(s =>
            s.setName("setup")
                .setDescription("Setup welcome")
                .addChannelOption(o =>
                    o.setName("channel")
                        .setDescription("Welcome channel")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addRoleOption(o =>
                    o.setName("role")
                        .setDescription("Auto role")
                        .setRequired(false)
                )
                .addStringOption(o =>
                    o.setName("message")
                        .setDescription("Welcome message")
                        .setRequired(false)
                )
        )
        .addSubcommand(s =>
            s.setName("config")
                .setDescription("View welcome config")
        )
        .addSubcommand(s =>
            s.setName("test")
                .setDescription("Test welcome")
        )
        .addSubcommand(s =>
            s.setName("disable")
                .setDescription("Disable welcome")
        ),

    // ---------------- LOGS ----------------

    new SlashCommandBuilder()
        .setName("logs")
        .setDescription("Logging system")
        .addSubcommand(s =>
            s.setName("setup")
                .setDescription("Setup a log channel")
                .addStringOption(o =>
                    o.setName("type")
                        .setDescription("Log type")
                        .setRequired(true)
                        .addChoices(
                            { name: "General", value: "general" },
                            { name: "Member", value: "member" },
                            { name: "Message", value: "message" },
                            { name: "Moderation", value: "moderation" },
                            { name: "Role", value: "role" },
                            { name: "Channel", value: "channel" },
                            { name: "Server", value: "server" },
                            { name: "Bot", value: "bot" },
                            { name: "Voice", value: "voice" },
                            { name: "AutoMod", value: "automod" },
                            { name: "Ticket", value: "ticket" },
                            { name: "Security", value: "security" },
                            { name: "Giveaway", value: "giveaway" },
                            { name: "Raid", value: "raid" }
                        )
                )
                .addChannelOption(o =>
                    o.setName("channel")
                        .setDescription("Log channel")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("config")
                .setDescription("View logging config")
        )
        .addSubcommand(s =>
            s.setName("test")
                .setDescription("Test logs")
        )
        .addSubcommand(s =>
            s.setName("disable")
                .setDescription("Disable logs")
        ),

    // ---------------- AUTOMOD ----------------

    new SlashCommandBuilder()
        .setName("automod")
        .setDescription("Auto moderation")
        .addSubcommand(s =>
            s.setName("enable")
                .setDescription("Enable AutoMod")
        )
        .addSubcommand(s =>
            s.setName("disable")
                .setDescription("Disable AutoMod")
        )
        .addSubcommand(s =>
            s.setName("config")
                .setDescription("View AutoMod config")
        )
        .addSubcommand(s =>
            s.setName("punishment")
                .setDescription("Set punishment")
                .addStringOption(o =>
                    o.setName("type")
                        .setDescription("Punishment")
                        .setRequired(true)
                        .addChoices(
                            { name: "Delete", value: "delete" },
                            { name: "Warn", value: "warn" },
                            { name: "Timeout", value: "timeout" },
                            { name: "Kick", value: "kick" },
                            { name: "Ban", value: "ban" }
                        )
                )
        )
        .addSubcommand(s =>
            s.setName("word")
                .setDescription("Block a word")
                .addStringOption(o =>
                    o.setName("word")
                        .setDescription("Word")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("unword")
                .setDescription("Remove blocked word")
                .addStringOption(o =>
                    o.setName("word")
                        .setDescription("Word")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("toggle")
                .setDescription("Toggle AutoMod feature")
                .addStringOption(o =>
                    o.setName("feature")
                        .setDescription("Feature")
                        .setRequired(true)
                        .addChoices(
                            { name: "Invites", value: "antiInvite" },
                            { name: "Links", value: "antiLinks" },
                            { name: "Spam", value: "antiSpam" },
                            { name: "Duplicates", value: "antiDuplicate" },
                            { name: "Caps", value: "antiCaps" },
                            { name: "Mention Spam", value: "antiMentionSpam" }
                        )
                )
                .addBooleanOption(o =>
                    o.setName("enabled")
                        .setDescription("Enabled")
                        .setRequired(true)
                )
        ),

    // ---------------- SECURITY ----------------

    new SlashCommandBuilder()
        .setName("security")
        .setDescription("Anti-raid and anti-nuke security")
        .addSubcommand(s =>
            s.setName("enable")
                .setDescription("Enable security")
        )
        .addSubcommand(s =>
            s.setName("disable")
                .setDescription("Disable security")
        )
        .addSubcommand(s =>
            s.setName("status")
                .setDescription("View security status")
        )
        .addSubcommand(s =>
            s.setName("raid")
                .setDescription("Toggle raid mode")
                .addBooleanOption(o =>
                    o.setName("enabled")
                        .setDescription("Enabled")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("trust")
                .setDescription("Trust a member")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("User")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("untrust")
                .setDescription("Remove trusted member")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("User")
                        .setRequired(true)
                )
        ),

    // ---------------- TICKETS ----------------

    new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Ticket system")
        .addSubcommand(s =>
            s.setName("setup")
                .setDescription("Setup tickets")
                .addChannelOption(o =>
                    o.setName("category")
                        .setDescription("Ticket category")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
                .addRoleOption(o =>
                    o.setName("staff")
                        .setDescription("Staff role")
                        .setRequired(true)
                )
                .addChannelOption(o =>
                    o.setName("logs")
                        .setDescription("Ticket logs")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addChannelOption(o =>
                    o.setName("transcripts")
                        .setDescription("Transcript channel")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        )
        .addSubcommand(s =>
            s.setName("panel")
                .setDescription("Create ticket panel")
                .addChannelOption(o =>
                    o.setName("channel")
                        .setDescription("Panel channel")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("close")
                .setDescription("Close current ticket")
        )
        .addSubcommand(s =>
            s.setName("reopen")
                .setDescription("Reopen current ticket")
        )
        .addSubcommand(s =>
            s.setName("claim")
                .setDescription("Claim current ticket")
        )
        .addSubcommand(s =>
            s.setName("transcript")
                .setDescription("Create ticket transcript")
        )
        .addSubcommand(s =>
            s.setName("delete")
                .setDescription("Delete current ticket")
        )
        .addSubcommand(s =>
            s.setName("add")
                .setDescription("Add user to ticket")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("User")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("remove")
                .setDescription("Remove user from ticket")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("User")
                        .setRequired(true)
                )
        ),

    // ---------------- GIVEAWAYS ----------------

    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Giveaway system")
        .addSubcommand(s =>
            s.setName("start")
                .setDescription("Start giveaway")
                .addIntegerOption(o =>
                    o.setName("minutes")
                        .setDescription("Duration")
                        .setMinValue(1)
                        .setRequired(true)
                )
                .addIntegerOption(o =>
                    o.setName("winners")
                        .setDescription("Winner count")
                        .setMinValue(1)
                        .setMaxValue(20)
                        .setRequired(true)
                )
                .addStringOption(o =>
                    o.setName("prize")
                        .setDescription("Prize")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("end")
                .setDescription("End giveaway")
                .addStringOption(o =>
                    o.setName("messageid")
                        .setDescription("Giveaway message ID")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("reroll")
                .setDescription("Reroll giveaway")
                .addStringOption(o =>
                    o.setName("messageid")
                        .setDescription("Giveaway message ID")
                        .setRequired(true)
                )
        ),

    // ---------------- LEVELING ----------------

    new SlashCommandBuilder()
        .setName("rank")
        .setDescription("View rank")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("View XP leaderboard"),

    // ---------------- ROLE PANEL ----------------

    new SlashCommandBuilder()
        .setName("rolepanel")
        .setDescription("Create a self-role panel")
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Channel")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Role")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("label")
                .setDescription("Button label")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("emoji")
                .setDescription("Emoji")
                .setRequired(false)
        ),

    // ---------------- UTILITY ----------------

    new SlashCommandBuilder()
        .setName("say")
        .setDescription("Make the bot say something")
        .addStringOption(o =>
            o.setName("message")
                .setDescription("Message")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Send an announcement")
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Channel")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("message")
                .setDescription("Announcement")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("poll")
        .setDescription("Create a poll")
        .addStringOption(o =>
            o.setName("question")
                .setDescription("Question")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("remind")
        .setDescription("Create a reminder")
        .addIntegerOption(o =>
            o.setName("minutes")
                .setDescription("Minutes")
                .setMinValue(1)
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("message")
                .setDescription("Reminder")
                .setRequired(true)
        ),

    // ---------------- FUN ----------------

    new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Flip a coin"),

    new SlashCommandBuilder()
        .setName("roll")
        .setDescription("Roll dice")
        .addIntegerOption(o =>
            o.setName("sides")
                .setDescription("Sides")
                .setMinValue(2)
                .setMaxValue(100000)
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Ask the magic 8-ball")
        .addStringOption(o =>
            o.setName("question")
                .setDescription("Question")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("choose")
        .setDescription("Choose between options")
        .addStringOption(o =>
            o.setName("options")
                .setDescription("Separate options with commas")
                .setRequired(true)
        ),

    // ---------------- KICK ----------------

    new SlashCommandBuilder()
        .setName("live")
        .setDescription("KICK live notification system")
        .addSubcommand(s =>
            s.setName("setup")
                .setDescription("Setup KICK notifications")
                .addStringOption(o =>
                    o.setName("username")
                        .setDescription("KICK username")
                        .setRequired(true)
                )
                .addChannelOption(o =>
                    o.setName("channel")
                        .setDescription("Notification channel")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("disable")
                .setDescription("Disable KICK notifications")
        ),

    new SlashCommandBuilder()
        .setName("livecheck")
        .setDescription("Check KICK live status")
];

const commandJSON =
    commands.map(command =>
        command.toJSON()
    );

    // ============================================================
// 27PRO - PART 2/4
// CORE SYSTEMS
// ============================================================

// ============================================================
// GLOBAL COMMAND REGISTRATION
// ============================================================

async function registerCommands() {
    try {
        const rest = new REST({
            version: "10"
        }).setToken(TOKEN);

        console.log(
            "🌍 Registering global slash commands..."
        );

        await rest.put(
            Routes.applicationCommands(
                CLIENT_ID
            ),
            {
                body: commandJSON
            }
        );

        console.log(
            `✅ ${commandJSON.length} global commands registered.`
        );
    } catch (error) {
        console.error(
            "❌ Command registration failed:",
            error
        );
    }
}

// ============================================================
// MODERATION HELPERS
// ============================================================

async function warnMember(
    guild,
    userId,
    moderatorId,
    reason
) {
    const caseData =
        await createCase(
            guild,
            "WARN",
            userId,
            moderatorId,
            reason
        );

    await Warning.create({
        guildId: guild.id,
        userId,
        moderatorId,
        reason,
        caseId: caseData.caseId
    });

    return caseData;
}

async function getWarningCount(
    guildId,
    userId
) {
    return Warning.countDocuments({
        guildId,
        userId
    });
}

async function clearWarnings(
    guildId,
    userId
) {
    return Warning.deleteMany({
        guildId,
        userId
    });
}

// ============================================================
// SECURITY
// ============================================================

function isTrusted(
    guild,
    member,
    config
) {
    if (!member) return false;

    if (
        member.id === guild.ownerId
    ) {
        return true;
    }

    if (
        config.trustedUsers.includes(
            member.id
        )
    ) {
        return true;
    }

    return member.roles.cache.some(
        role =>
            config.trustedRoles.includes(
                role.id
            )
    );
}

async function auditExecutor(
    guild,
    type,
    targetId = null
) {
    try {
        const logs =
            await guild.fetchAuditLogs({
                type,
                limit: 10
            });

        const entry =
            logs.entries.find(item => {
                if (
                    targetId &&
                    item.target?.id !== targetId
                ) {
                    return false;
                }

                return (
                    Date.now() -
                    item.createdTimestamp <
                    15000
                );
            });

        return entry?.executor || null;
    } catch {
        return null;
    }
}

function addSecurityStrike(
    guildId,
    userId,
    action
) {
    const key =
        `${guildId}:${userId}:${action}`;

    const now = Date.now();

    let entries =
        securityTracker.get(key) || [];

    entries = entries.filter(
        timestamp =>
            now - timestamp < 30000
    );

    entries.push(now);

    securityTracker.set(
        key,
        entries
    );

    return entries.length;
}

async function securityEvent(
    guild,
    executor,
    action,
    reason
) {
    try {
        if (!executor) return;

        if (
            executor.id ===
            client.user.id
        ) {
            return;
        }

        const config =
            await getSecurity(
                guild.id
            );

        if (!config.enabled) {
            return;
        }

        const member =
            await guild.members
                .fetch(executor.id)
                .catch(() => null);

        if (!member) return;

        if (
            isTrusted(
                guild,
                member,
                config
            )
        ) {
            return;
        }

        const strikes =
            addSecurityStrike(
                guild.id,
                executor.id,
                action
            );

        await sendLog(
            guild,
            "security",
            embed(0xff0000)
                .setTitle(
                    "🚨 Security Alert"
                )
                .addFields(
                    {
                        name: "Executor",
                        value:
                            `${member}\n\`${member.id}\``
                    },
                    {
                        name: "Action",
                        value: action,
                        inline: true
                    },
                    {
                        name: "Strikes",
                        value:
                            String(strikes),
                        inline: true
                    },
                    {
                        name: "Reason",
                        value: truncate(
                            reason
                        )
                    }
                )
        );

        // Three dangerous actions in a short period.
        if (strikes < 3) {
            return;
        }

        if (
            !botCanModerate(member)
        ) {
            return;
        }

        if (
            config.action === "ban"
        ) {
            await member.ban({
                reason:
                    `27Pro Anti-Nuke: ${reason}`
            });
        }

        else if (
            config.action === "timeout"
        ) {
            await member.timeout(
                60 * 60 * 1000,
                `27Pro Anti-Nuke: ${reason}`
            );
        }

        else {
            await member.kick(
                `27Pro Anti-Nuke: ${reason}`
            );
        }

        const caseData =
            await createCase(
                guild,
                "SECURITY",
                member.id,
                client.user.id,
                reason
            );

        await sendLog(
            guild,
            "security",
            embed(0xff0000)
                .setTitle(
                    "🛡️ Anti-Nuke Action"
                )
                .addFields(
                    {
                        name: "User",
                        value: `${member}`,
                        inline: true
                    },
                    {
                        name: "Action",
                        value:
                            config.action.toUpperCase(),
                        inline: true
                    },
                    {
                        name: "Case",
                        value:
                            `#${caseData.caseId}`,
                        inline: true
                    }
                )
        );
    } catch (error) {
        console.error(
            "Security system error:",
            error
        );
    }
}

// ============================================================
// AUTOMOD PUNISHMENT
// ============================================================

async function automodPunish(
    message,
    config,
    reason
) {
    const member =
        message.member;

    if (!member) return;

    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator
        ) ||
        member.permissions.has(
            PermissionFlagsBits.ManageMessages
        )
    ) {
        return;
    }

    if (
        message.deletable
    ) {
        await message.delete()
            .catch(() => {});
    }

    let punishment =
        config.punishment;

    const warnings =
        await getWarningCount(
            message.guild.id,
            member.id
        );

    // Escalation
    if (warnings >= 3) {
        punishment = "timeout";
    }

    if (warnings >= 5) {
        punishment = "kick";
    }

    if (warnings >= 7) {
        punishment = "ban";
    }

    const caseData =
        await createCase(
            message.guild,
            `AUTOMOD_${punishment.toUpperCase()}`,
            member.id,
            client.user.id,
            reason
        );

    if (
        punishment === "warn"
    ) {
        await Warning.create({
            guildId:
                message.guild.id,
            userId:
                member.id,
            moderatorId:
                client.user.id,
            reason,
            caseId:
                caseData.caseId
        });
    }

    else if (
        punishment === "timeout"
    ) {
        if (
            botCanModerate(member)
        ) {
            await member.timeout(
                config.timeoutMinutes *
                    60 *
                    1000,
                reason
            );
        }
    }

    else if (
        punishment === "kick"
    ) {
        if (
            botCanModerate(member)
        ) {
            await member.kick(
                reason
            );
        }
    }

    else if (
        punishment === "ban"
    ) {
        if (
            botCanModerate(member)
        ) {
            await member.ban({
                reason
            });
        }
    }

    await sendLog(
        message.guild,
        "automod",
        embed(0xff6600)
            .setTitle(
                "🤖 AutoMod Action"
            )
            .addFields(
                {
                    name: "User",
                    value:
                        `${member}\n\`${member.id}\``,
                    inline: true
                },
                {
                    name: "Action",
                    value:
                        punishment.toUpperCase(),
                    inline: true
                },
                {
                    name: "Case",
                    value:
                        `#${caseData.caseId}`,
                    inline: true
                },
                {
                    name: "Reason",
                    value:
                        truncate(reason)
                }
            )
    );
}

// ============================================================
// AUTOMOD CHECK
// ============================================================

async function runAutoMod(
    message
) {
    if (
        !message.guild ||
        !message.member ||
        message.author.bot
    ) {
        return false;
    }

    const config =
        await getAutoMod(
            message.guild.id
        );

    if (!config.enabled) {
        return false;
    }

    if (
        config.ignoredChannels.includes(
            message.channel.id
        )
    ) {
        return false;
    }

    if (
        message.member.roles.cache.some(
            role =>
                config.ignoredRoles.includes(
                    role.id
                )
        )
    ) {
        return false;
    }

    if (
        message.member.permissions.has(
            PermissionFlagsBits.Administrator
        ) ||
        message.member.permissions.has(
            PermissionFlagsBits.ManageMessages
        )
    ) {
        return false;
    }

    const content =
        message.content || "";

    const lower =
        content.toLowerCase();

    // --------------------------------------------------------
    // INVITES
    // --------------------------------------------------------

    if (
        config.antiInvite &&
        /discord(?:\.gg|\.com\/invite|app\.com\/invite)\/[a-z0-9-]+/i.test(
            content
        )
    ) {
        await automodPunish(
            message,
            config,
            "Discord invite detected"
        );

        return true;
    }

    // --------------------------------------------------------
    // LINKS
    // --------------------------------------------------------

    if (
        config.antiLinks &&
        /https?:\/\/\S+/i.test(
            content
        )
    ) {
        await automodPunish(
            message,
            config,
            "External link detected"
        );

        return true;
    }

    // --------------------------------------------------------
    // BLOCKED WORDS
    // --------------------------------------------------------

    for (
        const word of config.blockedWords
    ) {
        if (
            word &&
            lower.includes(
                word.toLowerCase()
            )
        ) {
            await automodPunish(
                message,
                config,
                `Blocked word detected: ${word}`
            );

            return true;
        }
    }

    // --------------------------------------------------------
    // MENTION SPAM
    // --------------------------------------------------------

    const mentionCount =
        message.mentions.users.size +
        message.mentions.roles.size;

    if (
        config.antiMentionSpam &&
        mentionCount >=
            config.maxMentions
    ) {
        await automodPunish(
            message,
            config,
            "Mention spam detected"
        );

        return true;
    }

    // --------------------------------------------------------
    // CAPS
    // --------------------------------------------------------

    if (
        config.antiCaps &&
        content.length >= 8
    ) {
        const letters =
            content.match(
                /[A-Za-z]/g
            ) || [];

        const uppercase =
            content.match(
                /[A-Z]/g
            ) || [];

        if (
            letters.length >= 5 &&
            (
                uppercase.length /
                letters.length
            ) * 100 >=
                config.capsPercentage
        ) {
            await automodPunish(
                message,
                config,
                "Excessive caps detected"
            );

            return true;
        }
    }

    // --------------------------------------------------------
    // DUPLICATES
    // --------------------------------------------------------

    if (
        config.antiDuplicate &&
        content.trim().length >= 3
    ) {
        const key =
            `${message.guild.id}:${message.author.id}`;

        const previous =
            duplicateTracker.get(key);

        const now = Date.now();

        if (
            previous &&
            previous.content ===
                lower.trim() &&
            now - previous.timestamp <=
                config.duplicateWindow
        ) {
            await automodPunish(
                message,
                config,
                "Duplicate message detected"
            );

            duplicateTracker.delete(
                key
            );

            return true;
        }

        duplicateTracker.set(
            key,
            {
                content:
                    lower.trim(),
                timestamp: now
            }
        );
    }

    // --------------------------------------------------------
    // SPAM
    // --------------------------------------------------------

    if (
        config.antiSpam
    ) {
        const key =
            `${message.guild.id}:${message.author.id}`;

        const now = Date.now();

        let timestamps =
            spamTracker.get(key) || [];

        timestamps =
            timestamps.filter(
                timestamp =>
                    now - timestamp <=
                    config.spamWindow
            );

        timestamps.push(now);

        spamTracker.set(
            key,
            timestamps
        );

        if (
            timestamps.length >=
            config.maxMessages
        ) {
            spamTracker.delete(key);

            await automodPunish(
                message,
                config,
                "Message spam detected"
            );

            return true;
        }
    }

    return false;
}

// ============================================================
// TICKET HELPERS
// ============================================================

async function getTicket(
    guildId,
    channelId
) {
    return Ticket.findOne({
        guildId,
        channelId
    });
}

async function ticketStaff(
    interaction,
    config
) {
    if (
        interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageChannels
        )
    ) {
        return true;
    }

    if (
        config.staffRoleId &&
        interaction.member?.roles?.cache?.has(
            config.staffRoleId
        )
    ) {
        return true;
    }

    return false;
}

// ============================================================
// TICKET TRANSCRIPT
// ============================================================

async function createTranscript(
    channel
) {
    const messages = [];
    let lastId = null;

    for (let i = 0; i < 10; i++) {
        const fetched =
            await channel.messages.fetch({
                limit: 100,
                before: lastId || undefined
            });

        if (!fetched.size) {
            break;
        }

        messages.push(
            ...fetched.values()
        );

        lastId =
            fetched.last().id;

        if (
            fetched.size < 100
        ) {
            break;
        }
    }

    messages.sort(
        (a, b) =>
            a.createdTimestamp -
            b.createdTimestamp
    );

    let output =
        `27Pro Ticket Transcript\n`;

    output +=
        `Server: ${channel.guild.name}\n`;

    output +=
        `Channel: ${channel.name}\n`;

    output +=
        `Generated: ${new Date().toISOString()}\n`;

    output +=
        `========================================\n\n`;

    for (
        const message of messages
    ) {
        const date =
            new Date(
                message.createdTimestamp
            ).toISOString();

        output +=
            `[${date}] ${message.author.tag}: ${message.content || ""}`;

        if (
            message.attachments.size
        ) {
            output +=
                ` [Attachments: ${[
                    ...message.attachments.values()
                ].map(a => a.url).join(", ")}]`;
        }

        output += "\n";
    }

    // Avoid enormous attachments.
    if (
        Buffer.byteLength(output, "utf8") >
        7_500_000
    ) {
        output =
            output.slice(
                0,
                7_400_000
            ) +
            "\n\n[Transcript truncated]";
    }

    return Buffer.from(
        output,
        "utf8"
    );
}

async function sendTicketTranscript(
    guild,
    ticket,
    channel
) {
    const config =
        await getTickets(
            guild.id
        );

    const buffer =
        await createTranscript(
            channel
        );

    const attachment =
        new AttachmentBuilder(
            buffer,
            {
                name:
                    `${channel.name}-transcript.txt`
            }
        );

    let target = null;

    if (
        config.transcriptChannelId
    ) {
        target =
            guild.channels.cache.get(
                config.transcriptChannelId
            );
    }

    if (
        !target &&
        config.logChannelId
    ) {
        target =
            guild.channels.cache.get(
                config.logChannelId
            );
    }

    if (
        target &&
        target.isTextBased()
    ) {
        await target.send({
            content:
                `📄 Transcript for **${channel.name}**`,
            files: [attachment]
        });
    }
}

// ============================================================
// CREATE TICKET
// ============================================================

async function createTicket(
    guild,
    user
) {
    const config =
        await getTickets(
            guild.id
        );

    if (!config.enabled) {
        return {
            error:
                "The ticket system is disabled."
        };
    }

    const current =
        await Ticket.findOne({
            guildId: guild.id,
            userId: user.id,
            status: "open"
        });

    if (current) {
        return {
            error:
                `You already have an open ticket: <#${current.channelId}>`
        };
    }

    const count =
        await Ticket.countDocuments({
            guildId: guild.id,
            userId: user.id,
            status: "open"
        });

    if (
        count >=
        config.maxTicketsPerUser
    ) {
        return {
            error:
                "You reached the maximum number of open tickets."
        };
    }

    config.ticketCounter++;

    await config.save();

    const number =
        config.ticketCounter;

    const overwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [
                PermissionFlagsBits.ViewChannel
            ]
        },
        {
            id: user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles
            ]
        }
    ];

    if (
        config.staffRoleId
    ) {
        overwrites.push({
            id: config.staffRoleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ManageMessages
            ]
        });
    }

    const channel =
        await guild.channels.create({
            name:
                `ticket-${String(number).padStart(4, "0")}`,
            type:
                ChannelType.GuildText,

            parent:
                config.categoryId || null,

            permissionOverwrites:
                overwrites,

            topic:
                `27Pro Ticket #${number} • ${user.tag}`
        });

    const ticket =
        await Ticket.create({
            guildId: guild.id,
            channelId: channel.id,
            userId: user.id,
            number,
            status: "open",
            lastActivityAt: new Date()
        });

    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "ticket:claim"
                    )
                    .setLabel("Claim")
                    .setEmoji("🙋")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "ticket:close"
                    )
                    .setLabel("Close")
                    .setEmoji("🔒")
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );

    const ticketEmbed =
        embed(0x5865f2)
            .setTitle(
                `🎫 Ticket #${number}`
            )
            .setDescription(
                [
                    `Welcome ${user}.`,
                    "",
                    "A staff member will assist you shortly.",
                    "",
                    "Use the buttons below to manage this ticket."
                ].join("\n")
            )
            .addFields({
                name: "Opened By",
                value:
                    `${user}\n\`${user.id}\``
            });

    await channel.send({
        content:
            `${user}${config.staffRoleId ? ` <@&${config.staffRoleId}>` : ""}`,
        embeds: [
            ticketEmbed
        ],
        components: [row]
    });

    await sendLog(
        guild,
        "ticket",
        embed(0x5865f2)
            .setTitle(
                "🎫 Ticket Created"
            )
            .addFields(
                {
                    name: "Ticket",
                    value:
                        `<#${channel.id}>`,
                    inline: true
                },
                {
                    name: "User",
                    value:
                        `${user}`,
                    inline: true
                },
                {
                    name: "Number",
                    value:
                        `#${number}`,
                    inline: true
                }
            )
    );

    return {
        ticket,
        channel
    };
}

// ============================================================
// CLOSE TICKET
// ============================================================

async function closeTicket(
    guild,
    ticket,
    userId
) {
    const channel =
        guild.channels.cache.get(
            ticket.channelId
        );

    if (!channel) {
        ticket.status = "closed";
        ticket.closedBy = userId;
        ticket.closedAt = new Date();
        await ticket.save();
        return;
    }

    await sendTicketTranscript(
        guild,
        ticket,
        channel
    ).catch(() => {});

    const config =
        await getTickets(
            guild.id
        );

    if (
        ticket.userId
    ) {
        await channel.permissionOverwrites.edit(
            ticket.userId,
            {
                SendMessages: false
            }
        ).catch(() => {});
    }

    ticket.status = "closed";
    ticket.closedBy = userId;
    ticket.closedAt = new Date();

    await ticket.save();

    await channel.setName(
        `closed-${String(ticket.number).padStart(4, "0")}`
    ).catch(() => {});

    await sendLog(
        guild,
        "ticket",
        embed(0xff9900)
            .setTitle(
                "🔒 Ticket Closed"
            )
            .addFields(
                {
                    name: "Ticket",
                    value:
                        `<#${channel.id}>`,
                    inline: true
                },
                {
                    name: "Closed By",
                    value:
                        `<@${userId}>`,
                    inline: true
                }
            )
    );

    return config;
}

// ============================================================
// REOPEN TICKET
// ============================================================

async function reopenTicket(
    guild,
    ticket
) {
    const channel =
        guild.channels.cache.get(
            ticket.channelId
        );

    if (!channel) {
        return false;
    }

    await channel.permissionOverwrites.edit(
        ticket.userId,
        {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        }
    );

    ticket.status = "open";
    ticket.reopenedAt = new Date();
    ticket.lastActivityAt = new Date();

    await ticket.save();

    await channel.setName(
        `ticket-${String(ticket.number).padStart(4, "0")}`
    ).catch(() => {});

    return true;
}

// ============================================================
// GIVEAWAY
// ============================================================

function randomWinners(
    participants,
    count
) {
    const pool = [...participants];
    const winners = [];

    while (
        pool.length &&
        winners.length < count
    ) {
        const index =
            Math.floor(
                Math.random() *
                pool.length
            );

        winners.push(
            pool.splice(index, 1)[0]
        );
    }

    return winners;
}

async function finishGiveaway(
    giveawayId
) {
    const giveaway =
        await Giveaway.findOneAndUpdate(
            {
                _id: giveawayId,
                ended: false
            },
            {
                $set: {
                    ended: true
                }
            },
            {
                new: true
            }
        );

    if (!giveaway) {
        return;
    }

    const guild =
        client.guilds.cache.get(
            giveaway.guildId
        );

    if (!guild) return;

    const channel =
        guild.channels.cache.get(
            giveaway.channelId
        );

    if (!channel) return;

    const winners =
        randomWinners(
            giveaway.participants,
            giveaway.winners
        );

    giveaway.selectedWinners =
        winners;

    await giveaway.save();

    const winnerText =
        winners.length
            ? winners
                .map(id => `<@${id}>`)
                .join(", ")
            : "No valid participants.";

    const giveawayEmbed =
        embed(
            winners.length
                ? 0x57f287
                : 0x747f8d
        )
            .setTitle(
                "🎉 Giveaway Ended"
            )
            .setDescription(
                [
                    `**Prize:** ${giveaway.prize}`,
                    "",
                    `**Winner(s):** ${winnerText}`,
                    "",
                    `Hosted by <@${giveaway.hostId}>`
                ].join("\n")
            );

    const message =
        await channel.messages
            .fetch(giveaway.messageId)
            .catch(() => null);

    if (message) {
        await message.edit({
            embeds: [
                giveawayEmbed
            ],
            components: []
        }).catch(() => {});
    }

    await channel.send({
        content:
            winners.length
                ? `🎉 Congratulations ${winnerText}!`
                : "🎉 Giveaway ended, but there were no participants.",
        embeds: [
            giveawayEmbed
        ]
    });

    await sendLog(
        guild,
        "giveaway",
        embed(0x57f287)
            .setTitle(
                "🎉 Giveaway Finished"
            )
            .addFields(
                {
                    name: "Prize",
                    value:
                        giveaway.prize,
                    inline: true
                },
                {
                    name: "Winners",
                    value:
                        winnerText,
                    inline: true
                }
            )
    );

    giveawayTimers.delete(
        String(giveaway._id)
    );
}

function scheduleGiveaway(
    giveaway
) {
    const key =
        String(giveaway._id);

    if (
        giveawayTimers.has(key)
    ) {
        clearTimeout(
            giveawayTimers.get(key)
        );
    }

    const remaining =
        new Date(
            giveaway.endAt
        ).getTime() -
        Date.now();

    if (remaining <= 0) {
        finishGiveaway(
            giveaway._id
        );
        return;
    }

    const MAX_TIMEOUT =
        2147483647;

    const timer =
        setTimeout(
            () => {
                if (
                    remaining >
                    MAX_TIMEOUT
                ) {
                    scheduleGiveaway(
                        giveaway
                    );
                } else {
                    finishGiveaway(
                        giveaway._id
                    );
                }
            },
            Math.min(
                remaining,
                MAX_TIMEOUT
            )
        );

    giveawayTimers.set(
        key,
        timer
    );
}

async function restoreGiveaways() {
    const giveaways =
        await Giveaway.find({
            ended: false
        });

    for (
        const giveaway of giveaways
    ) {
        scheduleGiveaway(
            giveaway
        );
    }

    console.log(
        `🎉 Restored ${giveaways.length} giveaway(s).`
    );
}

// ============================================================
// REMINDERS
// ============================================================

function scheduleReminder(
    reminder
) {
    const key =
        String(reminder._id);

    if (
        reminderTimers.has(key)
    ) {
        clearTimeout(
            reminderTimers.get(key)
        );
    }

    const remaining =
        new Date(
            reminder.remindAt
        ).getTime() -
        Date.now();

    if (remaining <= 0) {
        sendReminder(
            reminder._id
        );
        return;
    }

    const timer =
        setTimeout(
            () =>
                sendReminder(
                    reminder._id
                ),
            Math.min(
                remaining,
                2147483647
            )
        );

    reminderTimers.set(
        key,
        timer
    );
}

async function sendReminder(
    reminderId
) {
    const reminder =
        await Reminder.findOneAndUpdate(
            {
                _id: reminderId,
                sent: false
            },
            {
                $set: {
                    sent: true
                }
            },
            {
                new: true
            }
        );

    if (!reminder) return;

    const channel =
        client.channels.cache.get(
            reminder.channelId
        );

    if (
        channel &&
        channel.isTextBased()
    ) {
        await channel.send({
            content:
                `<@${reminder.userId}> ⏰ **Reminder:** ${reminder.message}`
        }).catch(() => {});
    }

    reminderTimers.delete(
        String(reminderId)
    );
}

async function restoreReminders() {
    const reminders =
        await Reminder.find({
            sent: false
        });

    for (
        const reminder of reminders
    ) {
        scheduleReminder(
            reminder
        );
    }

    console.log(
        `⏰ Restored ${reminders.length} reminder(s).`
    );
}

// ============================================================
// KICK API
// ============================================================

async function getKickChannel(
    username
) {
    const url =
        `https://kick.com/api/v2/channels/${encodeURIComponent(username)}`;

    const response =
        await axios.get(
            url,
            {
                timeout: 15000,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 27Pro"
                }
            }
        );

    return response.data;
}

// ============================================================
// KICK CATEGORY EXTRACTION
// ============================================================

function getKickCategory(
    data
) {
    const stream =
        data?.livestream;

    const candidates = [
        stream?.category?.name,
        stream?.category?.title,
        stream?.category?.slug,
        stream?.category?.category_name,

        stream?.game?.name,
        stream?.game?.title,

        data?.category?.name,
        data?.category?.title,
        data?.game?.name,
        data?.game?.title
    ];

    const category =
        candidates.find(
            value =>
                value &&
                String(value).trim()
        );

    return category
        ? String(category)
        : "Unknown";
}

// ============================================================
// KICK LIVE CHECK
// ============================================================

async function checkKickChannels() {
    if (kickChecker) {
        return;
    }

    kickChecker = true;

    try {
        const configs =
            await KickConfig.find({
                enabled: true
            });

        for (
            const config of configs
        ) {
            try {
                const data =
                    await getKickChannel(
                        config.username
                    );

                const stream =
                    data?.livestream;

                const live =
                    Boolean(stream);

                const streamId =
                    stream?.id
                        ? String(stream.id)
                        : null;

                // No state change
                if (
                    live ===
                        config.lastLive &&
                    (
                        !live ||
                        streamId ===
                            config.lastStreamId
                    )
                ) {
                    continue;
                }

                config.lastLive =
                    live;

                config.lastStreamId =
                    streamId;

                await config.save();

                const guild =
                    client.guilds.cache.get(
                        config.guildId
                    );

                if (!guild) continue;

                const channel =
                    guild.channels.cache.get(
                        config.channelId
                    );

                if (
                    !channel ||
                    !channel.isTextBased()
                ) {
                    continue;
                }

                if (live) {
                    const category =
                        getKickCategory(
                            data
                        );

                    const title =
                        stream?.session_title ||
                        stream?.title ||
                        "Live on KICK";

                    const viewers =
                        stream?.viewer_count ??
                        stream?.viewers ??
                        0;

                    const url =
                        `https://kick.com/${config.username}`;

                    const liveEmbed =
                        embed(0x53fc18)
                            .setTitle(
                                `🔴 ${config.username} is LIVE on KICK`
                            )
                            .setURL(url)
                            .setDescription(
                                `**${title}**`
                            )
                            .addFields(
                                {
                                    name: "🎮 Category / Game",
                                    value:
                                        `**${category}**`,
                                    inline: true
                                },
                                {
                                    name: "👀 Viewers",
                                    value:
                                        String(viewers),
                                    inline: true
                                }
                            );

                    const thumbnail =
                        stream?.thumbnail?.url ||
                        stream?.thumbnail ||
                        null;

                    if (thumbnail) {
                        liveEmbed.setImage(
                            thumbnail
                        );
                    }

                    let mention = "";

                    if (
                        config.mentionEveryone
                    ) {
                        mention =
                            "@everyone";
                    }

                    else if (
                        config.mentionRoleId
                    ) {
                        mention =
                            `<@&${config.mentionRoleId}>`;
                    }

                    await channel.send({
                        content:
                            mention || undefined,
                        embeds: [
                            liveEmbed
                        ]
                    });

                    await sendLog(
                        guild,
                        "bot",
                        liveEmbed
                    );
                }

                else {
                    const offlineEmbed =
                        embed(0x747f8d)
                            .setTitle(
                                `⚫ ${config.username} is now offline`
                            )
                            .setDescription(
                                `The KICK stream has ended.`
                            );

                    await channel.send({
                        embeds: [
                            offlineEmbed
                        ]
                    });
                }
            } catch (error) {
                console.error(
                    `KICK check failed for ${config.username}:`,
                    error.message
                );
            }
        }
    } finally {
        kickChecker = false;
    }
}

// ============================================================
// 27PRO - PART 3/4
// DISCORD EVENTS + INTERACTIONS + MODERATION
// ============================================================

// ============================================================
// MEMBER JOIN
// ============================================================

client.on("guildMemberAdd", async member => {
    try {
        const guild = member.guild;

        // --------------------------------------------------------
        // RAID TRACKING
        // --------------------------------------------------------

        const now = Date.now();

        let joins =
            raidTracker.get(guild.id) || [];

        joins = joins.filter(
            timestamp =>
                now - timestamp <
                30000
        );

        joins.push(now);

        raidTracker.set(
            guild.id,
            joins
        );

        const security =
            await getSecurity(
                guild.id
            );

        if (
            security.enabled &&
            security.antiRaid &&
            joins.length >=
                security.raidThreshold
        ) {
            if (!security.raidMode) {
                security.raidMode = true;
                await security.save();

                await sendLog(
                    guild,
                    "raid",
                    embed(0xff0000)
                        .setTitle(
                            "🚨 RAID MODE ACTIVATED"
                        )
                        .setDescription(
                            `Detected **${joins.length} joins** within ${security.raidWindowSeconds} seconds.`
                        )
                        .addFields({
                            name: "Action",
                            value:
                                security.raidAction.toUpperCase()
                        })
                );
            }
        }

        // --------------------------------------------------------
        // RAID MODE MEMBER ACTION
        // --------------------------------------------------------

        if (
            security.enabled &&
            security.raidMode &&
            security.raidAction === "timeout"
        ) {
            if (
                member.moderatable
            ) {
                await member.timeout(
                    security.raidTimeoutMinutes *
                        60 *
                        1000,
                    "27Pro Anti-Raid"
                ).catch(() => {});
            }
        }

        // --------------------------------------------------------
        // BOT ADD PROTECTION
        // --------------------------------------------------------

        if (
            member.user.bot &&
            security.enabled &&
            security.antiBotAdd
        ) {
            const executor =
                await auditExecutor(
                    guild,
                    AuditLogEvent.BotAdd,
                    member.id
                );

            if (executor) {
                const executorMember =
                    await guild.members
                        .fetch(executor.id)
                        .catch(() => null);

                if (
                    executorMember &&
                    !isTrusted(
                        guild,
                        executorMember,
                        security
                    )
                ) {
                    if (
                        member.kickable
                    ) {
                        await member.kick(
                            "27Pro Anti-Bot Protection"
                        ).catch(() => {});
                    }

                    await securityEvent(
                        guild,
                        executor,
                        "BOT_ADD",
                        `Unauthorized bot added: ${member.user.tag}`
                    );
                }
            }
        }

        // --------------------------------------------------------
        // WELCOME
        // --------------------------------------------------------

        const config =
            await WelcomeConfig.findOne({
                guildId: guild.id
            });

        if (
            config?.enabled &&
            config.channelId
        ) {
            const channel =
                guild.channels.cache.get(
                    config.channelId
                );

            if (
                channel &&
                channel.isTextBased()
            ) {
                const text =
                    replaceVariables(
                        config.message ||
                            "Welcome {user} to {server}!",
                        member
                    );

                const welcomeEmbed =
                    embed(0x57f287)
                        .setTitle(
                            "👋 Welcome!"
                        )
                        .setDescription(
                            text
                        )
                        .setThumbnail(
                            member.displayAvatarURL({
                                size: 256
                            })
                        );

                if (config.image) {
                    welcomeEmbed.setImage(
                        config.image
                    );
                }

                await channel.send({
                    content:
                        `${member}`,
                    embeds: [
                        welcomeEmbed
                    ]
                }).catch(() => {});
            }
        }

        // --------------------------------------------------------
        // AUTO ROLE
        // --------------------------------------------------------

        if (
            config?.roleId
        ) {
            const role =
                guild.roles.cache.get(
                    config.roleId
                );

            if (
                role &&
                role.editable
            ) {
                await member.roles.add(
                    role
                ).catch(() => {});
            }
        }

        // --------------------------------------------------------
        // JOIN LOG
        // --------------------------------------------------------

        await sendLog(
            guild,
            "member",
            embed(0x57f287)
                .setTitle(
                    "📥 Member Joined"
                )
                .setThumbnail(
                    member.displayAvatarURL()
                )
                .addFields(
                    {
                        name: "User",
                        value:
                            `${member}\n\`${member.id}\``,
                        inline: true
                    },
                    {
                        name: "Account Created",
                        value:
                            `<t:${Math.floor(
                                member.user.createdTimestamp /
                                    1000
                            )}:R>`,
                        inline: true
                    },
                    {
                        name: "Member Count",
                        value:
                            String(
                                guild.memberCount
                            ),
                        inline: true
                    }
                )
        );
    } catch (error) {
        console.error(
            "guildMemberAdd error:",
            error
        );
    }
});

// ============================================================
// MEMBER LEAVE
// ============================================================

client.on(
    "guildMemberRemove",
    async member => {
        try {
            const guild =
                member.guild;

            const kickExecutor =
                await auditExecutor(
                    guild,
                    AuditLogEvent.MemberKick,
                    member.id
                );

            if (kickExecutor) {
                await sendLog(
                    guild,
                    "moderation",
                    embed(0xff9900)
                        .setTitle(
                            "👢 Member Kicked"
                        )
                        .addFields(
                            {
                                name: "User",
                                value:
                                    `${member.user.tag}\n\`${member.id}\``,
                                inline: true
                            },
                            {
                                name: "Moderator",
                                value:
                                    `${kickExecutor}`,
                                inline: true
                            }
                        )
                );
            }

            else {
                await sendLog(
                    guild,
                    "member",
                    embed(0xff0000)
                        .setTitle(
                            "📤 Member Left"
                        )
                        .addFields(
                            {
                                name: "User",
                                value:
                                    `${member.user.tag}\n\`${member.id}\``,
                                inline: true
                            },
                            {
                                name: "Member Count",
                                value:
                                    String(
                                        guild.memberCount
                                    ),
                                inline: true
                            }
                        )
                );
            }

            const config =
                await WelcomeConfig.findOne({
                    guildId: guild.id
                });

            if (
                config?.goodbyeEnabled &&
                config.goodbyeChannelId
            ) {
                const channel =
                    guild.channels.cache.get(
                        config.goodbyeChannelId
                    );

                if (
                    channel &&
                    channel.isTextBased()
                ) {
                    const text =
                        replaceVariables(
                            config.goodbyeMessage ||
                                "Goodbye {user}!",
                            member
                        );

                    await channel.send({
                        content: text
                    }).catch(() => {});
                }
            }
        } catch (error) {
            console.error(
                "guildMemberRemove error:",
                error
            );
        }
    }
);

// ============================================================
// MEMBER UPDATE
// ============================================================

client.on(
    "guildMemberUpdate",
    async (oldMember, newMember) => {
        try {
            // Nickname
            if (
                oldMember.nickname !==
                newMember.nickname
            ) {
                await sendLog(
                    newMember.guild,
                    "member",
                    embed(0x5865f2)
                        .setTitle(
                            "✏️ Nickname Changed"
                        )
                        .addFields(
                            {
                                name: "User",
                                value:
                                    `${newMember}`,
                                inline: true
                            },
                            {
                                name: "Before",
                                value:
                                    oldMember.nickname ||
                                    oldMember.user.username,
                                inline: true
                            },
                            {
                                name: "After",
                                value:
                                    newMember.nickname ||
                                    newMember.user.username,
                                inline: true
                            }
                        )
                );
            }

            // Roles
            const oldRoles =
                new Set(
                    oldMember.roles.cache
                        .filter(
                            role =>
                                role.id !==
                                oldMember.guild.id
                        )
                        .map(role => role.id)
                );

            const newRoles =
                new Set(
                    newMember.roles.cache
                        .filter(
                            role =>
                                role.id !==
                                newMember.guild.id
                        )
                        .map(role => role.id)
                );

            const added =
                [...newRoles].filter(
                    id =>
                        !oldRoles.has(id)
                );

            const removed =
                [...oldRoles].filter(
                    id =>
                        !newRoles.has(id)
                );

            if (
                added.length ||
                removed.length
            ) {
                const changes = [];

                if (added.length) {
                    changes.push(
                        `**Added:** ${added
                            .map(
                                id =>
                                    `<@&${id}>`
                            )
                            .join(", ")}`
                    );
                }

                if (removed.length) {
                    changes.push(
                        `**Removed:** ${removed
                            .map(
                                id =>
                                    `<@&${id}>`
                            )
                            .join(", ")}`
                    );
                }

                await sendLog(
                    newMember.guild,
                    "role",
                    embed(0x5865f2)
                        .setTitle(
                            "🎭 Member Roles Updated"
                        )
                        .setDescription(
                            changes.join("\n")
                        )
                        .setAuthor({
                            name:
                                newMember.user.tag,
                            iconURL:
                                newMember.displayAvatarURL()
                        })
                );
            }
        } catch (error) {
            console.error(
                "guildMemberUpdate error:",
                error
            );
        }
    }
);

// ============================================================
// MESSAGE CREATE
// ============================================================

client.on(
    "messageCreate",
    async message => {
        try {
            if (
                !message.guild ||
                message.author.bot
            ) {
                return;
            }

            // Update ticket activity
            const ticket =
                await Ticket.findOne({
                    guildId:
                        message.guild.id,
                    channelId:
                        message.channel.id,
                    status: "open"
                });

            if (ticket) {
                ticket.lastActivityAt =
                    new Date();

                await ticket.save()
                    .catch(() => {});
            }

            // AutoMod
            const blocked =
                await runAutoMod(
                    message
                );

            if (blocked) {
                return;
            }

            // ----------------------------------------------------
            // LEVEL XP
            // ----------------------------------------------------

            const xpKey =
                `${message.guild.id}:${message.author.id}`;

            const now =
                Date.now();

            const lastXP =
                xpTracker.get(
                    xpKey
                ) || 0;

            if (
                now - lastXP >=
                60000
            ) {
                xpTracker.set(
                    xpKey,
                    now
                );

                const amount =
                    randomInt(
                        5,
                        15
                    );

                const result =
                    await addXP(
                        message.guild.id,
                        message.author.id,
                        amount
                    );

                if (
                    result.leveledUp
                ) {
                    await message.channel.send({
                        content:
                            `🎉 ${message.author}, you reached **Level ${result.level}**!`
                    }).catch(() => {});
                }
            }
        } catch (error) {
            console.error(
                "messageCreate error:",
                error
            );
        }
    }
);

// ============================================================
// MESSAGE DELETE
// ============================================================

client.on(
    "messageDelete",
    async message => {
        try {
            if (
                !message.guild ||
                message.author?.bot
            ) {
                return;
            }

            await sendLog(
                message.guild,
                "message",
                embed(0xff0000)
                    .setTitle(
                        "🗑️ Message Deleted"
                    )
                    .addFields(
                        {
                            name: "Author",
                            value:
                                message.author
                                    ? `${message.author}\n\`${message.author.id}\``
                                    : "Unknown",
                            inline: true
                        },
                        {
                            name: "Channel",
                            value:
                                `<#${message.channelId}>`,
                            inline: true
                        },
                        {
                            name: "Content",
                            value:
                                truncate(
                                    message.content ||
                                        "*No text content*",
                                    1000
                                )
                        }
                    )
            );
        } catch (error) {
            console.error(
                "messageDelete error:",
                error
            );
        }
    }
);

// ============================================================
// MESSAGE UPDATE
// ============================================================

client.on(
    "messageUpdate",
    async (oldMessage, newMessage) => {
        try {
            if (
                !newMessage.guild ||
                newMessage.author?.bot
            ) {
                return;
            }

            if (
                oldMessage.content ===
                newMessage.content
            ) {
                return;
            }

            await sendLog(
                newMessage.guild,
                "message",
                embed(0xffcc00)
                    .setTitle(
                        "✏️ Message Edited"
                    )
                    .setAuthor({
                        name:
                            newMessage.author?.tag ||
                            "Unknown"
                    })
                    .addFields(
                        {
                            name: "Channel",
                            value:
                                `<#${newMessage.channelId}>`
                        },
                        {
                            name: "Before",
                            value:
                                truncate(
                                    oldMessage.content ||
                                        "*Empty*",
                                    1000
                                )
                        },
                        {
                            name: "After",
                            value:
                                truncate(
                                    newMessage.content ||
                                        "*Empty*",
                                    1000
                                )
                        }
                    )
                    .setURL(
                        newMessage.url
                    )
            );
        } catch (error) {
            console.error(
                "messageUpdate error:",
                error
            );
        }
    }
);

// ============================================================
// BAN ADD
// ============================================================

client.on(
    "guildBanAdd",
    async ban => {
        try {
            const executor =
                await auditExecutor(
                    ban.guild,
                    AuditLogEvent.MemberBanAdd,
                    ban.user.id
                );

            await sendLog(
                ban.guild,
                "moderation",
                embed(0xff0000)
                    .setTitle(
                        "🔨 Member Banned"
                    )
                    .addFields(
                        {
                            name: "User",
                            value:
                                `${ban.user.tag}\n\`${ban.user.id}\``,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value:
                                executor
                                    ? `${executor}`
                                    : "Unknown",
                            inline: true
                        }
                    )
            );
        } catch (error) {
            console.error(
                "guildBanAdd error:",
                error
            );
        }
    }
);

// ============================================================
// BAN REMOVE
// ============================================================

client.on(
    "guildBanRemove",
    async ban => {
        try {
            const executor =
                await auditExecutor(
                    ban.guild,
                    AuditLogEvent.MemberBanRemove,
                    ban.user.id
                );

            await sendLog(
                ban.guild,
                "moderation",
                embed(0x57f287)
                    .setTitle(
                        "🔓 Member Unbanned"
                    )
                    .addFields(
                        {
                            name: "User",
                            value:
                                `${ban.user.tag}\n\`${ban.user.id}\``,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value:
                                executor
                                    ? `${executor}`
                                    : "Unknown",
                            inline: true
                        }
                    )
            );
        } catch (error) {
            console.error(
                "guildBanRemove error:",
                error
            );
        }
    }
);

// ============================================================
// ROLE CREATE
// ============================================================

client.on(
    "roleCreate",
    async role => {
        try {
            const executor =
                await auditExecutor(
                    role.guild,
                    AuditLogEvent.RoleCreate,
                    role.id
                );

            await sendLog(
                role.guild,
                "role",
                embed(0x57f287)
                    .setTitle(
                        "🎭 Role Created"
                    )
                    .addFields(
                        {
                            name: "Role",
                            value:
                                `${role}\n\`${role.id}\``,
                            inline: true
                        },
                        {
                            name: "Created By",
                            value:
                                executor
                                    ? `${executor}`
                                    : "Unknown",
                            inline: true
                        }
                    )
            );
        } catch (error) {
            console.error(
                "roleCreate error:",
                error
            );
        }
    }
);

// ============================================================
// ROLE DELETE
// ============================================================

client.on(
    "roleDelete",
    async role => {
        try {
            const executor =
                await auditExecutor(
                    role.guild,
                    AuditLogEvent.RoleDelete,
                    role.id
                );

            await sendLog(
                role.guild,
                "role",
                embed(0xff0000)
                    .setTitle(
                        "🗑️ Role Deleted"
                    )
                    .addFields(
                        {
                            name: "Role",
                            value:
                                `${role.name}\n\`${role.id}\``,
                                inline: true
                        },
                        {
                            name: "Deleted By",
                            value:
                                executor
                                    ? `${executor}`
                                    : "Unknown",
                            inline: true
                        }
                    )
            );

            await securityEvent(
                role.guild,
                executor,
                "ROLE_DELETE",
                `Role deleted: ${role.name}`
            );
        } catch (error) {
            console.error(
                "roleDelete error:",
                error
            );
        }
    }
);

// ============================================================
// ROLE UPDATE
// ============================================================

client.on(
    "roleUpdate",
    async (oldRole, newRole) => {
        try {
            const changes = [];

            if (
                oldRole.name !==
                newRole.name
            ) {
                changes.push(
                    `**Name:** ${oldRole.name} → ${newRole.name}`
                );
            }

            if (
                oldRole.color !==
                newRole.color
            ) {
                changes.push(
                    `**Color:** ${oldRole.hexColor} → ${newRole.hexColor}`
                );
            }

            if (
                oldRole.permissions.bitfield !==
                newRole.permissions.bitfield
            ) {
                changes.push(
                    "**Permissions:** Changed"
                );
            }

            if (!changes.length) {
                return;
            }

            const executor =
                await auditExecutor(
                    newRole.guild,
                    AuditLogEvent.RoleUpdate,
                    newRole.id
                );

            await sendLog(
                newRole.guild,
                "role",
                embed(0xffcc00)
                    .setTitle(
                        "✏️ Role Updated"
                    )
                    .setDescription(
                        changes.join("\n")
                    )
                    .addFields({
                        name: "Role",
                        value:
                            `${newRole}\n\`${newRole.id}\``
                    })
            );

            // Dangerous permission changes
            if (
                oldRole.permissions.has(
                    PermissionFlagsBits.Administrator
                ) === false &&
                newRole.permissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                await securityEvent(
                    newRole.guild,
                    executor,
                    "DANGEROUS_ROLE_PERMISSION",
                    `Administrator permission granted to ${newRole.name}`
                );
            }
        } catch (error) {
            console.error(
                "roleUpdate error:",
                error
            );
        }
    }
);

// ============================================================
// CHANNEL CREATE
// ============================================================

client.on(
    "channelCreate",
    async channel => {
        try {
            if (!channel.guild) {
                return;
            }

            const executor =
                await auditExecutor(
                    channel.guild,
                    AuditLogEvent.ChannelCreate,
                    channel.id
                );

            await sendLog(
                channel.guild,
                "channel",
                embed(0x57f287)
                    .setTitle(
                        "📁 Channel Created"
                    )
                    .addFields(
                        {
                            name: "Channel",
                            value:
                                `${channel}\n\`${channel.id}\``,
                            inline: true
                        },
                        {
                            name: "Created By",
                            value:
                                executor
                                    ? `${executor}`
                                    : "Unknown",
                            inline: true
                        }
                    )
            );
        } catch (error) {
            console.error(
                "channelCreate error:",
                error
            );
        }
    }
);

// ============================================================
// CHANNEL DELETE
// ============================================================

client.on(
    "channelDelete",
    async channel => {
        try {
            if (!channel.guild) {
                return;
            }

            const executor =
                await auditExecutor(
                    channel.guild,
                    AuditLogEvent.ChannelDelete,
                    channel.id
                );

            await sendLog(
                channel.guild,
                "channel",
                embed(0xff0000)
                    .setTitle(
                        "🗑️ Channel Deleted"
                    )
                    .addFields(
                        {
                            name: "Channel",
                            value:
                                `${channel.name}\n\`${channel.id}\``,
                            inline: true
                        },
                        {
                            name: "Deleted By",
                            value:
                                executor
                                    ? `${executor}`
                                    : "Unknown",
                            inline: true
                        }
                    )
            );

            await securityEvent(
                channel.guild,
                executor,
                "CHANNEL_DELETE",
                `Channel deleted: ${channel.name}`
            );
        } catch (error) {
            console.error(
                "channelDelete error:",
                error
            );
        }
    }
);

// ============================================================
// CHANNEL UPDATE
// ============================================================

client.on(
    "channelUpdate",
    async (oldChannel, newChannel) => {
        try {
            if (!newChannel.guild) {
                return;
            }

            const changes = [];

            if (
                oldChannel.name !==
                newChannel.name
            ) {
                changes.push(
                    `**Name:** ${oldChannel.name} → ${newChannel.name}`
                );
            }

            if (
                oldChannel.parentId !==
                newChannel.parentId
            ) {
                changes.push(
                    "**Category:** Changed"
                );
            }

            if (
                oldChannel.topic !==
                newChannel.topic
            ) {
                changes.push(
                    "**Topic:** Changed"
                );
            }

            if (!changes.length) {
                return;
            }

            await sendLog(
                newChannel.guild,
                "channel",
                embed(0xffcc00)
                    .setTitle(
                        "✏️ Channel Updated"
                    )
                    .setDescription(
                        changes.join("\n")
                    )
                    .addFields({
                        name: "Channel",
                        value:
                            `${newChannel}`
                    })
            );
        } catch (error) {
            console.error(
                "channelUpdate error:",
                error
            );
        }
    }
);

// ============================================================
// WEBHOOK UPDATE
// ============================================================

client.on(
    "webhookUpdate",
    async channel => {
        try {
            if (!channel.guild) {
                return;
            }

            await sendLog(
                channel.guild,
                "webhook",
                embed(0xff9900)
                    .setTitle(
                        "🪝 Webhook Updated"
                    )
                    .setDescription(
                        `A webhook was created, deleted, or modified in ${channel}.`
                    )
            );

            const executor =
                await auditExecutor(
                    channel.guild,
                    AuditLogEvent.WebhookUpdate
                );

            await securityEvent(
                channel.guild,
                executor,
                "WEBHOOK_UPDATE",
                `Webhook activity detected in ${channel.name}`
            );
        } catch (error) {
            console.error(
                "webhookUpdate error:",
                error
            );
        }
    }
);

// ============================================================
// VOICE LOGGING
// ============================================================

client.on(
    "voiceStateUpdate",
    async (oldState, newState) => {
        try {
            if (
                oldState.channelId ===
                newState.channelId
            ) {
                return;
            }

            let title =
                "🔄 Voice Channel Changed";

            if (
                !oldState.channelId
            ) {
                title =
                    "🔊 Joined Voice";
            }

            else if (
                !newState.channelId
            ) {
                title =
                    "🔇 Left Voice";
            }

            await sendLog(
                newState.guild,
                "voice",
                embed(0x5865f2)
                    .setTitle(title)
                    .addFields(
                        {
                            name: "User",
                            value:
                                `${newState.member}`,
                            inline: true
                        },
                        {
                            name: "From",
                            value:
                                oldState.channel
                                    ? oldState.channel.name
                                    : "None",
                            inline: true
                        },
                        {
                            name: "To",
                            value:
                                newState.channel
                                    ? newState.channel.name
                                    : "None",
                            inline: true
                        }
                    )
            );
        } catch (error) {
            console.error(
                "voiceStateUpdate error:",
                error
            );
        }
    }
);

// ============================================================
// GUILD UPDATE
// ============================================================

client.on(
    "guildUpdate",
    async (oldGuild, newGuild) => {
        try {
            const changes = [];

            if (
                oldGuild.name !==
                newGuild.name
            ) {
                changes.push(
                    `**Name:** ${oldGuild.name} → ${newGuild.name}`
                );
            }

            if (
                oldGuild.verificationLevel !==
                newGuild.verificationLevel
            ) {
                changes.push(
                    `**Verification Level:** ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`
                );
            }

            if (!changes.length) {
                return;
            }

            await sendLog(
                newGuild,
                "server",
                embed(0xffcc00)
                    .setTitle(
                        "🏠 Server Updated"
                    )
                    .setDescription(
                        changes.join("\n")
                    )
            );
        } catch (error) {
            console.error(
                "guildUpdate error:",
                error
            );
        }
    }
);

// ============================================================
// INTERACTION HANDLER
// ============================================================

client.on(
    "interactionCreate",
    async interaction => {
        try {

            // ====================================================
            // BUTTONS
            // ====================================================

            if (
                interaction.isButton()
            ) {
                const id =
                    interaction.customId;

                // ------------------------------------------------
                // TICKET CREATE
                // ------------------------------------------------

                if (
                    id === "ticket:create"
                ) {
                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const result =
                        await createTicket(
                            interaction.guild,
                            interaction.user
                        );

                    if (result.error) {
                        return interaction.editReply({
                            content:
                                `❌ ${result.error}`
                        });
                    }

                    return interaction.editReply({
                        content:
                            `✅ Ticket created: ${result.channel}`
                    });
                }

                // ------------------------------------------------
                // TICKET CLAIM
                // ------------------------------------------------

                if (
                    id === "ticket:claim"
                ) {
                    const ticket =
                        await getTicket(
                            interaction.guild.id,
                            interaction.channel.id
                        );

                    if (!ticket) {
                        return interaction.reply({
                            content:
                                "❌ This is not a ticket.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const config =
                        await getTickets(
                            interaction.guild.id
                        );

                    if (
                        !await ticketStaff(
                            interaction,
                            config
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ You are not ticket staff.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        ticket.claimedBy
                    ) {
                        return interaction.reply({
                            content:
                                `❌ This ticket is already claimed by <@${ticket.claimedBy}>.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    ticket.claimedBy =
                        interaction.user.id;

                    await ticket.save();

                    await interaction.reply({
                        content:
                            `🙋 ${interaction.user} claimed this ticket.`
                    });

                    await sendLog(
                        interaction.guild,
                        "ticket",
                        embed(0x5865f2)
                            .setTitle(
                                "🙋 Ticket Claimed"
                            )
                            .addFields(
                                {
                                    name: "Ticket",
                                    value:
                                        `${interaction.channel}`,
                                    inline: true
                                },
                                {
                                    name: "Staff",
                                    value:
                                        `${interaction.user}`,
                                    inline: true
                                }
                            )
                    );

                    return;
                }

                // ------------------------------------------------
                // TICKET CLOSE
                // ------------------------------------------------

                if (
                    id === "ticket:close"
                ) {
                    const ticket =
                        await getTicket(
                            interaction.guild.id,
                            interaction.channel.id
                        );

                    if (!ticket) {
                        return interaction.reply({
                            content:
                                "❌ This is not a ticket.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const config =
                        await getTickets(
                            interaction.guild.id
                        );

                    const staff =
                        await ticketStaff(
                            interaction,
                            config
                        );

                    if (
                        ticket.userId !==
                            interaction.user.id &&
                        !staff
                    ) {
                        return interaction.reply({
                            content:
                                "❌ You cannot close this ticket.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply();

                    await closeTicket(
                        interaction.guild,
                        ticket,
                        interaction.user.id
                    );

                    await interaction.editReply({
                        content:
                            "🔒 Ticket closed. A transcript was saved."
                    });

                    return;
                }

                // ------------------------------------------------
                // GIVEAWAY JOIN
                // ------------------------------------------------

                if (
                    id === "giveaway:join"
                ) {
                    const giveaway =
                        await Giveaway.findOne({
                            guildId:
                                interaction.guild.id,
                            messageId:
                                interaction.message.id
                        });

                    if (
                        !giveaway ||
                        giveaway.ended
                    ) {
                        return interaction.reply({
                            content:
                                "❌ This giveaway has ended.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        giveaway.participants.includes(
                            interaction.user.id
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ You are already entered.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    giveaway.participants.push(
                        interaction.user.id
                    );

                    await giveaway.save();

                    return interaction.reply({
                        content:
                            "🎉 You entered the giveaway!",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // ------------------------------------------------
                // ROLE BUTTON
                // ------------------------------------------------

                if (
                    id.startsWith("role:")
                ) {
                    const roleId =
                        id.slice(5);

                    const role =
                        interaction.guild.roles.cache.get(
                            roleId
                        );

                    if (!role) {
                        return interaction.reply({
                            content:
                                "❌ That role no longer exists.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !role.editable
                    ) {
                        return interaction.reply({
                            content:
                                "❌ I cannot manage that role.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        interaction.member.roles.cache.has(
                            role.id
                        )
                    ) {
                        await interaction.member.roles.remove(
                            role
                        );

                        return interaction.reply({
                            content:
                                `➖ Removed ${role}.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.member.roles.add(
                        role
                    );

                    return interaction.reply({
                        content:
                            `➕ Added ${role}.`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }
            }

            // ====================================================
            // SLASH COMMANDS
            // ====================================================

            if (
                !interaction.isChatInputCommand()
            ) {
                return;
            }

            const command =
                interaction.commandName;

            // ====================================================
            // INFORMATION
            // ====================================================

            if (
                command === "help"
            ) {
                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                "🤖 27Pro Help"
                            )
                            .setDescription(
                                "Your all-in-one Discord management bot."
                            )
                            .addFields(
                                {
                                    name: "🛡️ Moderation",
                                    value:
                                        "`/warn` `/kick` `/ban` `/timeout` `/mute` `/purge` `/history` `/cases`"
                                },
                                {
                                    name: "🤖 AutoMod",
                                    value:
                                        "`/automod`"
                                },
                                {
                                    name: "🚨 Security",
                                    value:
                                        "`/security`"
                                },
                                {
                                    name: "🎫 Tickets",
                                    value:
                                        "`/ticket`"
                                },
                                {
                                    name: "📊 Logs",
                                    value:
                                        "`/logs`"
                                },
                                {
                                    name: "🎉 Community",
                                    value:
                                        "`/giveaway` `/rank` `/leaderboard` `/rolepanel`"
                                },
                                {
                                    name: "📢 Utility",
                                    value:
                                        "`/announce` `/poll` `/say` `/remind` `/rules`"
                                },
                                {
                                    name: "🎮 Fun",
                                    value:
                                        "`/coinflip` `/roll` `/8ball` `/choose`"
                                },
                                {
                                    name: "🔴 KICK",
                                    value:
                                        "`/live` `/livecheck`"
                                }
                            )
                    ]
                });
            }

            if (
                command === "ping"
            ) {
                return interaction.reply({
                    content:
                        `🏓 Pong! **${client.ws.ping}ms**`
                });
            }

            if (
                command === "uptime"
            ) {
                return interaction.reply({
                    embeds: [
                        embed(0x57f287)
                            .setTitle(
                                "⏱️ Bot Uptime"
                            )
                            .setDescription(
                                formatDuration(
                                    client.uptime
                                )
                            )
                    ]
                });
            }

            if (
                command === "botinfo"
            ) {
                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                "🤖 27Pro"
                            )
                            .addFields(
                                {
                                    name: "Servers",
                                    value:
                                        String(
                                            client.guilds.cache.size
                                        ),
                                    inline: true
                                },
                                {
                                    name: "Users",
                                    value:
                                        String(
                                            client.guilds.cache.reduce(
                                                (total, guild) =>
                                                    total +
                                                    guild.memberCount,
                                                0
                                            )
                                        ),
                                    inline: true
                                },
                                {
                                    name: "Ping",
                                    value:
                                        `${client.ws.ping}ms`,
                                    inline: true
                                },
                                {
                                    name: "Version",
                                    value:
                                        "27Pro 4.0",
                                    inline: true
                                }
                            )
                    ]
                });
            }

            if (
                command === "serverinfo"
            ) {
                const guild =
                    interaction.guild;

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                `🏠 ${guild.name}`
                            )
                            .setThumbnail(
                                guild.iconURL()
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
                                        String(
                                            guild.memberCount
                                        ),
                                    inline: true
                                },
                                {
                                    name: "Channels",
                                    value:
                                        String(
                                            guild.channels.cache.size
                                        ),
                                    inline: true
                                },
                                {
                                    name: "Roles",
                                    value:
                                        String(
                                            guild.roles.cache.size
                                        ),
                                    inline: true
                                },
                                {
                                    name: "Created",
                                    value:
                                        `<t:${Math.floor(
                                            guild.createdTimestamp /
                                                1000
                                        )}:F>`
                                }
                            )
                    ]
                });
            }

            if (
                command === "membercount"
            ) {
                return interaction.reply({
                    content:
                        `👥 This server has **${interaction.guild.memberCount}** members.`
                });
            }

            if (
                command === "userinfo"
            ) {
                const user =
                    interaction.options.getUser(
                        "user"
                    ) ||
                    interaction.user;

                const member =
                    await interaction.guild.members
                        .fetch(user.id)
                        .catch(() => null);

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
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
                                    name: "User ID",
                                    value:
                                        `\`${user.id}\``,
                                    inline: true
                                },
                                {
                                    name: "Account",
                                    value:
                                        `<t:${Math.floor(
                                            user.createdTimestamp /
                                                1000
                                        )}:R>`,
                                    inline: true
                                },
                                {
                                    name: "Joined",
                                    value:
                                        member
                                            ? `<t:${Math.floor(
                                                member.joinedTimestamp /
                                                    1000
                                            )}:R>`
                                            : "Not in server",
                                    inline: true
                                },
                                {
                                    name: "Roles",
                                    value:
                                        member
                                            ? String(
                                                Math.max(
                                                    member.roles.cache.size -
                                                        1,
                                                    0
                                                )
                                            )
                                            : "0",
                                    inline: true
                                }
                            )
                    ]
                });
            }

            if (
                command === "avatar"
            ) {
                const user =
                    interaction.options.getUser(
                        "user"
                    ) ||
                    interaction.user;

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                `🖼️ ${user.tag}'s Avatar`
                            )
                            .setImage(
                                user.displayAvatarURL({
                                    size: 1024
                                })
                            )
                    ]
                });
            }

            if (
                command === "banner"
            ) {
                const user =
                    interaction.options.getUser(
                        "user"
                    ) ||
                    interaction.user;

                const fetched =
                    await client.users.fetch(
                        user.id,
                        {
                            force: true
                        }
                    );

                const banner =
                    fetched.bannerURL({
                        size: 1024
                    });

                if (!banner) {
                    return interaction.reply({
                        content:
                            "❌ This user does not have a banner.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                `🖼️ ${user.tag}'s Banner`
                            )
                            .setImage(
                                banner
                            )
                    ]
                });
            }

            // ====================================================
            // MODERATION
            // ====================================================

            if (
                command === "warn"
            ) {
                const member =
                    interaction.options.getMember(
                        "user"
                    );

                const reason =
                    interaction.options.getString(
                        "reason"
                    );

                if (
                    !member
                ) {
                    return interaction.reply({
                        content:
                            "❌ Member not found.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    !moderatorCanAct(
                        interaction.member,
                        member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You cannot moderate this member.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const caseData =
                    await warnMember(
                        interaction.guild,
                        member.id,
                        interaction.user.id,
                        reason
                    );

                await sendLog(
                    interaction.guild,
                    "moderation",
                    embed(0xffcc00)
                        .setTitle(
                            "⚠️ Member Warned"
                        )
                        .addFields(
                            {
                                name: "User",
                                value:
                                    `${member}`,
                                inline: true
                            },
                            {
                                name: "Moderator",
                                value:
                                    `${interaction.user}`,
                                inline: true
                            },
                            {
                                name: "Case",
                                value:
                                    `#${caseData.caseId}`,
                                inline: true
                            },
                            {
                                name: "Reason",
                                value:
                                    reason
                            }
                        )
                );

                return interaction.reply({
                    content:
                        `⚠️ ${member} was warned. Case **#${caseData.caseId}**.`
                });
            }

            if (
                command === "warnings"
            ) {
                const sub =
                    interaction.options.getSubcommand();

                const member =
                    interaction.options.getUser(
                        "user"
                    );

                if (
                    sub === "view"
                ) {
                    const warnings =
                        await Warning.find({
                            guildId:
                                interaction.guild.id,
                            userId:
                                member.id
                        })
                            .sort({
                                createdAt: -1
                            })
                            .limit(15);

                    if (!warnings.length) {
                        return interaction.reply({
                            content:
                                `✅ ${member} has no warnings.`
                        });
                    }

                    const text =
                        warnings
                            .map(
                                warning =>
                                    `**#${warning.caseId}** — ${truncate(warning.reason, 100)} — <@${warning.moderatorId}>`
                            )
                            .join("\n");

                    return interaction.reply({
                        embeds: [
                            embed(0xffcc00)
                                .setTitle(
                                    `⚠️ Warnings — ${member.tag}`
                                )
                                .setDescription(
                                    text
                                )
                        ]
                    });
                }

                if (
                    sub === "clear"
                ) {
                    if (
                        !interaction.memberPermissions.has(
                            PermissionFlagsBits.ManageMessages
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ You need Manage Messages.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await clearWarnings(
                        interaction.guild.id,
                        member.id
                    );

                    const caseData =
                        await createCase(
                            interaction.guild,
                            "WARNINGS_CLEAR",
                            member.id,
                            interaction.user.id,
                            "All warnings cleared"
                        );

                    return interaction.reply({
                        content:
                            `✅ Cleared warnings for ${member}. Case **#${caseData.caseId}**.`
                    });
                }
            }

            // ----------------------------------------------------
            // KICK
            // ----------------------------------------------------

            if (
                command === "kick"
            ) {
                const member =
                    interaction.options.getMember(
                        "user"
                    );

                const reason =
                    interaction.options.getString(
                        "reason"
                    );

                if (
                    !member ||
                    !member.kickable
                ) {
                    return interaction.reply({
                        content:
                            "❌ I cannot kick that member.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    !moderatorCanAct(
                        interaction.member,
                        member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You cannot moderate this member.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const caseData =
                    await createCase(
                        interaction.guild,
                        "KICK",
                        member.id,
                        interaction.user.id,
                        reason
                    );

                await member.kick(
                    reason
                );

                return interaction.reply({
                    content:
                        `👢 ${member.user.tag} was kicked. Case **#${caseData.caseId}**.`
                });
            }

            // ----------------------------------------------------
            // BAN
            // ----------------------------------------------------

            if (
                command === "ban"
            ) {
                const member =
                    interaction.options.getMember(
                        "user"
                    );

                const reason =
                    interaction.options.getString(
                        "reason"
                    );

                const deleteDays =
                    interaction.options.getInteger(
                        "delete_days"
                    ) || 0;

                if (
                    !member ||
                    !member.bannable
                ) {
                    return interaction.reply({
                        content:
                            "❌ I cannot ban that member.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    !moderatorCanAct(
                        interaction.member,
                        member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You cannot moderate this member.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const caseData =
                    await createCase(
                        interaction.guild,
                        "BAN",
                        member.id,
                        interaction.user.id,
                        reason
                    );

                await member.ban({
                    reason,
                    deleteMessageSeconds:
                        deleteDays *
                        24 *
                        60 *
                        60
                });

                return interaction.reply({
                    content:
                        `🔨 ${member.user.tag} was banned. Case **#${caseData.caseId}**.`
                });
            }

            // ----------------------------------------------------
            // SOFTBAN
            // ----------------------------------------------------

            if (
                command === "softban"
            ) {
                const member =
                    interaction.options.getMember(
                        "user"
                    );

                const reason =
                    interaction.options.getString(
                        "reason"
                    );

                if (
                    !member ||
                    !member.bannable
                ) {
                    return interaction.reply({
                        content:
                            "❌ I cannot softban that member.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const caseData =
                    await createCase(
                        interaction.guild,
                        "SOFTBAN",
                        member.id,
                        interaction.user.id,
                        reason
                    );

                await member.ban({
                    reason,
                    deleteMessageSeconds:
                        24 * 60 * 60
                });

                await interaction.guild.members.unban(
                    member.id,
                    "27Pro Softban"
                );

                return interaction.reply({
                    content:
                        `🔨 ${member.user.tag} was softbanned. Case **#${caseData.caseId}**.`
                });
            }

            // ----------------------------------------------------
            // TIMEOUT / MUTE
            // ----------------------------------------------------

            if (
                command === "timeout" ||
                command === "mute"
            ) {
                const member =
                    interaction.options.getMember(
                        "user"
                    );

                const minutes =
                    interaction.options.getInteger(
                        "minutes"
                    );

                const reason =
                    interaction.options.getString(
                        "reason"
                    );

                if (
                    !member ||
                    !member.moderatable
                ) {
                    return interaction.reply({
                        content:
                            "❌ I cannot timeout that member.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    !moderatorCanAct(
                        interaction.member,
                        member
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You cannot moderate this member.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const caseData =
                    await createCase(
                        interaction.guild,
                        "TIMEOUT",
                        member.id,
                        interaction.user.id,
                        reason,
                        `${minutes} minutes`
                    );

                await member.timeout(
                    minutes *
                        60 *
                        1000,
                    reason
                );

                return interaction.reply({
                    content:
                        `🔇 ${member.user.tag} was timed out for **${minutes} minutes**. Case **#${caseData.caseId}**.`
                });
            }

            // ----------------------------------------------------
            // UNTIMEOUT / UNMUTE
            // ----------------------------------------------------

            if (
                command === "untimeout" ||
                command === "unmute"
            ) {
                const member =
                    interaction.options.getMember(
                        "user"
                    );

                if (
                    !member
                ) {
                    return interaction.reply({
                        content:
                            "❌ Member not found.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await member.timeout(
                    null,
                    "27Pro untimeout"
                );

                const caseData =
                    await createCase(
                        interaction.guild,
                        "UNTIMEOUT",
                        member.id,
                        interaction.user.id,
                        "Timeout removed"
                    );

                return interaction.reply({
                    content:
                        `🔊 Timeout removed from ${member}. Case **#${caseData.caseId}**.`
                });
            }

            // ----------------------------------------------------
            // UNBAN
            // ----------------------------------------------------

            if (
                command === "unban"
            ) {
                const userId =
                    interaction.options.getString(
                        "userid"
                    );

                await interaction.guild.members.unban(
                    userId,
                    "27Pro Unban"
                );

                const caseData =
                    await createCase(
                        interaction.guild,
                        "UNBAN",
                        userId,
                        interaction.user.id,
                        "Manual unban"
                    );

                return interaction.reply({
                    content:
                        `🔓 <@${userId}> was unbanned. Case **#${caseData.caseId}**.`
                });
            }

            // ----------------------------------------------------
            // NICKNAME
            // ----------------------------------------------------

            if (
                command === "nick"
            ) {
                const member =
                    interaction.options.getMember(
                        "user"
                    );

                const nickname =
                    interaction.options.getString(
                        "nickname"
                    );

                if (
                    !member ||
                    !member.manageable
                ) {
                    return interaction.reply({
                        content:
                            "❌ I cannot change that nickname.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const old =
                    member.displayName;

                await member.setNickname(
                    nickname || null,
                    `27Pro by ${interaction.user.tag}`
                );

                return interaction.reply({
                    content:
                        `✏️ Nickname changed from **${old}** to **${nickname || member.user.username}**.`
                });
            }

            // ----------------------------------------------------
            // CLEAR
            // ----------------------------------------------------

            if (
                command === "clear"
            ) {
                const amount =
                    interaction.options.getInteger(
                        "amount"
                    );

                if (
                    amount < 1 ||
                    amount > 100
                ) {
                    return interaction.reply({
                        content:
                            "❌ Amount must be between 1 and 100.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await interaction.channel.bulkDelete(
                    amount,
                    true
                );

                const caseData =
                    await createCase(
                        interaction.guild,
                        "PURGE",
                        interaction.user.id,
                        interaction.user.id,
                        `Deleted ${amount} messages`
                    );

                return interaction.reply({
                    content:
                        `🧹 Deleted **${amount}** messages. Case **#${caseData.caseId}**.`,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // ----------------------------------------------------
            // PURGE
            // ----------------------------------------------------

            if (
                command === "purge"
            ) {
                const sub =
                    interaction.options.getSubcommand();

                const amount =
                    interaction.options.getInteger(
                        "amount"
                    ) || 50;

                const messages =
                    await interaction.channel.messages.fetch({
                        limit: 100
                    });

                let filtered =
                    [...messages.values()];

                if (
                    sub === "user"
                ) {
                    const user =
                        interaction.options.getUser(
                            "user"
                        );

                    filtered =
                        filtered.filter(
                            message =>
                                message.author.id ===
                                user.id
                        );
                }

                if (
                    sub === "bots"
                ) {
                    filtered =
                        filtered.filter(
                            message =>
                                message.author.bot
                        );
                }

                if (
                    sub === "links"
                ) {
                    filtered =
                        filtered.filter(
                            message =>
                                /https?:\/\/\S+/i.test(
                                    message.content
                                )
                        );
                }

                filtered =
                    filtered.slice(
                        0,
                        Math.min(
                            amount,
                            100
                        )
                    );

                if (!filtered.length) {
                    return interaction.reply({
                        content:
                            "❌ No matching messages found.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await interaction.channel.bulkDelete(
                    filtered,
                    true
                );

                return interaction.reply({
                    content:
                        `🧹 Deleted **${filtered.length}** matching messages.`,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // ----------------------------------------------------
            // SLOWMODE
            // ----------------------------------------------------

            if (
                command === "slowmode"
            ) {
                const seconds =
                    interaction.options.getInteger(
                        "seconds"
                    );

                await interaction.channel.setRateLimitPerUser(
                    seconds
                );

                return interaction.reply({
                    content:
                        `🐌 Slowmode set to **${seconds}s**.`
                });
            }

            // ----------------------------------------------------
            // LOCK / UNLOCK
            // ----------------------------------------------------

            if (
                command === "lock" ||
                command === "unlock"
            ) {
                const lock =
                    command === "lock";

                await interaction.channel.permissionOverwrites.edit(
                    interaction.guild.roles.everyone,
                    {
                        SendMessages:
                            lock ? false : null
                    }
                );

                return interaction.reply({
                    content:
                        lock
                            ? "🔒 Channel locked."
                            : "🔓 Channel unlocked."
                });
            }

            // ----------------------------------------------------
            // CASE
            // ----------------------------------------------------

            if (
                command === "case"
            ) {
                const id =
                    interaction.options.getInteger(
                        "id"
                    );

                const data =
                    await ModCase.findOne({
                        guildId:
                            interaction.guild.id,
                        caseId: id
                    });

                if (!data) {
                    return interaction.reply({
                        content:
                            "❌ Case not found.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                `📁 Case #${data.caseId}`
                            )
                            .addFields(
                                {
                                    name: "Type",
                                    value:
                                        data.type,
                                    inline: true
                                },
                                {
                                    name: "User",
                                    value:
                                        `<@${data.userId}>`,
                                    inline: true
                                },
                                {
                                    name: "Moderator",
                                    value:
                                        `<@${data.moderatorId}>`,
                                    inline: true
                                },
                                {
                                    name: "Reason",
                                    value:
                                        data.reason ||
                                        "No reason"
                                }
                            )
                    ]
                });
            }

            // ----------------------------------------------------
            // CASES
            // ----------------------------------------------------

            if (
                command === "cases"
            ) {
                const user =
                    interaction.options.getUser(
                        "user"
                    );

                const cases =
                    await ModCase.find({
                        guildId:
                            interaction.guild.id,
                        ...(user
                            ? {
                                userId:
                                    user.id
                            }
                            : {})
                    })
                        .sort({
                            createdAt: -1
                        })
                        .limit(20);

                if (!cases.length) {
                    return interaction.reply({
                        content:
                            "No moderation cases found."
                    });
                }

                const text =
                    cases
                        .map(
                            item =>
                                `**#${item.caseId}** • ${item.type} • <@${item.userId}> • ${truncate(item.reason || "No reason", 70)}`
                        )
                        .join("\n");

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                "📚 Moderation Cases"
                            )
                            .setDescription(
                                text
                            )
                    ]
                });
            }

            // ----------------------------------------------------
            // HISTORY
            // ----------------------------------------------------

            if (
                command === "history"
            ) {
                const user =
                    interaction.options.getUser(
                        "user"
                    );

                const cases =
                    await ModCase.find({
                        guildId:
                            interaction.guild.id,
                        userId:
                            user.id
                    })
                        .sort({
                            createdAt: -1
                        })
                        .limit(15);

                const text =
                    cases.length
                        ? cases.map(
                            item =>
                                `**#${item.caseId}** — ${item.type} — ${truncate(item.reason || "No reason", 100)}`
                        ).join("\n")
                        : "No history found.";

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                `📜 History — ${user.tag}`
                            )
                            .setDescription(
                                text
                            )
                    ]
                });
            }

            // ----------------------------------------------------
            // MOD STATS
            // ----------------------------------------------------

            if (
                command === "modstats"
            ) {
                const user =
                    interaction.options.getUser(
                        "user"
                    ) ||
                    interaction.user;

                const count =
                    await ModCase.countDocuments({
                        guildId:
                            interaction.guild.id,
                        moderatorId:
                            user.id
                    });

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                `📊 Moderator Stats — ${user.tag}`
                            )
                            .setDescription(
                                `Total recorded actions: **${count}**`
                            )
                    ]
                });
            }

            // ====================================================
            // ROLE COMMANDS
            // ====================================================

            if (
                command === "role"
            ) {
                const sub =
                    interaction.options.getSubcommand();

                if (
                    !interaction.memberPermissions.has(
                        PermissionFlagsBits.ManageRoles
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You need Manage Roles.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const member =
                    interaction.options.getMember(
                        "user"
                    );

                const role =
                    interaction.options.getRole(
                        "role"
                    );

                if (
                    sub === "add"
                ) {
                    if (
                        !role.editable
                    ) {
                        return interaction.reply({
                            content:
                                "❌ I cannot manage that role.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await member.roles.add(
                        role
                    );

                    return interaction.reply({
                        content:
                            `➕ Added ${role} to ${member}.`
                    });
                }

                if (
                    sub === "remove"
                ) {
                    await member.roles.remove(
                        role
                    );

                    return interaction.reply({
                        content:
                            `➖ Removed ${role} from ${member}.`
                    });
                }

                if (
                    sub === "create"
                ) {
                    const name =
                        interaction.options.getString(
                            "name"
                        );

                    const newRole =
                        await interaction.guild.roles.create({
                            name,
                            reason:
                                `Created by ${interaction.user.tag}`
                        });

                    return interaction.reply({
                        content:
                            `✅ Created ${newRole}.`
                    });
                }

                if (
                    sub === "delete"
                ) {
                    await role.delete(
                        `Deleted by ${interaction.user.tag}`
                    );

                    return interaction.reply({
                        content:
                            `🗑️ Role **${role.name}** deleted.`
                    });
                }
            }

            // ====================================================
            // WELCOME
            // ====================================================

            if (
                command === "welcome"
            ) {
                const sub =
                    interaction.options.getSubcommand();

                if (
                    !interaction.memberPermissions.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You need Manage Server.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    sub === "setup"
                ) {
                    const channel =
                        interaction.options.getChannel(
                            "channel"
                        );

                    const role =
                        interaction.options.getRole(
                            "role"
                        );

                    const message =
                        interaction.options.getString(
                            "message"
                        );

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
                                role?.id || null,
                            message:
                                message ||
                                "Welcome {user} to {server}!"
                        },
                        {
                            upsert: true,
                            new: true
                        }
                    );

                    return interaction.reply({
                        content:
                            "✅ Welcome system configured."
                    });
                }

                if (
                    sub === "config"
                ) {
                    const config =
                        await WelcomeConfig.findOne({
                            guildId:
                                interaction.guild.id
                        });

                    if (!config) {
                        return interaction.reply({
                            content:
                                "❌ Welcome system is not configured."
                        });
                    }

                    return interaction.reply({
                        embeds: [
                            embed(0x57f287)
                                .setTitle(
                                    "👋 Welcome Configuration"
                                )
                                .addFields(
                                    {
                                        name: "Enabled",
                                        value:
                                            String(
                                                config.enabled
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Channel",
                                        value:
                                            config.channelId
                                                ? `<#${config.channelId}>`
                                                : "None",
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
                                                config.message
                                            )
                                    }
                                )
                        ]
                    });
                }

                if (
                    sub === "test"
                ) {
                    const config =
                        await WelcomeConfig.findOne({
                            guildId:
                                interaction.guild.id
                        });

                    if (
                        !config?.channelId
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Welcome system is not configured.",
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const channel =
                        interaction.guild.channels.cache.get(
                            config.channelId
                        );

                    const text =
                        replaceVariables(
                            config.message,
                            interaction.member
                        );

                    await channel.send({
                        embeds: [
                            embed(0x57f287)
                                .setTitle(
                                    "🧪 Welcome Test"
                                )
                                .setDescription(
                                    text
                                )
                        ]
                    });

                    return interaction.reply({
                        content:
                            "✅ Test sent.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    sub === "disable"
                ) {
                    await WelcomeConfig.findOneAndUpdate(
                        {
                            guildId:
                                interaction.guild.id
                        },
                        {
                            enabled: false
                        },
                        {
                            upsert: true
                        }
                    );

                    return interaction.reply({
                        content:
                            "✅ Welcome system disabled."
                    });
                }
            }

            // ====================================================
            // END OF PART 3
            // ====================================================
        } catch (error) {
            console.error(
                "interactionCreate error:",
                error
            );

            if (
                interaction.isRepliable()
            ) {
                await safeReply(
                    interaction,
                    {
                        content:
                            "❌ Something went wrong while processing that command."
                    }
                );
            }
        }
    }
);

// ============================================================
// 27PRO - PART 4/4
// CORRECTED FINAL PART
// ============================================================

// ============================================================
// SECOND INTERACTION HANDLER
// ============================================================
// Part 3 already closed its interactionCreate handler.
// This handler safely handles the remaining commands.
// ============================================================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) {
        return;
    }

    const command =
        interaction.commandName;

    try {

        // ====================================================
        // LOGS
        // ====================================================

        if (command === "logs") {

            const subcommand =
                interaction.options.getSubcommand();

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You need **Manage Server** permission.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const guildId =
                interaction.guild.id;

            // ------------------------------------------------
            // /logs setup
            // ------------------------------------------------

            if (subcommand === "setup") {

                const type =
                    interaction.options.getString(
                        "type"
                    );

                const channel =
                    interaction.options.getChannel(
                        "channel"
                    );

                const validTypes = [
                    "general",
                    "member",
                    "message",
                    "moderation",
                    "role",
                    "channel",
                    "server",
                    "bot",
                    "voice",
                    "automod",
                    "ticket",
                    "raid",
                    "security",
                    "giveaway",
                    "invite",
                    "webhook"
                ];

                if (
                    !validTypes.includes(type)
                ) {
                    return interaction.reply({
                        content:
                            "❌ Invalid log type.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                let config =
                    await LogConfig.findOne({
                        guildId
                    });

                if (!config) {
                    config =
                        new LogConfig({
                            guildId
                        });
                }

                if (!config.channels) {
                    config.channels = {};
                }

                config.enabled = true;

                config.channels[type] =
                    channel.id;

                config.markModified(
                    "channels"
                );

                await config.save();

                return interaction.reply({
                    content:
                        `✅ **${type}** logs will now be sent to ${channel}.`
                });
            }

            // ------------------------------------------------
            // /logs config
            // ------------------------------------------------

            if (subcommand === "config") {

                const config =
                    await LogConfig.findOne({
                        guildId
                    });

                if (!config) {
                    return interaction.reply({
                        embeds: [
                            embed(0x5865f2)
                                .setTitle(
                                    "📋 Logging Configuration"
                                )
                                .setDescription(
                                    "No logging configuration has been created yet."
                                )
                        ]
                    });
                }

                const channels =
                    config.channels || {};

                const types = [
                    "general",
                    "member",
                    "message",
                    "moderation",
                    "role",
                    "channel",
                    "server",
                    "bot",
                    "voice",
                    "automod",
                    "ticket",
                    "raid",
                    "security",
                    "giveaway",
                    "invite",
                    "webhook"
                ];

                const description =
                    types
                        .map(type => {

                            const channelId =
                                channels[type];

                            return (
                                `**${type}** → ` +
                                (
                                    channelId
                                        ? `<#${channelId}>`
                                        : "Not configured"
                                )
                            );

                        })
                        .join("\n");

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                "📋 27Pro Logging Configuration"
                            )
                            .setDescription(
                                description
                            )
                    ]
                });
            }

            // ------------------------------------------------
            // /logs test
            // ------------------------------------------------

            if (subcommand === "test") {

                const type =
                    interaction.options.getString(
                        "type"
                    );

                const config =
                    await LogConfig.findOne({
                        guildId
                    });

                const channelId =
                    config?.channels?.[type];

                if (!channelId) {
                    return interaction.reply({
                        content:
                            `❌ **${type}** logs are not configured.`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const channel =
                    interaction.guild.channels.cache.get(
                        channelId
                    );

                if (
                    !channel ||
                    !channel.isTextBased()
                ) {
                    return interaction.reply({
                        content:
                            "❌ The configured log channel no longer exists or is not a text channel.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await channel.send({
                    embeds: [
                        embed(0x57f287)
                            .setTitle(
                                "🧪 27Pro Log Test"
                            )
                            .setDescription(
                                `The **${type}** logging system is working correctly.`
                            )
                            .addFields(
                                {
                                    name:
                                        "Server",
                                    value:
                                        interaction.guild.name,
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Tested By",
                                    value:
                                        interaction.user.tag,
                                    inline:
                                        true
                                }
                            )
                    ]
                });

                return interaction.reply({
                    content:
                        `✅ Test sent to ${channel}.`,
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // ------------------------------------------------
            // /logs disable
            // ------------------------------------------------

            if (subcommand === "disable") {

                const type =
                    interaction.options.getString(
                        "type"
                    );

                const config =
                    await LogConfig.findOne({
                        guildId
                    });

                if (!config) {
                    return interaction.reply({
                        content:
                            "❌ Logging is not configured.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (!config.channels) {
                    config.channels = {};
                }

                config.channels[type] =
                    null;

                config.markModified(
                    "channels"
                );

                await config.save();

                return interaction.reply({
                    content:
                        `✅ **${type}** logging disabled.`
                });
            }
        }

        // ====================================================
        // AUTOMOD
        // ====================================================

        if (command === "automod") {

            const subcommand =
                interaction.options.getSubcommand();

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You need **Manage Server** permission.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const config =
                await getAutoMod(
                    interaction.guild.id
                );

            // ------------------------------------------------
            // ENABLE
            // ------------------------------------------------

            if (
                subcommand === "enable"
            ) {

                config.enabled =
                    true;

                await config.save();

                return interaction.reply({
                    content:
                        "🛡️ AutoMod has been **enabled**."
                });
            }

            // ------------------------------------------------
            // DISABLE
            // ------------------------------------------------

            if (
                subcommand === "disable"
            ) {

                config.enabled =
                    false;

                await config.save();

                return interaction.reply({
                    content:
                        "🛡️ AutoMod has been **disabled**."
                });
            }

            // ------------------------------------------------
            // CONFIG
            // ------------------------------------------------

            if (
                subcommand === "config"
            ) {

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                "🛡️ AutoMod Configuration"
                            )
                            .addFields(
                                {
                                    name:
                                        "Enabled",
                                    value:
                                        config.enabled
                                            ? "✅ Yes"
                                            : "❌ No",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Invite Filter",
                                    value:
                                        config.antiInvite
                                            ? "✅ On"
                                            : "❌ Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Spam Protection",
                                    value:
                                        config.antiSpam
                                            ? "✅ On"
                                            : "❌ Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Caps Protection",
                                    value:
                                        config.antiCaps
                                            ? "✅ On"
                                            : "❌ Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Mention Protection",
                                    value:
                                        config.antiMentionSpam
                                            ? "✅ On"
                                            : "❌ Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Max Mentions",
                                    value:
                                        String(
                                            config.maxMentions ||
                                            5
                                        ),
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Duplicate Messages",
                                    value:
                                        config.duplicateFilter
                                            ? "✅ On"
                                            : "❌ Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Punishment",
                                    value:
                                        config.punishment ||
                                        "delete",
                                    inline:
                                        true
                                }
                            ]
                    ]
                });
            }

            // ------------------------------------------------
            // PUNISHMENT
            // ------------------------------------------------

            if (
                subcommand === "punishment"
            ) {

                const punishment =
                    interaction.options.getString(
                        "type"
                    );

                const validPunishments = [
                    "delete",
                    "warn",
                    "timeout",
                    "kick",
                    "ban"
                ];

                if (
                    !validPunishments.includes(
                        punishment
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Invalid punishment.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                config.punishment =
                    punishment;

                await config.save();

                return interaction.reply({
                    content:
                        `✅ AutoMod punishment set to **${punishment}**.`
                });
            }

            // ------------------------------------------------
            // WORD
            // ------------------------------------------------

            if (
                subcommand === "word"
            ) {

                const word =
                    interaction.options.getString(
                        "word"
                    )
                        .trim()
                        .toLowerCase();

                if (!word) {
                    return interaction.reply({
                        content:
                            "❌ Enter a word.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    !config.blockedWords
                ) {
                    config.blockedWords =
                        [];
                }

                if (
                    !config.blockedWords.includes(
                        word
                    )
                ) {
                    config.blockedWords.push(
                        word
                    );
                }

                await config.save();

                return interaction.reply({
                    content:
                        `🚫 Added **${word}** to the blocked-word list.`
                });
            }

            // ------------------------------------------------
            // UNWORD
            // ------------------------------------------------

            if (
                subcommand === "unword"
            ) {

                const word =
                    interaction.options.getString(
                        "word"
                    )
                        .trim()
                        .toLowerCase();

                config.blockedWords =
                    (
                        config.blockedWords ||
                        []
                    ).filter(
                        item =>
                            item !== word
                    );

                await config.save();

                return interaction.reply({
                    content:
                        `✅ Removed **${word}** from the blocked-word list.`
                });
            }

            // ------------------------------------------------
            // TOGGLE
            // ------------------------------------------------

            if (
                subcommand === "toggle"
            ) {

                const feature =
                    interaction.options.getString(
                        "feature"
                    );

                const enabled =
                    interaction.options.getBoolean(
                        "enabled"
                    );

                const featureMap = {
                    invites:
                        "antiInvite",
                    links:
                        "antiLinks",
                    spam:
                        "antiSpam",
                    caps:
                        "antiCaps",
                    mentions:
                        "antiMentionSpam",
                    duplicates:
                        "duplicateFilter",
                    raid:
                        "antiRaid",
                    escalation:
                        "escalation"
                };

                const property =
                    featureMap[
                        feature
                    ];

                if (!property) {
                    return interaction.reply({
                        content:
                            "❌ Unknown AutoMod feature.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                config[property] =
                    enabled;

                await config.save();

                return interaction.reply({
                    content:
                        `✅ **${feature}** is now ${
                            enabled
                                ? "enabled"
                                : "disabled"
                        }.`
                });
            }
        }

        // ====================================================
        // SECURITY
        // ====================================================

        if (command === "security") {

            const subcommand =
                interaction.options.getSubcommand();

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.Administrator
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You need **Administrator** permission.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const config =
                await getSecurity(
                    interaction.guild.id
                );

            // ------------------------------------------------
            // ENABLE
            // ------------------------------------------------

            if (
                subcommand === "enable"
            ) {

                config.enabled =
                    true;

                await config.save();

                return interaction.reply({
                    content:
                        "🛡️ Advanced security has been **enabled**."
                });
            }

            // ------------------------------------------------
            // DISABLE
            // ------------------------------------------------

            if (
                subcommand === "disable"
            ) {

                config.enabled =
                    false;

                await config.save();

                return interaction.reply({
                    content:
                        "🛡️ Advanced security has been **disabled**."
                });
            }

            // ------------------------------------------------
            // CONFIG
            // ------------------------------------------------

            if (
                subcommand === "config"
            ) {

                return interaction.reply({
                    embeds: [
                        embed(0xff0000)
                            .setTitle(
                                "🚨 27Pro Security"
                            )
                            .addFields(
                                {
                                    name:
                                        "System",
                                    value:
                                        config.enabled
                                            ? "🟢 Enabled"
                                            : "🔴 Disabled",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Anti-Raid",
                                    value:
                                        config.antiRaid
                                            ? "🟢 On"
                                            : "🔴 Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Anti-Nuke",
                                    value:
                                        config.antiNuke
                                            ? "🟢 On"
                                            : "🔴 Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Anti Bot Add",
                                    value:
                                        config.antiBotAdd
                                            ? "🟢 On"
                                            : "🔴 Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Channel Protection",
                                    value:
                                        config.antiChannelDelete
                                            ? "🟢 On"
                                            : "🔴 Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Role Protection",
                                    value:
                                        config.antiRoleDelete
                                            ? "🟢 On"
                                            : "🔴 Off",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Raid Mode",
                                    value:
                                        config.raidMode
                                            ? "🚨 ACTIVE"
                                            : "🟢 Normal",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Raid Threshold",
                                    value:
                                        String(
                                            config.raidThreshold ||
                                            5
                                        ),
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Punishment",
                                    value:
                                        config.punishment ||
                                        "timeout",
                                    inline:
                                        true
                                }
                            ]
                    ]
                });
            }

            // ------------------------------------------------
            // RAIDMODE
            // ------------------------------------------------

            if (
                subcommand === "raidmode"
            ) {

                const enabled =
                    interaction.options.getBoolean(
                        "enabled"
                    );

                config.raidMode =
                    enabled;

                await config.save();

                return interaction.reply({
                    content:
                        enabled
                            ? "🚨 Raid mode manually **enabled**."
                            : "✅ Raid mode manually **disabled**."
                });
            }

            // ------------------------------------------------
            // TRUST USER
            // ------------------------------------------------

            if (
                subcommand === "trust"
            ) {

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                if (
                    !config.trustedUsers
                ) {
                    config.trustedUsers =
                        [];
                }

                if (
                    !config.trustedUsers.includes(
                        user.id
                    )
                ) {
                    config.trustedUsers.push(
                        user.id
                    );
                }

                await config.save();

                return interaction.reply({
                    content:
                        `✅ ${user} is now trusted by 27Pro security.`
                });
            }

            // ------------------------------------------------
            // UNTRUST USER
            // ------------------------------------------------

            if (
                subcommand === "untrust"
            ) {

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                config.trustedUsers =
                    (
                        config.trustedUsers ||
                        []
                    ).filter(
                        id =>
                            id !== user.id
                    );

                await config.save();

                return interaction.reply({
                    content:
                        `✅ ${user} has been removed from the security whitelist.`
                });
            }

            // ------------------------------------------------
            // TRUST ROLE
            // ------------------------------------------------

            if (
                subcommand === "trustrole"
            ) {

                const role =
                    interaction.options.getRole(
                        "role"
                    );

                if (
                    !config.trustedRoles
                ) {
                    config.trustedRoles =
                        [];
                }

                if (
                    !config.trustedRoles.includes(
                        role.id
                    )
                ) {
                    config.trustedRoles.push(
                        role.id
                    );
                }

                await config.save();

                return interaction.reply({
                    content:
                        `✅ ${role} is now a trusted security role.`
                });
            }

            // ------------------------------------------------
            // UNTRUST ROLE
            // ------------------------------------------------

            if (
                subcommand === "untrustrole"
            ) {

                const role =
                    interaction.options.getRole(
                        "role"
                    );

                config.trustedRoles =
                    (
                        config.trustedRoles ||
                        []
                    ).filter(
                        id =>
                            id !== role.id
                    );

                await config.save();

                return interaction.reply({
                    content:
                        `✅ ${role} has been removed from trusted security roles.`
                });
            }
        }

        // ====================================================
        // TICKETS
        // ====================================================

        if (command === "ticket") {

            const subcommand =
                interaction.options.getSubcommand();

            const guildId =
                interaction.guild.id;

            const ticketConfig =
                await TicketConfig.findOne({
                    guildId
                });

            // ------------------------------------------------
            // SETUP
            // ------------------------------------------------

            if (
                subcommand === "setup"
            ) {

                if (
                    !interaction.memberPermissions.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You need **Manage Server** permission.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const category =
                    interaction.options.getChannel(
                        "category"
                    );

                const staffRole =
                    interaction.options.getRole(
                        "staff"
                    );

                const logs =
                    interaction.options.getChannel(
                        "logs"
                    );

                const transcript =
                    interaction.options.getChannel(
                        "transcript"
                    );

                const autoClose =
                    interaction.options.getInteger(
                        "autoclose"
                    );

                const config =
                    ticketConfig ||
                    new TicketConfig({
                        guildId
                    });

                config.enabled =
                    true;

                config.categoryId =
                    category?.id ||
                    null;

                config.staffRoleId =
                    staffRole?.id ||
                    null;

                config.logChannelId =
                    logs?.id ||
                    null;

                config.transcriptChannelId =
                    transcript?.id ||
                    logs?.id ||
                    null;

                if (
                    autoClose !== null &&
                    autoClose !== undefined
                ) {
                    config.autoCloseHours =
                        autoClose;
                }

                await config.save();

                return interaction.reply({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                "🎫 Ticket System Configured"
                            )
                            .setDescription(
                                "27Pro ticketing is now ready."
                            )
                            .addFields(
                                {
                                    name:
                                        "Category",
                                    value:
                                        category
                                            ? `<#${category.id}>`
                                            : "Not set",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Staff Role",
                                    value:
                                        staffRole
                                            ? `<@&${staffRole.id}>`
                                            : "Not set",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Logs",
                                    value:
                                        logs
                                            ? `<#${logs.id}>`
                                            : "Not set",
                                    inline:
                                        true
                                }
                            )
                    ]
                });
            }

            // ------------------------------------------------
            // PANEL
            // ------------------------------------------------

            if (
                subcommand === "panel"
            ) {

                if (
                    !interaction.memberPermissions.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You need **Manage Server** permission.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (!ticketConfig) {
                    return interaction.reply({
                        content:
                            "❌ Configure the ticket system first with `/ticket setup`.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const channel =
                    interaction.options.getChannel(
                        "channel"
                    );

                const button =
                    new ButtonBuilder()
                        .setCustomId(
                            "ticket:create"
                        )
                        .setLabel(
                            "Create Ticket"
                        )
                        .setEmoji("🎫")
                        .setStyle(
                            ButtonStyle.Primary
                        );

                const message =
                    await channel.send({
                        embeds: [
                            embed(0x5865f2)
                                .setTitle(
                                    "🎫 Support Center"
                                )
                                .setDescription(
                                    "Need help? Click **Create Ticket** below to open a private support ticket."
                                )
                        ],
                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    button
                                )
                        ]
                    });

                ticketConfig.panelChannelId =
                    channel.id;

                ticketConfig.panelMessageId =
                    message.id;

                await ticketConfig.save();

                return interaction.reply({
                    content:
                        `✅ Ticket panel created in ${channel}.`
                });
            }

            // ------------------------------------------------
            // GET CURRENT TICKET
            // ------------------------------------------------

            const currentTicket =
                await Ticket.findOne({
                    guildId,
                    channelId:
                        interaction.channel.id
                });

            // ------------------------------------------------
            // CLOSE
            // ------------------------------------------------

            if (
                subcommand === "close"
            ) {

                if (!currentTicket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not a ticket.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const isStaff =
                    ticketConfig?.staffRoleId &&
                    interaction.member.roles.cache.has(
                        ticketConfig.staffRoleId
                    );

                if (
                    currentTicket.userId !==
                        interaction.user.id &&
                    !isStaff
                ) {
                    return interaction.reply({
                        content:
                            "❌ You cannot close this ticket.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                currentTicket.status =
                    "closed";

                currentTicket.closedBy =
                    interaction.user.id;

                currentTicket.closedAt =
                    new Date();

                await currentTicket.save();

                await interaction.channel.permissionOverwrites
                    .edit(
                        currentTicket.userId,
                        {
                            ViewChannel:
                                true,
                            SendMessages:
                                false,
                            ReadMessageHistory:
                                true
                        }
                    )
                    .catch(
                        () => {}
                    );

                return interaction.reply({
                    embeds: [
                        embed(0xff0000)
                            .setTitle(
                                "🔒 Ticket Closed"
                            )
                            .setDescription(
                                `Closed by ${interaction.user}.`
                            )
                    ]
                });
            }

            // ------------------------------------------------
            // CLAIM
            // ------------------------------------------------

            if (
                subcommand === "claim"
            ) {

                if (!currentTicket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not a ticket.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const isStaff =
                    ticketConfig?.staffRoleId &&
                    interaction.member.roles.cache.has(
                        ticketConfig.staffRoleId
                    );

                if (!isStaff) {
                    return interaction.reply({
                        content:
                            "❌ You are not ticket staff.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                currentTicket.claimedBy =
                    interaction.user.id;

                await currentTicket.save();

                return interaction.reply({
                    content:
                        `🙋 Ticket claimed by ${interaction.user}.`
                });
            }

            // ------------------------------------------------
            // ADD USER
            // ------------------------------------------------

            if (
                subcommand === "add"
            ) {

                if (!currentTicket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not a ticket.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const isStaff =
                    ticketConfig?.staffRoleId &&
                    interaction.member.roles.cache.has(
                        ticketConfig.staffRoleId
                    );

                if (!isStaff) {
                    return interaction.reply({
                        content:
                            "❌ You are not ticket staff.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                await interaction.channel.permissionOverwrites.edit(
                    user.id,
                    {
                        ViewChannel:
                            true,
                        SendMessages:
                            true,
                        ReadMessageHistory:
                            true,
                        AttachFiles:
                            true
                    }
                );

                return interaction.reply({
                    content:
                        `➕ Added ${user} to this ticket.`
                });
            }

            // ------------------------------------------------
            // REMOVE USER
            // ------------------------------------------------

            if (
                subcommand === "remove"
            ) {

                if (!currentTicket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not a ticket.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const isStaff =
                    ticketConfig?.staffRoleId &&
                    interaction.member.roles.cache.has(
                        ticketConfig.staffRoleId
                    );

                if (!isStaff) {
                    return interaction.reply({
                        content:
                            "❌ You are not ticket staff.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                await interaction.channel.permissionOverwrites
                    .delete(
                        user.id
                    )
                    .catch(
                        () => {}
                    );

                return interaction.reply({
                    content:
                        `➖ Removed ${user} from this ticket.`
                });
            }

            // ------------------------------------------------
            // REOPEN
            // ------------------------------------------------

            if (
                subcommand === "reopen"
            ) {

                if (!currentTicket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not a ticket.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const isStaff =
                    ticketConfig?.staffRoleId &&
                    interaction.member.roles.cache.has(
                        ticketConfig.staffRoleId
                    );

                if (!isStaff) {
                    return interaction.reply({
                        content:
                            "❌ You are not ticket staff.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                currentTicket.status =
                    "open";

                currentTicket.closedAt =
                    null;

                currentTicket.closedBy =
                    null;

                await currentTicket.save();

                await interaction.channel.permissionOverwrites
                    .edit(
                        currentTicket.userId,
                        {
                            ViewChannel:
                                true,
                            SendMessages:
                                true,
                            ReadMessageHistory:
                                true
                        }
                    )
                    .catch(
                        () => {}
                    );

                return interaction.reply({
                    content:
                        "🔓 Ticket reopened."
                });
            }

            // ------------------------------------------------
            // DELETE
            // ------------------------------------------------

            if (
                subcommand === "delete"
            ) {

                if (!currentTicket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not a ticket.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const isStaff =
                    ticketConfig?.staffRoleId &&
                    interaction.member.roles.cache.has(
                        ticketConfig.staffRoleId
                    );

                if (!isStaff) {
                    return interaction.reply({
                        content:
                            "❌ You are not ticket staff.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await Ticket.deleteOne({
                    _id:
                        currentTicket._id
                });

                await interaction.reply({
                    content:
                        "🗑️ Deleting ticket..."
                });

                setTimeout(
                    () => {
                        interaction.channel
                            .delete(
                                "27Pro ticket deleted"
                            )
                            .catch(
                                () => {}
                            );
                    },
                    1500
                );

                return;
            }

            // ------------------------------------------------
            // TRANSCRIPT
            // ------------------------------------------------

            if (
                subcommand === "transcript"
            ) {

                if (!currentTicket) {
                    return interaction.reply({
                        content:
                            "❌ This channel is not a ticket.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const isStaff =
                    ticketConfig?.staffRoleId &&
                    interaction.member.roles.cache.has(
                        ticketConfig.staffRoleId
                    );

                if (!isStaff) {
                    return interaction.reply({
                        content:
                            "❌ You are not ticket staff.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const messages =
                    await interaction.channel.messages.fetch({
                        limit:
                            100
                    });

                const transcript =
                    messages
                        .sort(
                            (a, b) =>
                                a.createdTimestamp -
                                b.createdTimestamp
                        )
                        .map(
                            message =>
                                `[${new Date(
                                    message.createdTimestamp
                                ).toISOString()}] ${
                                    message.author.tag
                               }: ${
                                    message.content ||
                                    "[embed/attachment]"
                                }`
                        )
                        .join("\n");

                const buffer =
                    Buffer.from(
                        transcript ||
                            "No messages.",
                        "utf8"
                    );

                const attachment =
                    new AttachmentBuilder(
                        buffer,
                        {
                            name:
                                `ticket-${currentTicket.number || currentTicket._id}.txt`
                        }
                    );

                return interaction.reply({
                    content:
                        "📄 Ticket transcript:",
                    files: [
                        attachment
                    ],
                    flags:
                        MessageFlags.Ephemeral
                });
            }
        }

        // ====================================================
        // GIVEAWAYS
        // ====================================================

        if (command === "giveaway") {

            const subcommand =
                interaction.options.getSubcommand();

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You need **Manage Server** permission.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // ------------------------------------------------
            // START
            // ------------------------------------------------

            if (
                subcommand === "start"
            ) {

                const minutes =
                    interaction.options.getInteger(
                        "minutes"
                    );

                const winners =
                    interaction.options.getInteger(
                        "winners"
                    );

                const prize =
                    interaction.options.getString(
                        "prize"
                    );

                if (
                    minutes < 1
                ) {
                    return interaction.reply({
                        content:
                            "❌ Duration must be at least 1 minute.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const endAt =
                    new Date(
                        Date.now() +
                            minutes *
                            60 *
                            1000
                    );

                const giveaway =
                    new Giveaway({
                        guildId:
                            interaction.guild.id,
                        channelId:
                            interaction.channel.id,
                        hostId:
                            interaction.user.id,
                        prize,
                        winners:
                            winners || 1,
                        endAt,
                        ended:
                            false,
                        participants:
                            []
                    });

                await giveaway.save();

                const button =
                    new ButtonBuilder()
                        .setCustomId(
                            "giveaway:join"
                        )
                        .setLabel(
                            "Enter Giveaway"
                        )
                        .setEmoji("🎉")
                        .setStyle(
                            ButtonStyle.Success
                        );

                const message =
                    await interaction.channel.send({
                        embeds: [
                            embed(0xff0055)
                                .setTitle(
                                    "🎉 GIVEAWAY"
                                )
                                .setDescription(
                                    `🎁 **Prize:** ${prize}\n\n` +
                                    `🏆 **Winners:** ${winners}\n` +
                                    `⏰ **Ends:** <t:${Math.floor(
                                        endAt.getTime() /
                                            1000
                                    )}:R>\n\n` +
                                    "Click **Enter Giveaway** below!"
                                )
                                .setFooter({
                                    text:
                                        `Hosted by ${interaction.user.tag}`
                                })
                        ],
                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    button
                                )
                        ]
                    });

                giveaway.messageId =
                    message.id;

                await giveaway.save();

                if (
                    typeof scheduleGiveaway ===
                    "function"
                ) {
                    scheduleGiveaway(
                        giveaway
                    );
                }

                return interaction.reply({
                    content:
                        "🎉 Giveaway started!",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // ------------------------------------------------
            // END
            // ------------------------------------------------

            if (
                subcommand === "end"
            ) {

                const messageId =
                    interaction.options.getString(
                        "messageid"
                    );

                const giveaway =
                    await Giveaway.findOne({
                        guildId:
                            interaction.guild.id,
                        messageId
                    });

                if (!giveaway) {
                    return interaction.reply({
                        content:
                            "❌ Giveaway not found.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    typeof finishGiveaway ===
                    "function"
                ) {
                    await finishGiveaway(
                        giveaway
                    );
                } else {
                    giveaway.ended =
                        true;

                    await giveaway.save();
                }

                return interaction.reply({
                    content:
                        "🏁 Giveaway ended."
                });
            }

            // ------------------------------------------------
            // REROLL
            // ------------------------------------------------

            if (
                subcommand === "reroll"
            ) {

                const messageId =
                    interaction.options.getString(
                        "messageid"
                    );

                const giveaway =
                    await Giveaway.findOne({
                        guildId:
                            interaction.guild.id,
                        messageId
                    });

                if (!giveaway) {
                    return interaction.reply({
                        content:
                            "❌ Giveaway not found.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const participants =
                    [
                        ...(giveaway.participants ||
                            [])
                    ];

                if (
                    !participants.length
                ) {
                    return interaction.reply({
                        content:
                            "❌ There are no participants.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const selected =
                    [];

                while (
                    selected.length <
                        Math.min(
                            giveaway.winners ||
                                1,
                            participants.length
                        )
                ) {

                    const index =
                        Math.floor(
                            Math.random() *
                                participants.length
                        );

                    const userId =
                        participants[
                            index
                        ];

                    if (
                        !selected.includes(
                            userId
                        )
                    ) {
                        selected.push(
                            userId
                        );
                    }
                }

                await interaction.channel.send({
                    content:
                        `🎉 **Giveaway Reroll!** Congratulations ${selected
                            .map(
                                id =>
                                    `<@${id}>`
                            )
                            .join(
                                ", "
                            )}!`
                });

                return interaction.reply({
                    content:
                        "🔄 Giveaway rerolled.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }
        }

        // ====================================================
        // RANK
        // ====================================================

        if (
            command === "rank"
        ) {

            const user =
                interaction.options.getUser(
                    "user"
                ) ||
                interaction.user;

            const data =
                await Level.findOne({
                    guildId:
                        interaction.guild.id,
                    userId:
                        user.id
                });

            const xp =
                data?.xp || 0;

            const level =
                Math.floor(
                    Math.sqrt(
                        xp / 100
                    )
                );

            const nextLevelXP =
                (level + 1) *
                (level + 1) *
                100;

            return interaction.reply({
                embeds: [
                    embed(0x5865f2)
                        .setTitle(
                            `📈 ${user.username}'s Rank`
                        )
                        .setThumbnail(
                            user.displayAvatarURL()
                        )
                        .addFields(
                            {
                                name:
                                    "Level",
                                value:
                                    String(
                                        level
                                    ),
                                inline:
                                    true
                            },
                            {
                                name:
                                    "XP",
                                value:
                                    String(
                                        xp
                                    ),
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Next Level",
                                value:
                                    `${Math.max(
                                        nextLevelXP -
                                            xp,
                                        0
                                    )} XP`,
                                inline:
                                    true
                            }
                        )
                ]
            });
        }

        // ====================================================
        // LEADERBOARD
        // ====================================================

        if (
            command === "leaderboard"
        ) {

            const users =
                await Level.find({
                    guildId:
                        interaction.guild.id
                })
                    .sort({
                        xp:
                            -1
                    })
                    .limit(
                        10
                    );

            if (!users.length) {
                return interaction.reply({
                    content:
                        "📊 There is no XP data yet."
                });
            }

            const lines =
                users.map(
                    (user, index) => {

                        const level =
                            Math.floor(
                                Math.sqrt(
                                    user.xp /
                                        100
                                )
                            );

                        return (
                            `**${index + 1}.** ` +
                            `<@${user.userId}> ` +
                            `— Level **${level}** ` +
                            `(${user.xp} XP)`
                        );
                    }
                );

            return interaction.reply({
                embeds: [
                    embed(0xffcc00)
                        .setTitle(
                            "🏆 Level Leaderboard"
                        )
                        .setDescription(
                            lines.join(
                                "\n"
                            )
                        )
                ]
            });
        }

        // ====================================================
        // ROLE PANEL
        // ====================================================

        if (
            command === "rolepanel"
        ) {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You need **Manage Roles** permission.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const channel =
                interaction.options.getChannel(
                    "channel"
                );

            const role =
                interaction.options.getRole(
                    "role"
                );

            const label =
                interaction.options.getString(
                    "label"
                );

            const emoji =
                interaction.options.getString(
                    "emoji"
                );

            const button =
                new ButtonBuilder()
                    .setCustomId(
                        `role:${role.id}`
                    )
                    .setLabel(
                        label
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    );

            if (emoji) {
                button.setEmoji(
                    emoji
                );
            }

            const message =
                await channel.send({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                "🎭 Self Roles"
                            )
                            .setDescription(
                                `Click the button below to toggle ${role}.`
                            )
                    ],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                button
                            )
                    ]
                });

            await RolePanel.create({
                guildId:
                    interaction.guild.id,
                channelId:
                    channel.id,
                messageId:
                    message.id,
                roleId:
                    role.id,
                label,
                emoji:
                    emoji || null
            });

            return interaction.reply({
                content:
                    `✅ Role panel created in ${channel}.`
            });
        }

        // ====================================================
        // SAY
        // ====================================================

        if (
            command === "say"
        ) {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageMessages
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You need **Manage Messages** permission.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const message =
                interaction.options.getString(
                    "message"
                );

            await interaction.channel.send({
                content:
                    message
            });

            return interaction.reply({
                content:
                    "✅ Message sent.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // ANNOUNCE
        // ====================================================

        if (
            command === "announce"
        ) {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You need **Manage Server** permission.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const channel =
                interaction.options.getChannel(
                    "channel"
                );

            const message =
                interaction.options.getString(
                    "message"
                );

            await channel.send({
                embeds: [
                    embed(0xff0055)
                        .setTitle(
                            "📢 Announcement"
                        )
                        .setDescription(
                            message
                        )
                        .setFooter({
                            text:
                                `Announced by ${interaction.user.tag}`
                        })
                ]
            });

            return interaction.reply({
                content:
                    `✅ Announcement sent to ${channel}.`,
                flags:
                    MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // POLL
        // ====================================================

        if (
            command === "poll"
        ) {

            const question =
                interaction.options.getString(
                    "question"
                );

            const message =
                await interaction.channel.send({
                    embeds: [
                        embed(0x5865f2)
                            .setTitle(
                                "📊 Poll"
                            )
                            .setDescription(
                                question
                            )
                            .setFooter({
                                text:
                                    `Poll by ${interaction.user.tag}`
                            })
                    ]
                });

            await message.react(
                "👍"
            );

            await message.react(
                "👎"
            );

            return interaction.reply({
                content:
                    "✅ Poll created.",
                flags:
                    MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // REMIND
        // ====================================================

        if (
            command === "remind"
        ) {

            const minutes =
                interaction.options.getInteger(
                    "minutes"
                );

            const message =
                interaction.options.getString(
                    "message"
                );

            const remindAt =
                new Date(
                    Date.now() +
                        minutes *
                        60 *
                        1000
                );

            const reminder =
                await Reminder.create({
                    guildId:
                        interaction.guild.id,
                    userId:
                        interaction.user.id,
                    channelId:
                        interaction.channel.id,
                    message,
                    remindAt,
                    sent:
                        false
                });

            if (
                typeof scheduleReminder ===
                "function"
            ) {
                scheduleReminder(
                    reminder
                );
            }

            return interaction.reply({
                embeds: [
                    embed(0x57f287)
                        .setTitle(
                            "⏰ Reminder Created"
                        )
                        .setDescription(
                            `I'll remind you in **${minutes} minutes**.`
                        )
                ],
                flags:
                    MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // COINFLIP
        // ====================================================

        if (
            command === "coinflip"
        ) {

            const result =
                Math.random() <
                0.5
                    ? "Heads 🪙"
                    : "Tails 🪙";

            return interaction.reply({
                embeds: [
                    embed(0xffcc00)
                        .setTitle(
                            "🪙 Coin Flip"
                        )
                        .setDescription(
                            `**${result}**`
                        )
                ]
            });
        }

        // ====================================================
        // ROLL
        // ====================================================

        if (
            command === "roll"
        ) {

            const sides =
                interaction.options.getInteger(
                    "sides"
                ) ||
                6;

            if (
                sides < 2 ||
                sides > 1000000
            ) {
                return interaction.reply({
                    content:
                        "❌ Sides must be between 2 and 1,000,000.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const result =
                Math.floor(
                    Math.random() *
                        sides
                ) + 1;

            return interaction.reply({
                embeds: [
                    embed(0x5865f2)
                        .setTitle(
                            "🎲 Dice Roll"
                        )
                        .setDescription(
                            `You rolled **${result}** on a d${sides}.`
                        )
                ]
            });
        }

        // ====================================================
        // 8BALL
        // ====================================================

        if (
            command === "8ball"
        ) {

            const question =
                interaction.options.getString(
                    "question"
                );

            const answers = [
                "Absolutely.",
                "Most likely.",
                "Yes.",
                "It is possible.",
                "Ask again later.",
                "Probably not.",
                "No.",
                "Definitely not.",
                "The future is unclear."
            ];

            const answer =
                answers[
                    Math.floor(
                        Math.random() *
                            answers.length
                    )
                ];

            return interaction.reply({
                embeds: [
                    embed(0x5865f2)
                        .setTitle(
                            "🔮 Magic 8-Ball"
                        )
                        .addFields(
                            {
                                name:
                                    "Question",
                                value:
                                    question
                            },
                            {
                                name:
                                    "Answer",
                                value:
                                    answer
                            }
                        )
                ]
            });
        }

        // ====================================================
        // CHOOSE
        // ====================================================

        if (
            command === "choose"
        ) {

            const input =
                interaction.options.getString(
                    "options"
                );

            const choices =
                input
                    .split(",")
                    .map(
                        item =>
                            item.trim()
                    )
                    .filter(
                        Boolean
                    );

            if (
                choices.length <
                2
            ) {
                return interaction.reply({
                    content:
                        "❌ Enter at least two options separated by commas.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            const selected =
                choices[
                    Math.floor(
                        Math.random() *
                            choices.length
                    )
                ];

            return interaction.reply({
                embeds: [
                    embed(0xff0055)
                        .setTitle(
                            "🤔 Choice"
                        )
                        .setDescription(
                            `I choose **${selected}**`
                        )
                ]
            });
        }

        // ====================================================
        // RULES
        // ====================================================

        if (
            command === "rules"
        ) {

            const subcommand =
                interaction.options.getSubcommand();

            if (
                subcommand === "setup"
            ) {

                if (
                    !interaction.memberPermissions.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You need **Manage Server** permission.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const channel =
                    interaction.options.getChannel(
                        "channel"
                    );

                const text =
                    interaction.options.getString(
                        "text"
                    );

                await RulesConfig.findOneAndUpdate(
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
                        text
                    },
                    {
                        upsert:
                            true,
                        new:
                            true
                    }
                );

                await channel.send({
                    embeds: [
                        embed(0xff0055)
                            .setTitle(
                                "📜 Server Rules"
                            )
                            .setDescription(
                                text
                            )
                    ]
                });

                return interaction.reply({
                    content:
                        `✅ Rules posted in ${channel}.`
                });
            }

            if (
                subcommand === "show"
            ) {

                const rules =
                    await RulesConfig.findOne({
                        guildId:
                            interaction.guild.id,
                        enabled:
                            true
                    });

                if (!rules) {
                    return interaction.reply({
                        content:
                            "❌ No rules have been configured.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    embeds: [
                        embed(0xff0055)
                            .setTitle(
                                "📜 Server Rules"
                            )
                            .setDescription(
                                rules.text ||
                                "No rules configured."
                            )
                    ]
                });
            }

            if (
                subcommand === "disable"
            ) {

                if (
                    !interaction.memberPermissions.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ You need **Manage Server** permission.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await RulesConfig.findOneAndUpdate(
                    {
                        guildId:
                            interaction.guild.id
                    },
                    {
                        enabled:
                            false
                    },
                    {
                        upsert:
                            true
                    }
                );

                return interaction.reply({
                    content:
                        "✅ Rules system disabled."
                });
            }
        }

        // ====================================================
        // KICK LIVE
        // ====================================================

        if (
            command === "live"
        ) {

            const subcommand =
                interaction.options.getSubcommand();

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You need **Manage Server** permission.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // ------------------------------------------------
            // SETUP
            // ------------------------------------------------

            if (
                subcommand === "setup"
            ) {

                const username =
                    interaction.options.getString(
                        "username"
                    )
                        .replace(
                            /^@/,
                            ""
                        )
                        .trim();

                const channel =
                    interaction.options.getChannel(
                        "channel"
                    );

                await KickConfig.findOneAndUpdate(
                    {
                        guildId:
                            interaction.guild.id
                    },
                    {
                        guildId:
                            interaction.guild.id,
                        enabled:
                            true,
                        username,
                        channelId:
                            channel.id
                    },
                    {
                        upsert:
                            true,
                        new:
                            true
                    }
                );

                return interaction.reply({
                    embeds: [
                        embed(0x53fc18)
                            .setTitle(
                                "🔴 KICK Live Alerts Enabled"
                            )
                            .addFields(
                                {
                                    name:
                                        "Username",
                                    value:
                                        `kick.com/${username}`,
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Channel",
                                    value:
                                        `<#${channel.id}>`,
                                    inline:
                                        true
                                }
                            )
                    ]
                });
            }

            // ------------------------------------------------
            // DISABLE
            // ------------------------------------------------

            if (
                subcommand === "disable"
            ) {

                await KickConfig.findOneAndUpdate(
                    {
                        guildId:
                            interaction.guild.id
                    },
                    {
                        enabled:
                            false
                    },
                    {
                        upsert:
                            true
                    }
                );

                return interaction.reply({
                    content:
                        "🔴 KICK live alerts disabled."
                });
            }

            // ------------------------------------------------
            // CONFIG
            // ------------------------------------------------

            if (
                subcommand === "config"
            ) {

                const config =
                    await KickConfig.findOne({
                        guildId:
                            interaction.guild.id
                    });

                if (!config) {
                    return interaction.reply({
                        content:
                            "❌ KICK is not configured.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    embeds: [
                        embed(0x53fc18)
                            .setTitle(
                                "🔴 KICK Configuration"
                            )
                            .addFields(
                                {
                                    name:
                                        "Enabled",
                                    value:
                                        config.enabled
                                            ? "🟢 Yes"
                                            : "🔴 No",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Username",
                                    value:
                                        config.username ||
                                        "Not configured",
                                    inline:
                                        true
                                },
                                {
                                    name:
                                        "Channel",
                                    value:
                                        config.channelId
                                            ? `<#${config.channelId}>`
                                            : "Not configured",
                                    inline:
                                        true
                                }
                            )
                    ]
                });
            }
        }

        // ====================================================
        // KICK LIVE CHECK
        // ====================================================

        if (
            command === "livecheck"
        ) {

            await interaction.deferReply();

            const config =
                await KickConfig.findOne({
                    guildId:
                        interaction.guild.id
                });

            if (
                !config?.username
            ) {
                return interaction.editReply({
                    content:
                        "❌ KICK is not configured."
                });
            }

            try {

                const response =
                    await axios.get(
                        `https://kick.com/api/v2/channels/${encodeURIComponent(
                            config.username
                        )}`,
                        {
                            timeout:
                                15000,
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0",
                                Accept:
                                    "application/json"
                            }
                        }
                    );

                const data =
                    response.data;

                const stream =
                    data?.livestream ||
                    null;

                if (!stream) {

                    return interaction.editReply({
                        embeds: [
                            embed(0x2b2d31)
                                .setTitle(
                                    "⚫ KICK Offline"
                                )
                                .setDescription(
                                    `**${config.username}** is currently offline.`
                                )
                        ]
                    });
                }

                // --------------------------------------------
                // CATEGORY / GAME EXTRACTION
                // --------------------------------------------

                let category =
                    "Unknown";

                const possibleCategories = [
                    stream?.category?.name,
                    stream?.category?.title,
                    stream?.category?.slug,
                    stream?.game?.name,
                    stream?.game?.title,
                    stream?.game?.slug,
                    data?.category?.name,
                    data?.category?.title,
                    data?.game?.name,
                    data?.game?.title
                ];

                for (
                    const value
                    of possibleCategories
                ) {

                    if (
                        value &&
                        typeof value ===
                            "string" &&
                        value.trim()
                    ) {
                        category =
                            value.trim();

                        break;
                    }
                }

                const title =
                    stream?.session_title ||
                    stream?.title ||
                    "No stream title";

                const viewers =
                    stream?.viewer_count ??
                    stream?.viewers ??
                    0;

                const thumbnail =
                    stream?.thumbnail?.url ||
                    stream?.thumbnail ||
                    null;

                const startedAt =
                    stream?.created_at ||
                    stream?.start_time ||
                    null;

                const fields = [
                    {
                        name:
                            "🎮 Category / Game",
                        value:
                            category,
                        inline:
                            true
                    },
                    {
                        name:
                            "👀 Viewers",
                        value:
                            String(
                                viewers
                            ),
                        inline:
                            true
                    },
                    {
                        name:
                            "📺 Title",
                        value:
                            title
                    }
                ];

                if (
                    startedAt
                ) {
                    const timestamp =
                        Math.floor(
                            new Date(
                                startedAt
                            ).getTime() /
                                1000
                        );

                    if (
                        Number.isFinite(
                            timestamp
                        )
                    ) {
                        fields.push({
                            name:
                                "🔴 Started",
                            value:
                                `<t:${timestamp}:R>`,
                            inline:
                                true
                        });
                    }
                }

                const liveEmbed =
                    embed(0x53fc18)
                        .setTitle(
                            "🔴 LIVE ON KICK"
                        )
                        .setURL(
                            `https://kick.com/${config.username}`
                        )
                        .setDescription(
                            `**${
                                data?.name ||
                                config.username
                            }** is now live!`
                        )
                        .addFields(
                            fields
                        );

                if (
                    thumbnail
                ) {
                    liveEmbed.setImage(
                        thumbnail
                    );
                }

                return interaction.editReply({
                    embeds: [
                        liveEmbed
                    ]
                });

            } catch (error) {

                console.error(
                    "KICK livecheck error:",
                    error
                );

                return interaction.editReply({
                    content:
                        "❌ Failed to contact KICK right now."
                });
            }
        }

        // ====================================================
        // ROLE INFO
        // ====================================================

        if (
            command === "roleinfo"
        ) {

            const role =
                interaction.options.getRole(
                    "role"
                );

            return interaction.reply({
                embeds: [
                    embed(0x5865f2)
                        .setTitle(
                            `🎭 Role Info — ${role.name}`
                        )
                        .addFields(
                            {
                                name:
                                    "ID",
                                value:
                                    `\`${role.id}\``,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Color",
                                value:
                                    role.hexColor,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Position",
                                value:
                                    String(
                                        role.position
                                    ),
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Members",
                                value:
                                    String(
                                        role.members.size
                                    ),
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Mentionable",
                                value:
                                    role.mentionable
                                        ? "Yes"
                                        : "No",
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Managed",
                                value:
                                    role.managed
                                        ? "Yes"
                                        : "No",
                                inline:
                                    true
                            }
                        )
                ]
            });
        }

        // ====================================================
        // CHANNEL INFO
        // ====================================================

        if (
            command === "channelinfo"
        ) {

            const channel =
                interaction.options.getChannel(
                    "channel"
                ) ||
                interaction.channel;

            return interaction.reply({
                embeds: [
                    embed(0x5865f2)
                        .setTitle(
                            `📁 Channel Info — ${channel.name}`
                        )
                        .addFields(
                            {
                                name:
                                    "ID",
                                value:
                                    `\`${channel.id}\``,
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Type",
                                value:
                                    String(
                                        channel.type
                                    ),
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Category",
                                value:
                                    channel.parent
                                        ? channel.parent.name
                                        : "None",
                                inline:
                                    true
                            },
                            {
                                name:
                                    "Created",
                                value:
                                    `<t:${Math.floor(
                                        channel.createdTimestamp /
                                            1000
                                    )}:R>`,
                                inline:
                                    true
                            }
                        )
                ]
            });
        }

    } catch (error) {

        console.error(
            "27Pro Part 4 interaction error:",
            error
        );

        if (
            interaction.isRepliable()
        ) {

            await safeReply(
                interaction,
                {
                    content:
                        "❌ Something went wrong while processing that command."
                }
            );
        }
    }
});

// ============================================================
// BACKGROUND SYSTEMS
// ============================================================

async function start27ProBackgroundSystems() {

    // --------------------------------------------------------
    // GIVEAWAY RECOVERY
    // --------------------------------------------------------

    try {

        if (
            typeof restoreGiveaways ===
            "function"
        ) {
            await restoreGiveaways();
        }

    } catch (error) {

        console.error(
            "Giveaway recovery error:",
            error
        );
    }

    // --------------------------------------------------------
    // REMINDER RECOVERY
    // --------------------------------------------------------

    try {

        if (
            typeof restoreReminders ===
            "function"
        ) {
            await restoreReminders();
        }

    } catch (error) {

        console.error(
            "Reminder recovery error:",
            error
        );
    }
}

// ============================================================
// KICK CHECKER
// ============================================================

function start27ProKickChecker() {

    if (
        checkerInterval
    ) {
        clearInterval(
            checkerInterval
        );
    }

    checkerInterval =
        setInterval(
            async () => {

                if (
                    checkerRunning
                ) {
                    return;
                }

                checkerRunning =
                    true;

                try {

                    await checkKickChannels();

                } catch (error) {

                    console.error(
                        "KICK checker error:",
                        error
                    );

                } finally {

                    checkerRunning =
                        false;
                }

            },
            60000
        );

    checkKickChannels()
        .catch(
            error =>
                console.error(
                    "Initial KICK check error:",
                    error
                )
        );
}

// ============================================================
// HEALTH SERVER
// ============================================================

const healthServer =
    http.createServer(
        (req, res) => {

            try {

                if (
                    req.url ===
                    "/health"
                ) {

                    const result = {
                        status:
                            "ok",

                        bot:
                            client.user
                                ? "connected"
                                : "connecting",

                        botTag:
                            client.user
                                ? client.user.tag
                                : null,

                        guilds:
                            client.guilds.cache.size,

                        ping:
                            client.ws.ping,

                        uptime:
                            process.uptime(),

                        mongo:
                            mongoose.connection
                                .readyState ===
                            1
                                ? "connected"
                                : "disconnected",

                        timestamp:
                            new Date().toISOString()
                    };

                    res.writeHead(
                        200,
                        {
                            "Content-Type":
                                "application/json",
                            "Cache-Control":
                                "no-cache"
                        }
                    );

                    return res.end(
                        JSON.stringify(
                            result
                        )
                    );
                }

                if (
                    req.url ===
                    "/"
                ) {

                    res.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/plain; charset=utf-8"
                        }
                    );

                    return res.end(
                        "27Pro Discord Bot is online."
                    );
                }

                res.writeHead(
                    404,
                    {
                        "Content-Type":
                            "text/plain"
                    }
                );

                return res.end(
                    "Not Found"
                );

            } catch (error) {

                console.error(
                    "Health server error:",
                    error
                );

                res.writeHead(
                    500
                );

                return res.end(
                    "Internal Server Error"
                );
            }
        }
    );

// ============================================================
// HEALTH SERVER ERROR
// ============================================================

healthServer.on(
    "error",
    error => {

        if (
            error.code ===
            "EADDRINUSE"
        ) {

            console.error(
                `[27Pro] Port ${PORT} is already in use.`
            );

            return;
        }

        console.error(
            "Health server error:",
            error
        );
    }
);

// ============================================================
// PROCESS ERROR HANDLERS
// ============================================================

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "[27Pro] UNHANDLED REJECTION:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {

        console.error(
            "[27Pro] UNCAUGHT EXCEPTION:",
            error
        );
    }
);

client.on(
    "error",
    error => {

        console.error(
            "[27Pro] Discord client error:",
            error
        );
    }
);

client.on(
    "warn",
    warning => {

        console.warn(
            "[27Pro] Discord warning:",
            warning
        );
    }
);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown27Pro(
    signal
) {

    if (
        shuttingDown
    ) {
        return;
    }

    shuttingDown =
        true;

    console.log(
        `[27Pro] ${signal} received. Shutting down...`
    );

    try {

        // ----------------------------------------------------
        // KICK TIMER
        // ----------------------------------------------------

        if (
            checkerInterval
        ) {

            clearInterval(
                checkerInterval
            );

            checkerInterval =
                null;
        }

        // ----------------------------------------------------
        // GIVEAWAY TIMERS
        // ----------------------------------------------------

        if (
            giveawayTimers &&
            giveawayTimers.size
        ) {

            for (
                const timer
                of giveawayTimers.values()
            ) {

                clearTimeout(
                    timer
                );
            }

            giveawayTimers.clear();
        }

        // ----------------------------------------------------
        // REMINDER TIMERS
        // ----------------------------------------------------

        if (
            reminderTimers &&
            reminderTimers.size
        ) {

            for (
                const timer
                of reminderTimers.values()
            ) {

                clearTimeout(
                    timer
                );
            }

            reminderTimers.clear();
        }

        // ----------------------------------------------------
        // HTTP SERVER
        // ----------------------------------------------------

        if (
            healthServer.listening
        ) {

            await new Promise(
                resolve => {

                    healthServer.close(
                        () =>
                            resolve()
                    );
                }
            ).catch(
                () => {}
            );
        }

        // ----------------------------------------------------
        // DISCORD
        // ----------------------------------------------------

        try {
            client.destroy();
        } catch {}

        // ----------------------------------------------------
        // MONGODB
        // ----------------------------------------------------

        try {

            if (
                mongoose.connection.readyState !==
                0
            ) {

                await mongoose.connection
                    .close();
            }

        } catch {}

        console.log(
            "[27Pro] Shutdown complete."
        );

        process.exit(
            0
        );

    } catch (error) {

        console.error(
            "[27Pro] Shutdown error:",
            error
        );

        process.exit(
            1
        );
    }
}

// ============================================================
// SIGNALS
// ============================================================

process.once(
    "SIGINT",
    () =>
        shutdown27Pro(
            "SIGINT"
        )
);

process.once(
    "SIGTERM",
    () =>
        shutdown27Pro(
            "SIGTERM"
        )
);

// ============================================================
// STARTUP
// ============================================================
//
// IMPORTANT:
// This is the ONLY startup section in Part 4.
// ============================================================

async function start27Pro() {

    console.log(
        "============================================================"
    );

    console.log(
        "27Pro - Advanced All-In-One Discord Bot"
    );

    console.log(
        "============================================================"
    );

    // --------------------------------------------------------
    // ENVIRONMENT
    // --------------------------------------------------------

    if (!TOKEN) {
        throw new Error(
            "TOKEN is missing from .env"
        );
    }

    if (!CLIENT_ID) {
        throw new Error(
            "CLIENT_ID is missing from .env"
        );
    }

    if (!MONGODB_URI) {
        throw new Error(
            "MONGODB_URI is missing from .env"
        );
    }

    // --------------------------------------------------------
    // MONGODB
    // --------------------------------------------------------

    console.log(
        "[27Pro] Connecting to MongoDB..."
    );

    await mongoose.connect(
        MONGODB_URI,
        {
            serverSelectionTimeoutMS:
                15000
        }
    );

    console.log(
        "[27Pro] MongoDB connected."
    );

    // --------------------------------------------------------
    // HTTP HEALTH SERVER
    // --------------------------------------------------------

    const port =
        Number(
            PORT
        ) || 5500;

    if (
        !healthServer.listening
    ) {

        await new Promise(
            (resolve, reject) => {

                const onError =
                    error => {

                        healthServer.removeListener(
                            "listening",
                            onListening
                        );

                        reject(
                            error
                        );
                    };

                const onListening =
                    () => {

                        healthServer.removeListener(
                            "error",
                            onError
                        );

                        resolve();
                    };

                healthServer.once(
                    "error",
                    onError
                );

                healthServer.once(
                    "listening",
                    onListening
                );

                healthServer.listen(
                    port,
                    "0.0.0.0"
                );
            }
        );

        console.log(
            `[27Pro] Health server listening on port ${port}`
        );
    }

    // --------------------------------------------------------
    // DISCORD
    // --------------------------------------------------------

    console.log(
        "[27Pro] Logging into Discord..."
    );

    await client.login(
        TOKEN
    );
}

// ============================================================
// READY
// ============================================================

client.once(
    "ready",
    async () => {

        try {

            console.log(
                "============================================================"
            );

            console.log(
                `[27Pro] Logged in as ${client.user.tag}`
            );

            console.log(
                `[27Pro] Guilds: ${client.guilds.cache.size}`
            );

            console.log(
                `[27Pro] Ping: ${client.ws.ping}ms`
            );

            console.log(
                "============================================================"
            );

            // ------------------------------------------------
            // PRESENCE
            // ------------------------------------------------

            client.user.setPresence({
                activities: [
                    {
                        name:
                            `${client.guilds.cache.size} servers`,
                        type:
                            ActivityType.Watching
                    }
                ],
                status:
                    "online"
            });

            // ------------------------------------------------
            // GLOBAL SLASH COMMANDS
            // ------------------------------------------------

            await registerCommands();

            console.log(
                "[27Pro] Global slash commands registered."
            );

            // ------------------------------------------------
            // DATABASE RECOVERY
            // ------------------------------------------------

            await start27ProBackgroundSystems();

            // ------------------------------------------------
            // KICK
            // ------------------------------------------------

            start27ProKickChecker();

            console.log(
                "[27Pro] KICK checker started."
            );

            console.log(
                "[27Pro] All systems are online."
            );

        } catch (error) {

            console.error(
                "[27Pro] Ready initialization error:",
                error
            );
        }
    }
);

// ============================================================
// BOOT
// ============================================================

start27Pro()
    .catch(
        async error => {

            console.error(
                "============================================================"
            );

            console.error(
                "[27Pro] FATAL STARTUP ERROR"
            );

            console.error(
                error
            );

            console.error(
                "============================================================"
            );

            try {

                if (
                    healthServer.listening
                ) {

                    healthServer.close();
                }

            } catch {}

            try {

                if (
                    mongoose.connection.readyState !==
                    0
                ) {

                    await mongoose.connection
                        .close();
                }

            } catch {}

            process.exit(
                1
            );
        }
    );
