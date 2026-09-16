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
    ChannelType
} = require("discord.js");

// ======================================================
// 27PRO CONFIGURATION
// ======================================================

const BOT_NAME = "27Pro";
const BOT_CREATOR = "iik27";
const BOT_COPYRIGHT = "© 2026 iik27. All rights reserved.";
const BOT_FOOTER = "27Pro • © 2026 iik27";

const TOKEN = process.env.TOKEN;
const CONFIGURED_CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

const DEFAULT_WELCOME_MESSAGE =
    "Welcome {user} to **{server}**! You are member #{count}. Enjoy your stay!";

// ======================================================
// STARTUP CHECK
// ======================================================

console.log("");
console.log("==========================================");
console.log(`🚀 ${BOT_NAME} STARTING`);
console.log(`👤 Creator: ${BOT_CREATOR}`);
console.log(`© ${BOT_COPYRIGHT}`);
console.log("==========================================");

console.log("🔐 TOKEN:", TOKEN ? "FOUND" : "MISSING");
console.log("🆔 CLIENT_ID:", CONFIGURED_CLIENT_ID || "MISSING");
console.log("🏠 GUILD_ID:", GUILD_ID || "MISSING");
console.log("🍃 MONGODB:", MONGODB_URI ? "FOUND" : "MISSING");
console.log("🌐 PORT:", PORT);
console.log("==========================================");

// ======================================================
// ENV VALIDATION
// ======================================================

if (!TOKEN) {
    console.error("❌ TOKEN is missing.");
    process.exit(1);
}

if (!GUILD_ID) {
    console.error("❌ GUILD_ID is missing.");
    process.exit(1);
}

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing.");
    process.exit(1);
}

// ======================================================
// HTTP SERVER
// ======================================================

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "application/json"
    });

    res.end(
        JSON.stringify({
            status: "online",
            bot: BOT_NAME,
            creator: BOT_CREATOR,
            copyright: BOT_COPYRIGHT,
            message: `${BOT_NAME} Discord Bot is online.`,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        })
    );
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 ${BOT_NAME} server listening on port ${PORT}`);
});

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// ======================================================
// DISCORD DEBUG EVENTS
// ======================================================

client.on("debug", message => {
    console.log(`[Discord Debug] ${message}`);
});

client.on("warn", message => {
    console.warn(`[Discord Warn] ${message}`);
});

client.on("error", error => {
    console.error("❌ Discord Client Error:");
    console.error(error);
});

client.on("shardError", error => {
    console.error("❌ Discord Shard Error:");
    console.error(error);
});

client.on("shardReady", id => {
    console.log(`✅ Discord shard ${id} ready.`);
});

client.on("shardReconnecting", id => {
    console.log(`🔄 Discord shard ${id} reconnecting...`);
});

client.on("shardDisconnect", (event, id) => {
    console.error(`❌ Discord shard ${id} disconnected.`);
    console.error(event);
});

// ======================================================
// MONGODB
// ======================================================

const WelcomeConfig = mongoose.model(
    "WelcomeConfig",
    new mongoose.Schema(
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
                default: DEFAULT_WELCOME_MESSAGE
            }
        },
        {
            timestamps: true
        }
    )
);

const Warning = mongoose.model(
    "Warning",
    new mongoose.Schema(
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
                required: true
            }
        },
        {
            timestamps: true
        }
    )
);

const GuildSettings = mongoose.model(
    "GuildSettings",
    new mongoose.Schema(
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
    )
);

// ======================================================
// HELPERS
// ======================================================

function replaceVariables(text, member) {
    if (!text) return "";

    return text
        .replace(/{user}/gi, `<@${member.id}>`)
        .replace(/{username}/gi, member.user.username)
        .replace(/{server}/gi, member.guild.name)
        .replace(/{count}/gi, member.guild.memberCount.toString());
}

function createBaseEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setFooter({
            text: BOT_FOOTER
        })
        .setTimestamp();
}

function isGuildInteraction(interaction) {
    return interaction.inGuild();
}

function canModerateMember(interaction, member) {
    if (!member) return false;

    if (member.id === interaction.guild.ownerId) {
        return false;
    }

    if (
        interaction.member.roles.highest.position <=
        member.roles.highest.position
    ) {
        return false;
    }

    return true;
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

    return `${Math.floor(hours / 24)}d`;
}

// ======================================================
// COMMAND DEFINITIONS
// ======================================================

const commands = [

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check 27Pro latency."),

    new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Show information about 27Pro."),

    new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Show server information."),

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
        .setDescription("Show a user's avatar.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user.")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("say")
        .setDescription("Make 27Pro say something.")
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("Message to send.")
                .setRequired(true)
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
        .setName("kick")
        .setDescription("Kick a member.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member to kick.")
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
                .setDescription("Member to ban.")
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
        .setDescription("Remove a timeout.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a member.")
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
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("Show warnings.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Member.")
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

    new SlashCommandBuilder()
        .setName("role")
        .setDescription("Manage roles.")
        .addSubcommand(sub =>
            sub
                .setName("add")
                .setDescription("Add a role.")
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
                .setDescription("Separate choices with commas.")
                .setRequired(true)
        )

].map(command => command.toJSON());

// ======================================================
// COMMAND REGISTRATION
// ======================================================

async function registerCommands() {

    if (!client.user) {
        throw new Error("client.user is unavailable.");
    }

    const applicationId = client.user.id;

    console.log("");
    console.log("==========================================");
    console.log("📝 REGISTERING SLASH COMMANDS");
    console.log("==========================================");
    console.log(`🤖 Bot: ${client.user.tag}`);
    console.log(`🆔 Actual Application ID: ${applicationId}`);
    console.log(`🆔 Configured CLIENT_ID: ${CONFIGURED_CLIENT_ID || "MISSING"}`);
    console.log(`🏠 Guild ID: ${GUILD_ID}`);
    console.log(`📦 Commands: ${commands.length}`);

    if (
        CONFIGURED_CLIENT_ID &&
        CONFIGURED_CLIENT_ID !== applicationId
    ) {
        console.warn(
            "⚠️ CLIENT_ID does not match the actual bot application ID."
        );
        console.warn(
            "⚠️ Using the actual logged-in bot ID instead."
        );
    }

    const rest = new REST({
        version: "10"
    }).setToken(TOKEN);

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

    const registered = await rest.get(
        Routes.applicationGuildCommands(
            applicationId,
            GUILD_ID
        )
    );

    console.log(
        `📋 Discord reports ${registered.length} registered guild commands.`
    );

    console.log("==========================================");
}

// ======================================================
// READY
// ======================================================

client.once("ready", async () => {

    console.log("");
    console.log("==========================================");
    console.log(`✅ ${BOT_NAME} IS READY`);
    console.log("==========================================");

    console.log(`🤖 Logged in as: ${client.user.tag}`);
    console.log(`🆔 Application ID: ${client.user.id}`);
    console.log(`🏠 Guilds: ${client.guilds.cache.size}`);
    console.log(`📡 WebSocket ping: ${client.ws.ping}ms`);

    const guild = client.guilds.cache.get(GUILD_ID);

    if (!guild) {

        console.error(
            `❌ 27Pro is NOT in the configured guild: ${GUILD_ID}`
        );

    } else {

        console.log(
            `✅ Target guild found: ${guild.name} (${guild.id})`
        );
    }

    client.user.setPresence({
        activities: [
            {
                name: "iik27 on top",
                type: 3
            }
        ],
        status: "online"
    });

    try {

        await registerCommands();

    } catch (error) {

        console.error("❌ COMMAND REGISTRATION FAILED:");
        console.error(error);
    }

    console.log("");
    console.log(`🟢 ${BOT_NAME} is fully online.`);
    console.log(`© 2026 ${BOT_CREATOR}. All rights reserved.`);
});

// ======================================================
// INTERACTION HANDLER
// ======================================================

client.on("interactionCreate", async interaction => {

    console.log(
        `📥 Interaction received: ${interaction.type} ${
            interaction.isChatInputCommand()
                ? `/${interaction.commandName}`
                : ""
        }`
    );

    if (!interaction.isChatInputCommand()) {
        return;
    }

    const command = interaction.commandName;

    console.log(`⚡ Processing /${command}`);

    try {

        // ==================================================
        // PING
        // ==================================================

        if (command === "ping") {

            const start = Date.now();

            await interaction.reply({
                content: "🏓 **Pong!**"
            });

            const responseTime = Date.now() - start;

            await interaction.editReply({
                content:
                    `🏓 **Pong!**\n` +
                    `API: **${client.ws.ping}ms**\n` +
                    `Response: **${responseTime}ms**\n\n` +
                    `🤖 **27Pro**\n` +
                    `© 2026 iik27`
            });

            console.log("✅ /ping completed.");

            return;
        }

        // ==================================================
        // BOT INFO
        // ==================================================

        if (command === "botinfo") {

            const embed = createBaseEmbed(
                "🤖 27Pro",
                "Discord bot information."
            )
                .addFields(
                    {
                        name: "Bot",
                        value: "27Pro",
                        inline: true
                    },
                    {
                        name: "Creator",
                        value: "iik27",
                        inline: true
                    },
                    {
                        name: "Servers",
                        value: `${client.guilds.cache.size}`,
                        inline: true
                    },
                    {
                        name: "Ping",
                        value: `${client.ws.ping}ms`,
                        inline: true
                    },
                    {
                        name: "Copyright",
                        value: "© 2026 iik27",
                        inline: true
                    }
                );

            await interaction.reply({
                embeds: [embed]
            });

            return;
        }

        // ==================================================
        // SERVER INFO
        // ==================================================

        if (command === "serverinfo") {

            if (!isGuildInteraction(interaction)) {

                await interaction.reply({
                    content: "❌ This command can only be used in a server.",
                    ephemeral: true
                });

                return;
            }

            const guild = interaction.guild;

            const embed = createBaseEmbed(
                `🏠 ${guild.name}`,
                "Server information."
            )
                .addFields(
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
                    }
                );

            if (guild.iconURL()) {
                embed.setThumbnail(guild.iconURL({
                    size: 512
                }));
            }

            await interaction.reply({
                embeds: [embed]
            });

            return;
        }

        // ==================================================
        // MEMBER COUNT
        // ==================================================

        if (command === "membercount") {

            await interaction.reply({
                embeds: [
                    createBaseEmbed(
                        "👥 Member Count",
                        `This server has **${interaction.guild.memberCount}** members.`
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
                interaction.guild.members.cache.get(user.id);

            const embed = createBaseEmbed(
                `👤 ${user.username}`,
                "User information."
            )
                .addFields(
                    {
                        name: "Username",
                        value: user.tag,
                        inline: true
                    },
                    {
                        name: "User ID",
                        value: user.id,
                        inline: true
                    }
                );

            if (member) {
                embed.addFields({
                    name: "Joined Server",
                    value: `<t:${Math.floor(
                        member.joinedTimestamp / 1000
                    )}:R>`,
                    inline: true
                });
            }

            if (user.displayAvatarURL()) {
                embed.setThumbnail(
                    user.displayAvatarURL({
                        size: 512
                    })
                );
            }

            await interaction.reply({
                embeds: [embed]
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

            const avatar = user.displayAvatarURL({
                size: 4096,
                extension: "png"
            });

            await interaction.reply({
                embeds: [
                    createBaseEmbed(
                        `🖼️ ${user.username}'s Avatar`,
                        `[Open full resolution](${avatar})`
                    ).setImage(avatar)
                ]
            });

            return;
        }

        // ==================================================
        // SAY
        // ==================================================

        if (command === "say") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageMessages
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Manage Messages** to use this command.",
                    ephemeral: true
                });

                return;
            }

            const message =
                interaction.options.getString("message");

            await interaction.reply({
                content: message
            });

            return;
        }

        // ==================================================
        // CLEAR
        // ==================================================

        if (command === "clear") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageMessages
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Manage Messages** permission.",
                    ephemeral: true
                });

                return;
            }

            const amount =
                interaction.options.getInteger("amount");

            await interaction.deferReply({
                ephemeral: true
            });

            const deleted =
                await interaction.channel.bulkDelete(
                    amount,
                    true
                );

            await interaction.editReply({
                content:
                    `🧹 Deleted **${deleted.size}** messages.\n\n` +
                    `27Pro • © 2026 iik27`
            });

            return;
        }

        // ==================================================
        // KICK
        // ==================================================

        if (command === "kick") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.KickMembers
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Kick Members** permission.",
                    ephemeral: true
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            const member =
                await interaction.guild.members.fetch(user.id)
                    .catch(() => null);

            if (!member) {

                await interaction.reply({
                    content: "❌ Member not found.",
                    ephemeral: true
                });

                return;
            }

            if (!canModerateMember(interaction, member)) {

                await interaction.reply({
                    content:
                        "❌ You cannot moderate this member.",
                    ephemeral: true
                });

                return;
            }

            await interaction.deferReply();

            await member.kick(reason);

            await interaction.editReply({
                embeds: [
                    createBaseEmbed(
                        "👢 Member Kicked",
                        `**${user.tag}** has been kicked.\n\n**Reason:** ${reason}`
                    )
                ]
            });

            return;
        }

        // ==================================================
        // BAN
        // ==================================================

        if (command === "ban") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.BanMembers
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Ban Members** permission.",
                    ephemeral: true
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const reason =
                interaction.options.getString("reason") ||
                "No reason provided.";

            const member =
                await interaction.guild.members.fetch(user.id)
                    .catch(() => null);

            if (member && !canModerateMember(interaction, member)) {

                await interaction.reply({
                    content:
                        "❌ You cannot moderate this member.",
                    ephemeral: true
                });

                return;
            }

            await interaction.deferReply();

            await interaction.guild.members.ban(
                user.id,
                {
                    reason
                }
            );

            await interaction.editReply({
                embeds: [
                    createBaseEmbed(
                        "🔨 Member Banned",
                        `**${user.tag}** has been banned.\n\n**Reason:** ${reason}`
                    )
                ]
            });

            return;
        }

        // ==================================================
        // UNBAN
        // ==================================================

        if (command === "unban") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.BanMembers
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Ban Members** permission.",
                    ephemeral: true
                });

                return;
            }

            const userId =
                interaction.options.getString("userid");

            await interaction.deferReply();

            await interaction.guild.members.unban(
                userId
            );

            await interaction.editReply({
                content:
                    `✅ <@${userId}> has been unbanned.\n\n` +
                    `27Pro • © 2026 iik27`
            });

            return;
        }

        // ==================================================
        // TIMEOUT
        // ==================================================

        if (command === "timeout") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ModerateMembers
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Moderate Members** permission.",
                    ephemeral: true
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
                await interaction.guild.members.fetch(user.id)
                    .catch(() => null);

            if (!member) {

                await interaction.reply({
                    content: "❌ Member not found.",
                    ephemeral: true
                });

                return;
            }

            if (!canModerateMember(interaction, member)) {

                await interaction.reply({
                    content:
                        "❌ You cannot moderate this member.",
                    ephemeral: true
                });

                return;
            }

            await interaction.deferReply();

            await member.timeout(
                minutes * 60 * 1000,
                reason
            );

            await interaction.editReply({
                embeds: [
                    createBaseEmbed(
                        "⏳ Member Timed Out",
                        `**${user.tag}** has been timed out for **${minutes} minutes**.\n\n**Reason:** ${reason}`
                    )
                ]
            });

            return;
        }

        // ==================================================
        // UNTIMEOUT
        // ==================================================

        if (command === "untimeout") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ModerateMembers
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Moderate Members** permission.",
                    ephemeral: true
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const member =
                await interaction.guild.members.fetch(user.id)
                    .catch(() => null);

            if (!member) {

                await interaction.reply({
                    content: "❌ Member not found.",
                    ephemeral: true
                });

                return;
            }

            await member.timeout(null);

            await interaction.reply({
                content:
                    `✅ **${user.tag}** is no longer timed out.\n\n` +
                    `27Pro • © 2026 iik27`
            });

            return;
        }

        // ==================================================
        // WARN
        // ==================================================

        if (command === "warn") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ModerateMembers
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Moderate Members** permission.",
                    ephemeral: true
                });

                return;
            }

            const user =
                interaction.options.getUser("user");

            const reason =
                interaction.options.getString("reason");

            await Warning.create({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                reason
            });

            await interaction.reply({
                embeds: [
                    createBaseEmbed(
                        "⚠️ Warning Issued",
                        `**${user.tag}** has been warned.\n\n**Reason:** ${reason}`
                    )
                ]
            });

            return;
        }

        // ==================================================
        // WARNINGS
        // ==================================================

        if (command === "warnings") {

            const user =
                interaction.options.getUser("user");

            const warnings =
                await Warning.find({
                    guildId: interaction.guild.id,
                    userId: user.id
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

            const text = warnings
                .map(
                    (warning, index) =>
                        `**${index + 1}.** ${warning.reason}`
                )
                .join("\n");

            await interaction.reply({
                embeds: [
                    createBaseEmbed(
                        `⚠️ Warnings — ${user.tag}`,
                        text
                    )
                ]
            });

            return;
        }

        // ==================================================
        // SLOWMODE
        // ==================================================

        if (command === "slowmode") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Manage Channels** permission.",
                    ephemeral: true
                });

                return;
            }

            const seconds =
                interaction.options.getInteger("seconds");

            await interaction.channel.setRateLimitPerUser(
                seconds
            );

            await interaction.reply({
                embeds: [
                    createBaseEmbed(
                        "🐢 Slowmode Updated",
                        seconds === 0
                            ? "Slowmode has been disabled."
                            : `Slowmode is now **${seconds} seconds**.`
                    )
                ]
            });

            return;
        }

        // ==================================================
        // LOCK
        // ==================================================

        if (command === "lock") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Manage Channels** permission.",
                    ephemeral: true
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
                    createBaseEmbed(
                        "🔒 Channel Locked",
                        "This channel has been locked."
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
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageChannels
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Manage Channels** permission.",
                    ephemeral: true
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
                    createBaseEmbed(
                        "🔓 Channel Unlocked",
                        "This channel has been unlocked."
                    )
                ]
            });

            return;
        }

        // ==================================================
        // ROLE ADD / REMOVE
        // ==================================================

        if (command === "role") {

            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ You need **Manage Roles** permission.",
                    ephemeral: true
                });

                return;
            }

            const subcommand =
                interaction.options.getSubcommand();

            const user =
                interaction.options.getUser("user");

            const role =
                interaction.options.getRole("role");

            const member =
                await interaction.guild.members.fetch(user.id);

            if (
                role.position >=
                interaction.guild.members.me.roles.highest.position
            ) {

                await interaction.reply({
                    content:
                        "❌ I cannot manage that role because it is above my highest role.",
                    ephemeral: true
                });

                return;
            }

            if (subcommand === "add") {

                await member.roles.add(role);

                await interaction.reply({
                    content:
                        `✅ Added ${role} to **${user.tag}**.\n\n` +
                        `27Pro • © 2026 iik27`
                });

                return;
            }

            if (subcommand === "remove") {

                await member.roles.remove(role);

                await interaction.reply({
                    content:
                        `✅ Removed ${role} from **${user.tag}**.\n\n` +
                        `27Pro • © 2026 iik27`
                });

                return;
            }
        }

        // ==================================================
        // COINFLIP
        // ==================================================

        if (command === "coinflip") {

            const result =
                Math.random() < 0.5
                    ? "Heads"
                    : "Tails";

            await interaction.reply({
                embeds: [
                    createBaseEmbed(
                        "🪙 Coin Flip",
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
                    createBaseEmbed(
                        "🎲 Dice Roll",
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

            const answers = [
                "Yes.",
                "No.",
                "Probably.",
                "Probably not.",
                "Definitely.",
                "I wouldn't count on it.",
                "Ask again later.",
                "The answer is unclear.",
                "Absolutely.",
                "Not a chance."
            ];

            const question =
                interaction.options.getString("question");

            const answer =
                answers[
                    Math.floor(
                        Math.random() * answers.length
                    )
                ];

            await interaction.reply({
                embeds: [
                    createBaseEmbed(
                        "🎱 Magic 8-Ball",
                        `**Question:** ${question}\n\n**Answer:** ${answer}`
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
                    ephemeral: true
                });

                return;
            }

            const choice =
                options[
                    Math.floor(
                        Math.random() * options.length
                    )
                ];

            await interaction.reply({
                embeds: [
                    createBaseEmbed(
                        "🎯 Choice",
                        `I choose **${choice}**.`
                    )
                ]
            });

            return;
        }

        // ==================================================
        // UNKNOWN COMMAND
        // ==================================================

        if (!interaction.replied && !interaction.deferred) {

            await interaction.reply({
                content:
                    "❌ This command is not implemented.",
                ephemeral: true
            });
        }

    } catch (error) {

        console.error(`❌ ERROR IN /${command}:`);
        console.error(error);

        try {

            if (interaction.replied || interaction.deferred) {

                await interaction.editReply({
                    content:
                        `❌ An error occurred while executing **/${command}**.\n\n` +
                        `Please check the 27Pro console logs.\n\n` +
                        `© 2026 iik27`
                });

            } else {

                await interaction.reply({
                    content:
                        `❌ An error occurred while executing **/${command}**.\n\n` +
                        `© 2026 iik27`,
                    ephemeral: true
                });
            }

        } catch (replyError) {

            console.error(
                "❌ Could not send error response:",
                replyError
            );
        }
    }
});

// ======================================================
// WELCOME
// ======================================================

client.on("guildMemberAdd", async member => {

    try {

        const config =
            await WelcomeConfig.findOne({
                guildId: member.guild.id
            });

        if (!config || !config.enabled) {
            return;
        }

        const channel =
            member.guild.channels.cache.get(
                config.channelId
            );

        if (!channel) {
            return;
        }

        const message =
            replaceVariables(
                config.message ||
                DEFAULT_WELCOME_MESSAGE,
                member
            );

        const embed =
            createBaseEmbed(
                "👋 Welcome!",
                message
            );

        if (config.image) {
            embed.setImage(config.image);
        }

        await channel.send({
            content: config.roleId
                ? `${member} <@&${config.roleId}>`
                : `${member}`,
            embeds: [embed]
        });

    } catch (error) {

        console.error(
            "❌ Welcome system error:",
            error
        );
    }
});

// ======================================================
// MONGODB + DISCORD STARTUP
// ======================================================

async function startBot() {

    try {

        console.log("");
        console.log("🍃 Connecting to MongoDB...");

        await mongoose.connect(MONGODB_URI);

        console.log("✅ MongoDB connected.");

        console.log("");
        console.log("🔄 Connecting 27Pro to Discord...");
        console.log(`🔐 TOKEN exists: ${Boolean(TOKEN)}`);
        console.log(`🔐 TOKEN length: ${TOKEN.length}`);
        console.log(
            `🔐 TOKEN prefix: ${TOKEN.substring(0, 5)}...`
        );
        console.log(
            `🆔 Configured CLIENT_ID: ${
                CONFIGURED_CLIENT_ID || "MISSING"
            }`
        );
        console.log(`🏠 GUILD_ID: ${GUILD_ID}`);

        console.log("");
        console.log("🚀 Calling client.login()...");

        await client.login(TOKEN);

        console.log("✅ client.login() completed.");

    } catch (error) {

        console.error("");
        console.error("==========================================");
        console.error("❌ 27PRO STARTUP FAILED");
        console.error("==========================================");
        console.error(error);
        console.error("==========================================");

        process.exit(1);
    }
}

// ======================================================
// PROCESS ERRORS
// ======================================================

process.on("unhandledRejection", error => {
    console.error("❌ UNHANDLED REJECTION:");
    console.error(error);
});

process.on("uncaughtException", error => {
    console.error("❌ UNCAUGHT EXCEPTION:");
    console.error(error);
});

process.on("SIGTERM", () => {

    console.log("🛑 SIGTERM received.");

    server.close();

    client.destroy();

    mongoose.connection.close();
});

// ======================================================
// START
// ======================================================

startBot();
