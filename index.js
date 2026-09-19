// ============================================================
// 27PRO - ADVANCED DISCORD BOT
// ============================================================
// © 2026 iik27
// All rights reserved.
//
// Discord.js 14.25.x
// MongoDB / Mongoose
//
// IMPORTANT:
// - Multi-server
// - No GUILD_ID
// - Global slash commands
// - One startup system
// - One shutdown system
// - One health server
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
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    AttachmentBuilder
} = require("discord.js");

// ============================================================
// ENVIRONMENT
// ============================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = Number(process.env.PORT || 5500);

const BOT_NAME = "27Pro";
const CREATOR = "iik27";
const VERSION = "2.0.0";
const COPYRIGHT = `© 2026 ${CREATOR}`;

// ============================================================
// VALIDATION
// ============================================================

if (!TOKEN) {
    console.error("[FATAL] TOKEN is missing.");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("[FATAL] CLIENT_ID is missing.");
    process.exit(1);
}

if (!MONGODB_URI) {
    console.error("[FATAL] MONGODB_URI is missing.");
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
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildExpressions,
        GatewayIntentBits.AutoModerationExecution,
        GatewayIntentBits.AutoModerationConfiguration
    ],

    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.GuildMember,
        Partials.User,
        Partials.Reaction
    ]
});

// ============================================================
// GLOBAL STATE
// ============================================================

const spamTracker = new Map();
const raidTracker = new Map();
const duplicateTracker = new Map();
const giveawayTimers = new Map();
const reminderTimers = new Map();
const kickStates = new Map();

let shuttingDown = false;
let healthServer = null;
let statusTimer = null;
let kickTimer = null;

// ============================================================
// DATABASE SCHEMAS
// ============================================================

const guildConfigSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            unique: true,
            index: true
        },

        prefix: {
            type: String,
            default: "!"
        },

        security: {
            antiRaid: {
                type: Boolean,
                default: true
            },

            raidThreshold: {
                type: Number,
                default: 8
            },

            raidWindow: {
                type: Number,
                default: 10000
            },

            autoLockdown: {
                type: Boolean,
                default: false
            },

            alertChannelId: {
                type: String,
                default: null
            }
        },

        moderation: {
            dmActions: {
                type: Boolean,
                default: true
            },

            deleteCommandMessages: {
                type: Boolean,
                default: false
            }
        }
    },
    { timestamps: true }
);

const welcomeSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            unique: true,
            index: true
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
            default:
                "Welcome {user} to **{server}**! You are member #{count}. Enjoy your stay!"
        },

        title: {
            type: String,
            default: "Welcome!"
        },

        color: {
            type: Number,
            default: 0x5865f2
        },

        image: {
            type: String,
            default: null
        },

        thumbnail: {
            type: String,
            default: null
        },

        mention: {
            type: Boolean,
            default: true
        },

        dmEnabled: {
            type: Boolean,
            default: false
        },

        dmMessage: {
            type: String,
            default: "Welcome to {server}!"
        },

        goodbyeEnabled: {
            type: Boolean,
            default: false
        },

        goodbyeChannelId: {
            type: String,
            default: null
        },

        goodbyeMessage: {
            type: String,
            default:
                "Goodbye {username}. We hope to see you again!"
        }
    },
    { timestamps: true }
);

const logSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            unique: true,
            index: true
        },

        enabled: {
            type: Boolean,
            default: false
        },

        channels: {
            general: { type: String, default: null },
            member: { type: String, default: null },
            message: { type: String, default: null },
            moderation: { type: String, default: null },
            role: { type: String, default: null },
            channel: { type: String, default: null },
            server: { type: String, default: null },
            bot: { type: String, default: null },
            voice: { type: String, default: null },
            automod: { type: String, default: null },
            ticket: { type: String, default: null },
            security: { type: String, default: null },
            giveaway: { type: String, default: null }
        }
    },
    { timestamps: true }
);

const warningSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            index: true
        },

        userId: {
            type: String,
            index: true
        },

        moderatorId: String,
        reason: String,
        caseId: Number
    },
    { timestamps: true }
);

const modCaseSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            index: true
        },

        caseId: Number,

        type: String,

        userId: String,

        moderatorId: String,

        reason: String,

        duration: Number,

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    { timestamps: true }
);

modCaseSchema.index(
    { guildId: 1, caseId: 1 },
    { unique: true }
);

const autoModSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            unique: true,
            index: true
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

        antiCaps: {
            type: Boolean,
            default: false
        },

        antiMentionSpam: {
            type: Boolean,
            default: true
        },

        antiDuplicate: {
            type: Boolean,
            default: false
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
            default: "timeout"
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
    },
    { timestamps: true }
);

const ticketConfigSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            unique: true,
            index: true
        },

        enabled: {
            type: Boolean,
            default: false
        },

        categoryId: {
            type: String,
            default: null
        },

        closedCategoryId: {
            type: String,
            default: null
        },

        staffRoleId: {
            type: String,
            default: null
        },

        mentionRoleId: {
            type: String,
            default: null
        },

        transcriptChannelId: {
            type: String,
            default: null
        },

        logChannelId: {
            type: String,
            default: null
        },

        panelChannelId: {
            type: String,
            default: null
        },

        panelMessageId: {
            type: String,
            default: null
        },

        ticketCounter: {
            type: Number,
            default: 0
        },

        autoCloseHours: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            index: true
        },

        channelId: {
            type: String,
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

        closedBy: {
            type: String,
            default: null
        },

        closedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

const giveawaySchema = new mongoose.Schema(
    {
        guildId: String,
        channelId: String,
        messageId: String,
        hostId: String,
        prize: String,
        winners: Number,
        endAt: Date,
        ended: {
            type: Boolean,
            default: false
        },
        participants: {
            type: [String],
            default: []
        }
    },
    { timestamps: true }
);

const levelSchema = new mongoose.Schema(
    {
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
    },
    { timestamps: true }
);

levelSchema.index(
    { guildId: 1, userId: 1 },
    { unique: true }
);

const reminderSchema = new mongoose.Schema(
    {
        guildId: String,
        userId: String,
        channelId: String,
        message: String,
        remindAt: Date,
        sent: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

const rolePanelSchema = new mongoose.Schema(
    {
        guildId: String,
        channelId: String,
        messageId: String,
        roleId: String,
        label: String,
        emoji: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

const rulesSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            unique: true,
            index: true
        },

        enabled: {
            type: Boolean,
            default: false
        },

        channelId: {
            type: String,
            default: null
        },

        messageId: {
            type: String,
            default: null
        },

        sections: {
            type: Map,
            of: String,
            default: {}
        }
    },
    { timestamps: true }
);

const kickConfigSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            unique: true,
            index: true
        },

        enabled: {
            type: Boolean,
            default: false
        },

        username: {
            type: String,
            default: null
        },

        channelId: {
            type: String,
            default: null
        },

        mentionRoleId: {
            type: String,
            default: null
        },

        everyone: {
            type: Boolean,
            default: false
        },

        lastLive: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

// ============================================================
// MODELS
// ============================================================

const GuildConfig =
    mongoose.models.GuildConfig ||
    mongoose.model("GuildConfig", guildConfigSchema);

const WelcomeConfig =
    mongoose.models.WelcomeConfig ||
    mongoose.model("WelcomeConfig", welcomeSchema);

const LogConfig =
    mongoose.models.LogConfig ||
    mongoose.model("LogConfig", logSchema);

const Warning =
    mongoose.models.Warning ||
    mongoose.model("Warning", warningSchema);

const ModCase =
    mongoose.models.ModCase ||
    mongoose.model("ModCase", modCaseSchema);

const AutoMod =
    mongoose.models.AutoMod ||
    mongoose.model("AutoMod", autoModSchema);

const TicketConfig =
    mongoose.models.TicketConfig ||
    mongoose.model("TicketConfig", ticketConfigSchema);

const Ticket =
    mongoose.models.Ticket ||
    mongoose.model("Ticket", ticketSchema);

const Giveaway =
    mongoose.models.Giveaway ||
    mongoose.model("Giveaway", giveawaySchema);

const Level =
    mongoose.models.Level ||
    mongoose.model("Level", levelSchema);

const Reminder =
    mongoose.models.Reminder ||
    mongoose.model("Reminder", reminderSchema);

const RolePanel =
    mongoose.models.RolePanel ||
    mongoose.model("RolePanel", rolePanelSchema);

const RulesConfig =
    mongoose.models.RulesConfig ||
    mongoose.model("RulesConfig", rulesSchema);

const KickConfig =
    mongoose.models.KickConfig ||
    mongoose.model("KickConfig", kickConfigSchema);

// ============================================================
// EMBEDS
// ============================================================

function baseEmbed(color = 0x5865f2) {
    return new EmbedBuilder()
        .setColor(color)
        .setFooter({
            text: `${BOT_NAME} • Made by ${CREATOR}`
        })
        .setTimestamp();
}

function successEmbed(title, description) {
    return baseEmbed(0x57f287)
        .setTitle(`✅ ${title}`)
        .setDescription(description);
}

function errorEmbed(description) {
    return baseEmbed(0xed4245)
        .setTitle("❌ Error")
        .setDescription(description);
}

function infoEmbed(title, description) {
    return baseEmbed(0x5865f2)
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description);
}

// ============================================================
// HELPERS
// ============================================================

function truncate(text, max = 1024) {
    if (!text) return "";
    text = String(text);

    if (text.length <= max) return text;

    return text.slice(0, max - 3) + "...";
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
    if (!message) return "";

    return message
        .replaceAll("{user}", `<@${member.id}>`)
        .replaceAll("{username}", member.user.username)
        .replaceAll("{server}", member.guild.name)
        .replaceAll("{count}", String(member.guild.memberCount))
        .replaceAll("{id}", member.id);
}

function randomInt(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}

function safeUser(user) {
    return user ? `<@${user.id}>` : "Unknown";
}

async function safeReply(interaction, payload) {
    try {
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(payload);
        }

        return await interaction.reply(payload);
    } catch (error) {
        console.error("[SAFE REPLY]", error.message);
    }
}

function hasPermission(member, permission) {
    return Boolean(
        member?.permissions?.has(permission)
    );
}

function getBotMember(guild) {
    return guild.members.me;
}

function botCanModerate(member) {
    const bot = getBotMember(member.guild);

    if (!bot) return false;

    return bot.roles.highest.comparePositionTo(
        member.roles.highest
    ) > 0;
}

function moderatorCanAct(interaction, member) {
    if (!member) return false;

    if (member.id === interaction.guild.ownerId) {
        return true;
    }

    if (
        interaction.member.roles.highest.comparePositionTo(
            member.roles.highest
        ) <= 0
    ) {
        return false;
    }

    return true;
}

// ============================================================
// DATABASE GETTERS
// ============================================================

async function getGuildConfig(guildId) {
    return GuildConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        {
            new: true,
            upsert: true
        }
    );
}

async function getWelcomeConfig(guildId) {
    return WelcomeConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        {
            new: true,
            upsert: true
        }
    );
}

async function getLogConfig(guildId) {
    return LogConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        {
            new: true,
            upsert: true
        }
    );
}

async function getAutoModConfig(guildId) {
    return AutoMod.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        {
            new: true,
            upsert: true
        }
    );
}

async function getTicketConfig(guildId) {
    return TicketConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        {
            new: true,
            upsert: true
        }
    );
}

async function getRulesConfig(guildId) {
    return RulesConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        {
            new: true,
            upsert: true
        }
    );
}

async function getKickConfig(guildId) {
    return KickConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        {
            new: true,
            upsert: true
        }
    );
}

// ============================================================
// LOGGING
// ============================================================

const LOG_TYPES = [
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
    "security",
    "giveaway"
];

async function sendLog(
    guild,
    type,
    title,
    description,
    color = 0x5865f2,
    extraFields = []
) {
    try {
        if (!guild) return;

        const config = await getLogConfig(guild.id);

        if (!config.enabled) return;

        let channelId =
            config.channels?.[type];

        if (!channelId) {
            channelId = config.channels?.general;
        }

        if (!channelId) return;

        const channel =
            guild.channels.cache.get(channelId);

        if (
            !channel ||
            !channel.isTextBased()
        ) {
            return;
        }

        const embed = baseEmbed(color)
            .setTitle(title)
            .setDescription(
                truncate(description || "No details.", 4096)
            );

        if (extraFields.length) {
            embed.addFields(extraFields);
        }

        await channel.send({
            embeds: [embed]
        });
    } catch (error) {
        console.error("[LOG ERROR]", error.message);
    }
}

// ============================================================
// CASE SYSTEM
// ============================================================

async function nextCaseId(guildId) {
    const latest = await ModCase
        .findOne({ guildId })
        .sort({ caseId: -1 });

    return latest
        ? latest.caseId + 1
        : 1;
}

async function createCase(
    guild,
    type,
    userId,
    moderatorId,
    reason = "No reason provided",
    duration = null,
    metadata = {}
) {
    const caseId =
        await nextCaseId(guild.id);

    const record = await ModCase.create({
        guildId: guild.id,
        caseId,
        type,
        userId,
        moderatorId,
        reason,
        duration,
        metadata
    });

    await sendLog(
        guild,
        "moderation",
        `Case #${caseId} • ${type.toUpperCase()}`,
        `**User:** <@${userId}>\n**Moderator:** <@${moderatorId}>\n**Reason:** ${reason}`,
        0xed4245,
        [
            {
                name: "Case",
                value: `#${caseId}`,
                inline: true
            },
            {
                name: "Action",
                value: type,
                inline: true
            }
        ]
    );

    return record;
}

// ============================================================
// COMMAND DEFINITIONS
// ============================================================

const commands = [];

// ------------------------------------------------------------
// INFORMATION
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show all 27Pro features"),

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
        .setDescription("Show member statistics"),

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

    new SlashCommandBuilder()
        .setName("roleinfo")
        .setDescription("Show role information")
        .addRoleOption(o =>
            o.setName("role")
                .setDescription("Role")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("channelinfo")
        .setDescription("Show channel information")
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Channel")
                .setRequired(false)
        )
);

// ------------------------------------------------------------
// MODERATION
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers.toString()
        )
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
        .setName("warnings")
        .setDescription("View or clear warnings")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers.toString()
        )
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
        .setDefaultMemberPermissions(
            PermissionFlagsBits.KickMembers.toString()
        )
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
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers.toString()
        )
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
        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers.toString()
        )
        .addStringOption(o =>
            o.setName("userid")
                .setDescription("User ID")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Timeout a member")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers.toString()
        )
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("minutes")
                .setDescription("Duration in minutes")
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
        .setDescription("Remove a timeout")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers.toString()
        )
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("nick")
        .setDescription("Change a member nickname")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageNicknames.toString()
        )
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("nickname")
                .setDescription("New nickname, empty to reset")
                .setMaxLength(32)
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Delete messages")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages.toString()
        )
        .addIntegerOption(o =>
            o.setName("amount")
                .setDescription("1-100")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Set channel slowmode")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels.toString()
        )
        .addIntegerOption(o =>
            o.setName("seconds")
                .setDescription("0-21600")
                .setMinValue(0)
                .setMaxValue(21600)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Lock the current channel")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels.toString()
        ),

    new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlock the current channel")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels.toString()
        ),

    new SlashCommandBuilder()
        .setName("case")
        .setDescription("View a moderation case")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers.toString()
        )
        .addIntegerOption(o =>
            o.setName("id")
                .setDescription("Case number")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("cases")
        .setDescription("View a user's moderation cases")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers.toString()
        )
        .addUserOption(o =>
            o.setName("user")
                .setDescription("Member")
                .setRequired(true)
        )
);

// ------------------------------------------------------------
// ROLE MANAGEMENT
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("role")
        .setDescription("Manage roles")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles.toString()
        )
        .addSubcommand(s =>
            s.setName("add")
                .setDescription("Add a role")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("Member")
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
                        .setDescription("Member")
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
);

// ------------------------------------------------------------
// WELCOME
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("welcome")
        .setDescription("Configure welcome system")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
        .addSubcommand(s =>
            s.setName("setup")
                .setDescription("Enable welcome")
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
                .setDescription("Show welcome configuration")
        )
        .addSubcommand(s =>
            s.setName("test")
                .setDescription("Test welcome")
        )
        .addSubcommand(s =>
            s.setName("disable")
                .setDescription("Disable welcome")
        )
);

// ------------------------------------------------------------
// LOGS
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("logs")
        .setDescription("Configure advanced logging")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
        .addSubcommand(s =>
            s.setName("on")
                .setDescription("Enable logging")
        )
        .addSubcommand(s =>
            s.setName("off")
                .setDescription("Disable logging")
        )
        .addSubcommand(s =>
            s.setName("setup")
                .setDescription("Configure a log channel")
                .addStringOption(o =>
                    o.setName("type")
                        .setDescription("Log type")
                        .setRequired(true)
                        .addChoices(
                            ...LOG_TYPES.map(type => ({
                                name: type,
                                value: type
                            }))
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
                .setDescription("View log configuration")
        )
        .addSubcommand(s =>
            s.setName("test")
                .setDescription("Test logging")
        )
        .addSubcommand(s =>
            s.setName("disable")
                .setDescription("Disable all logging")
        )
);

// ------------------------------------------------------------
// AUTOMOD
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("automod")
        .setDescription("Configure AutoMod")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
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
                .setDescription("View AutoMod configuration")
        )
        .addSubcommand(s =>
            s.setName("punishment")
                .setDescription("Set AutoMod punishment")
                .addStringOption(o =>
                    o.setName("type")
                        .setDescription("Punishment")
                        .setRequired(true)
                        .addChoices(
                            { name: "Delete", value: "delete" },
                            { name: "Warn", value: "warn" },
                            { name: "Timeout", value: "timeout" }
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
);

// ------------------------------------------------------------
// TICKETS
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Manage ticket system")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
        .addSubcommand(s =>
            s.setName("setup")
                .setDescription("Configure tickets")
                .addChannelOption(o =>
                    o.setName("category")
                        .setDescription("Open ticket category")
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
            s.setName("delete")
                .setDescription("Delete current ticket")
        )
        .addSubcommand(s =>
            s.setName("add")
                .setDescription("Add member to ticket")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("Member")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("remove")
                .setDescription("Remove member from ticket")
                .addUserOption(o =>
                    o.setName("user")
                        .setDescription("Member")
                        .setRequired(true)
                )
        )
);

// ------------------------------------------------------------
// RULES
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("rules")
        .setDescription("Manage interactive rules")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
        .addSubcommand(s =>
            s.setName("setup")
                .setDescription("Create rules panel")
                .addChannelOption(o =>
                    o.setName("channel")
                        .setDescription("Rules channel")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("set")
                .setDescription("Set a rules section")
                .addStringOption(o =>
                    o.setName("section")
                        .setDescription("Section")
                        .setRequired(true)
                        .addChoices(
                            { name: "General", value: "general" },
                            { name: "Chat", value: "chat" },
                            { name: "Gaming / RP", value: "gaming" },
                            { name: "Punishments", value: "punishments" },
                            { name: "Privacy & Security", value: "privacy" },
                            { name: "Staff", value: "staff" }
                        )
                )
                .addStringOption(o =>
                    o.setName("text")
                        .setDescription("Rules text")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("publish")
                .setDescription("Publish rules panel")
        )
        .addSubcommand(s =>
            s.setName("preview")
                .setDescription("Preview rules")
        )
);

// ------------------------------------------------------------
// GIVEAWAYS
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Manage giveaways")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
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
                        .setMaxValue(50)
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
        )
);

// ------------------------------------------------------------
// LEVELING
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Show your rank")
        .addUserOption(o =>
            o.setName("user")
                .setDescription("User")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Show server leaderboard")
);

// ------------------------------------------------------------
// ROLE PANEL
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("rolepanel")
        .setDescription("Create a role button")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles.toString()
        )
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
        )
);

// ------------------------------------------------------------
// UTILITY
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("say")
        .setDescription("Make the bot send a message")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages.toString()
        )
        .addStringOption(o =>
            o.setName("message")
                .setDescription("Message")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Send an announcement")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
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
        .setDescription("Create a yes/no poll")
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
                .setMaxValue(525600)
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("message")
                .setDescription("Reminder")
                .setRequired(true)
        )
);

// ------------------------------------------------------------
// FUN
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Flip a coin"),

    new SlashCommandBuilder()
        .setName("roll")
        .setDescription("Roll dice")
        .addIntegerOption(o =>
            o.setName("sides")
                .setDescription("Number of sides")
                .setMinValue(2)
                .setMaxValue(1000000)
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
        )
);

// ------------------------------------------------------------
// STREAMING
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("live")
        .setDescription("Configure KICK live alerts")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild.toString()
        )
        .addSubcommand(s =>
            s.setName("setup")
                .setDescription("Configure KICK alerts")
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
                .setDescription("Disable KICK alerts")
        )
        .addSubcommand(s =>
            s.setName("config")
                .setDescription("View KICK configuration")
        ),

    new SlashCommandBuilder()
        .setName("livecheck")
        .setDescription("Check KICK live status")
);

// ------------------------------------------------------------
// SECURITY
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("security")
        .setDescription("Configure server security")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator.toString()
        )
        .addSubcommand(s =>
            s.setName("config")
                .setDescription("Show security configuration")
        )
        .addSubcommand(s =>
            s.setName("raid")
                .setDescription("Configure anti-raid")
                .addBooleanOption(o =>
                    o.setName("enabled")
                        .setDescription("Enable anti-raid")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("lockdown")
                .setDescription("Lock the server")
        )
        .addSubcommand(s =>
            s.setName("unlock")
                .setDescription("Unlock the server")
        )
);

// ------------------------------------------------------------
// HEALTH
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("health")
        .setDescription("Show bot health")
);

// ============================================================
// EXPORT JSON
// ============================================================

const commandJSON = commands.map(
    command => command.toJSON()
);


// ============================================================
// GENERAL MEMBER HELPERS
// ============================================================

function memberHighestRole(member) {
    if (!member) return null;

    return member.roles.highest;
}

function canBotManageRole(guild, role) {
    const bot = guild.members.me;

    if (!bot) return false;
    if (role.managed) return false;

    return bot.roles.highest.comparePositionTo(role) > 0;
}

function canBotManageMember(guild, member) {
    const bot = guild.members.me;

    if (!bot || !member) return false;

    if (member.id === guild.ownerId) {
        return false;
    }

    return bot.roles.highest.comparePositionTo(
        member.roles.highest
    ) > 0;
}

// ============================================================
// MODERATION DM
// ============================================================

async function sendModerationDM(
    member,
    action,
    reason,
    duration = null
) {
    try {
        const config =
            await getGuildConfig(member.guild.id);

        if (!config.moderation.dmActions) {
            return;
        }

        const embed = baseEmbed(0xed4245)
            .setTitle(`Moderation Action • ${action}`)
            .addFields(
                {
                    name: "Server",
                    value: member.guild.name,
                    inline: true
                },
                {
                    name: "Action",
                    value: action,
                    inline: true
                },
                {
                    name: "Reason",
                    value: truncate(
                        reason || "No reason provided",
                        1024
                    ),
                    inline: false
                }
            );

        if (duration) {
            embed.addFields({
                name: "Duration",
                value: formatDuration(duration),
                inline: true
            });
        }

        await member.send({
            embeds: [embed]
        });
    } catch {
        // DMs may be disabled.
    }
}

// ============================================================
// MODERATION ACTION
// ============================================================

async function punishMember(
    interaction,
    member,
    action,
    reason,
    durationMinutes = null
) {
    if (!member) {
        throw new Error("Member not found.");
    }

    if (member.id === interaction.user.id) {
        throw new Error("You cannot moderate yourself.");
    }

    if (member.id === client.user.id) {
        throw new Error("I cannot moderate myself.");
    }

    if (!moderatorCanAct(interaction, member)) {
        throw new Error(
            "You cannot moderate a member with an equal or higher role."
        );
    }

    if (!canBotManageMember(
        interaction.guild,
        member
    )) {
        throw new Error(
            "My highest role must be above the target member."
        );
    }

    const bot = interaction.guild.members.me;

    if (!bot) {
        throw new Error("I could not resolve my server member.");
    }

    const durationMs =
        durationMinutes
            ? durationMinutes * 60 * 1000
            : null;

    await sendModerationDM(
        member,
        action,
        reason,
        durationMs
    );

    if (action === "kick") {
        await member.kick(reason);
    }

    if (action === "ban") {
        await member.ban({
            reason,
            deleteMessageSeconds: 0
        });
    }

    if (action === "timeout") {
        await member.timeout(
            durationMs,
            reason
        );
    }

    if (action === "untimeout") {
        await member.timeout(
            null,
            reason
        );
    }

    return true;
}

// ============================================================
// WARNING SYSTEM
// ============================================================

async function addWarning(
    guild,
    userId,
    moderatorId,
    reason
) {
    const caseId =
        await nextCaseId(guild.id);

    const warning =
        await Warning.create({
            guildId: guild.id,
            userId,
            moderatorId,
            reason,
            caseId
        });

    await ModCase.create({
        guildId: guild.id,
        caseId,
        type: "warn",
        userId,
        moderatorId,
        reason
    });

    await sendLog(
        guild,
        "moderation",
        `⚠️ Warning • Case #${caseId}`,
        `**User:** <@${userId}>\n**Moderator:** <@${moderatorId}>\n**Reason:** ${reason}`,
        0xfee75c
    );

    return warning;
}

// ============================================================
// LOCKDOWN
// ============================================================

async function lockdownGuild(guild) {
    const bot = guild.members.me;

    if (!bot) {
        throw new Error("Bot member unavailable.");
    }

    const channels =
        guild.channels.cache.filter(
            channel =>
                channel.type === ChannelType.GuildText
        );

    let changed = 0;

    for (const channel of channels.values()) {
        try {
            await channel.permissionOverwrites.edit(
                guild.roles.everyone,
                {
                    SendMessages: false
                },
                {
                    reason: "27Pro security lockdown"
                }
            );

            changed++;
        } catch (error) {
            console.error(
                `[LOCKDOWN] ${channel.id}`,
                error.message
            );
        }
    }

    await sendLog(
        guild,
        "security",
        "🔒 Server Lockdown",
        `Security lockdown activated.\nChannels modified: **${changed}**`,
        0xed4245
    );

    return changed;
}

async function unlockGuild(guild) {
    const channels =
        guild.channels.cache.filter(
            channel =>
                channel.type === ChannelType.GuildText
        );

    let changed = 0;

    for (const channel of channels.values()) {
        try {
            await channel.permissionOverwrites.edit(
                guild.roles.everyone,
                {
                    SendMessages: null
                },
                {
                    reason: "27Pro security unlock"
                }
            );

            changed++;
        } catch (error) {
            console.error(
                `[UNLOCK] ${channel.id}`,
                error.message
            );
        }
    }

    await sendLog(
        guild,
        "security",
        "🔓 Server Unlocked",
        `Security lockdown removed.\nChannels modified: **${changed}**`,
        0x57f287
    );

    return changed;
}

// ============================================================
// RAID DETECTION
// ============================================================

async function registerRaidJoin(member) {
    const guildId = member.guild.id;

    let entries =
        raidTracker.get(guildId);

    if (!entries) {
        entries = [];
        raidTracker.set(
            guildId,
            entries
        );
    }

    const now = Date.now();

    entries.push(now);

    const config =
        await getGuildConfig(guildId);

    const window =
        Number(
            config.security.raidWindow || 10000
        );

    const threshold =
        Number(
            config.security.raidThreshold || 8
        );

    const valid =
        entries.filter(
            timestamp =>
                now - timestamp <= window
        );

    raidTracker.set(
        guildId,
        valid
    );

    if (
        config.security.antiRaid &&
        valid.length >= threshold
    ) {
        await sendLog(
            member.guild,
            "security",
            "🚨 Possible Raid Detected",
            `**${valid.length}** members joined within **${window / 1000}s**.`,
            0xed4245
        );

        const alertChannelId =
            config.security.alertChannelId;

        if (alertChannelId) {
            const channel =
                member.guild.channels.cache.get(
                    alertChannelId
                );

            if (
                channel &&
                channel.isTextBased()
            ) {
                await channel.send({
                    embeds: [
                        baseEmbed(0xed4245)
                            .setTitle(
                                "🚨 Security Alert"
                            )
                            .setDescription(
                                `Rapid member joins detected.\n\n**${valid.length} members** joined within **${window / 1000} seconds**.`
                            )
                    ]
                }).catch(() => {});
            }
        }

        if (config.security.autoLockdown) {
            await lockdownGuild(
                member.guild
            ).catch(() => {});
        }

        raidTracker.set(
            guildId,
            []
        );
    }
}

// ============================================================
// AUTOMOD HELPERS
// ============================================================

function containsInvite(text) {
    if (!text) return false;

    return /(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\//i
        .test(text);
}

function containsUrl(text) {
    if (!text) return false;

    return /https?:\/\/[^\s]+/i.test(text);
}

function isCapsMessage(
    content,
    percentage = 70
) {
    if (!content) return false;

    const letters =
        content.match(/[A-Za-z]/g);

    if (!letters || letters.length < 8) {
        return false;
    }

    const uppercase =
        content.match(/[A-Z]/g);

    if (!uppercase) {
        return false;
    }

    return (
        uppercase.length /
        letters.length *
        100
    ) >= percentage;
}

function normalizeMessage(content) {
    return String(content || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function containsBlockedWord(
    content,
    words
) {
    const normalized =
        normalizeMessage(content);

    return words.some(
        word =>
            word &&
            normalized.includes(
                normalizeMessage(word)
            )
    );
}

function shouldIgnoreAutoMod(
    message,
    config
) {
    if (!message.guild) {
        return true;
    }

    if (
        config.ignoredChannels
            ?.includes(message.channel.id)
    ) {
        return true;
    }

    if (
        message.member &&
        config.ignoredRoles?.some(
            roleId =>
                message.member.roles.cache.has(
                    roleId
                )
        )
    ) {
        return true;
    }

    if (
        message.member?.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    return false;
}

// ============================================================
// AUTOMOD ACTION
// ============================================================

async function performAutoModAction(
    message,
    reason
) {
    try {
        const config =
            await getAutoModConfig(
                message.guild.id
            );

        try {
            await message.delete();
        } catch {}

        await sendLog(
            message.guild,
            "automod",
            "🛡️ AutoMod Action",
            `**User:** <@${message.author.id}>\n**Channel:** <#${message.channel.id}>\n**Reason:** ${reason}`,
            0xed4245
        );

        if (
            config.punishment === "delete"
        ) {
            return;
        }

        if (
            config.punishment === "warn"
        ) {
            await addWarning(
                message.guild,
                message.author.id,
                client.user.id,
                `AutoMod: ${reason}`
            );

            return;
        }

        if (
            config.punishment === "timeout"
        ) {
            const member =
                message.member;

            if (
                member &&
                canBotManageMember(
                    message.guild,
                    member
                )
            ) {
                await member.timeout(
                    config.timeoutMinutes *
                        60 *
                        1000,
                    `AutoMod: ${reason}`
                );
            }
        }
    } catch (error) {
        console.error(
            "[AUTOMOD ACTION]",
            error
        );
    }
}

// ============================================================
// AUTOMOD ENGINE
// ============================================================

async function runAutoMod(message) {
    if (
        !message.guild ||
        message.author.bot ||
        !message.content
    ) {
        return false;
    }

    const config =
        await getAutoModConfig(
            message.guild.id
        );

    if (!config.enabled) {
        return false;
    }

    if (
        shouldIgnoreAutoMod(
            message,
            config
        )
    ) {
        return false;
    }

    const content =
        message.content;

    if (
        config.antiInvite &&
        containsInvite(content)
    ) {
        await performAutoModAction(
            message,
            "Discord invite detected"
        );

        return true;
    }

    if (
        config.antiLinks &&
        containsUrl(content)
    ) {
        await performAutoModAction(
            message,
            "Link detected"
        );

        return true;
    }

    if (
        config.antiCaps &&
        isCapsMessage(
            content,
            config.capsPercentage
        )
    ) {
        await performAutoModAction(
            message,
            "Excessive capital letters"
        );

        return true;
    }

    if (
        config.antiMentionSpam &&
        message.mentions.users.size >=
            config.maxMentions
    ) {
        await performAutoModAction(
            message,
            "Mention spam"
        );

        return true;
    }

    if (
        config.blockedWords?.length &&
        containsBlockedWord(
            content,
            config.blockedWords
        )
    ) {
        await performAutoModAction(
            message,
            "Blocked word detected"
        );

        return true;
    }

    if (config.antiDuplicate) {
        const key =
            `${message.guild.id}:${message.author.id}`;

        const normalized =
            normalizeMessage(content);

        const previous =
            duplicateTracker.get(key);

        if (
            previous &&
            previous === normalized
        ) {
            await performAutoModAction(
                message,
                "Duplicate message"
            );

            duplicateTracker.delete(key);

            return true;
        }

        duplicateTracker.set(
            key,
            normalized
        );

        setTimeout(() => {
            if (
                duplicateTracker.get(key) ===
                normalized
            ) {
                duplicateTracker.delete(key);
            }
        }, 10000);
    }

    if (config.antiSpam) {
        const key =
            `${message.guild.id}:${message.author.id}`;

        let entries =
            spamTracker.get(key);

        if (!entries) {
            entries = [];
            spamTracker.set(
                key,
                entries
            );
        }

        const now = Date.now();

        entries.push(now);

        const valid =
            entries.filter(
                timestamp =>
                    now - timestamp <=
                    config.spamWindow
            );

        spamTracker.set(
            key,
            valid
        );

        if (
            valid.length >=
            config.maxMessages
        ) {
            spamTracker.set(
                key,
                []
            );

            await performAutoModAction(
                message,
                "Message spam"
            );

            return true;
        }
    }

    return false;
}

// ============================================================
// TICKET HELPERS
// ============================================================

async function getOpenTicket(
    guildId,
    userId
) {
    return Ticket.findOne({
        guildId,
        userId,
        status: "open"
    });
}

function ticketName(number) {
    return `ticket-${String(number).padStart(4, "0")}`;
}

function ticketControlRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_close")
                .setLabel("Close")
                .setEmoji("🔒")
                .setStyle(
                    ButtonStyle.Danger
                ),

            new ButtonBuilder()
                .setCustomId("ticket_claim")
                .setLabel("Claim")
                .setEmoji("🙋")
                .setStyle(
                    ButtonStyle.Primary
                ),

            new ButtonBuilder()
                .setCustomId("ticket_delete")
                .setLabel("Delete")
                .setEmoji("🗑️")
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
}

function ticketReopenRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_reopen")
                .setLabel("Reopen")
                .setEmoji("🔓")
                .setStyle(
                    ButtonStyle.Success
                ),

            new ButtonBuilder()
                .setCustomId("ticket_delete")
                .setLabel("Delete")
                .setEmoji("🗑️")
                .setStyle(
                    ButtonStyle.Danger
                )
        );
}

async function buildTicketTranscript(
    channel
) {
    try {
        const messages = [];

        let lastId;

        while (true) {
            const options = {
                limit: 100
            };

            if (lastId) {
                options.before = lastId;
            }

            const batch =
                await channel.messages.fetch(
                    options
                );

            if (!batch.size) {
                break;
            }

            messages.push(
                ...batch.values()
            );

            lastId =
                batch.last().id;

            if (
                batch.size < 100 ||
                messages.length >= 5000
            ) {
                break;
            }
        }

        messages.reverse();

        const lines = [];

        lines.push(
            `27Pro Ticket Transcript`,
            `Server: ${channel.guild.name}`,
            `Channel: ${channel.name}`,
            `Generated: ${new Date().toISOString()}`,
            "",
            "============================================================",
            ""
        );

        for (const message of messages) {
            const timestamp =
                message.createdAt
                    ?.toISOString() ||
                "Unknown";

            const author =
                `${message.author?.tag || "Unknown"} (${message.author?.id || "unknown"})`;

            const content =
                message.content ||
                "[No text content]";

            lines.push(
                `[${timestamp}] ${author}: ${content}`
            );

            if (message.attachments?.size) {
                for (
                    const attachment
                    of message.attachments.values()
                ) {
                    lines.push(
                        `Attachment: ${attachment.url}`
                    );
                }
            }
        }

        return lines.join("\n");
    } catch (error) {
        console.error(
            "[TRANSCRIPT]",
            error
        );

        return "Unable to generate transcript.";
    }
}

async function sendTicketTranscript(
    ticket,
    channel
) {
    try {
        const config =
            await getTicketConfig(
                channel.guild.id
            );

        if (
            !config.transcriptChannelId
        ) {
            return;
        }

        const transcriptChannel =
            channel.guild.channels.cache.get(
                config.transcriptChannelId
            );

        if (
            !transcriptChannel ||
            !transcriptChannel.isTextBased()
        ) {
            return;
        }

        const transcript =
            await buildTicketTranscript(
                channel
            );

        const attachment =
            new AttachmentBuilder(
                Buffer.from(
                    transcript,
                    "utf8"
                ),
                {
                    name:
                        `${channel.name}-transcript.txt`
                }
            );

        await transcriptChannel.send({
            content:
                `📄 Ticket transcript: **${channel.name}**`,
            files: [attachment]
        });
    } catch (error) {
        console.error(
            "[TICKET TRANSCRIPT]",
            error
        );
    }
}

async function createTicket(
    guild,
    user,
    config
) {
    const existing =
        await getOpenTicket(
            guild.id,
            user.id
        );

    if (existing) {
        return {
            existing: true,
            ticket: existing,
            channel:
                guild.channels.cache.get(
                    existing.channelId
                )
        };
    }

    const nextNumber =
        Number(config.ticketCounter || 0) + 1;

    config.ticketCounter =
        nextNumber;

    await config.save();

    const permissionOverwrites = [
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

    if (config.staffRoleId) {
        permissionOverwrites.push({
            id: config.staffRoleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles
            ]
        });
    }

    const channel =
        await guild.channels.create({
            name: ticketName(nextNumber),
            type: ChannelType.GuildText,
            parent:
                config.categoryId || null,
            permissionOverwrites,
            reason:
                `27Pro ticket #${nextNumber}`
        });

    const ticket =
        await Ticket.create({
            guildId: guild.id,
            channelId: channel.id,
            userId: user.id,
            number: nextNumber,
            status: "open"
        });

    const embed =
        baseEmbed(0x5865f2)
            .setTitle(
                `🎫 Support Ticket #${nextNumber}`
            )
            .setDescription(
                [
                    `Welcome <@${user.id}>.`,
                    "",
                    "Please describe your issue clearly.",
                    "A member of staff will assist you shortly.",
                    "",
                    "Use the buttons below to manage this ticket."
                ].join("\n")
            )
            .addFields({
                name: "Opened by",
                value: `<@${user.id}>`,
                inline: true
            });

    const content =
        config.mentionRoleId
            ? `<@&${config.mentionRoleId}> <@${user.id}>`
            : `<@${user.id}>`;

    await channel.send({
        content,
        embeds: [embed],
        components: [
            ticketControlRow()
        ]
    });

    await sendLog(
        guild,
        "ticket",
        "🎫 Ticket Created",
        `**Ticket:** ${channel}\n**User:** <@${user.id}>\n**Number:** #${nextNumber}`,
        0x57f287
    );

    return {
        existing: false,
        ticket,
        channel
    };
}

async function closeTicket(
    ticket,
    channel,
    userId
) {
    if (!ticket) {
        throw new Error(
            "This channel is not a ticket."
        );
    }

    if (ticket.status === "closed") {
        return;
    }

    await sendTicketTranscript(
        ticket,
        channel
    );

    const config =
        await getTicketConfig(
            channel.guild.id
        );

    ticket.status = "closed";
    ticket.closedBy = userId;
    ticket.closedAt = new Date();

    await ticket.save();

    if (config.closedCategoryId) {
        await channel.setParent(
            config.closedCategoryId,
            {
                lockPermissions: false
            }
        ).catch(() => {});
    }

    await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone,
        {
            ViewChannel: false
        }
    ).catch(() => {});

    await channel.permissionOverwrites.edit(
        ticket.userId,
        {
            ViewChannel: true,
            SendMessages: false,
            ReadMessageHistory: true
        }
    ).catch(() => {});

    if (config.staffRoleId) {
        await channel.permissionOverwrites.edit(
            config.staffRoleId,
            {
                ViewChannel: true,
                SendMessages: false,
                ReadMessageHistory: true
            }
        ).catch(() => {});
    }

    await channel.send({
        embeds: [
            baseEmbed(0xed4245)
                .setTitle("🔒 Ticket Closed")
                .setDescription(
                    `Closed by <@${userId}>.\n\nThis ticket has been archived.`
                )
        ],
        components: [
            ticketReopenRow()
        ]
    });

    await sendLog(
        channel.guild,
        "ticket",
        "🔒 Ticket Closed",
        `**Ticket:** ${channel}\n**Closed by:** <@${userId}>`,
        0xed4245
    );
}

async function reopenTicket(
    ticket,
    channel,
    userId
) {
    if (!ticket) {
        throw new Error(
            "This channel is not a ticket."
        );
    }

    if (ticket.status === "open") {
        return;
    }

    const config =
        await getTicketConfig(
            channel.guild.id
        );

    ticket.status = "open";
    ticket.closedBy = null;
    ticket.closedAt = null;

    await ticket.save();

    if (config.categoryId) {
        await channel.setParent(
            config.categoryId,
            {
                lockPermissions: false
            }
        ).catch(() => {});
    }

    await channel.permissionOverwrites.edit(
        ticket.userId,
        {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true
        }
    ).catch(() => {});

    if (config.staffRoleId) {
        await channel.permissionOverwrites.edit(
            config.staffRoleId,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true
            }
        ).catch(() => {});
    }

    await channel.send({
        embeds: [
            baseEmbed(0x57f287)
                .setTitle("🔓 Ticket Reopened")
                .setDescription(
                    `Reopened by <@${userId}>.`
                )
        ],
        components: [
            ticketControlRow()
        ]
    });

    await sendLog(
        channel.guild,
        "ticket",
        "🔓 Ticket Reopened",
        `**Ticket:** ${channel}\n**Reopened by:** <@${userId}>`,
        0x57f287
    );
}

async function deleteTicket(
    ticket,
    channel,
    userId
) {
    if (!ticket) {
        throw new Error(
            "This channel is not a ticket."
        );
    }

    await sendTicketTranscript(
        ticket,
        channel
    );

    await sendLog(
        channel.guild,
        "ticket",
        "🗑️ Ticket Deleted",
        `**Ticket:** ${channel.name}\n**Deleted by:** <@${userId}>`,
        0xed4245
    );

    await Ticket.deleteOne({
        _id: ticket._id
    });

    await channel.delete(
        "27Pro ticket deleted"
    );
}

// ============================================================
// GIVEAWAYS
// ============================================================

function giveawayRow(messageId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `giveaway_join:${messageId}`
                )
                .setLabel("Enter Giveaway")
                .setEmoji("🎉")
                .setStyle(
                    ButtonStyle.Success
                )
        );
}

function giveawayEmbed(
    giveaway,
    ended = false,
    winners = []
) {
    const end =
        giveaway.endAt
            ? `<t:${Math.floor(
                new Date(
                    giveaway.endAt
                ).getTime() / 1000
            )}:R>`
            : "Unknown";

    const embed =
        baseEmbed(
            ended
                ? 0x747f8d
                : 0x57f287
        )
            .setTitle(
                ended
                    ? "🎉 Giveaway Ended"
                    : "🎉 Giveaway"
            )
            .setDescription(
                ended
                    ? `The giveaway for **${giveaway.prize}** has ended.`
                    : `React using the button below to enter!\n\n**Prize:** ${giveaway.prize}\n**Winners:** ${giveaway.winners}\n**Ends:** ${end}`
            )
            .addFields(
                {
                    name: "Host",
                    value: `<@${giveaway.hostId}>`,
                    inline: true
                },
                {
                    name: "Entries",
                    value: String(
                        giveaway.participants.length
                    ),
                    inline: true
                }
            );

    if (ended) {
        embed.addFields({
            name: "Winner(s)",
            value:
                winners.length
                    ? winners
                        .map(id => `<@${id}>`)
                        .join(", ")
                    : "No valid participants."
        });
    }

    return embed;
}

function chooseGiveawayWinners(
    participants,
    amount
) {
    const pool = [...participants];
    const winners = [];

    while (
        pool.length &&
        winners.length < amount
    ) {
        const index =
            randomInt(
                0,
                pool.length - 1
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
        await Giveaway.findById(
            giveawayId
        );

    if (!giveaway || giveaway.ended) {
        return;
    }

    giveaway.ended = true;

    const guild =
        client.guilds.cache.get(
            giveaway.guildId
        );

    if (!guild) {
        await giveaway.save();
        return;
    }

    const channel =
        guild.channels.cache.get(
            giveaway.channelId
        );

    if (!channel) {
        await giveaway.save();
        return;
    }

    const winners =
        chooseGiveawayWinners(
            giveaway.participants,
            giveaway.winners
        );

    await giveaway.save();

    let message = null;

    try {
        message =
            await channel.messages.fetch(
                giveaway.messageId
            );
    } catch {}

    if (message) {
        await message.edit({
            embeds: [
                giveawayEmbed(
                    giveaway,
                    true,
                    winners
                )
            ],
            components: []
        }).catch(() => {});
    }

    if (winners.length) {
        await channel.send({
            content:
                `🎉 Congratulations ${winners.map(id => `<@${id}>`).join(", ")}!\nYou won **${giveaway.prize}**!`
        });
    } else {
        await channel.send({
            content:
                `🎉 The giveaway for **${giveaway.prize}** ended, but there were no valid entries.`
        });
    }

    await sendLog(
        guild,
        "giveaway",
        "🎉 Giveaway Ended",
        `**Prize:** ${giveaway.prize}\n**Entries:** ${giveaway.participants.length}\n**Winners:** ${
            winners.length
                ? winners.map(id => `<@${id}>`).join(", ")
                : "None"
        }`,
        0x57f287
    );

    const timer =
        giveawayTimers.get(
            giveawayId
        );

    if (timer) {
        clearTimeout(timer);
        giveawayTimers.delete(
            giveawayId
        );
    }
}

function scheduleGiveaway(
    giveaway
) {
    const delay =
        Math.max(
            0,
            new Date(
                giveaway.endAt
            ).getTime() -
                Date.now()
        );

    const timer =
        setTimeout(
            () =>
                finishGiveaway(
                    giveaway._id.toString()
                ),
            delay
        );

    giveawayTimers.set(
        giveaway._id.toString(),
        timer
    );
}

async function restoreGiveaways() {
    try {
        const active =
            await Giveaway.find({
                ended: false
            });

        for (const giveaway of active) {
            if (
                new Date(
                    giveaway.endAt
                ).getTime() <= Date.now()
            ) {
                await finishGiveaway(
                    giveaway._id.toString()
                );
            } else {
                scheduleGiveaway(
                    giveaway
                );
            }
        }

        console.log(
            `[GIVEAWAY] Restored ${active.length} giveaway(s).`
        );
    } catch (error) {
        console.error(
            "[GIVEAWAY RESTORE]",
            error
        );
    }
}

// ============================================================
// LEVELING
// ============================================================

function calculateLevel(xp) {
    return Math.floor(
        Math.sqrt(xp / 100)
    );
}

function xpRequiredForLevel(level) {
    return Math.pow(
        level,
        2
    ) * 100;
}

async function getLevelXP(
    guildId,
    userId
) {
    return Level.findOneAndUpdate(
        {
            guildId,
            userId
        },
        {
            $setOnInsert: {
                guildId,
                userId
            }
        },
        {
            new: true,
            upsert: true
        }
    );
}

async function addXP(
    member,
    amount = null
) {
    if (!member?.guild) {
        return null;
    }

    const xpAmount =
        amount ||
        randomInt(10, 20);

    const record =
        await getLevelXP(
            member.guild.id,
            member.id
        );

    const oldLevel =
        Number(record.level || 0);

    record.xp += xpAmount;

    const newLevel =
        calculateLevel(
            record.xp
        );

    record.level =
        newLevel;

    await record.save();

    if (newLevel > oldLevel) {
        const channel =
            member.guild.systemChannel;

        if (
            channel &&
            channel.isTextBased()
        ) {
            await channel.send({
                embeds: [
                    baseEmbed(0x57f287)
                        .setTitle("🎉 Level Up!")
                        .setDescription(
                            `<@${member.id}> reached **Level ${newLevel}**!`
                        )
                ]
            }).catch(() => {});
        }

        await sendLog(
            member.guild,
            "general",
            "📈 Level Up",
            `<@${member.id}> reached level **${newLevel}**.`,
            0x57f287
        );
    }

    return record;
}

// ============================================================
// REMINDERS
// ============================================================

async function sendReminder(
    reminder
) {
    try {
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
                    `<@${reminder.userId}> ⏰ Reminder: ${reminder.message}`
            });
        }

        reminder.sent = true;

        await reminder.save();

        const timer =
            reminderTimers.get(
                reminder._id.toString()
            );

        if (timer) {
            clearTimeout(timer);

            reminderTimers.delete(
                reminder._id.toString()
            );
        }
    } catch (error) {
        console.error(
            "[REMINDER]",
            error
        );
    }
}

function scheduleReminder(
    reminder
) {
    const delay =
        Math.max(
            0,
            new Date(
                reminder.remindAt
            ).getTime() -
                Date.now()
        );

    const timer =
        setTimeout(
            () =>
                sendReminder(
                    reminder
                ),
            delay
        );

    reminderTimers.set(
        reminder._id.toString(),
        timer
    );
}

async function restoreReminders() {
    try {
        const reminders =
            await Reminder.find({
                sent: false
            });

        for (const reminder of reminders) {
            if (
                new Date(
                    reminder.remindAt
                ).getTime() <= Date.now()
            ) {
                await sendReminder(
                    reminder
                );
            } else {
                scheduleReminder(
                    reminder
                );
            }
        }

        console.log(
            `[REMINDER] Restored ${reminders.length} reminder(s).`
        );
    } catch (error) {
        console.error(
            "[REMINDER RESTORE]",
            error
        );
    }
}

// ============================================================
// RULES SYSTEM
// ============================================================

const RULE_SECTIONS = {
    general: {
        label: "General",
        emoji: "📌"
    },

    chat: {
        label: "Chat",
        emoji: "💬"
    },

    gaming: {
        label: "Gaming / RP",
        emoji: "🎮"
    },

    punishments: {
        label: "Punishments",
        emoji: "⚖️"
    },

    privacy: {
        label: "Privacy & Security",
        emoji: "🔐"
    },

    staff: {
        label: "Staff",
        emoji: "🛡️"
    }
};

function rulesSelectMenu() {
    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                "rules_select"
            )
            .setPlaceholder(
                "Select a rules category..."
            );

    for (
        const [value, data]
        of Object.entries(RULE_SECTIONS)
    ) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(data.label)
                .setValue(value)
                .setEmoji(data.emoji)
        );
    }

    menu.addOptions(
        new StringSelectMenuOptionBuilder()
            .setLabel("Full Rules")
            .setValue("full")
            .setEmoji("📜")
    );

    return new ActionRowBuilder()
        .addComponents(menu);
}

function buildRulesEmbed(
    config,
    section = null
) {
    if (
        section &&
        section !== "full"
    ) {
        const data =
            RULE_SECTIONS[section];

        const text =
            config.sections?.get
                ? config.sections.get(
                    section
                )
                : config.sections?.[section];

        return baseEmbed(0x5865f2)
            .setTitle(
                `${data?.emoji || "📜"} ${data?.label || "Rules"}`
            )
            .setDescription(
                text ||
                "No rules have been configured for this section yet."
            );
    }

    const embed =
        baseEmbed(0x5865f2)
            .setTitle("📜 Server Rules")
            .setDescription(
                "Select a category below to view the rules."
            );

    for (
        const [key, data]
        of Object.entries(RULE_SECTIONS)
    ) {
        const text =
            config.sections?.get
                ? config.sections.get(key)
                : config.sections?.[key];

        embed.addFields({
            name:
                `${data.emoji} ${data.label}`,
            value:
                truncate(
                    text ||
                    "Not configured.",
                    1024
                )
        });
    }

    return embed;
}

async function publishRules(
    guild,
    channel
) {
    const config =
        await getRulesConfig(
            guild.id
        );

    const embed =
        buildRulesEmbed(
            config
        );

    const message =
        await channel.send({
            embeds: [embed],
            components: [
                rulesSelectMenu()
            ]
        });

    config.enabled = true;
    config.channelId =
        channel.id;
    config.messageId =
        message.id;

    await config.save();

    return message;
}

// ============================================================
// ROLE PANEL
// ============================================================

async function createRolePanel(
    guild,
    channel,
    role,
    label,
    emoji
) {
    if (!canBotManageRole(
        guild,
        role
    )) {
        throw new Error(
            "My highest role must be above the selected role."
        );
    }

    const customId =
        `rolepanel:${role.id}`;

    const button =
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel(label)
            .setStyle(
                ButtonStyle.Primary
            );

    if (emoji) {
        button.setEmoji(emoji);
    }

    const embed =
        baseEmbed(0x5865f2)
            .setTitle("🎭 Self Role")
            .setDescription(
                `Click the button below to toggle <@&${role.id}>.`
            );

    const message =
        await channel.send({
            embeds: [embed],
            components: [
                new ActionRowBuilder()
                    .addComponents(button)
            ]
        });

    await RolePanel.create({
        guildId: guild.id,
        channelId: channel.id,
        messageId: message.id,
        roleId: role.id,
        label,
        emoji: emoji || null
    });

    return message;
}

// ============================================================
// KICK HELPERS
// ============================================================

async function getKickChannel(
    username
) {
    if (!username) {
        return null;
    }

    try {
        const response =
            await axios.get(
                `https://kick.com/api/v2/channels/${encodeURIComponent(username)}`,
                {
                    timeout: 15000,
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (compatible; 27Pro/2.0)"
                    }
                }
            );

        return response.data;
    } catch (error) {
        console.error(
            `[KICK] Failed to fetch ${username}:`,
            error.response?.status ||
                error.message
        );

        return null;
    }
}

function getKickStream(
    data
) {
    if (!data) return null;

    return (
        data.livestream ||
        data.stream ||
        data.data?.livestream ||
        null
    );
}

function getKickCategory(
    stream,
    data
) {
    const possible = [
        stream?.category?.name,
        typeof stream?.category === "string"
            ? stream.category
            : null,
        stream?.game?.name,
        data?.category?.name,
        data?.category?.slug,
        data?.livestream?.category?.name,
        data?.livestream?.categories?.[0]?.name,
        data?.stream?.category?.name
    ];

    const found =
        possible.find(
            value =>
                value &&
                String(value).trim()
        );

    return found
        ? String(found)
        : "Just Chatting";
}

function getKickTitle(
    stream,
    data
) {
    return (
        stream?.session_title ||
        stream?.title ||
        data?.livestream?.session_title ||
        data?.livestream?.title ||
        "Live on KICK"
    );
}

function getKickViewers(
    stream
) {
    return Number(
        stream?.viewer_count ??
        stream?.viewers ??
        0
    );
}

function getKickThumbnail(
    stream,
    data
) {
    return (
        stream?.thumbnail?.url ||
        stream?.thumbnail ||
        data?.livestream?.thumbnail?.url ||
        data?.livestream?.thumbnail ||
        null
    );
}

function isKickLive(
    data
) {
    const stream =
        getKickStream(data);

    if (!stream) {
        return false;
    }

    if (
        stream.is_live === false ||
        stream.live === false
    ) {
        return false;
    }

    return Boolean(
        stream.id ||
        stream.session_title ||
        stream.viewer_count ||
        stream.category
    );
}


function buildHelpEmbed(guildCount = 0) {
    return baseEmbed(0x5865f2)
        .setTitle("🤖 27Pro • Advanced Discord Bot")
        .setDescription(
            [
                "Everything your server needs in one bot.",
                "",
                `**Serving:** ${guildCount} server(s)`,
                `**Creator:** ${CREATOR}`,
                `**Version:** ${VERSION}`
            ].join("\n")
        )
        .addFields(
            {
                name: "🛡️ Moderation",
                value:
                    "`/warn` `/warnings` `/kick` `/ban` `/unban`\n" +
                    "`/timeout` `/untimeout` `/nick` `/clear`\n" +
                    "`/slowmode` `/lock` `/unlock` `/case` `/cases`"
            },
            {
                name: "🔐 Security & AutoMod",
                value:
                    "`/automod` `/security`\n" +
                    "Anti-spam • Anti-links • Anti-invites • Anti-caps\n" +
                    "Mention protection • Blocked words • Anti-raid • Lockdown"
            },
            {
                name: "🎫 Tickets",
                value:
                    "`/ticket setup` `/ticket panel`\n" +
                    "Claim • Close • Reopen • Delete • Add • Remove\n" +
                    "Transcripts • Archive category • Staff management"
            },
            {
                name: "📋 Logs",
                value:
                    "`/logs on` `/logs off` `/logs setup`\n" +
                    "`/logs config` `/logs test` `/logs disable`\n" +
                    "Members • Messages • Moderation • Roles • Channels • Voice • Security"
            },
            {
                name: "👋 Community",
                value:
                    "`/welcome` `/rules` `/rolepanel`\n" +
                    "Welcome • Goodbye • Auto-role • Interactive rules • Self roles"
            },
            {
                name: "📈 Community Growth",
                value:
                    "`/rank` `/leaderboard` `/giveaway`\n" +
                    "XP • Levels • Leaderboards • Giveaways • Winner rerolls"
            },
            {
                name: "🔴 Streaming",
                value:
                    "`/live setup` `/live config` `/live disable`\n" +
                    "`/livecheck`\n" +
                    "KICK live detection • Category • Title • Viewers • Thumbnail"
            },
            {
                name: "🎮 Fun & Utility",
                value:
                    "`/coinflip` `/roll` `/8ball` `/choose`\n" +
                    "`/poll` `/remind` `/say` `/announce`\n" +
                    "`/userinfo` `/avatar` `/banner` `/serverinfo`"
            }
        )
        .setFooter({
            text: `${BOT_NAME} • Made by ${CREATOR}`
        });
}

// ============================================================
// LOG CONFIG EMBED
// ============================================================

function buildLogConfigEmbed(config) {
    const lines = LOG_TYPES.map(type => {
        const channelId =
            config.channels?.[type];

        return `**${type}:** ${
            channelId
                ? `<#${channelId}>`
                : "Not configured"
        }`;
    });

    return baseEmbed(
        config.enabled
            ? 0x57f287
            : 0xed4245
    )
        .setTitle("📋 Logging Configuration")
        .setDescription(
            [
                `**Status:** ${
                    config.enabled
                        ? "Enabled"
                        : "Disabled"
                }`,
                "",
                ...lines
            ].join("\n")
        );
}

// ============================================================
// AUTOMOD CONFIG EMBED
// ============================================================

function buildAutoModEmbed(config) {
    return baseEmbed(
        config.enabled
            ? 0x57f287
            : 0xed4245
    )
        .setTitle("🛡️ AutoMod Configuration")
        .addFields(
            {
                name: "Status",
                value: config.enabled
                    ? "Enabled"
                    : "Disabled",
                inline: true
            },
            {
                name: "Anti Invite",
                value: config.antiInvite
                    ? "ON"
                    : "OFF",
                inline: true
            },
            {
                name: "Anti Links",
                value: config.antiLinks
                    ? "ON"
                    : "OFF",
                inline: true
            },
            {
                name: "Anti Spam",
                value: config.antiSpam
                    ? "ON"
                    : "OFF",
                inline: true
            },
            {
                name: "Anti Caps",
                value: config.antiCaps
                    ? "ON"
                    : "OFF",
                inline: true
            },
            {
                name: "Mention Spam",
                value: config.antiMentionSpam
                    ? "ON"
                    : "OFF",
                inline: true
            },
            {
                name: "Duplicate Messages",
                value: config.antiDuplicate
                    ? "ON"
                    : "OFF",
                inline: true
            },
            {
                name: "Max Mentions",
                value: String(
                    config.maxMentions
                ),
                inline: true
            },
            {
                name: "Max Messages",
                value: String(
                    config.maxMessages
                ),
                inline: true
            },
            {
                name: "Punishment",
                value:
                    config.punishment,
                inline: true
            },
            {
                name: "Timeout",
                value:
                    `${config.timeoutMinutes} minute(s)`,
                inline: true
            },
            {
                name: "Blocked Words",
                value:
                    config.blockedWords?.length
                        ? config.blockedWords
                            .slice(0, 20)
                            .map(
                                word =>
                                    `\`${word}\``
                            )
                            .join(", ")
                        : "None",
                inline: false
            }
        );
}

// ============================================================
// SECURITY CONFIG EMBED
// ============================================================

function buildSecurityEmbed(config) {
    return baseEmbed(
        config.security.antiRaid
            ? 0x57f287
            : 0xed4245
    )
        .setTitle("🔐 Security Configuration")
        .addFields(
            {
                name: "Anti-Raid",
                value:
                    config.security.antiRaid
                        ? "Enabled"
                        : "Disabled",
                inline: true
            },
            {
                name: "Raid Threshold",
                value:
                    String(
                        config.security
                            .raidThreshold
                    ),
                inline: true
            },
            {
                name: "Raid Window",
                value:
                    `${config.security.raidWindow / 1000}s`,
                inline: true
            },
            {
                name: "Automatic Lockdown",
                value:
                    config.security.autoLockdown
                        ? "Enabled"
                        : "Disabled",
                inline: true
            },
            {
                name: "Alert Channel",
                value:
                    config.security
                        .alertChannelId
                        ? `<#${config.security.alertChannelId}>`
                        : "Not configured",
                inline: true
            }
        );
}

// ============================================================
// TICKET CONFIG EMBED
// ============================================================

function buildTicketConfigEmbed(config) {
    return baseEmbed(
        config.enabled
            ? 0x57f287
            : 0xed4245
    )
        .setTitle("🎫 Ticket Configuration")
        .addFields(
            {
                name: "Status",
                value:
                    config.enabled
                        ? "Enabled"
                        : "Disabled",
                inline: true
            },
            {
                name: "Open Category",
                value:
                    config.categoryId
                        ? `<#${config.categoryId}>`
                        : "Not configured",
                inline: true
            },
            {
                name: "Closed Category",
                value:
                    config.closedCategoryId
                        ? `<#${config.closedCategoryId}>`
                        : "Not configured",
                inline: true
            },
            {
                name: "Staff Role",
                value:
                    config.staffRoleId
                        ? `<@&${config.staffRoleId}>`
                        : "Not configured",
                inline: true
            },
            {
                name: "Ticket Counter",
                value:
                    String(
                        config.ticketCounter
                    ),
                inline: true
            },
            {
                name: "Transcript Channel",
                value:
                    config.transcriptChannelId
                        ? `<#${config.transcriptChannelId}>`
                        : "Not configured",
                inline: true
            }
        );
}

// ============================================================
// WELCOME CONFIG EMBED
// ============================================================

function buildWelcomeConfigEmbed(config) {
    return baseEmbed(
        config.enabled
            ? 0x57f287
            : 0xed4245
    )
        .setTitle("👋 Welcome Configuration")
        .addFields(
            {
                name: "Status",
                value:
                    config.enabled
                        ? "Enabled"
                        : "Disabled",
                inline: true
            },
            {
                name: "Channel",
                value:
                    config.channelId
                        ? `<#${config.channelId}>`
                        : "Not configured",
                inline: true
            },
            {
                name: "Auto Role",
                value:
                    config.roleId
                        ? `<@&${config.roleId}>`
                        : "None",
                inline: true
            },
            {
                name: "Mention",
                value:
                    config.mention
                        ? "Enabled"
                        : "Disabled",
                inline: true
            },
            {
                name: "Welcome DM",
                value:
                    config.dmEnabled
                        ? "Enabled"
                        : "Disabled",
                inline: true
            },
            {
                name: "Goodbye",
                value:
                    config.goodbyeEnabled
                        ? "Enabled"
                        : "Disabled",
                inline: true
            },
            {
                name: "Message",
                value:
                    truncate(
                        config.message,
                        1024
                    )
            }
        );
}

// ============================================================
// KICK CONFIG EMBED
// ============================================================

function buildKickConfigEmbed(config) {
    return baseEmbed(
        config.enabled
            ? 0x57f287
            : 0xed4245
    )
        .setTitle("🔴 KICK Live Configuration")
        .addFields(
            {
                name: "Status",
                value:
                    config.enabled
                        ? "Enabled"
                        : "Disabled",
                inline: true
            },
            {
                name: "Username",
                value:
                    config.username ||
                    "Not configured",
                inline: true
            },
            {
                name: "Channel",
                value:
                    config.channelId
                        ? `<#${config.channelId}>`
                        : "Not configured",
                inline: true
            },
            {
                name: "Mention Role",
                value:
                    config.mentionRoleId
                        ? `<@&${config.mentionRoleId}>`
                        : "None",
                inline: true
            },
            {
                name: "@everyone",
                value:
                    config.everyone
                        ? "Enabled"
                        : "Disabled",
                inline: true
            }
        );
}

// ============================================================
// TICKET PERMISSION CHECK
// ============================================================

async function isTicketStaff(
    interaction
) {
    const config =
        await getTicketConfig(
            interaction.guild.id
        );

    if (
        interaction.member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    if (
        config.staffRoleId &&
        interaction.member.roles.cache.has(
            config.staffRoleId
        )
    ) {
        return true;
    }

    return false;
}

// ============================================================
// CURRENT TICKET
// ============================================================

async function getCurrentTicket(
    guild,
    channelId
) {
    return Ticket.findOne({
        guildId: guild.id,
        channelId
    });
}

// ============================================================
// INTERACTION ENGINE
// ============================================================

client.on(
    "interactionCreate",
    async interaction => {
        try {
            // ====================================================
            // BUTTONS
            // ====================================================

            if (interaction.isButton()) {

                // ----------------------------------------------
                // TICKET CLOSE
                // ----------------------------------------------

                if (
                    interaction.customId ===
                    "ticket_close"
                ) {
                    const ticket =
                        await getCurrentTicket(
                            interaction.guild,
                            interaction.channel.id
                        );

                    if (!ticket) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "This is not a ticket."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const staff =
                        await isTicketStaff(
                            interaction
                        );

                    if (
                        !staff &&
                        ticket.userId !==
                            interaction.user.id
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Only the ticket owner or staff can close this ticket."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    await interaction.deferUpdate();

                    await closeTicket(
                        ticket,
                        interaction.channel,
                        interaction.user.id
                    );

                    return;
                }

                // ----------------------------------------------
                // TICKET REOPEN
                // ----------------------------------------------

                if (
                    interaction.customId ===
                    "ticket_reopen"
                ) {
                    const ticket =
                        await getCurrentTicket(
                            interaction.guild,
                            interaction.channel.id
                        );

                    if (!ticket) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "This is not a ticket."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const staff =
                        await isTicketStaff(
                            interaction
                        );

                    if (
                        !staff &&
                        ticket.userId !==
                            interaction.user.id
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Only staff or the ticket owner can reopen this ticket."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    await interaction.deferUpdate();

                    await reopenTicket(
                        ticket,
                        interaction.channel,
                        interaction.user.id
                    );

                    return;
                }

                // ----------------------------------------------
                // TICKET CLAIM
                // ----------------------------------------------

                if (
                    interaction.customId ===
                    "ticket_claim"
                ) {
                    const ticket =
                        await getCurrentTicket(
                            interaction.guild,
                            interaction.channel.id
                        );

                    if (!ticket) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "This is not a ticket."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const staff =
                        await isTicketStaff(
                            interaction
                        );

                    if (!staff) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Only ticket staff can claim tickets."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (ticket.claimedBy) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    infoEmbed(
                                        "Already Claimed",
                                        `This ticket is already claimed by <@${ticket.claimedBy}>.`
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    ticket.claimedBy =
                        interaction.user.id;

                    await ticket.save();

                    await interaction.reply({
                        embeds: [
                            successEmbed(
                                "Ticket Claimed",
                                `<@${interaction.user.id}> is now handling this ticket.`
                            )
                        ]
                    });

                    await sendLog(
                        interaction.guild,
                        "ticket",
                        "🙋 Ticket Claimed",
                        `**Ticket:** ${interaction.channel}\n**Staff:** <@${interaction.user.id}>`,
                        0x5865f2
                    );

                    return;
                }

                // ----------------------------------------------
                // TICKET DELETE
                // ----------------------------------------------

                if (
                    interaction.customId ===
                    "ticket_delete"
                ) {
                    const ticket =
                        await getCurrentTicket(
                            interaction.guild,
                            interaction.channel.id
                        );

                    if (!ticket) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "This is not a ticket."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const staff =
                        await isTicketStaff(
                            interaction
                        );

                    if (!staff) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Only ticket staff can delete tickets."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    await safeReply(
                        interaction,
                        {
                            embeds: [
                                infoEmbed(
                                    "Deleting Ticket",
                                    "The ticket and transcript are being processed."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );

                    await deleteTicket(
                        ticket,
                        interaction.channel,
                        interaction.user.id
                    );

                    return;
                }

                // ----------------------------------------------
                // TICKET PANEL
                // ----------------------------------------------

                if (
                    interaction.customId ===
                    "ticket_create"
                ) {
                    const config =
                        await getTicketConfig(
                            interaction.guild.id
                        );

                    if (!config.enabled) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "The ticket system is not configured."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const result =
                        await createTicket(
                            interaction.guild,
                            interaction.user,
                            config
                        );

                    if (result.existing) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    infoEmbed(
                                        "You Already Have a Ticket",
                                        result.channel
                                            ? `Your current ticket is ${result.channel}.`
                                            : "You already have an open ticket."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Ticket Created",
                                    `Your ticket is ${result.channel}.`
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                // ----------------------------------------------
                // GIVEAWAY
                // ----------------------------------------------

                if (
                    interaction.customId.startsWith(
                        "giveaway_join:"
                    )
                ) {
                    const messageId =
                        interaction.customId
                            .split(":")[1];

                    const giveaway =
                        await Giveaway.findOne({
                            messageId,
                            guildId:
                                interaction.guild.id
                        });

                    if (
                        !giveaway ||
                        giveaway.ended
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "This giveaway has ended."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (
                        new Date(
                            giveaway.endAt
                        ).getTime() <= Date.now()
                    ) {
                        await finishGiveaway(
                            giveaway._id.toString()
                        );

                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "This giveaway has ended."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const index =
                        giveaway.participants.indexOf(
                            interaction.user.id
                        );

                    if (index !== -1) {
                        giveaway.participants.splice(
                            index,
                            1
                        );

                        await giveaway.save();

                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    infoEmbed(
                                        "Entry Removed",
                                        "You have left the giveaway."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    giveaway.participants.push(
                        interaction.user.id
                    );

                    await giveaway.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Entered Giveaway",
                                    `Good luck! You are now entered for **${giveaway.prize}**.`
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                // ----------------------------------------------
                // ROLE PANEL
                // ----------------------------------------------

                if (
                    interaction.customId.startsWith(
                        "rolepanel:"
                    )
                ) {
                    const roleId =
                        interaction.customId
                            .split(":")[1];

                    const role =
                        interaction.guild.roles.cache.get(
                            roleId
                        );

                    if (!role) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "That role no longer exists."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (
                        !canBotManageRole(
                            interaction.guild,
                            role
                        )
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "I cannot manage this role because it is above my highest role."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (
                        interaction.member.roles.cache.has(
                            role.id
                        )
                    ) {
                        await interaction.member.roles.remove(
                            role,
                            "27Pro self-role toggle"
                        );

                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    successEmbed(
                                        "Role Removed",
                                        `Removed ${role} from you.`
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    await interaction.member.roles.add(
                        role,
                        "27Pro self-role toggle"
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Role Added",
                                    `You now have ${role}.`
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }
            }

            // ====================================================
            // SELECT MENUS
            // ====================================================

            if (
                interaction.isStringSelectMenu()
            ) {
                if (
                    interaction.customId ===
                    "rules_select"
                ) {
                    const section =
                        interaction.values[0];

                    const config =
                        await getRulesConfig(
                            interaction.guild.id
                        );

                    const embed =
                        buildRulesEmbed(
                            config,
                            section
                        );

                    return safeReply(
                        interaction,
                        {
                            embeds: [embed],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }
            }

            // ====================================================
            // CHAT COMMANDS ONLY
            // ====================================================

            if (
                !interaction.isChatInputCommand()
            ) {
                return;
            }

            const command =
                interaction.commandName;

            // ====================================================
            // HELP
            // ====================================================

            if (command === "help") {
                return safeReply(
                    interaction,
                    {
                        embeds: [
                            buildHelpEmbed(
                                client.guilds.cache.size
                            )
                        ]
                    }
                );
            }

            // ====================================================
            // PING
            // ====================================================

            if (command === "ping") {
                const latency =
                    Date.now() -
                    interaction.createdTimestamp;

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed(0x57f287)
                                .setTitle("🏓 Pong!")
                                .addFields(
                                    {
                                        name: "Bot Latency",
                                        value:
                                            `${latency}ms`,
                                        inline: true
                                    },
                                    {
                                        name: "WebSocket",
                                        value:
                                            `${client.ws.ping}ms`,
                                        inline: true
                                    }
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // UPTIME
            // ====================================================

            if (command === "uptime") {
                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle("⏱️ Bot Uptime")
                                .setDescription(
                                    formatDuration(
                                        client.uptime || 0
                                    )
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // BOT INFO
            // ====================================================

            if (command === "botinfo") {
                const memory =
                    process.memoryUsage();

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle("🤖 27Pro Information")
                                .addFields(
                                    {
                                        name: "Version",
                                        value:
                                            VERSION,
                                        inline: true
                                    },
                                    {
                                        name: "Creator",
                                        value:
                                            CREATOR,
                                        inline: true
                                    },
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
                                        name: "Node.js",
                                        value:
                                            process.version,
                                        inline: true
                                    },
                                    {
                                        name: "Memory",
                                        value:
                                            `${Math.round(
                                                memory.rss /
                                                1024 /
                                                1024
                                            )} MB`,
                                        inline: true
                                    }
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // SERVER INFO
            // ====================================================

            if (command === "serverinfo") {
                const guild =
                    interaction.guild;

                const owner =
                    await guild.fetchOwner()
                        .catch(() => null);

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    `🏠 ${guild.name}`
                                )
                                .setThumbnail(
                                    guild.iconURL({
                                        size: 512
                                    }) || null
                                )
                                .addFields(
                                    {
                                        name: "Owner",
                                        value:
                                            owner
                                                ? `<@${owner.id}>`
                                                : "Unknown",
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
                                        name: "Boosts",
                                        value:
                                            String(
                                                guild.premiumSubscriptionCount || 0
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Created",
                                        value:
                                            `<t:${Math.floor(
                                                guild.createdTimestamp /
                                                1000
                                            )}:F>`,
                                        inline: false
                                    }
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // MEMBER COUNT
            // ====================================================

            if (command === "membercount") {
                const guild =
                    interaction.guild;

                const humans =
                    guild.members.cache.filter(
                        member =>
                            !member.user.bot
                    ).size;

                const bots =
                    guild.members.cache.filter(
                        member =>
                            member.user.bot
                    ).size;

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    "👥 Member Count"
                                )
                                .addFields(
                                    {
                                        name: "Total",
                                        value:
                                            String(
                                                guild.memberCount
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Humans",
                                        value:
                                            String(
                                                humans
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Bots",
                                        value:
                                            String(
                                                bots
                                            ),
                                        inline: true
                                    }
                                )
                        ]
                    }
                );
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
                    interaction.guild.members.cache.get(
                        user.id
                    );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
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
                                            user.id,
                                        inline: true
                                    },
                                    {
                                        name: "Bot",
                                        value:
                                            user.bot
                                                ? "Yes"
                                                : "No",
                                        inline: true
                                    },
                                    {
                                        name: "Account Created",
                                        value:
                                            `<t:${Math.floor(
                                                user.createdTimestamp /
                                                1000
                                            )}:R>`,
                                        inline: true
                                    },
                                    {
                                        name: "Joined Server",
                                        value:
                                            member?.joinedTimestamp
                                                ? `<t:${Math.floor(
                                                    member.joinedTimestamp /
                                                    1000
                                                )}:R>`
                                                : "Unknown",
                                        inline: true
                                    },
                                    {
                                        name: "Highest Role",
                                        value:
                                            member
                                                ? member.roles.highest.toString()
                                                : "None",
                                        inline: true
                                    }
                                ]
                        ]
                    }
                );
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

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    `🖼️ ${user.tag}'s Avatar`
                                )
                                .setImage(
                                    user.displayAvatarURL({
                                        size: 4096,
                                        extension: "png"
                                    })
                                )
                        ]
                    }
                );
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

                const fetched =
                    await user.fetch();

                const banner =
                    fetched.bannerURL({
                        size: 4096,
                        extension: "png"
                    });

                if (!banner) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                infoEmbed(
                                    "No Banner",
                                    "This user does not have a profile banner."
                                )
                            ]
                        }
                    );
                }

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    `🖼️ ${user.tag}'s Banner`
                                )
                                .setImage(
                                    banner
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // ROLE INFO
            // ====================================================

            if (command === "roleinfo") {
                const role =
                    interaction.options.getRole(
                        "role"
                    );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    `🎭 ${role.name}`
                                )
                                .addFields(
                                    {
                                        name: "ID",
                                        value:
                                            role.id,
                                        inline: true
                                    },
                                    {
                                        name: "Members",
                                        value:
                                            String(
                                                role.members.size
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Position",
                                        value:
                                            String(
                                                role.position
                                            ),
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
                                        name: "Managed",
                                        value:
                                            role.managed
                                                ? "Yes"
                                                : "No",
                                        inline: true
                                    }
                                )
                        ]
                    }
                );
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

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    `📺 #${channel.name}`
                                )
                                .addFields(
                                    {
                                        name: "ID",
                                        value:
                                            channel.id,
                                        inline: true
                                    },
                                    {
                                        name: "Type",
                                        value:
                                            String(
                                                channel.type
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Category",
                                        value:
                                            channel.parent
                                                ? channel.parent.name
                                                : "None",
                                        inline: true
                                    },
                                    {
                                        name: "Created",
                                        value:
                                            `<t:${Math.floor(
                                                channel.createdTimestamp /
                                                1000
                                            )}:R>`,
                                        inline: true
                                    }
                                )
                        ]
                    }
                );
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

                if (!member) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "Member not found."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                if (
                    !moderatorCanAct(
                        interaction,
                        member
                    )
                ) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "You cannot warn a member with an equal or higher role."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                const warning =
                    await addWarning(
                        interaction.guild,
                        member.id,
                        interaction.user.id,
                        reason
                    );

                await sendModerationDM(
                    member,
                    "Warning",
                    reason
                );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                "Member Warned",
                                `<@${member.id}> has been warned.\n\n**Case:** #${warning.caseId}\n**Reason:** ${reason}`
                            )
                        ]
                    }
                );
            }

            // ====================================================
            // WARNINGS
            // ====================================================

            if (command === "warnings") {
                const sub =
                    interaction.options.getSubcommand();

                const user =
                    interaction.options.getUser(
                        "user"
                    );

                if (sub === "view") {
                    const warnings =
                        await Warning.find({
                            guildId:
                                interaction.guild.id,
                            userId:
                                user.id
                        })
                            .sort({
                                createdAt: -1
                            })
                            .limit(20);

                    if (!warnings.length) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    infoEmbed(
                                        "No Warnings",
                                        `<@${user.id}> has no warnings.`
                                    )
                                ]
                            }
                        );
                    }

                    const description =
                        warnings
                            .map(
                                warning =>
                                    `**#${warning.caseId}** • <t:${Math.floor(
                                        warning.createdAt.getTime() /
                                        1000
                                    )}:R>\n${truncate(
                                        warning.reason,
                                        250
                                    )}\nModerator: <@${warning.moderatorId}>`
                            )
                            .join("\n\n");

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                baseEmbed()
                                    .setTitle(
                                        `⚠️ Warnings • ${user.tag}`
                                    )
                                    .setDescription(
                                        description
                                    )
                            ]
                        }
                    );
                }

                if (sub === "clear") {
                    await Warning.deleteMany({
                        guildId:
                            interaction.guild.id,
                        userId:
                            user.id
                    });

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Warnings Cleared",
                                    `All warnings for <@${user.id}> have been cleared.`
                                )
                            ]
                        }
                    );
                }
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

                if (!member) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "Member not found."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                try {
                    await punishMember(
                        interaction,
                        member,
                        "kick",
                        reason
                    );

                    await createCase(
                        interaction.guild,
                        "kick",
                        member.id,
                        interaction.user.id,
                        reason
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Member Kicked",
                                    `<@${member.id}> was kicked.\n\n**Reason:** ${reason}`
                                )
                            ]
                        }
                    );
                } catch (error) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    error.message
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
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

                if (!member) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "Member is not currently in the server."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                try {
                    await punishMember(
                        interaction,
                        member,
                        "ban",
                        reason
                    );

                    await createCase(
                        interaction.guild,
                        "ban",
                        member.id,
                        interaction.user.id,
                        reason
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Member Banned",
                                    `<@${member.id}> was banned.\n\n**Reason:** ${reason}`
                                )
                            ]
                        }
                    );
                } catch (error) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    error.message
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }
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
                    await interaction.guild.bans.remove(
                        userId,
                        `Unbanned by ${interaction.user.tag}`
                    );

                    await createCase(
                        interaction.guild,
                        "unban",
                        userId,
                        interaction.user.id,
                        "Manual unban"
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "User Unbanned",
                                    `User ID \`${userId}\` has been unbanned.`
                                )
                            ]
                        }
                    );
                } catch (error) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "That user could not be unbanned. Check the ID and make sure the user is banned."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }
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

                if (!member) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "Member not found."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                try {
                    await punishMember(
                        interaction,
                        member,
                        "timeout",
                        reason,
                        minutes
                    );

                    await createCase(
                        interaction.guild,
                        "timeout",
                        member.id,
                        interaction.user.id,
                        reason,
                        minutes
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Member Timed Out",
                                    `<@${member.id}> was timed out for **${minutes} minute(s)**.\n\n**Reason:** ${reason}`
                                )
                            ]
                        }
                    );
                } catch (error) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    error.message
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }
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
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "Member not found."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                try {
                    await punishMember(
                        interaction,
                        member,
                        "untimeout",
                        "Timeout removed"
                    );

                    await createCase(
                        interaction.guild,
                        "untimeout",
                        member.id,
                        interaction.user.id,
                        "Timeout removed"
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Timeout Removed",
                                    `<@${member.id}> is no longer timed out.`
                                )
                            ]
                        }
                    );
                } catch (error) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    error.message
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }
            }

            // ====================================================
            // NICK
            // ====================================================

            if (command === "nick") {
                const user =
                    interaction.options.getUser(
                        "user"
                    );

                const nickname =
                    interaction.options.getString(
                        "nickname"
                    );

                const member =
                    await interaction.guild.members
                        .fetch(user.id)
                        .catch(() => null);

                if (!member) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "Member not found."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                if (
                    !moderatorCanAct(
                        interaction,
                        member
                    )
                ) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "You cannot change the nickname of a member with an equal or higher role."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                if (
                    !canBotManageMember(
                        interaction.guild,
                        member
                    )
                ) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "My role is not high enough to change this nickname."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                await member.setNickname(
                    nickname || null,
                    `Nickname changed by ${interaction.user.tag}`
                );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                "Nickname Updated",
                                `<@${member.id}> is now **${nickname || member.user.username}**.`
                            )
                        ]
                    }
                );
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
                    !interaction.channel ||
                    !interaction.channel.isTextBased()
                ) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "This command can only be used in a text channel."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });

                const deleted =
                    await interaction.channel.bulkDelete(
                        amount,
                        true
                    );

                await createCase(
                    interaction.guild,
                    "clear",
                    interaction.user.id,
                    interaction.user.id,
                    `Deleted ${deleted.size} messages`
                );

                return interaction.editReply({
                    embeds: [
                        successEmbed(
                            "Messages Cleared",
                            `Deleted **${deleted.size}** message(s).`
                        )
                    ]
                });
            }

            // ====================================================
            // SLOWMODE
            // ====================================================

            if (command === "slowmode") {
                const seconds =
                    interaction.options.getInteger(
                        "seconds"
                    );

                await interaction.channel.setRateLimitPerUser(
                    seconds,
                    `Slowmode changed by ${interaction.user.tag}`
                );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                "Slowmode Updated",
                                `Slowmode is now **${seconds} second(s)**.`
                            )
                        ]
                    }
                );
            }

            // ====================================================
            // LOCK
            // ====================================================

            if (command === "lock") {
                await interaction.channel.permissionOverwrites.edit(
                    interaction.guild.roles.everyone,
                    {
                        SendMessages: false
                    },
                    {
                        reason:
                            `Locked by ${interaction.user.tag}`
                    }
                );

                await sendLog(
                    interaction.guild,
                    "channel",
                    "🔒 Channel Locked",
                    `<#${interaction.channel.id}> was locked by <@${interaction.user.id}>.`,
                    0xed4245
                );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                "Channel Locked",
                                "Members can no longer send messages here."
                            )
                        ]
                    }
                );
            }

            // ====================================================
            // UNLOCK
            // ====================================================

            if (command === "unlock") {
                await interaction.channel.permissionOverwrites.edit(
                    interaction.guild.roles.everyone,
                    {
                        SendMessages: null
                    },
                    {
                        reason:
                            `Unlocked by ${interaction.user.tag}`
                    }
                );

                await sendLog(
                    interaction.guild,
                    "channel",
                    "🔓 Channel Unlocked",
                    `<#${interaction.channel.id}> was unlocked by <@${interaction.user.id}>.`,
                    0x57f287
                );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                "Channel Unlocked",
                                "Members can send messages again."
                            )
                        ]
                    }
                );
            }

            // ====================================================
            // CASE
            // ====================================================

            if (command === "case") {
                const id =
                    interaction.options.getInteger(
                        "id"
                    );

                const record =
                    await ModCase.findOne({
                        guildId:
                            interaction.guild.id,
                        caseId: id
                    });

                if (!record) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    `Case #${id} does not exist.`
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    `📁 Case #${record.caseId}`
                                )
                                .addFields(
                                    {
                                        name: "Action",
                                        value:
                                            record.type,
                                        inline: true
                                    },
                                    {
                                        name: "User",
                                        value:
                                            `<@${record.userId}>`,
                                        inline: true
                                    },
                                    {
                                        name: "Moderator",
                                        value:
                                            `<@${record.moderatorId}>`,
                                        inline: true
                                    },
                                    {
                                        name: "Reason",
                                        value:
                                            truncate(
                                                record.reason,
                                                1024
                                            )
                                    },
                                    {
                                        name: "Created",
                                        value:
                                            `<t:${Math.floor(
                                                record.createdAt.getTime() /
                                                1000
                                            )}:F>`
                                    }
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // CASES
            // ====================================================

            if (command === "cases") {
                const user =
                    interaction.options.getUser(
                        "user"
                    );

                const records =
                    await ModCase.find({
                        guildId:
                            interaction.guild.id,
                        userId:
                            user.id
                    })
                        .sort({
                            createdAt: -1
                        })
                        .limit(20);

                if (!records.length) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                infoEmbed(
                                    "No Cases",
                                    `<@${user.id}> has no moderation cases.`
                                )
                            ]
                        }
                    );
                }

                const description =
                    records
                        .map(
                            record =>
                                `**#${record.caseId}** • ${record.type} • ${truncate(record.reason, 150)}`
                        )
                        .join("\n");

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    `📁 Cases • ${user.tag}`
                                )
                                .setDescription(
                                    description
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // ROLE COMMAND
            // ====================================================

            if (command === "role") {
                const sub =
                    interaction.options.getSubcommand();

                if (
                    sub === "add" ||
                    sub === "remove"
                ) {
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
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Member not found."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (
                        !canBotManageRole(
                            interaction.guild,
                            role
                        )
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "I cannot manage that role because it is above my highest role."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (
                        interaction.member.roles.highest.comparePositionTo(
                            role
                        ) <= 0 &&
                        interaction.guild.ownerId !==
                            interaction.user.id
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "You cannot manage a role equal to or above your highest role."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (sub === "add") {
                        await member.roles.add(
                            role,
                            `Added by ${interaction.user.tag}`
                        );

                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    successEmbed(
                                        "Role Added",
                                        `${role} was added to <@${member.id}>.`
                                    )
                                ]
                            }
                        );
                    }

                    await member.roles.remove(
                        role,
                        `Removed by ${interaction.user.tag}`
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Role Removed",
                                    `${role} was removed from <@${member.id}>.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "create") {
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

                    await sendLog(
                        interaction.guild,
                        "role",
                        "🎭 Role Created",
                        `${role} was created by <@${interaction.user.id}>.`,
                        0x57f287
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Role Created",
                                    `${role} has been created.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "delete") {
                    const role =
                        interaction.options.getRole(
                            "role"
                        );

                    if (
                        !canBotManageRole(
                            interaction.guild,
                            role
                        )
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "I cannot delete that role."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const name =
                        role.name;

                    await role.delete(
                        `Deleted by ${interaction.user.tag}`
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Role Deleted",
                                    `**${name}** has been deleted.`
                                )
                            ]
                        }
                    );
                }
            }

            // ====================================================
            // WELCOME
            // ====================================================

            if (command === "welcome") {
                const sub =
                    interaction.options.getSubcommand();

                const config =
                    await getWelcomeConfig(
                        interaction.guild.id
                    );

                if (sub === "setup") {
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

                    config.enabled = true;
                    config.channelId =
                        channel.id;

                    if (role) {
                        if (
                            !canBotManageRole(
                                interaction.guild,
                                role
                            )
                        ) {
                            return safeReply(
                                interaction,
                                {
                                    embeds: [
                                        errorEmbed(
                                            "I cannot assign that role because it is above my highest role."
                                        )
                                    ],
                                    flags:
                                        MessageFlags.Ephemeral
                                }
                            );
                        }

                        config.roleId =
                            role.id;
                    }

                    if (message) {
                        config.message =
                            message;
                    }

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Welcome Enabled",
                                    `Welcome messages will be sent in ${channel}.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "config") {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                buildWelcomeConfigEmbed(
                                    config
                                )
                            ]
                        }
                    );
                }

                if (sub === "test") {
                    if (
                        !config.enabled ||
                        !config.channelId
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Welcome is not configured."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const channel =
                        interaction.guild.channels.cache.get(
                            config.channelId
                        );

                    if (
                        !channel ||
                        !channel.isTextBased()
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "The configured welcome channel no longer exists."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const embed =
                        baseEmbed(
                            config.color
                        )
                            .setTitle(
                                config.title
                            )
                            .setDescription(
                                replaceVariables(
                                    config.message,
                                    interaction.member
                                )
                            );

                    if (config.image) {
                        embed.setImage(
                            config.image
                        );
                    }

                    if (config.thumbnail) {
                        embed.setThumbnail(
                            config.thumbnail
                        );
                    }

                    await channel.send({
                        content:
                            config.mention
                                ? `<@${interaction.user.id}>`
                                : undefined,
                        embeds: [embed]
                    });

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Welcome Tested",
                                    `Test sent to ${channel}.`
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                if (sub === "disable") {
                    config.enabled =
                        false;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Welcome Disabled",
                                    "Welcome messages are now disabled."
                                )
                            ]
                        }
                    );
                }
            }

            // ====================================================
            // LOGS
            // ====================================================

            if (command === "logs") {
                const sub =
                    interaction.options.getSubcommand();

                const config =
                    await getLogConfig(
                        interaction.guild.id
                    );

            

                if (sub === "on") {
                    config.enabled =
                        true;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Logging Enabled",
                                    "27Pro logging is now enabled."
                                )
                            ]
                        }
                    );
                }

                if (sub === "off") {
                    config.enabled =
                        false;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Logging Disabled",
                                    "Logging has been temporarily disabled."
                                )
                            ]
                        }
                    );
                }

                if (sub === "disable") {
                    config.enabled =
                        false;

                    config.channels =
                        {
                            general: null,
                            member: null,
                            message: null,
                            moderation: null,
                            role: null,
                            channel: null,
                            server: null,
                            bot: null,
                            voice: null,
                            automod: null,
                            ticket: null,
                            security: null,
                            giveaway: null
                        };

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Logging Disabled",
                                    "Logging has been disabled and configured channels were cleared."
                                )
                            ]
                        }
                    );
                }

                if (sub === "setup") {
                    const type =
                        interaction.options.getString(
                            "type"
                        );

                    const channel =
                        interaction.options.getChannel(
                            "channel"
                        );

                    config.channels[type] =
                        channel.id;

                    config.enabled =
                        true;

                    config.markModified(
                        "channels"
                    );

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Log Channel Configured",
                                    `**${type}** logs will now be sent to ${channel}.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "config") {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                buildLogConfigEmbed(
                                    config
                                )
                            ]
                        }
                    );
                }

                if (sub === "test") {
                    await sendLog(
                        interaction.guild,
                        "general",
                        "🧪 Log Test",
                        `Logging test requested by <@${interaction.user.id}>.`,
                        0x5865f2
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Log Test Sent",
                                    "A test log was sent to the configured general log channel."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }
            }

            // ====================================================
            // AUTOMOD
            // ====================================================

            if (command === "automod") {
                const sub =
                    interaction.options.getSubcommand();

                const config =
                    await getAutoModConfig(
                        interaction.guild.id
                    );

                if (sub === "enable") {
                    config.enabled =
                        true;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "AutoMod Enabled",
                                    "Automatic moderation is now active."
                                )
                            ]
                        }
                    );
                }

                if (sub === "disable") {
                    config.enabled =
                        false;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "AutoMod Disabled",
                                    "Automatic moderation is now disabled."
                                )
                            ]
                        }
                    );
                }

                if (sub === "config") {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                buildAutoModEmbed(
                                    config
                                )
                            ]
                        }
                    );
                }

                if (sub === "punishment") {
                    const type =
                        interaction.options.getString(
                            "type"
                        );

                    config.punishment =
                        type;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "AutoMod Punishment Updated",
                                    `New punishment: **${type}**.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "word") {
                    const word =
                        interaction.options.getString(
                            "word"
                        )
                            .trim()
                            .toLowerCase();

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

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Blocked Word Added",
                                    `\`${word}\` has been added to AutoMod.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "unword") {
                    const word =
                        interaction.options.getString(
                            "word"
                        )
                            .trim()
                            .toLowerCase();

                    config.blockedWords =
                        config.blockedWords.filter(
                            item =>
                                item !== word
                        );

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Blocked Word Removed",
                                    `\`${word}\` has been removed from AutoMod.`
                                )
                            ]
                        }
                    );
                }
            }

            // ====================================================
            // TICKETS
            // ====================================================

            if (command === "ticket") {
                const sub =
                    interaction.options.getSubcommand();

                const config =
                    await getTicketConfig(
                        interaction.guild.id
                    );

                if (sub === "setup") {
                    const category =
                        interaction.options.getChannel(
                            "category"
                        );

                    const staff =
                        interaction.options.getRole(
                            "staff"
                        );

                    const logs =
                        interaction.options.getChannel(
                            "logs"
                        );

                    if (
                        !canBotManageRole(
                            interaction.guild,
                            staff
                        )
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "My role must be above the ticket staff role."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    config.enabled =
                        true;

                    config.categoryId =
                        category.id;

                    config.staffRoleId =
                        staff.id;

                    if (logs) {
                        config.logChannelId =
                            logs.id;

                        config.transcriptChannelId =
                            logs.id;
                    }

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Tickets Configured",
                                    [
                                        `**Category:** ${category}`,
                                        `**Staff:** ${staff}`,
                                        logs
                                            ? `**Logs:** ${logs}`
                                            : "**Logs:** Not configured"
                                    ].join("\n")
                                )
                            ]
                        }
                    );
                }

                if (sub === "panel") {
                    if (!config.enabled) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Run `/ticket setup` first."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const channel =
                        interaction.options.getChannel(
                            "channel"
                        );

                    const embed =
                        baseEmbed(0x5865f2)
                            .setTitle(
                                "🎫 Support Center"
                            )
                            .setDescription(
                                [
                                    "Need help?",
                                    "",
                                    "Click the button below to create a private support ticket.",
                                    "",
                                    "A member of staff will assist you."
                                ].join("\n")
                            );

                    const row =
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(
                                        "ticket_create"
                                    )
                                    .setLabel(
                                        "Create Ticket"
                                    )
                                    .setEmoji("🎫")
                                    .setStyle(
                                        ButtonStyle.Primary
                                    )
                            );

                    const message =
                        await channel.send({
                            embeds: [embed],
                            components: [row]
                        });

                    config.panelChannelId =
                        channel.id;

                    config.panelMessageId =
                        message.id;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Ticket Panel Created",
                                    `Panel created in ${channel}.`
                                )
                            ]
                        }
                    );
                }

                if (
                    sub === "close" ||
                    sub === "reopen" ||
                    sub === "claim" ||
                    sub === "delete"
                ) {
                    const ticket =
                        await getCurrentTicket(
                            interaction.guild,
                            interaction.channel.id
                        );

                    if (!ticket) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "This channel is not a ticket."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (
                        sub === "claim"
                    ) {
                        const staff =
                            await isTicketStaff(
                                interaction
                            );

                        if (!staff) {
                            return safeReply(
                                interaction,
                                {
                                    embeds: [
                                        errorEmbed(
                                            "Only ticket staff can claim tickets."
                                        )
                                    ],
                                    flags:
                                        MessageFlags.Ephemeral
                                }
                            );
                        }

                        if (
                            ticket.claimedBy
                        ) {
                            return safeReply(
                                interaction,
                                {
                                    embeds: [
                                        infoEmbed(
                                            "Already Claimed",
                                            `Claimed by <@${ticket.claimedBy}>.`
                                        )
                                    ],
                                    flags:
                                        MessageFlags.Ephemeral
                                }
                            );
                        }

                        ticket.claimedBy =
                            interaction.user.id;

                        await ticket.save();

                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    successEmbed(
                                        "Ticket Claimed",
                                        `You are now handling this ticket.`
                                    )
                                ]
                            }
                        );
                    }

                    if (
                        sub === "delete"
                    ) {
                        if (
                            !await isTicketStaff(
                                interaction
                            )
                        ) {
                            return safeReply(
                                interaction,
                                {
                                    embeds: [
                                        errorEmbed(
                                            "Only ticket staff can delete tickets."
                                        )
                                    ],
                                    flags:
                                        MessageFlags.Ephemeral
                                }
                            );
                        }

                        await safeReply(
                            interaction,
                            {
                                embeds: [
                                    infoEmbed(
                                        "Deleting",
                                        "Deleting ticket and generating transcript..."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );

                        return deleteTicket(
                            ticket,
                            interaction.channel,
                            interaction.user.id
                        );
                    }

                    if (
                        sub === "close"
                    ) {
                        await closeTicket(
                            ticket,
                            interaction.channel,
                            interaction.user.id
                        );

                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    successEmbed(
                                        "Ticket Closed",
                                        "This ticket has been archived."
                                    )
                                ]
                            }
                        );
                    }

                    if (
                        sub === "reopen"
                    ) {
                        await reopenTicket(
                            ticket,
                            interaction.channel,
                            interaction.user.id
                        );

                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    successEmbed(
                                        "Ticket Reopened",
                                        "This ticket is open again."
                                    )
                                ]
                            }
                        );
                    }
                }

                if (
                    sub === "add" ||
                    sub === "remove"
                ) {
                    const ticket =
                        await getCurrentTicket(
                            interaction.guild,
                            interaction.channel.id
                        );

                    if (!ticket) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "This channel is not a ticket."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (
                        !await isTicketStaff(
                            interaction
                        )
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Only ticket staff can manage ticket members."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const user =
                        interaction.options.getUser(
                            "user"
                        );

                    if (sub === "add") {
                        await interaction.channel.permissionOverwrites.edit(
                            user.id,
                            {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true,
                                AttachFiles: true
                            }
                        );

                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    successEmbed(
                                        "Member Added",
                                        `<@${user.id}> can now access this ticket.`
                                    )
                                ]
                            }
                        );
                    }

                    await interaction.channel.permissionOverwrites.delete(
                        user.id
                    ).catch(() => {});

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Member Removed",
                                    `<@${user.id}> has been removed from this ticket.`
                                )
                            ]
                        }
                    );
                }
            }

            // ====================================================
            // RULES
            // ====================================================

            if (command === "rules") {
                const sub =
                    interaction.options.getSubcommand();

                const config =
                    await getRulesConfig(
                        interaction.guild.id
                    );

                if (sub === "setup") {
                    const channel =
                        interaction.options.getChannel(
                            "channel"
                        );

                    config.channelId =
                        channel.id;

                    config.enabled =
                        true;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Rules Configured",
                                    `Rules channel set to ${channel}.\nUse \`/rules set\` to add your rules, then \`/rules publish\`.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "set") {
                    const section =
                        interaction.options.getString(
                            "section"
                        );

                    const text =
                        interaction.options.getString(
                            "text"
                        );

                    config.sections.set(
                        section,
                        text
                    );

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Rules Updated",
                                    `The **${RULE_SECTIONS[section].label}** section has been updated.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "preview") {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                buildRulesEmbed(
                                    config
                                )
                            ],
                            components: [
                                rulesSelectMenu()
                            ]
                        }
                    );
                }

                if (sub === "publish") {
                    if (
                        !config.channelId
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Run `/rules setup` first."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const channel =
                        interaction.guild.channels.cache.get(
                            config.channelId
                        );

                    if (
                        !channel ||
                        !channel.isTextBased()
                    ) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "The configured rules channel no longer exists."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const message =
                        await publishRules(
                            interaction.guild,
                            channel
                        );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Rules Published",
                                    `Rules published in ${channel}.`
                                )
                            ]
                        }
                    );
                }
            }

            // ====================================================
            // GIVEAWAY
            // ====================================================

            if (command === "giveaway") {
                const sub =
                    interaction.options.getSubcommand();

                if (sub === "start") {
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

                    const endAt =
                        new Date(
                            Date.now() +
                            minutes *
                            60 *
                            1000
                        );

                    const giveaway =
                        await Giveaway.create({
                            guildId:
                                interaction.guild.id,
                            channelId:
                                interaction.channel.id,
                            messageId:
                                "pending",
                            hostId:
                                interaction.user.id,
                            prize,
                            winners,
                            endAt,
                            participants: []
                        });

                    const message =
                        await interaction.channel.send({
                            embeds: [
                                giveawayEmbed(
                                    giveaway
                                )
                            ],
                            components: [
                                giveawayRow(
                                    giveaway._id.toString()
                                )
                            ]
                        });

                    giveaway.messageId =
                        message.id;

                    await giveaway.save();

                    scheduleGiveaway(
                        giveaway
                    );

                    await sendLog(
                        interaction.guild,
                        "giveaway",
                        "🎉 Giveaway Started",
                        `**Prize:** ${prize}\n**Winners:** ${winners}\n**Duration:** ${minutes} minute(s)\n**Host:** <@${interaction.user.id}>`,
                        0x57f287
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Giveaway Started",
                                    `Giveaway created in ${interaction.channel}.`
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                if (
                    sub === "end" ||
                    sub === "reroll"
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
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "Giveaway not found."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    if (sub === "end") {
                        await finishGiveaway(
                            giveaway._id.toString()
                        );

                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    successEmbed(
                                        "Giveaway Ended",
                                        "The giveaway has been ended."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    const winners =
                        chooseGiveawayWinners(
                            giveaway.participants,
                            giveaway.winners
                        );

                    if (!winners.length) {
                        return safeReply(
                            interaction,
                            {
                                embeds: [
                                    errorEmbed(
                                        "There are no participants to reroll."
                                    )
                                ],
                                flags:
                                    MessageFlags.Ephemeral
                            }
                        );
                    }

                    await interaction.channel.send({
                        content:
                            `🎉 Giveaway reroll!\nNew winner(s): ${winners.map(id => `<@${id}>`).join(", ")}`
                    });

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Giveaway Rerolled",
                                    "A new winner has been selected."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }
            }

            // ====================================================
            // RANK
            // ====================================================

            if (command === "rank") {
                const user =
                    interaction.options.getUser(
                        "user"
                    ) ||
                    interaction.user;

                const record =
                    await getLevelXP(
                        interaction.guild.id,
                        user.id
                    );

                const nextLevel =
                    Number(record.level) + 1;

                const currentRequirement =
                    xpRequiredForLevel(
                        record.level
                    );

                const nextRequirement =
                    xpRequiredForLevel(
                        nextLevel
                    );

                const progress =
                    Math.max(
                        0,
                        record.xp -
                        currentRequirement
                    );

                const needed =
                    Math.max(
                        1,
                        nextRequirement -
                        currentRequirement
                    );

                const percentage =
                    Math.min(
                        100,
                        Math.floor(
                            progress /
                            needed *
                            100
                        )
                    );

                const bars =
                    10;

                const filled =
                    Math.round(
                        percentage /
                        100 *
                        bars
                    );

                const progressBar =
                    "█".repeat(
                        filled
                    ) +
                    "░".repeat(
                        bars -
                        filled
                    );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed(0x5865f2)
                                .setTitle(
                                    `📈 ${user.username}'s Rank`
                                )
                                .setThumbnail(
                                    user.displayAvatarURL({
                                        size: 256
                                    })
                                )
                                .addFields(
                                    {
                                        name: "Level",
                                        value:
                                            String(
                                                record.level
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "XP",
                                        value:
                                            String(
                                                record.xp
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Next Level",
                                        value:
                                            String(
                                                nextLevel
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Progress",
                                        value:
                                            `${progressBar} ${percentage}%`
                                    }
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // LEADERBOARD
            // ====================================================

            if (command === "leaderboard") {
                const records =
                    await Level.find({
                        guildId:
                            interaction.guild.id
                    })
                        .sort({
                            xp: -1
                        })
                        .limit(10);

                if (!records.length) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                infoEmbed(
                                    "Leaderboard Empty",
                                    "Nobody has earned XP yet."
                                )
                            ]
                        }
                    );
                }

                const lines =
                    records.map(
                        (record, index) =>
                            `**${index + 1}.** <@${record.userId}> • Level **${record.level}** • **${record.xp} XP**`
                    );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    "🏆 Server Leaderboard"
                                )
                                .setDescription(
                                    lines.join("\n")
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // ROLE PANEL
            // ====================================================

            if (command === "rolepanel") {
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

                try {
                    await createRolePanel(
                        interaction.guild,
                        channel,
                        role,
                        label,
                        emoji
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Role Panel Created",
                                    `Role panel created in ${channel}.`
                                )
                            ]
                        }
                    );
                } catch (error) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    error.message
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }
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
                    content: message
                });

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                "Message Sent",
                                "Your message has been sent."
                            )
                        ],
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            // ====================================================
            // ANNOUNCE
            // ====================================================

            if (command === "announce") {
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
                        baseEmbed(0x5865f2)
                            .setTitle(
                                "📢 Announcement"
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
                            })
                    ]
                });

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                "Announcement Sent",
                                `Announcement sent to ${channel}.`
                            )
                        ],
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            // ====================================================
            // POLL
            // ====================================================

            if (command === "poll") {
                const question =
                    interaction.options.getString(
                        "question"
                    );

                const message =
                    await interaction.channel.send({
                        embeds: [
                            baseEmbed(0x5865f2)
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

                await message.react("👍");
                await message.react("👎");

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                "Poll Created",
                                "The poll has been created."
                            )
                        ],
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            // ====================================================
            // REMINDER
            // ====================================================

            if (command === "remind") {
                const minutes =
                    interaction.options.getInteger(
                        "minutes"
                    );

                const message =
                    interaction.options.getString(
                        "message"
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
                        remindAt:
                            new Date(
                                Date.now() +
                                minutes *
                                60 *
                                1000
                            ),
                        sent: false
                    });

                scheduleReminder(
                    reminder
                );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            successEmbed(
                                "Reminder Created",
                                `I'll remind you in **${minutes} minute(s)**.`
                            )
                        ],
                        flags:
                            MessageFlags.Ephemeral
                    }
                );
            }

            // ====================================================
            // COINFLIP
            // ====================================================

            if (command === "coinflip") {
                const result =
                    Math.random() >= 0.5
                        ? "Heads"
                        : "Tails";

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    "🪙 Coin Flip"
                                )
                                .setDescription(
                                    `The coin landed on **${result}**!`
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // ROLL
            // ====================================================

            if (command === "roll") {
                const sides =
                    interaction.options.getInteger(
                        "sides"
                    ) || 6;

                const result =
                    randomInt(
                        1,
                        sides
                    );

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    "🎲 Dice Roll"
                                )
                                .setDescription(
                                    `You rolled a **${result}** on a d${sides}.`
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // 8BALL
            // ====================================================

            if (command === "8ball") {
                const answers = [
                    "Absolutely.",
                    "Yes.",
                    "Probably.",
                    "It looks likely.",
                    "Ask again later.",
                    "I'm not sure.",
                    "Probably not.",
                    "No.",
                    "Definitely not."
                ];

                const question =
                    interaction.options.getString(
                        "question"
                    );

                const answer =
                    answers[
                        randomInt(
                            0,
                            answers.length - 1
                        )
                    ];

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    "🔮 Magic 8-Ball"
                                )
                                .addFields(
                                    {
                                        name: "Question",
                                        value:
                                            question
                                    },
                                    {
                                        name: "Answer",
                                        value:
                                            answer
                                    }
                                )
                        ]
                    }
                );
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
                            value =>
                                value.trim()
                        )
                        .filter(Boolean);

                if (
                    options.length < 2
                ) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "Give me at least two options separated by commas."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                const selected =
                    options[
                        randomInt(
                            0,
                            options.length - 1
                        )
                    ];

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed()
                                .setTitle(
                                    "🎯 Choice"
                                )
                                .setDescription(
                                    `I choose **${selected}**.`
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // LIVE
            // ====================================================

            if (command === "live") {
                const sub =
                    interaction.options.getSubcommand();

                const config =
                    await getKickConfig(
                        interaction.guild.id
                    );

                if (sub === "setup") {
                    const username =
                        interaction.options.getString(
                            "username"
                        )
                            .trim()
                            .replace(/^@/, "");

                    const channel =
                        interaction.options.getChannel(
                            "channel"
                        );

                    config.enabled =
                        true;

                    config.username =
                        username;

                    config.channelId =
                        channel.id;

                    config.lastLive =
                        false;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "KICK Alerts Enabled",
                                    `Monitoring **${username}**.\nNotifications will be sent to ${channel}.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "disable") {
                    config.enabled =
                        false;

                    config.lastLive =
                        false;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "KICK Alerts Disabled",
                                    "KICK live notifications are now disabled."
                                )
                            ]
                        }
                    );
                }

                if (sub === "config") {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                buildKickConfigEmbed(
                                    config
                                )
                            ]
                        }
                    );
                }
            }

            // ====================================================
            // LIVECHECK
            // ====================================================

            if (command === "livecheck") {
                const config =
                    await getKickConfig(
                        interaction.guild.id
                    );

                if (
                    !config.username
                ) {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                errorEmbed(
                                    "KICK has not been configured. Use `/live setup` first."
                                )
                            ],
                            flags:
                                MessageFlags.Ephemeral
                        }
                    );
                }

                await interaction.deferReply();

                const data =
                    await getKickChannel(
                        config.username
                    );

                if (!data) {
                    return interaction.editReply({
                        embeds: [
                            errorEmbed(
                                "I could not retrieve the KICK channel right now."
                            )
                        ]
                    });
                }

                const live =
                    isKickLive(data);

                const stream =
                    getKickStream(data);

                if (!live) {
                    return interaction.editReply({
                        embeds: [
                            baseEmbed(0x747f8d)
                                .setTitle(
                                    "⚫ Currently Offline"
                                )
                                .setDescription(
                                    `**${config.username}** is currently offline on KICK.`
                                )
                        ]
                    });
                }

                const category =
                    getKickCategory(
                        stream,
                        data
                    );

                const title =
                    getKickTitle(
                        stream,
                        data
                    );

                const viewers =
                    getKickViewers(
                        stream
                    );

                const thumbnail =
                    getKickThumbnail(
                        stream,
                        data
                    );

                const embed =
                    baseEmbed(0x57f287)
                        .setTitle(
                            `🔴 ${config.username} is LIVE!`
                        )
                        .setURL(
                            `https://kick.com/${encodeURIComponent(
                                config.username
                            )}`
                        )
                        .setDescription(
                            title
                        )
                        .addFields(
                            {
                                name: "🎮 Category",
                                value:
                                    category,
                                inline: true
                            },
                            {
                                name: "👥 Viewers",
                                value:
                                    String(
                                        viewers
                                    ),
                                inline: true
                            }
                        );

                if (thumbnail) {
                    embed.setImage(
                        thumbnail
                    );
                }

                return interaction.editReply({
                    embeds: [embed]
                });
            }

            // ====================================================
            // SECURITY
            // ====================================================

            if (command === "security") {
                const sub =
                    interaction.options.getSubcommand();

                const config =
                    await getGuildConfig(
                        interaction.guild.id
                    );

                if (sub === "config") {
                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                buildSecurityEmbed(
                                    config
                                )
                            ]
                        }
                    );
                }

                if (sub === "raid") {
                    const enabled =
                        interaction.options.getBoolean(
                            "enabled"
                        );

                    config.security.antiRaid =
                        enabled;

                    await config.save();

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Anti-Raid Updated",
                                    `Anti-raid is now **${enabled ? "enabled" : "disabled"}**.`
                                )
                            ]
                        }
                    );
                }

                if (sub === "lockdown") {
                    await lockdownGuild(
                        interaction.guild
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Server Locked",
                                    "Security lockdown has been activated."
                                )
                            ]
                        }
                    );
                }

                if (sub === "unlock") {
                    await unlockGuild(
                        interaction.guild
                    );

                    return safeReply(
                        interaction,
                        {
                            embeds: [
                                successEmbed(
                                    "Server Unlocked",
                                    "Security lockdown has been removed."
                                )
                            ]
                        }
                    );
                }
            }

            // ====================================================
            // HEALTH
            // ====================================================

            if (command === "health") {
                const mongoState =
                    mongoose.connection.readyState;

                const mongo =
                    mongoState === 1
                        ? "Connected"
                        : "Disconnected";

                return safeReply(
                    interaction,
                    {
                        embeds: [
                            baseEmbed(
                                mongoState === 1
                                    ? 0x57f287
                                    : 0xed4245
                            )
                                .setTitle(
                                    "💚 27Pro Health"
                                )
                                .addFields(
                                    {
                                        name: "Discord",
                                        value:
                                            client.ws.status === 0
                                                ? "Connected"
                                                : "Connecting / Unavailable",
                                        inline: true
                                    },
                                    {
                                        name: "MongoDB",
                                        value:
                                            mongo,
                                        inline: true
                                    },
                                    {
                                        name: "WebSocket",
                                        value:
                                            `${client.ws.ping}ms`,
                                        inline: true
                                    },
                                    {
                                        name: "Uptime",
                                        value:
                                            formatDuration(
                                                client.uptime || 0
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Servers",
                                        value:
                                            String(
                                                client.guilds.cache.size
                                            ),
                                        inline: true
                                    },
                                    {
                                        name: "Memory",
                                        value:
                                            `${Math.round(
                                                process.memoryUsage().rss /
                                                1024 /
                                                1024
                                            )} MB`,
                                        inline: true
                                    }
                                )
                        ]
                    }
                );
            }

            // ====================================================
            // UNKNOWN
            // ====================================================

            return safeReply(
                interaction,
                {
                    embeds: [
                        errorEmbed(
                            `Command \`/${command}\` was received but has no handler.`
                        )
                    ],
                    flags:
                        MessageFlags.Ephemeral
                }
            );
        } catch (error) {
            console.error(
                "[INTERACTION ERROR]",
                error
            );

            return safeReply(
                interaction,
                {
                    embeds: [
                        errorEmbed(
                            `Something went wrong while processing this command.\n\n\`${truncate(
                                error.message,
                                500
                            )}\``
                        )
                    ],
                    flags:
                        MessageFlags.Ephemeral
                }
            );
        }
    }
);



client.on("interactionCreate", async interaction => {
    try {

        // ====================================================
        // BUTTONS
        // ====================================================

        if (interaction.isButton()) {

            const id = interaction.customId;

            // ------------------------------------------------
            // TICKET CREATE
            // ------------------------------------------------

            if (id === "ticket_create") {

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                const config = await getTicketConfig(interaction.guild.id);

                if (!config?.enabled) {
                    return interaction.editReply({
                        content: "❌ The ticket system is not enabled."
                    });
                }

                const existing = await getOpenTicket(
                    interaction.guild.id,
                    interaction.user.id
                );

                if (existing) {
                    const existingChannel =
                        interaction.guild.channels.cache.get(existing.channelId);

                    return interaction.editReply({
                        content: existingChannel
                            ? `❌ You already have an open ticket: ${existingChannel}`
                            : "❌ You already have an open ticket."
                    });
                }

                const ticket = await createTicket(
                    interaction.guild,
                    interaction.user
                );

                if (!ticket) {
                    return interaction.editReply({
                        content: "❌ I couldn't create your ticket."
                    });
                }

                return interaction.editReply({
                    content: `✅ Your ticket has been created: <#${ticket.channelId}>`
                });
            }

            // ------------------------------------------------
            // TICKET CLAIM
            // ------------------------------------------------

            if (id === "ticket_claim") {

                const ticket = await Ticket.findOne({
                    guildId: interaction.guild.id,
                    channelId: interaction.channel.id,
                    status: "open"
                });

                if (!ticket) {
                    return safeReply(interaction, {
                        content: "❌ This is not an open ticket.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const config = await getTicketConfig(
                    interaction.guild.id
                );

                if (
                    config.staffRoleId &&
                    !interaction.member.roles.cache.has(config.staffRoleId) &&
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.ManageChannels
                    )
                ) {
                    return safeReply(interaction, {
                        content: "❌ You don't have permission to claim tickets.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (ticket.claimedBy) {
                    return safeReply(interaction, {
                        content: `❌ This ticket is already claimed by <@${ticket.claimedBy}>.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                ticket.claimedBy = interaction.user.id;
                await ticket.save();

                await interaction.channel.permissionOverwrites.edit(
                    interaction.user.id,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true
                    }
                );

                const embed = baseEmbed(0x57F287)
                    .setTitle("🎫 Ticket Claimed")
                    .setDescription(
                        `${interaction.user} has claimed this ticket.`
                    );

                await interaction.channel.send({
                    embeds: [embed]
                });

                await sendLog(
                    interaction.guild,
                    "ticket",
                    baseEmbed(0x57F287)
                        .setTitle("🎫 Ticket Claimed")
                        .addFields(
                            {
                                name: "Ticket",
                                value: interaction.channel.toString(),
                                inline: true
                            },
                            {
                                name: "Staff",
                                value: interaction.user.toString(),
                                inline: true
                            }
                        )
                );

                return safeReply(interaction, {
                    content: "✅ Ticket claimed.",
                    flags: MessageFlags.Ephemeral
                });
            }

            // ------------------------------------------------
            // TICKET CLOSE
            // ------------------------------------------------

            if (id === "ticket_close") {

                const ticket = await Ticket.findOne({
                    guildId: interaction.guild.id,
                    channelId: interaction.channel.id
                });

                if (!ticket) {
                    return safeReply(interaction, {
                        content: "❌ This is not a ticket.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply();

                const result = await closeTicket(
                    interaction.guild,
                    interaction.channel,
                    interaction.user
                );

                return interaction.editReply({
                    content: result
                        ? "🔒 Ticket closed and archived."
                        : "❌ Failed to close the ticket."
                });
            }

            // ------------------------------------------------
            // TICKET REOPEN
            // ------------------------------------------------

            if (id === "ticket_reopen") {

                const ticket = await Ticket.findOne({
                    guildId: interaction.guild.id,
                    channelId: interaction.channel.id
                });

                if (!ticket) {
                    return safeReply(interaction, {
                        content: "❌ This is not a ticket.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const config = await getTicketConfig(
                    interaction.guild.id
                );

                if (
                    config.staffRoleId &&
                    !interaction.member.roles.cache.has(config.staffRoleId) &&
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.ManageChannels
                    )
                ) {
                    return safeReply(interaction, {
                        content: "❌ You don't have permission to reopen tickets.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const result = await reopenTicket(
                    interaction.guild,
                    interaction.channel,
                    interaction.user
                );

                return safeReply(interaction, {
                    content: result
                        ? "🔓 Ticket reopened."
                        : "❌ Failed to reopen the ticket.",
                    flags: MessageFlags.Ephemeral
                });
            }

            // ------------------------------------------------
            // TICKET DELETE
            // ------------------------------------------------

            if (id === "ticket_delete") {

                const ticket = await Ticket.findOne({
                    guildId: interaction.guild.id,
                    channelId: interaction.channel.id
                });

                if (!ticket) {
                    return safeReply(interaction, {
                        content: "❌ This is not a ticket.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.ManageChannels
                    )
                ) {
                    return safeReply(interaction, {
                        content: "❌ You need Manage Channels to delete tickets.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.reply({
                    content: "🗑️ Deleting ticket in 5 seconds..."
                });

                setTimeout(async () => {
                    try {
                        await deleteTicket(
                            interaction.guild,
                            interaction.channel,
                            interaction.user
                        );
                    } catch (error) {
                        console.error("[TICKET DELETE]", error);
                    }
                }, 5000);

                return;
            }

            // ------------------------------------------------
            // GIVEAWAY JOIN
            // ------------------------------------------------

            if (id.startsWith("giveaway_join:")) {

                const giveawayId = id.split(":")[1];

                const giveaway = await Giveaway.findById(giveawayId);

                if (!giveaway || giveaway.ended) {
                    return safeReply(interaction, {
                        content: "❌ This giveaway has ended.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (!giveaway.participants.includes(interaction.user.id)) {
                    giveaway.participants.push(interaction.user.id);
                    await giveaway.save();

                    return safeReply(interaction, {
                        content: "🎉 You entered the giveaway!",
                        flags: MessageFlags.Ephemeral
                    });
                }

                giveaway.participants =
                    giveaway.participants.filter(
                        id => id !== interaction.user.id
                    );

                await giveaway.save();

                return safeReply(interaction, {
                    content: "❌ You left the giveaway.",
                    flags: MessageFlags.Ephemeral
                });
            }

            // ------------------------------------------------
            // ROLE PANEL
            // ------------------------------------------------

            if (id.startsWith("rolepanel:")) {

                const roleId = id.split(":")[1];

                const role = interaction.guild.roles.cache.get(roleId);

                if (!role) {
                    return safeReply(interaction, {
                        content: "❌ That role no longer exists.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return safeReply(interaction, {
                        content: "❌ I cannot manage that role.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (interaction.member.roles.cache.has(role.id)) {

                    await interaction.member.roles.remove(role);

                    return safeReply(interaction, {
                        content: `➖ Removed ${role} from you.`,
                        flags: MessageFlags.Ephemeral
                    });

                } else {

                    await interaction.member.roles.add(role);

                    return safeReply(interaction, {
                        content: `➕ Added ${role} to you.`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            // ------------------------------------------------
            // SECURITY LOCKDOWN
            // ------------------------------------------------

            if (id === "security_lockdown") {

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.Administrator
                    )
                ) {
                    return safeReply(interaction, {
                        content: "❌ Administrator permission required.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await lockdownGuild(interaction.guild);

                return safeReply(interaction, {
                    content: "🔒 Server lockdown enabled.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (id === "security_unlock") {

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.Administrator
                    )
                ) {
                    return safeReply(interaction, {
                        content: "❌ Administrator permission required.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await unlockGuild(interaction.guild);

                return safeReply(interaction, {
                    content: "🔓 Server lockdown disabled.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return;
        }

        // ====================================================
        // SELECT MENUS
        // ====================================================

        if (interaction.isStringSelectMenu()) {

            if (interaction.customId === "rules_select") {

                const value = interaction.values[0];

                const config = await RulesConfig.findOne({
                    guildId: interaction.guild.id
                });

                if (!config) {
                    return safeReply(interaction, {
                        content: "❌ Rules have not been configured.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const section =
                    config.sections.find(x => x.id === value);

                if (!section) {
                    return safeReply(interaction, {
                        content: "❌ That rules section does not exist.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const embed = baseEmbed(0x5865F2)
                    .setTitle(`📜 ${section.title}`)
                    .setDescription(
                        section.content || "No rules have been added."
                    );

                return safeReply(interaction, {
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });
            }

            return;
        }

        // ====================================================
        // CHAT COMMANDS ONLY
        // ====================================================

        if (!interaction.isChatInputCommand()) return;

        const command = interaction.commandName;

        // ====================================================
        // BASIC INFO
        // ====================================================

        if (command === "ping") {

            return safeReply(interaction, {
                embeds: [
                    baseEmbed(0x57F287)
                        .setTitle("🏓 Pong!")
                        .addFields(
                            {
                                name: "Bot Latency",
                                value: `${client.ws.ping}ms`,
                                inline: true
                            },
                            {
                                name: "Uptime",
                                value: formatDuration(
                                    process.uptime() * 1000
                                ),
                                inline: true
                            }
                        )
                ]
            });
        }

        if (command === "uptime") {

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle("⏱️ Bot Uptime")
                        .setDescription(
                            formatDuration(process.uptime() * 1000)
                        )
                ]
            });
        }

        if (command === "botinfo") {

            const memory =
                process.memoryUsage().rss / 1024 / 1024;

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle(`🤖 ${BOT_NAME}`)
                        .setThumbnail(client.user.displayAvatarURL())
                        .addFields(
                            {
                                name: "Version",
                                value: VERSION,
                                inline: true
                            },
                            {
                                name: "Servers",
                                value: `${client.guilds.cache.size}`,
                                inline: true
                            },
                            {
                                name: "Users",
                                value: `${client.guilds.cache.reduce(
                                    (a, g) => a + (g.memberCount || 0),
                                    0
                                )}`,
                                inline: true
                            },
                            {
                                name: "Memory",
                                value: `${memory.toFixed(1)} MB`,
                                inline: true
                            },
                            {
                                name: "Node",
                                value: process.version,
                                inline: true
                            },
                            {
                                name: "Creator",
                                value: CREATOR,
                                inline: true
                            }
                        )
                ]
            });
        }

        if (command === "serverinfo") {

            const guild = interaction.guild;

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle(`🏠 ${guild.name}`)
                        .setThumbnail(
                            guild.iconURL({ dynamic: true })
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
                                name: "Boosts",
                                value: `${guild.premiumSubscriptionCount || 0}`,
                                inline: true
                            },
                            {
                                name: "Created",
                                value: `<t:${Math.floor(
                                    guild.createdTimestamp / 1000
                                )}:R>`,
                                inline: true
                            }
                        )
                ]
            });
        }

        if (command === "membercount") {

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle("👥 Member Count")
                        .setDescription(
                            `This server has **${interaction.guild.memberCount}** members.`
                        )
                ]
            });
        }

        if (command === "userinfo") {

            const user =
                interaction.options.getUser("user") ||
                interaction.user;

            const member =
                interaction.guild.members.cache.get(user.id);

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle(`👤 ${user.tag}`)
                        .setThumbnail(
                            user.displayAvatarURL({ size: 1024 })
                        )
                        .addFields(
                            {
                                name: "User ID",
                                value: user.id,
                                inline: true
                            },
                            {
                                name: "Account Created",
                                value: `<t:${Math.floor(
                                    user.createdTimestamp / 1000
                                )}:F>`,
                                inline: true
                            },
                            {
                                name: "Joined Server",
                                value: member
                                    ? `<t:${Math.floor(
                                        member.joinedTimestamp / 1000
                                    )}:F>`
                                    : "Unknown",
                                inline: true
                            },
                            {
                                name: "Highest Role",
                                value: member
                                    ? memberHighestRole(member)
                                    : "None",
                                inline: true
                            }
                        )
                ]
            });
        }

        if (command === "avatar") {

            const user =
                interaction.options.getUser("user") ||
                interaction.user;

            return safeReply(interaction, {
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
        }

        if (command === "banner") {

            const user =
                interaction.options.getUser("user") ||
                interaction.user;

            const fetched = await client.users.fetch(
                user.id,
                { force: true }
            );

            if (!fetched.banner) {
                return safeReply(interaction, {
                    content: "❌ This user does not have a profile banner.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle(`🎨 ${user.username}'s Banner`)
                        .setImage(
                            fetched.bannerURL({
                                size: 4096,
                                extension: "png"
                            })
                        )
                ]
            });
        }

        if (command === "roleinfo") {

            const role =
                interaction.options.getRole("role");

            return safeReply(interaction, {
                embeds: [
                    baseEmbed(role.color || 0x5865F2)
                        .setTitle(`🎭 ${role.name}`)
                        .addFields(
                            {
                                name: "ID",
                                value: role.id,
                                inline: true
                            },
                            {
                                name: "Position",
                                value: `${role.position}`,
                                inline: true
                            },
                            {
                                name: "Members",
                                value: `${role.members.size}`,
                                inline: true
                            },
                            {
                                name: "Mentionable",
                                value: role.mentionable ? "Yes" : "No",
                                inline: true
                            },
                            {
                                name: "Hoisted",
                                value: role.hoist ? "Yes" : "No",
                                inline: true
                            }
                        )
                ]
            });
        }

        if (command === "channelinfo") {

            const channel =
                interaction.options.getChannel("channel") ||
                interaction.channel;

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle(`📺 ${channel.name}`)
                        .addFields(
                            {
                                name: "ID",
                                value: channel.id,
                                inline: true
                            },
                            {
                                name: "Type",
                                value: `${channel.type}`,
                                inline: true
                            },
                            {
                                name: "Category",
                                value: channel.parent
                                    ? channel.parent.name
                                    : "None",
                                inline: true
                            }
                        )
                ]
            });
        }

        // ====================================================
        // MODERATION
        // ====================================================

        if (command === "warn") {

            const target =
                interaction.options.getMember("user");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            if (!target) {
                return safeReply(interaction, {
                    content: "❌ Member not found.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (
                target.id === interaction.user.id ||
                target.user.bot
            ) {
                return safeReply(interaction, {
                    content: "❌ You cannot warn that user.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (
                !moderatorCanAct(
                    interaction.member,
                    target
                )
            ) {
                return safeReply(interaction, {
                    content: "❌ You cannot moderate that member.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const caseData =
                await createCase(
                    interaction.guild,
                    "WARN",
                    target.user,
                    interaction.user,
                    reason
                );

            await Warning.create({
                guildId: interaction.guild.id,
                userId: target.id,
                moderatorId: interaction.user.id,
                reason,
                caseId: caseData.caseId
            });

            await sendModerationDM(
                target.user,
                interaction.guild,
                "Warning",
                reason
            );

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0xFEE75C)
                    .setTitle("⚠️ Member Warned")
                    .addFields(
                        {
                            name: "User",
                            value: target.user.tag,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: interaction.user.tag,
                            inline: true
                        },
                        {
                            name: "Case",
                            value: `#${caseData.caseId}`,
                            inline: true
                        },
                        {
                            name: "Reason",
                            value: reason
                        }
                    )
            );

            return safeReply(interaction, {
                embeds: [
                    baseEmbed(0xFEE75C)
                        .setTitle("⚠️ Warning Issued")
                        .setDescription(
                            `${target} has been warned.`
                        )
                        .addFields({
                            name: "Case",
                            value: `#${caseData.caseId}`,
                            inline: true
                        })
                ]
            });
        }

        if (command === "warnings") {

            const sub =
                interaction.options.getSubcommand();

            const target =
                interaction.options.getUser("user");

            if (sub === "view") {

                const warnings =
                    await Warning.find({
                        guildId: interaction.guild.id,
                        userId: target.id
                    })
                    .sort({ createdAt: -1 })
                    .limit(20);

                if (!warnings.length) {
                    return safeReply(interaction, {
                        content: "✅ This user has no warnings.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const description =
                    warnings.map((w, i) =>
                        `**${i + 1}.** Case #${w.caseId} — ${truncate(w.reason, 150)}\n` +
                        `Moderator: <@${w.moderatorId}>`
                    ).join("\n\n");

                return safeReply(interaction, {
                    embeds: [
                        baseEmbed(0xFEE75C)
                            .setTitle(`⚠️ Warnings — ${target.tag}`)
                            .setDescription(description)
                    ]
                });
            }

            if (sub === "clear") {

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.ManageMessages
                    )
                ) {
                    return safeReply(interaction, {
                        content: "❌ Manage Messages required.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await Warning.deleteMany({
                    guildId: interaction.guild.id,
                    userId: target.id
                });

                return safeReply(interaction, {
                    content: `✅ Cleared all warnings for ${target.tag}.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        if (command === "kick") {

            const target =
                interaction.options.getMember("user");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            if (!target) {
                return safeReply(interaction, {
                    content: "❌ Member not found.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!moderatorCanAct(interaction.member, target)) {
                return safeReply(interaction, {
                    content: "❌ You cannot moderate this member.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!botCanModerate(target)) {
                return safeReply(interaction, {
                    content: "❌ My role is not high enough to kick this member.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const caseData =
                await createCase(
                    interaction.guild,
                    "KICK",
                    target.user,
                    interaction.user,
                    reason
                );

            await sendModerationDM(
                target.user,
                interaction.guild,
                "Kick",
                reason
            );

            await target.kick(reason);

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0xED4245)
                    .setTitle("👢 Member Kicked")
                    .addFields(
                        {
                            name: "User",
                            value: `${target.user.tag} (${target.id})`,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: interaction.user.tag,
                            inline: true
                        },
                        {
                            name: "Case",
                            value: `#${caseData.caseId}`,
                            inline: true
                        },
                        {
                            name: "Reason",
                            value: reason
                        }
                    )
            );

            return safeReply(interaction, {
                content: `👢 ${target.user.tag} was kicked. Case #${caseData.caseId}`
            });
        }

        if (command === "ban") {

            const target =
                interaction.options.getMember("user");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            if (!target) {
                return safeReply(interaction, {
                    content: "❌ Member not found.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!moderatorCanAct(interaction.member, target)) {
                return safeReply(interaction, {
                    content: "❌ You cannot moderate this member.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!botCanModerate(target)) {
                return safeReply(interaction, {
                    content: "❌ My role is not high enough to ban this member.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const caseData =
                await createCase(
                    interaction.guild,
                    "BAN",
                    target.user,
                    interaction.user,
                    reason
                );

            await sendModerationDM(
                target.user,
                interaction.guild,
                "Ban",
                reason
            );

            await target.ban({
                reason,
                deleteMessageSeconds: 0
            });

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0xED4245)
                    .setTitle("🔨 Member Banned")
                    .addFields(
                        {
                            name: "User",
                            value: `${target.user.tag} (${target.id})`,
                            inline: true
                        },
                        {
                            name: "Moderator",
                            value: interaction.user.tag,
                            inline: true
                        },
                        {
                            name: "Case",
                            value: `#${caseData.caseId}`,
                            inline: true
                        },
                        {
                            name: "Reason",
                            value: reason
                        }
                    )
            );

            return safeReply(interaction, {
                content: `🔨 ${target.user.tag} was banned. Case #${caseData.caseId}`
            });
        }

        if (command === "unban") {

            const userId =
                interaction.options.getString("user_id");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            await interaction.guild.members.unban(
                userId,
                reason
            );

            await createCase(
                interaction.guild,
                "UNBAN",
                { id: userId, tag: userId },
                interaction.user,
                reason
            );

            return safeReply(interaction, {
                content: `✅ <@${userId}> has been unbanned.`
            });
        }

        if (command === "timeout") {

            const target =
                interaction.options.getMember("user");

            const minutes =
                interaction.options.getInteger("minutes");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            if (!target) {
                return safeReply(interaction, {
                    content: "❌ Member not found.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!moderatorCanAct(interaction.member, target)) {
                return safeReply(interaction, {
                    content: "❌ You cannot timeout this member.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!botCanModerate(target)) {
                return safeReply(interaction, {
                    content: "❌ My role is not high enough.",
                    flags: MessageFlags.Ephemeral
                });
            }

            await target.timeout(
                minutes * 60 * 1000,
                reason
            );

            const caseData =
                await createCase(
                    interaction.guild,
                    "TIMEOUT",
                    target.user,
                    interaction.user,
                    reason,
                    minutes
                );

            await sendModerationDM(
                target.user,
                interaction.guild,
                "Timeout",
                `${reason}\nDuration: ${minutes} minute(s)`
            );

            await sendLog(
                interaction.guild,
                "moderation",
                baseEmbed(0xFEE75C)
                    .setTitle("🔇 Member Timed Out")
                    .addFields(
                        {
                            name: "User",
                            value: target.user.tag,
                            inline: true
                        },
                        {
                            name: "Duration",
                            value: `${minutes} minute(s)`,
                            inline: true
                        },
                        {
                            name: "Case",
                            value: `#${caseData.caseId}`,
                            inline: true
                        },
                        {
                            name: "Reason",
                            value: reason
                        }
                    )
            );

            return safeReply(interaction, {
                content: `🔇 ${target.user.tag} timed out for ${minutes} minute(s).`
            });
        }

        if (command === "untimeout") {

            const target =
                interaction.options.getMember("user");

            if (!target) {
                return safeReply(interaction, {
                    content: "❌ Member not found.",
                    flags: MessageFlags.Ephemeral
                });
            }

            await target.timeout(null);

            return safeReply(interaction, {
                content: `🔊 Timeout removed from ${target.user.tag}.`
            });
        }

        if (command === "nick") {

            const target =
                interaction.options.getMember("user");

            const nickname =
                interaction.options.getString("nickname");

            if (!target) {
                return safeReply(interaction, {
                    content: "❌ Member not found.",
                    flags: MessageFlags.Ephemeral
                });
            }

            await target.setNickname(
                nickname || null
            );

            return safeReply(interaction, {
                content: `✅ Nickname updated for ${target.user.tag}.`
            });
        }

        if (command === "clear") {

            const amount =
                interaction.options.getInteger("amount");

            const deleted =
                await interaction.channel.bulkDelete(
                    amount,
                    true
                );

            return safeReply(interaction, {
                content: `🧹 Deleted ${deleted.size} message(s).`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (command === "slowmode") {

            const seconds =
                interaction.options.getInteger("seconds");

            await interaction.channel.setRateLimitPerUser(
                seconds
            );

            return safeReply(interaction, {
                content: seconds
                    ? `🐢 Slowmode set to ${seconds} seconds.`
                    : "⚡ Slowmode disabled."
            });
        }

        if (command === "lock") {

            await interaction.channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: false
                }
            );

            return safeReply(interaction, {
                content: "🔒 Channel locked."
            });
        }

        if (command === "unlock") {

            await interaction.channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                {
                    SendMessages: null
                }
            );

            return safeReply(interaction, {
                content: "🔓 Channel unlocked."
            });
        }

        if (command === "case") {

            const id =
                interaction.options.getInteger("id");

            const data =
                await ModCase.findOne({
                    guildId: interaction.guild.id,
                    caseId: id
                });

            if (!data) {
                return safeReply(interaction, {
                    content: "❌ Case not found.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle(`📁 Case #${data.caseId}`)
                        .addFields(
                            {
                                name: "Type",
                                value: data.type,
                                inline: true
                            },
                            {
                                name: "User",
                                value: `<@${data.userId}>`,
                                inline: true
                            },
                            {
                                name: "Moderator",
                                value: `<@${data.moderatorId}>`,
                                inline: true
                            },
                            {
                                name: "Reason",
                                value: data.reason || "None"
                            }
                        )
                ]
            });
        }

        if (command === "cases") {

            const user =
                interaction.options.getUser("user");

            const cases =
                await ModCase.find({
                    guildId: interaction.guild.id,
                    userId: user.id
                })
                .sort({ createdAt: -1 })
                .limit(20);

            if (!cases.length) {
                return safeReply(interaction, {
                    content: "No moderation cases found.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle(`📁 Cases — ${user.tag}`)
                        .setDescription(
                            cases.map(c =>
                                `**#${c.caseId}** • ${c.type} • ${truncate(c.reason, 100)}`
                            ).join("\n")
                        )
                ]
            });
        }

        // ====================================================
        // ROLE MANAGEMENT
        // ====================================================

        if (command === "role") {

            const sub =
                interaction.options.getSubcommand();

            if (sub === "add") {

                const member =
                    interaction.options.getMember("user");

                const role =
                    interaction.options.getRole("role");

                if (!member || !role) {
                    return safeReply(interaction, {
                        content: "❌ Invalid member or role.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await member.roles.add(role);

                return safeReply(interaction, {
                    content: `✅ Added ${role} to ${member}.`
                });
            }

            if (sub === "remove") {

                const member =
                    interaction.options.getMember("user");

                const role =
                    interaction.options.getRole("role");

                await member.roles.remove(role);

                return safeReply(interaction, {
                    content: `✅ Removed ${role} from ${member}.`
                });
            }

            if (sub === "create") {

                const name =
                    interaction.options.getString("name");

                const role =
                    await interaction.guild.roles.create({
                        name,
                        reason: `Created by ${interaction.user.tag}`
                    });

                return safeReply(interaction, {
                    content: `✅ Created ${role}.`
                });
            }

            if (sub === "delete") {

                const role =
                    interaction.options.getRole("role");

                await role.delete(
                    `Deleted by ${interaction.user.tag}`
                );

                return safeReply(interaction, {
                    content: "🗑️ Role deleted."
                });
            }
        }

        // ====================================================
        // WELCOME
        // ====================================================

        if (command === "welcome") {

            const sub =
                interaction.options.getSubcommand();

            if (sub === "setup") {

                const channel =
                    interaction.options.getChannel("channel");

                const role =
                    interaction.options.getRole("role");

                const message =
                    interaction.options.getString("message");

                let config =
                    await WelcomeConfig.findOne({
                        guildId: interaction.guild.id
                    });

                if (!config) {
                    config = new WelcomeConfig({
                        guildId: interaction.guild.id
                    });
                }

                config.enabled = true;
                config.channelId = channel.id;

                if (role) {
                    config.roleId = role.id;
                }

                if (message) {
                    config.message = message;
                }

                await config.save();

                return safeReply(interaction, {
                    content:
                        `✅ Welcome system enabled in ${channel}.`
                });
            }

            if (sub === "config") {

                const config =
                    await getWelcomeConfig(
                        interaction.guild.id
                    );

                return safeReply(interaction, {
                    embeds: [
                        baseEmbed()
                            .setTitle("👋 Welcome Configuration")
                            .addFields(
                                {
                                    name: "Enabled",
                                    value: config.enabled ? "Yes" : "No",
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
                                        : "None",
                                    inline: true
                                },
                                {
                                    name: "Message",
                                    value: truncate(
                                        config.message || "None",
                                        1000
                                    )
                                }
                            )
                    ]
                });
            }

            if (sub === "test") {

                const config =
                    await getWelcomeConfig(
                        interaction.guild.id
                    );

                if (
                    !config.enabled ||
                    !config.channelId
                ) {
                    return safeReply(interaction, {
                        content: "❌ Welcome is not configured.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const channel =
                    interaction.guild.channels.cache.get(
                        config.channelId
                    );

                if (!channel) {
                    return safeReply(interaction, {
                        content: "❌ Welcome channel not found.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await sendWelcome(
                    interaction.guild,
                    interaction.member,
                    true
                );

                return safeReply(interaction, {
                    content: "✅ Welcome test sent.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (sub === "disable") {

                await WelcomeConfig.findOneAndUpdate(
                    {
                        guildId: interaction.guild.id
                    },
                    {
                        enabled: false
                    },
                    {
                        upsert: true
                    }
                );

                return safeReply(interaction, {
                    content: "✅ Welcome system disabled."
                });
            }
        }

        // ====================================================
        // LOGS
        // ====================================================

        if (command === "logs") {

            const sub =
                interaction.options.getSubcommand(false);

            // IMPORTANT:
            // These EXACT names must exist in Part 1:
            // on / off / setup / config / test / disable

            if (sub === "on") {

                let config =
                    await getLogConfig(
                        interaction.guild.id
                    );

                config.enabled = true;

                await config.save();

                return safeReply(interaction, {
                    content:
                        "✅ Advanced logging has been enabled."
                });
            }

            if (sub === "off") {

                let config =
                    await getLogConfig(
                        interaction.guild.id
                    );

                config.enabled = false;

                await config.save();

                return safeReply(interaction, {
                    content:
                        "⛔ Advanced logging has been disabled."
                });
            }

            if (sub === "setup") {

                const type =
                    interaction.options.getString("type");

                const channel =
                    interaction.options.getChannel("channel");

                let config =
                    await getLogConfig(
                        interaction.guild.id
                    );

                config.enabled = true;

                if (!config.channels) {
                    config.channels = {};
                }

                config.channels[type] = channel.id;

                config.markModified("channels");

                await config.save();

                return safeReply(interaction, {
                    content:
                        `✅ ${type} logs will now be sent to ${channel}.`
                });
            }

            if (sub === "config") {

                const config =
                    await getLogConfig(
                        interaction.guild.id
                    );

                const channels =
                    Object.entries(
                        config.channels || {}
                    )
                    .map(([key, value]) =>
                        `**${key}:** ${value ? `<#${value}>` : "Not configured"}`
                    )
                    .join("\n");

                return safeReply(interaction, {
                    embeds: [
                        baseEmbed()
                            .setTitle("📋 Logging Configuration")
                            .setDescription(
                                `**Enabled:** ${config.enabled ? "Yes" : "No"}\n\n${channels || "No channels configured."}`
                            )
                    ]
                });
            }

            if (sub === "test") {

                await sendLog(
                    interaction.guild,
                    "general",
                    baseEmbed(0x57F287)
                        .setTitle("🧪 Logging Test")
                        .setDescription(
                            "If you can see this message, logging is working correctly."
                        )
                        .addFields({
                            name: "Triggered By",
                            value: interaction.user.tag
                        })
                );

                return safeReply(interaction, {
                    content: "✅ Test log sent.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (sub === "disable") {

                const config =
                    await getLogConfig(
                        interaction.guild.id
                    );

                config.enabled = false;

                await config.save();

                return safeReply(interaction, {
                    content: "⛔ Logging disabled."
                });
            }

            return safeReply(interaction, {
                content: "❌ Unknown logs subcommand.",
                flags: MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // AUTOMOD
        // ====================================================

        if (command === "automod") {

            const sub =
                interaction.options.getSubcommand();

            const config =
                await getAutoModConfig(
                    interaction.guild.id
                );

            if (sub === "enable") {

                config.enabled = true;
                await config.save();

                return safeReply(interaction, {
                    content: "🛡️ AutoMod enabled."
                });
            }

            if (sub === "disable") {

                config.enabled = false;
                await config.save();

                return safeReply(interaction, {
                    content: "🛡️ AutoMod disabled."
                });
            }

            if (sub === "config") {

                return safeReply(interaction, {
                    embeds: [
                        automodConfigEmbed(config)
                    ]
                });
            }

            if (sub === "punishment") {

                const type =
                    interaction.options.getString("type");

                config.punishment = type;

                await config.save();

                return safeReply(interaction, {
                    content:
                        `✅ AutoMod punishment set to **${type}**.`
                });
            }

            if (sub === "word") {

                const word =
                    interaction.options.getString("word")
                        .toLowerCase();

                if (!config.blockedWords.includes(word)) {
                    config.blockedWords.push(word);
                    await config.save();
                }

                return safeReply(interaction, {
                    content:
                        `🚫 Added **${word}** to blocked words.`
                });
            }

            if (sub === "unword") {

                const word =
                    interaction.options.getString("word")
                        .toLowerCase();

                config.blockedWords =
                    config.blockedWords.filter(
                        x => x !== word
                    );

                await config.save();

                return safeReply(interaction, {
                    content:
                        `✅ Removed **${word}** from blocked words.`
                });
            }
        }

        // ====================================================
        // TICKETS
        // ====================================================

        if (command === "ticket") {

            const sub =
                interaction.options.getSubcommand();

            if (sub === "setup") {

                let config =
                    await getTicketConfig(
                        interaction.guild.id
                    );

                const category =
                    interaction.options.getChannel("category");

                const staff =
                    interaction.options.getRole("staff");

                const logs =
                    interaction.options.getChannel("logs");

                config.enabled = true;

                if (category) {
                    config.categoryId = category.id;
                }

                if (staff) {
                    config.staffRoleId = staff.id;
                }

                if (logs) {
                    config.logChannelId = logs.id;
                }

                await config.save();

                return safeReply(interaction, {
                    content: "🎫 Ticket system configured."
                });
            }

            if (sub === "panel") {

                const channel =
                    interaction.options.getChannel("channel");

                const config =
                    await getTicketConfig(
                        interaction.guild.id
                    );

                config.enabled = true;
                config.panelChannelId = channel.id;

                const row =
                    ticketPanelRow();

                const embed =
                    ticketPanelEmbed();

                const message =
                    await channel.send({
                        embeds: [embed],
                        components: [row]
                    });

                config.panelMessageId = message.id;

                await config.save();

                return safeReply(interaction, {
                    content:
                        `✅ Ticket panel created in ${channel}.`
                });
            }

            if (sub === "close") {

                const ticket =
                    await Ticket.findOne({
                        guildId: interaction.guild.id,
                        channelId: interaction.channel.id
                    });

                if (!ticket) {
                    return safeReply(interaction, {
                        content: "❌ This is not a ticket channel.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const result =
                    await closeTicket(
                        interaction.guild,
                        interaction.channel,
                        interaction.user
                    );

                return safeReply(interaction, {
                    content:
                        result
                            ? "🔒 Ticket closed."
                            : "❌ Failed to close ticket."
                });
            }

            if (sub === "reopen") {

                const result =
                    await reopenTicket(
                        interaction.guild,
                        interaction.channel,
                        interaction.user
                    );

                return safeReply(interaction, {
                    content:
                        result
                            ? "🔓 Ticket reopened."
                            : "❌ Failed to reopen ticket."
                });
            }

            if (sub === "claim") {

                const ticket =
                    await Ticket.findOne({
                        guildId: interaction.guild.id,
                        channelId: interaction.channel.id,
                        status: "open"
                    });

                if (!ticket) {
                    return safeReply(interaction, {
                        content: "❌ This is not an open ticket.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                ticket.claimedBy =
                    interaction.user.id;

                await ticket.save();

                return safeReply(interaction, {
                    content:
                        `🎫 Ticket claimed by ${interaction.user}.`
                });
            }

            if (sub === "delete") {

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.ManageChannels
                    )
                ) {
                    return safeReply(interaction, {
                        content: "❌ Manage Channels required.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await safeReply(interaction, {
                    content: "🗑️ Deleting ticket..."
                });

                setTimeout(() => {
                    deleteTicket(
                        interaction.guild,
                        interaction.channel,
                        interaction.user
                    ).catch(console.error);
                }, 1500);

                return;
            }

            if (sub === "add") {

                const member =
                    interaction.options.getMember("user");

                if (!member) {
                    return safeReply(interaction, {
                        content: "❌ Member not found.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.channel.permissionOverwrites.edit(
                    member.id,
                    {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true
                    }
                );

                return safeReply(interaction, {
                    content:
                        `✅ Added ${member} to the ticket.`
                });
            }

            if (sub === "remove") {

                const member =
                    interaction.options.getMember("user");

                if (!member) {
                    return safeReply(interaction, {
                        content: "❌ Member not found.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.channel.permissionOverwrites.delete(
                    member.id
                );

                return safeReply(interaction, {
                    content:
                        `✅ Removed ${member} from the ticket.`
                });
            }
        }

        // ====================================================
        // GIVEAWAYS
        // ====================================================

        if (command === "giveaway") {

            const sub =
                interaction.options.getSubcommand();

            if (sub === "start") {

                const minutes =
                    interaction.options.getInteger("minutes");

                const winners =
                    interaction.options.getInteger("winners");

                const prize =
                    interaction.options.getString("prize");

                const endAt =
                    Date.now() + minutes * 60 * 1000;

                const giveaway =
                    await Giveaway.create({
                        guildId: interaction.guild.id,
                        channelId: interaction.channel.id,
                        hostId: interaction.user.id,
                        prize,
                        winners,
                        endAt
                    });

                const message =
                    await interaction.channel.send({
                        embeds: [
                            giveawayEmbed(giveaway)
                        ],
                        components: [
                            giveawayRow(giveaway._id.toString())
                        ]
                    });

                giveaway.messageId =
                    message.id;

                await giveaway.save();

                scheduleGiveaway(giveaway);

                return safeReply(interaction, {
                    content:
                        `🎉 Giveaway started! Ends <t:${Math.floor(endAt / 1000)}:R>.`
                });
            }

            if (sub === "end") {

                const messageId =
                    interaction.options.getString("message_id");

                const giveaway =
                    await Giveaway.findOne({
                        guildId: interaction.guild.id,
                        messageId
                    });

                if (!giveaway) {
                    return safeReply(interaction, {
                        content: "❌ Giveaway not found.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await finishGiveaway(giveaway);

                return safeReply(interaction, {
                    content: "🏁 Giveaway ended."
                });
            }

            if (sub === "reroll") {

                const messageId =
                    interaction.options.getString("message_id");

                const giveaway =
                    await Giveaway.findOne({
                        guildId: interaction.guild.id,
                        messageId
                    });

                if (!giveaway) {
                    return safeReply(interaction, {
                        content: "❌ Giveaway not found.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const users =
                    giveaway.participants || [];

                if (!users.length) {
                    return safeReply(interaction, {
                        content: "❌ No participants.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const winner =
                    users[
                        Math.floor(
                            Math.random() * users.length
                        )
                    ];

                await interaction.channel.send(
                    `🎉 Giveaway reroll winner: <@${winner}>`
                );

                return safeReply(interaction, {
                    content: "✅ Giveaway rerolled.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ====================================================
        // LEVELING
        // ====================================================

        if (command === "rank") {

            const user =
                interaction.options.getUser("user") ||
                interaction.user;

            const levelData =
                await Level.findOne({
                    guildId: interaction.guild.id,
                    userId: user.id
                });

            const xp =
                levelData?.xp || 0;

            const level =
                calculateLevel(xp);

            const next =
                getLevelXP(level + 1);

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle(`📈 ${user.username}'s Rank`)
                        .setThumbnail(
                            user.displayAvatarURL()
                        )
                        .addFields(
                            {
                                name: "Level",
                                value: `${level}`,
                                inline: true
                            },
                            {
                                name: "XP",
                                value: `${xp}`,
                                inline: true
                            },
                            {
                                name: "Next Level",
                                value: `${next} XP`,
                                inline: true
                            }
                        )
                ]
            });
        }

        if (command === "leaderboard") {

            const users =
                await Level.find({
                    guildId: interaction.guild.id
                })
                .sort({ xp: -1 })
                .limit(10);

            if (!users.length) {
                return safeReply(interaction, {
                    content: "📊 No leveling data yet."
                });
            }

            const text =
                users.map((u, i) =>
                    `**${i + 1}.** <@${u.userId}> — Level **${calculateLevel(u.xp)}** • ${u.xp} XP`
                ).join("\n");

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle("🏆 Server Leaderboard")
                        .setDescription(text)
                ]
            });
        }

        // ====================================================
        // ROLE PANEL
        // ====================================================

        if (command === "rolepanel") {

            const channel =
                interaction.options.getChannel("channel");

            const role =
                interaction.options.getRole("role");

            const label =
                interaction.options.getString("label");

            const emoji =
                interaction.options.getString("emoji");

            const panel =
                await RolePanel.create({
                    guildId: interaction.guild.id,
                    channelId: channel.id,
                    roleId: role.id,
                    label,
                    emoji
                });

            const button =
                new ButtonBuilder()
                    .setCustomId(
                        `rolepanel:${role.id}`
                    )
                    .setLabel(label)
                    .setStyle(ButtonStyle.Primary);

            if (emoji) {
                button.setEmoji(emoji);
            }

            const message =
                await channel.send({
                    embeds: [
                        baseEmbed()
                            .setTitle("🎭 Self Roles")
                            .setDescription(
                                "Click the button below to toggle your role."
                            )
                    ],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(button)
                    ]
                });

            panel.messageId =
                message.id;

            await panel.save();

            return safeReply(interaction, {
                content:
                    `✅ Role panel created in ${channel}.`
            });
        }

        // ====================================================
        // POLL
        // ====================================================

        if (command === "poll") {

            const question =
                interaction.options.getString("question");

            const message =
                await interaction.channel.send({
                    embeds: [
                        baseEmbed()
                            .setTitle("📊 Poll")
                            .setDescription(question)
                            .setFooter({
                                text:
                                    `Poll by ${interaction.user.tag}`
                            })
                    ]
                });

            await message.react("👍");
            await message.react("👎");

            return safeReply(interaction, {
                content: "📊 Poll created.",
                flags: MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // SAY
        // ====================================================

        if (command === "say") {

            const message =
                interaction.options.getString("message");

            await interaction.channel.send({
                content: message,
                allowedMentions: {
                    parse: []
                }
            });

            return safeReply(interaction, {
                content: "✅ Message sent.",
                flags: MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // ANNOUNCE
        // ====================================================

        if (command === "announce") {

            const channel =
                interaction.options.getChannel("channel");

            const message =
                interaction.options.getString("message");

            await channel.send({
                embeds: [
                    baseEmbed()
                        .setTitle("📢 Announcement")
                        .setDescription(message)
                        .setAuthor({
                            name: interaction.guild.name,
                            iconURL:
                                interaction.guild.iconURL() || undefined
                        })
                ]
            });

            return safeReply(interaction, {
                content:
                    `📢 Announcement sent to ${channel}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // REMIND
        // ====================================================

        if (
            command === "reminder" ||
            command === "remind"
        ) {

            const minutes =
                interaction.options.getInteger("minutes");

            const message =
                interaction.options.getString("message");

            const reminder =
                await Reminder.create({
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    channelId: interaction.channel.id,
                    message,
                    remindAt:
                        new Date(
                            Date.now() +
                            minutes * 60 * 1000
                        )
                });

            scheduleReminder(reminder);

            return safeReply(interaction, {
                content:
                    `⏰ Reminder set for <t:${Math.floor(reminder.remindAt.getTime() / 1000)}:R>.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // ====================================================
        // FUN
        // ====================================================

        if (command === "coinflip") {

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle("🪙 Coin Flip")
                        .setDescription(
                            Math.random() < 0.5
                                ? "🟡 **Heads!**"
                                : "⚪ **Tails!**"
                        )
                ]
            });
        }

        if (command === "roll") {

            const sides =
                interaction.options.getInteger("sides") || 100;

            const result =
                randomInt(1, sides);

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle("🎲 Dice Roll")
                        .setDescription(
                            `You rolled **${result}** out of **${sides}**.`
                        )
                ]
            });
        }

        if (command === "8ball") {

            const question =
                interaction.options.getString("question");

            const answers = [
                "Absolutely.",
                "Definitely.",
                "Probably.",
                "Maybe.",
                "Ask again later.",
                "I don't think so.",
                "No.",
                "Absolutely not."
            ];

            const answer =
                answers[
                    Math.floor(
                        Math.random() * answers.length
                    )
                ];

            return safeReply(interaction, {
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
        }

        if (command === "choose") {

            const options =
                interaction.options
                    .getString("options")
                    .split("|")
                    .map(x => x.trim())
                    .filter(Boolean);

            if (!options.length) {
                return safeReply(interaction, {
                    content: "❌ Give me at least one option.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const choice =
                options[
                    Math.floor(
                        Math.random() * options.length
                    )
                ];

            return safeReply(interaction, {
                embeds: [
                    baseEmbed()
                        .setTitle("🎯 Choice")
                        .setDescription(
                            `I choose **${choice}**.`
                        )
                ]
            });
        }

        // ====================================================
        // RULES
        // ====================================================

        if (command === "rules") {

            const sub =
                interaction.options.getSubcommand();

            if (sub === "setup") {

                let config =
                    await RulesConfig.findOne({
                        guildId: interaction.guild.id
                    });

                if (!config) {
                    config = new RulesConfig({
                        guildId: interaction.guild.id
                    });
                }

                config.enabled = true;

                await config.save();

                return safeReply(interaction, {
                    content:
                        "📜 Rules system enabled."
                });
            }

            if (sub === "publish") {

                const channel =
                    interaction.options.getChannel("channel");

                const config =
                    await RulesConfig.findOne({
                        guildId: interaction.guild.id
                    });

                if (!config) {
                    return safeReply(interaction, {
                        content:
                            "❌ Configure rules first.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const menu =
                    new StringSelectMenuBuilder()
                        .setCustomId("rules_select")
                        .setPlaceholder(
                            "Select a rules section..."
                        )
                        .addOptions(
                            config.sections.map(section =>
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(
                                        section.title.substring(0, 100)
                                    )
                                    .setValue(section.id)
                                    .setDescription(
                                        truncate(
                                            section.content,
                                            100
                                        )
                                    )
                            )
                        );

                await channel.send({
                    embeds: [
                        baseEmbed()
                            .setTitle("📜 Server Rules")
                            .setDescription(
                                "Please select a category below to view the rules."
                            )
                    ],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(menu)
                    ]
                });

                return safeReply(interaction, {
                    content:
                        `✅ Rules published in ${channel}.`
                });
            }

            if (sub === "preview") {

                const config =
                    await RulesConfig.findOne({
                        guildId: interaction.guild.id
                    });

                if (!config) {
                    return safeReply(interaction, {
                        content: "❌ No rules configured.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                return safeReply(interaction, {
                    embeds: [
                        baseEmbed()
                            .setTitle("📜 Rules Preview")
                            .setDescription(
                                config.sections.map(
                                    s =>
                                        `### ${s.title}\n${s.content}`
                                ).join("\n\n")
                            )
                    ]
                });
            }
        }

        // ====================================================
        // SECURITY
        // ====================================================

        if (command === "security") {

            const sub =
                interaction.options.getSubcommand();

            const config =
                await getGuildConfig(
                    interaction.guild.id
                );

            if (sub === "status") {

                return safeReply(interaction, {
                    embeds: [
                        baseEmbed()
                            .setTitle("🛡️ Security Status")
                            .addFields(
                                {
                                    name: "Anti-Raid",
                                    value:
                                        config.security.antiRaid
                                            ? "Enabled"
                                            : "Disabled",
                                    inline: true
                                },
                                {
                                    name: "Auto Lockdown",
                                    value:
                                        config.security.autoLockdown
                                            ? "Enabled"
                                            : "Disabled",
                                    inline: true
                                },
                                {
                                    name: "Raid Threshold",
                                    value:
                                        `${config.security.raidThreshold}`,
                                    inline: true
                                },
                                {
                                    name: "Raid Window",
                                    value:
                                        `${config.security.raidWindow} seconds`,
                                    inline: true
                                }
                            )
                    ]
                });
            }

            if (sub === "lockdown") {

                await lockdownGuild(
                    interaction.guild
                );

                return safeReply(interaction, {
                    content:
                        "🔒 Server lockdown enabled."
                });
            }

            if (sub === "unlock") {

                await unlockGuild(
                    interaction.guild
                );

                return safeReply(interaction, {
                    content:
                        "🔓 Server lockdown disabled."
                });
            }
        }

        // ====================================================
        // KICK STREAMING
        // ====================================================

        if (command === "live") {

            const sub =
                interaction.options.getSubcommand();

            if (sub === "setup") {

                const username =
                    interaction.options.getString(
                        "username"
                    );

                const channel =
                    interaction.options.getChannel(
                        "channel"
                    );

                let config =
                    await getGuildConfig(
                        interaction.guild.id
                    );

                config.kickLive.enabled = true;
                config.kickLive.username = username;
                config.kickLive.channelId = channel.id;
                config.kickLive.lastLive = false;

                await config.save();

                return safeReply(interaction, {
                    content:
                        `🔴 KICK live alerts configured for **${username}** in ${channel}.`
                });
            }

            if (sub === "disable") {

                const config =
                    await getGuildConfig(
                        interaction.guild.id
                    );

                config.kickLive.enabled = false;

                await config.save();

                return safeReply(interaction, {
                    content:
                        "⛔ KICK live alerts disabled."
                });
            }
        }

        if (command === "livecheck") {

            const username =
                interaction.options.getString(
                    "username"
                ) ||
                (
                    await getGuildConfig(
                        interaction.guild.id
                    )
                ).kickLive.username;

            if (!username) {
                return safeReply(interaction, {
                    content:
                        "❌ No KICK username configured.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const data =
                await getKickChannel(
                    username
                );

            if (!data) {
                return safeReply(interaction, {
                    content:
                        "❌ Couldn't retrieve that KICK channel.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const live =
                Boolean(
                    data.livestream ||
                    data.is_live ||
                    data.livestream_id
                );

            if (!live) {

                return safeReply(interaction, {
                    embeds: [
                        baseEmbed(0x2B2D31)
                            .setTitle("⚫ Stream Offline")
                            .setDescription(
                                `**${username}** is currently offline on KICK.`
                            )
                    ]
                });
            }

            const stream =
                data.livestream || data.stream || {};

            const category =
                stream.category?.name ||
                data.category?.name ||
                stream.category ||
                data.category ||
                "Just Chatting";

            const title =
                stream.session_title ||
                stream.title ||
                data.stream_title ||
                "Live on KICK";

            const viewers =
                stream.viewer_count ??
                stream.viewers ??
                data.viewer_count ??
                0;

            const thumbnail =
                stream.thumbnail ||
                stream.thumbnail_url ||
                data.thumbnail ||
                null;

            const embed =
                baseEmbed(0x57F287)
                    .setTitle("🔴 LIVE ON KICK")
                    .setDescription(
                        `**${username}** is currently live!`
                    )
                    .addFields(
                        {
                            name: "🎮 Category",
                            value: String(category),
                            inline: true
                        },
                        {
                            name: "👁️ Viewers",
                            value: `${viewers}`,
                            inline: true
                        },
                        {
                            name: "📺 Title",
                            value: truncate(title, 1000)
                        }
                    )
                    .setURL(
                        `https://kick.com/${username}`
                    );

            if (thumbnail) {
                embed.setImage(thumbnail);
            }

            return safeReply(interaction, {
                embeds: [embed]
            });
        }

        // ====================================================
        // HELP
        // ====================================================

        if (command === "help") {

            return safeReply(interaction, {
                embeds: [
                    createHelpEmbed()
                ]
            });
        }

        // ====================================================
        // HEALTH
        // ====================================================

        if (command === "health") {

            const memory =
                process.memoryUsage().rss / 1024 / 1024;

            return safeReply(interaction, {
                embeds: [
                    baseEmbed(0x57F287)
                        .setTitle("💚 27Pro Health")
                        .addFields(
                            {
                                name: "Discord",
                                value: "🟢 Connected",
                                inline: true
                            },
                            {
                                name: "MongoDB",
                                value:
                                    mongoose.connection.readyState === 1
                                        ? "🟢 Connected"
                                        : "🔴 Disconnected",
                                inline: true
                            },
                            {
                                name: "Memory",
                                value:
                                    `${memory.toFixed(1)} MB`,
                                inline: true
                            },
                            {
                                name: "Ping",
                                value:
                                    `${client.ws.ping}ms`,
                                inline: true
                            }
                        )
                ]
            });
        }

    } catch (error) {

        console.error(
            "[INTERACTION ERROR]",
            error
        );

        await safeReply(interaction, {
            content:
                "❌ Something went wrong while processing that command.",
            flags: MessageFlags.Ephemeral
        });
    }
});


// ============================================================
// 27PRO - PART 4/4
// EVENTS + LOGGING + KICK + SECURITY + STARTUP
// ============================================================

// ============================================================
// GENERIC EVENT LOGGER
// ============================================================

async function logEvent(
    guild,
    type,
    title,
    description,
    color = 0x5865F2,
    fields = []
) {

    if (!guild) return;

    try {

        const embed =
            baseEmbed(color)
                .setTitle(title)
                .setDescription(
                    description || null
                );

        if (fields.length) {
            embed.addFields(fields);
        }

        await sendLog(
            guild,
            type,
            embed
        );

    } catch (error) {

        console.error(
            `[LOG EVENT ${type}]`,
            error
        );
    }
}


// ============================================================
// MEMBER JOIN
// ============================================================

client.on("guildMemberAdd", async member => {

    try {

        const guild =
            member.guild;

        const config =
            await getGuildConfig(
                guild.id
            );

        // ----------------------------------------------------
        // RAID DETECTION
        // ----------------------------------------------------

        const now =
            Date.now();

        const timestamps =
            raidTracker.get(guild.id) || [];

        const windowMs =
            (
                config.security.raidWindow ||
                10
            ) * 1000;

        const recent =
            timestamps.filter(
                time =>
                    now - time <= windowMs
            );

        recent.push(now);

        raidTracker.set(
            guild.id,
            recent
        );

        if (
            config.security.antiRaid &&
            recent.length >=
            (
                config.security.raidThreshold ||
                10
            )
        ) {

            await logEvent(
                guild,
                "raid",
                "🚨 Possible Raid Detected",
                `**${recent.length}** members joined within the configured raid window.`,
                0xED4245
            );

            if (
                config.security.autoLockdown
            ) {

                await lockdownGuild(
                    guild
                );
            }
        }

        // ----------------------------------------------------
        // WELCOME
        // ----------------------------------------------------

        await sendWelcome(
            guild,
            member,
            false
        );

        // ----------------------------------------------------
        // AUTO ROLE
        // ----------------------------------------------------

        const welcome =
            await getWelcomeConfig(
                guild.id
            );

        if (welcome?.roleId) {

            const role =
                guild.roles.cache.get(
                    welcome.roleId
                );

            if (
                role &&
                role.position <
                guild.members.me.roles.highest.position
            ) {

                await member.roles.add(
                    role,
                    "27Pro automatic welcome role"
                );
            }
        }

        // ----------------------------------------------------
        // LOG
        // ----------------------------------------------------

        await logEvent(
            guild,
            "member",
            "📥 Member Joined",
            `${member} joined the server.`,
            0x57F287,
            [
                {
                    name: "User",
                    value:
                        `${member.user.tag} (${member.id})`,
                    inline: true
                },
                {
                    name: "Account Created",
                    value:
                        `<t:${Math.floor(
                            member.user.createdTimestamp / 1000
                        )}:R>`,
                    inline: true
                },
                {
                    name: "Member Count",
                    value:
                        `${guild.memberCount}`,
                    inline: true
                }
            ]
        );

    } catch (error) {

        console.error(
            "[MEMBER JOIN]",
            error
        );
    }
});


// ============================================================
// MEMBER LEAVE
// ============================================================

client.on("guildMemberRemove", async member => {

    try {

        await sendGoodbye(
            member.guild,
            member
        );

        await logEvent(
            member.guild,
            "member",
            "📤 Member Left",
            `${member.user.tag} left the server.`,
            0xED4245,
            [
                {
                    name: "User",
                    value:
                        `${member.user.tag} (${member.id})`
                }
            ]
        );

    } catch (error) {

        console.error(
            "[MEMBER LEAVE]",
            error
        );
    }
});


// ============================================================
// MEMBER UPDATE
// ============================================================

client.on(
    "guildMemberUpdate",
    async (oldMember, newMember) => {

        try {

            if (
                oldMember.nickname !==
                newMember.nickname
            ) {

                await logEvent(
                    newMember.guild,
                    "member",
                    "✏️ Nickname Changed",
                    `${newMember} changed nickname.`,
                    0x5865F2,
                    [
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
                    ]
                );
            }

            const oldRoles =
                oldMember.roles.cache;

            const newRoles =
                newMember.roles.cache;

            const added =
                newRoles.filter(
                    role =>
                        !oldRoles.has(role.id)
                );

            const removed =
                oldRoles.filter(
                    role =>
                        !newRoles.has(role.id)
                );

            if (added.size) {

                await logEvent(
                    newMember.guild,
                    "role",
                    "➕ Role Added",
                    `${newMember} received a role.`,
                    0x57F287,
                    [
                        {
                            name: "Roles",
                            value:
                                added.map(
                                    r => r.toString()
                                ).join(", ")
                        }
                    ]
                );
            }

            if (removed.size) {

                await logEvent(
                    newMember.guild,
                    "role",
                    "➖ Role Removed",
                    `${newMember} lost a role.`,
                    0xED4245,
                    [
                        {
                            name: "Roles",
                            value:
                                removed.map(
                                    r => r.toString()
                                ).join(", ")
                        }
                    ]
                );
            }

            if (
                oldMember.communicationDisabledUntilTimestamp !==
                newMember.communicationDisabledUntilTimestamp
            ) {

                const timedOut =
                    Boolean(
                        newMember.communicationDisabledUntilTimestamp
                    );

                await logEvent(
                    newMember.guild,
                    "moderation",
                    timedOut
                        ? "🔇 Member Timed Out"
                        : "🔊 Timeout Removed",
                    `${newMember} ${
                        timedOut
                            ? "was timed out."
                            : "had their timeout removed."
                    }`,
                    timedOut
                        ? 0xFEE75C
                        : 0x57F287
                );
            }

            if (
                oldMember.premiumSinceTimestamp !==
                newMember.premiumSinceTimestamp
            ) {

                if (
                    newMember.premiumSinceTimestamp
                ) {

                    await logEvent(
                        newMember.guild,
                        "member",
                        "🚀 Server Boost",
                        `${newMember} boosted the server!`,
                        0xFF73FA
                    );
                }
            }

        } catch (error) {

            console.error(
                "[MEMBER UPDATE]",
                error
            );
        }
    }
);


// ============================================================
// MESSAGE CREATE
// ============================================================

client.on("messageCreate", async message => {

    try {

        if (
            message.author.bot ||
            !message.guild
        ) {
            return;
        }

        // ----------------------------------------------------
        // AUTOMOD
        // ----------------------------------------------------

        await runAutoMod(
            message
        );

        if (
            message.deleted ||
            !message.channel
        ) {
            return;
        }

        // ----------------------------------------------------
        // LEVELING
        // ----------------------------------------------------

        const key =
            `${message.guild.id}:${message.author.id}`;

        const now =
            Date.now();

        const last =
            spamTracker.get(
                `xp:${key}`
            ) || 0;

        if (
            now - last >= 60000
        ) {

            spamTracker.set(
                `xp:${key}`,
                now
            );

            const xp =
                randomInt(10, 20);

            await addXP(
                message.guild.id,
                message.author.id,
                xp
            );
        }

    } catch (error) {

        console.error(
            "[MESSAGE CREATE]",
            error
        );
    }
});


// ============================================================
// MESSAGE DELETE
// ============================================================

client.on("messageDelete", async message => {

    try {

        if (
            !message.guild ||
            message.author?.bot
        ) {
            return;
        }

        await logEvent(
            message.guild,
            "message",
            "🗑️ Message Deleted",
            `A message was deleted in ${message.channel}.`,
            0xED4245,
            [
                {
                    name: "Author",
                    value:
                        message.author
                            ? `${message.author.tag} (${message.author.id})`
                            : "Unknown"
                },
                {
                    name: "Content",
                    value:
                        truncate(
                            message.content ||
                            "No cached content.",
                            1000
                        )
                }
            ]
        );

    } catch (error) {

        console.error(
            "[MESSAGE DELETE]",
            error
        );
    }
});


// ============================================================
// MESSAGE UPDATE
// ============================================================

client.on(
    "messageUpdate",
    async (oldMessage, newMessage) => {

        try {

            if (
                !oldMessage.guild ||
                oldMessage.author?.bot
            ) {
                return;
            }

            if (
                oldMessage.content ===
                newMessage.content
            ) {
                return;
            }

            await logEvent(
                newMessage.guild,
                "message",
                "✏️ Message Edited",
                `A message was edited in ${newMessage.channel}.`,
                0xFEE75C,
                [
                    {
                        name: "Author",
                        value:
                            newMessage.author
                                ? newMessage.author.tag
                                : "Unknown"
                    },
                    {
                        name: "Before",
                        value:
                            truncate(
                                oldMessage.content ||
                                "Unknown",
                                1000
                            )
                    },
                    {
                        name: "After",
                        value:
                            truncate(
                                newMessage.content ||
                                "Unknown",
                                1000
                            )
                    }
                ]
            );

        } catch (error) {

            console.error(
                "[MESSAGE UPDATE]",
                error
            );
        }
    }
);


// ============================================================
// BULK DELETE
// ============================================================

client.on(
    "messageDeleteBulk",
    async messages => {

        try {

            const guild =
                messages.first()?.guild;

            if (!guild) return;

            await logEvent(
                guild,
                "message",
                "🧹 Bulk Message Delete",
                `${messages.size} messages were deleted.`,
                0xED4245
            );

        } catch (error) {

            console.error(
                "[BULK DELETE]",
                error
            );
        }
    }
);


// ============================================================
// ROLE EVENTS
// ============================================================

client.on("roleCreate", async role => {

    await logEvent(
        role.guild,
        "role",
        "🎭 Role Created",
        `Role ${role} was created.`,
        0x57F287,
        [
            {
                name: "Role ID",
                value: role.id
            }
        ]
    );
});

client.on("roleDelete", async role => {

    await logEvent(
        role.guild,
        "role",
        "🗑️ Role Deleted",
        `Role **${role.name}** was deleted.`,
        0xED4245
    );
});

client.on(
    "roleUpdate",
    async (oldRole, newRole) => {

        if (
            oldRole.name !== newRole.name ||
            oldRole.color !== newRole.color ||
            oldRole.permissions.bitfield !==
            newRole.permissions.bitfield
        ) {

            await logEvent(
                newRole.guild,
                "role",
                "✏️ Role Updated",
                `${newRole} was updated.`,
                0xFEE75C
            );
        }
    }
);


// ============================================================
// CHANNEL EVENTS
// ============================================================

client.on("channelCreate", async channel => {

    if (!channel.guild) return;

    await logEvent(
        channel.guild,
        "channel",
        "📺 Channel Created",
        `Channel ${channel} was created.`,
        0x57F287
    );
});

client.on("channelDelete", async channel => {

    if (!channel.guild) return;

    await logEvent(
        channel.guild,
        "channel",
        "🗑️ Channel Deleted",
        `Channel **${channel.name}** was deleted.`,
        0xED4245
    );
});

client.on(
    "channelUpdate",
    async (oldChannel, newChannel) => {

        if (!newChannel.guild) return;

        await logEvent(
            newChannel.guild,
            "channel",
            "✏️ Channel Updated",
            `Channel ${newChannel} was updated.`,
            0xFEE75C
        );
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
                    `Name: **${oldGuild.name}** → **${newGuild.name}**`
                );
            }

            if (
                oldGuild.description !==
                newGuild.description
            ) {
                changes.push(
                    "Description changed."
                );
            }

            if (
                oldGuild.icon !==
                newGuild.icon
            ) {
                changes.push(
                    "Server icon changed."
                );
            }

            if (!changes.length) return;

            await logEvent(
                newGuild,
                "server",
                "🏠 Server Updated",
                changes.join("\n"),
                0xFEE75C
            );

        } catch (error) {

            console.error(
                "[GUILD UPDATE]",
                error
            );
        }
    }
);


// ============================================================
// VOICE EVENTS
// ============================================================

client.on(
    "voiceStateUpdate",
    async (oldState, newState) => {

        try {

            if (
                !oldState.channelId &&
                newState.channelId
            ) {

                await logEvent(
                    newState.guild,
                    "voice",
                    "🔊 Voice Joined",
                    `${newState.member} joined ${newState.channel}.`,
                    0x57F287
                );

            } else if (
                oldState.channelId &&
                !newState.channelId
            ) {

                await logEvent(
                    oldState.guild,
                    "voice",
                    "🔇 Voice Left",
                    `${oldState.member} left <#${oldState.channelId}>.`,
                    0xED4245
                );

            } else if (
                oldState.channelId !==
                newState.channelId
            ) {

                await logEvent(
                    newState.guild,
                    "voice",
                    "🔄 Voice Moved",
                    `${newState.member} moved voice channels.`,
                    0x5865F2
                );
            }

        } catch (error) {

            console.error(
                "[VOICE UPDATE]",
                error
            );
        }
    }
);


// ============================================================
// THREAD EVENTS
// ============================================================

client.on(
    "threadCreate",
    async thread => {

        await logEvent(
            thread.guild,
            "channel",
            "🧵 Thread Created",
            `Thread **${thread.name}** was created.`,
            0x57F287
        );
    }
);

client.on(
    "threadDelete",
    async thread => {

        await logEvent(
            thread.guild,
            "channel",
            "🗑️ Thread Deleted",
            `Thread **${thread.name}** was deleted.`,
            0xED4245
        );
    }
);

client.on(
    "threadUpdate",
    async (oldThread, newThread) => {

        if (
            oldThread.name !==
            newThread.name
        ) {

            await logEvent(
                newThread.guild,
                "channel",
                "✏️ Thread Updated",
                `Thread **${newThread.name}** was updated.`,
                0xFEE75C
            );
        }
    }
);


// ============================================================
// BAN EVENTS
// ============================================================

client.on(
    "guildBanAdd",
    async ban => {

        await logEvent(
            ban.guild,
            "moderation",
            "🔨 User Banned",
            `**${ban.user.tag}** was banned.`,
            0xED4245,
            [
                {
                    name: "User ID",
                    value: ban.user.id
                }
            ]
        );
    }
);

client.on(
    "guildBanRemove",
    async ban => {

        await logEvent(
            ban.guild,
            "moderation",
            "🔓 User Unbanned",
            `**${ban.user.tag}** was unbanned.`,
            0x57F287
        );
    }
);


// ============================================================
// INVITE EVENTS
// ============================================================

client.on(
    "inviteCreate",
    async invite => {

        await logEvent(
            invite.guild,
            "server",
            "🔗 Invite Created",
            `An invite was created for ${invite.channel}.`,
            0x57F287,
            [
                {
                    name: "Code",
                    value: invite.code
                },
                {
                    name: "Creator",
                    value:
                        invite.inviter
                            ? invite.inviter.tag
                            : "Unknown"
                }
            ]
        );
    }
);

client.on(
    "inviteDelete",
    async invite => {

        if (!invite.guild) return;

        await logEvent(
            invite.guild,
            "server",
            "🗑️ Invite Deleted",
            `Invite **${invite.code}** was deleted.`,
            0xED4245
        );
    }
);


// ============================================================
// EMOJI / STICKER EVENTS
// ============================================================

client.on(
    "emojiCreate",
    async emoji => {

        await logEvent(
            emoji.guild,
            "server",
            "😀 Emoji Created",
            `Emoji **${emoji.name}** was created.`,
            0x57F287
        );
    }
);

client.on(
    "emojiDelete",
    async emoji => {

        await logEvent(
            emoji.guild,
            "server",
            "🗑️ Emoji Deleted",
            `Emoji **${emoji.name}** was deleted.`,
            0xED4245
        );
    }
);

client.on(
    "emojiUpdate",
    async (oldEmoji, newEmoji) => {

        await logEvent(
            newEmoji.guild,
            "server",
            "✏️ Emoji Updated",
            `Emoji **${newEmoji.name}** was updated.`,
            0xFEE75C
        );
    }
);

client.on(
    "stickerCreate",
    async sticker => {

        await logEvent(
            sticker.guild,
            "server",
            "🏷️ Sticker Created",
            `Sticker **${sticker.name}** was created.`,
            0x57F287
        );
    }
);

client.on(
    "stickerDelete",
    async sticker => {

        await logEvent(
            sticker.guild,
            "server",
            "🗑️ Sticker Deleted",
            `Sticker **${sticker.name}** was deleted.`,
            0xED4245
        );
    }
);

client.on(
    "stickerUpdate",
    async (oldSticker, newSticker) => {

        await logEvent(
            newSticker.guild,
            "server",
            "✏️ Sticker Updated",
            `Sticker **${newSticker.name}** was updated.`,
            0xFEE75C
        );
    }
);


// ============================================================
// WEBHOOK UPDATE
// ============================================================

client.on(
    "webhookUpdate",
    async channel => {

        if (!channel.guild) return;

        await logEvent(
            channel.guild,
            "server",
            "🪝 Webhook Updated",
            `A webhook was updated in ${channel}.`,
            0xFEE75C
        );
    }
);


// ============================================================
// AUTOMOD DISCORD EVENT
// ============================================================

client.on(
    "autoModerationActionExecution",
    async execution => {

        try {

            await logEvent(
                execution.guild,
                "automod",
                "🛡️ Discord AutoMod Action",
                `Discord AutoMod executed an action.`,
                0xED4245,
                [
                    {
                        name: "User",
                        value:
                            `<@${execution.userId}>`,
                        inline: true
                    },
                    {
                        name: "Rule",
                        value:
                            execution.ruleId,
                        inline: true
                    },
                    {
                        name: "Channel",
                        value:
                            execution.channelId
                                ? `<#${execution.channelId}>`
                                : "Unknown",
                        inline: true
                    }
                ]
            );

        } catch (error) {

            console.error(
                "[DISCORD AUTOMOD]",
                error
            );
        }
    }
);


// ============================================================
// KICK API
// ============================================================

async function getKickChannel(username) {

    try {

        const response =
            await fetch(
                `https://kick.com/api/v2/channels/${encodeURIComponent(username)}`,
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0",
                        "Accept":
                            "application/json"
                    },
                    signal:
                        AbortSignal.timeout(15000)
                }
            );

        if (!response.ok) {
            return null;
        }

        return await response.json();

    } catch (error) {

        console.error(
            "[KICK API]",
            error.message
        );

        return null;
    }
}


// ============================================================
// KICK STREAM DATA
// ============================================================

function getKickStreamData(data) {

    const stream =
        data?.livestream ||
        data?.stream ||
        data?.livestreams?.[0] ||
        null;

    if (!stream) {
        return null;
    }

    const category =
        stream.category?.name ||
        stream.category?.slug ||
        data?.category?.name ||
        data?.category?.slug ||
        (
            Array.isArray(
                stream.categories
            )
                ? stream.categories[0]?.name
                : null
        ) ||
        (
            Array.isArray(
                data?.categories
            )
                ? data.categories[0]?.name
                : null
        ) ||
        "Just Chatting";

    const title =
        stream.session_title ||
        stream.stream_title ||
        stream.title ||
        data?.stream_title ||
        data?.title ||
        "Live on KICK";

    const viewers =
        stream.viewer_count ??
        stream.viewers ??
        stream.viewerCount ??
        data?.viewer_count ??
        0;

    const thumbnail =
        stream.thumbnail?.url ||
        stream.thumbnail_url ||
        stream.thumbnail ||
        data?.thumbnail ||
        null;

    return {
        stream,
        category: String(category),
        title: String(title),
        viewers: Number(viewers) || 0,
        thumbnail
    };
}


// ============================================================
// KICK CHECKER
// ============================================================

async function checkKickChannels() {

    if (checkerRunning) {
        return;
    }

    checkerRunning = true;

    try {

        for (
            const guild of client.guilds.cache.values()
        ) {

            try {

                const config =
                    await getGuildConfig(
                        guild.id
                    );

                if (
                    !config?.kickLive?.enabled ||
                    !config.kickLive.username ||
                    !config.kickLive.channelId
                ) {
                    continue;
                }

                const data =
                    await getKickChannel(
                        config.kickLive.username
                    );

                if (!data) {
                    continue;
                }

                const stream =
                    getKickStreamData(data);

                const live =
                    Boolean(stream);

                const wasLive =
                    Boolean(
                        config.kickLive.lastLive
                    );

                // --------------------------------------------
                // OFFLINE
                // --------------------------------------------

                if (!live) {

                    if (wasLive) {

                        config.kickLive.lastLive =
                            false;

                        await config.save();

                        await sendLog(
                            guild,
                            "bot",
                            baseEmbed(0x2B2D31)
                                .setTitle("⚫ KICK Stream Offline")
                                .setDescription(
                                    `**${config.kickLive.username}** is now offline.`
                                )
                        );
                    }

                    continue;
                }

                // --------------------------------------------
                // ALREADY LIVE
                // --------------------------------------------

                if (wasLive) {
                    continue;
                }

                // --------------------------------------------
                // NEW LIVE
                // --------------------------------------------

                config.kickLive.lastLive =
                    true;

                await config.save();

                const channel =
                    guild.channels.cache.get(
                        config.kickLive.channelId
                    );

                if (
                    !channel ||
                    !channel.isTextBased()
                ) {
                    continue;
                }

                const embed =
                    baseEmbed(0x57F287)
                        .setTitle(
                            "🔴 LIVE NOW ON KICK"
                        )
                        .setDescription(
                            `**${config.kickLive.username}** is now live!`
                        )
                        .setURL(
                            `https://kick.com/${config.kickLive.username}`
                        )
                        .addFields(
                            {
                                name: "🎮 Category",
                                value:
                                    stream.category,
                                inline: true
                            },
                            {
                                name: "👁️ Viewers",
                                value:
                                    `${stream.viewers}`,
                                inline: true
                            },
                            {
                                name: "📺 Stream Title",
                                value:
                                    truncate(
                                        stream.title,
                                        1000
                                    )
                            }
                        );

                if (
                    stream.thumbnail
                ) {
                    embed.setImage(
                        stream.thumbnail
                    );
                }

                let content =
                    "";

                if (
                    config.kickLive.everyone
                ) {
                    content =
                        "@everyone";
                } else if (
                    config.kickLive.mentionRoleId
                ) {
                    content =
                        `<@&${config.kickLive.mentionRoleId}>`;
                }

                await channel.send({
                    content:
                        content || undefined,
                    embeds: [embed],
                    allowedMentions: {
                        parse:
                            config.kickLive.everyone
                                ? ["everyone"]
                                : [],
                        roles:
                            config.kickLive.mentionRoleId
                                ? [
                                    config.kickLive.mentionRoleId
                                ]
                                : []
                    }
                });

                await sendLog(
                    guild,
                    "bot",
                    embed
                );

            } catch (guildError) {

                console.error(
                    `[KICK ${guild.id}]`,
                    guildError
                );
            }
        }

    } finally {

        checkerRunning = false;
    }
}


// ============================================================
// HEALTH SERVER
// ============================================================

const healthServer =
    http.createServer(
        async (req, res) => {

            if (
                req.url === "/health" ||
                req.url === "/"
            ) {

                const health = {
                    status: "online",
                    bot: client.isReady(),
                    discordPing: client.ws.ping,
                    guilds: client.guilds.cache.size,
                    mongodb:
                        mongoose.connection.readyState === 1
                            ? "connected"
                            : "disconnected",
                    uptime:
                        process.uptime(),
                    memory:
                        process.memoryUsage().rss
                };

                res.writeHead(
                    200,
                    {
                        "Content-Type":
                            "application/json"
                    }
                );

                return res.end(
                    JSON.stringify(
                        health,
                        null,
                        2
                    )
                );
            }

            res.writeHead(404);
            res.end("Not Found");
        }
    );


// ============================================================
// READY
// ============================================================

client.once("ready", async () => {

    console.log(
        "============================================================"
    );

    console.log(
        `🤖 ${client.user.tag} is online`
    );

    console.log(
        `🌐 Servers: ${client.guilds.cache.size}`
    );

    console.log(
        `👥 Users: ${client.guilds.cache.reduce(
            (a, g) => a + (g.memberCount || 0),
            0
        )}`
    );

    console.log(
        `📡 Discord Ping: ${client.ws.ping}ms`
    );

    console.log(
        `💾 MongoDB: ${
            mongoose.connection.readyState === 1
                ? "CONNECTED"
                : "DISCONNECTED"
        }`
    );

    console.log(
        "============================================================"
    );

    // --------------------------------------------------------
    // REGISTER GLOBAL COMMANDS
    // --------------------------------------------------------

    try {

        const rest =
            new REST({
                version: "10"
            }).setToken(TOKEN);

        await rest.put(
            Routes.applicationCommands(
                client.user.id
            ),
            {
                body:
                    commands.map(
                        command =>
                            command.toJSON()
                    )
            }
        );

        console.log(
            `[COMMANDS] Registered ${commands.length} global commands.`
        );

    } catch (error) {

        console.error(
            "[COMMAND REGISTRATION]",
            error
        );
    }

    // --------------------------------------------------------
    // RESTORE GIVEAWAYS
    // --------------------------------------------------------

    try {
        await restoreGiveaways();
    } catch (error) {
        console.error(
            "[RESTORE GIVEAWAYS]",
            error
        );
    }

    // --------------------------------------------------------
    // RESTORE REMINDERS
    // --------------------------------------------------------

    try {
        await restoreReminders();
    } catch (error) {
        console.error(
            "[RESTORE REMINDERS]",
            error
        );
    }

    // --------------------------------------------------------
    // STATUS ROTATION
    // --------------------------------------------------------

    let statusIndex = 0;

    const statuses = () => [
        `/help • ${BOT_NAME}`,
        `${client.guilds.cache.size} Servers`,
        `Managing ${client.guilds.cache.reduce(
            (a, g) => a + (g.memberCount || 0),
            0
        ).toLocaleString()} Members`,
        "Moderation • Security • Fun",
        "Tickets • Giveaways • AutoMod",
        "KICK • Streaming • Alerts",
        "Made by iik27"
    ];

    const updateStatus = () => {

        const list =
            statuses();

        client.user.setPresence({
            status: "online",
            activities: [
                {
                    name:
                        list[
                            statusIndex %
                            list.length
                        ],
                    type:
                        ActivityType.Watching
                }
            ]
        });

        statusIndex++;
    };

    updateStatus();

    setInterval(
        updateStatus,
        30000
    );

    // --------------------------------------------------------
    // KICK CHECKER
    // --------------------------------------------------------

    if (!checkerInterval) {

        checkerInterval =
            setInterval(
                () => {
                    checkKickChannels()
                        .catch(error =>
                            console.error(
                                "[KICK CHECKER]",
                                error
                            )
                        );
                },
                60000
            );
    }

    // First check
    checkKickChannels()
        .catch(error =>
            console.error(
                "[KICK INITIAL CHECK]",
                error
            )
        );
});


// ============================================================
// SHARD / CLIENT ERRORS
// ============================================================

client.on(
    "error",
    error => {

        console.error(
            "[DISCORD CLIENT ERROR]",
            error
        );
    }
);

client.on(
    "warn",
    warning => {

        console.warn(
            "[DISCORD WARNING]",
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
            "[UNHANDLED REJECTION]",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {

        console.error(
            "[UNCAUGHT EXCEPTION]",
            error
        );
    }
);


// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function gracefulShutdown(
    signal
) {

    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log(
        `[SHUTDOWN] Received ${signal}`
    );

    try {

        if (checkerInterval) {

            clearInterval(
                checkerInterval
            );

            checkerInterval = null;
        }

        healthServer.close(
            () => {
                console.log(
                    "[SHUTDOWN] Health server closed."
                );
            }
        );

        if (
            mongoose.connection.readyState
        ) {

            await mongoose.connection.close();

            console.log(
                "[SHUTDOWN] MongoDB closed."
            );
        }

        if (
            client.isReady()
        ) {

            client.destroy();

            console.log(
                "[SHUTDOWN] Discord client closed."
            );
        }

    } catch (error) {

        console.error(
            "[SHUTDOWN ERROR]",
            error
        );

    } finally {

        process.exit(0);
    }
}


// ============================================================
// SIGNALS
// ============================================================

process.once(
    "SIGTERM",
    () => gracefulShutdown("SIGTERM")
);

process.once(
    "SIGINT",
    () => gracefulShutdown("SIGINT")
);


// ============================================================
// START BOT
// ============================================================

async function startBot() {

    try {

        console.log(
            "============================================================"
        );

        console.log(
            "🚀 Starting 27Pro..."
        );

        console.log(
            `📦 Version: ${VERSION}`
        );

        console.log(
            `🟢 Node.js: ${process.version}`
        );

        console.log(
            "============================================================"
        );

        // ----------------------------------------------------
        // ENV CHECK
        // ----------------------------------------------------

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

        // ----------------------------------------------------
        // MONGODB
        // ----------------------------------------------------

        mongoose.set(
            "strictQuery",
            true
        );

        await mongoose.connect(
            MONGODB_URI,
            {
                serverSelectionTimeoutMS:
                    15000
            }
        );

        console.log(
            "🟢 MongoDB connected."
        );

        // ----------------------------------------------------
        // HEALTH SERVER
        // ----------------------------------------------------

        healthServer.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `🌐 Health server listening on port ${PORT}`
                );
            }
        );

        // ----------------------------------------------------
        // DISCORD
        // ----------------------------------------------------

        await client.login(
            TOKEN
        );

    } catch (error) {

        console.error(
            "============================================================"
        );

        console.error(
            "❌ FATAL STARTUP ERROR"
        );

        console.error(
            error
        );

        console.error(
            "============================================================"
        );

        process.exit(1);
    }
}


// ============================================================
// START
// ============================================================

startBot();
