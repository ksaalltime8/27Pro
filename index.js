
// ============================================================
// DISCORD WELCOME BOT
// ============================================================
// Features:
// /welcome setup
// /welcome config
// /welcome disable
//
// Automatically:
// - Welcomes new members
// - Mentions them
// - Sends a custom embed
// - Shows their avatar
// - Shows your custom image
// - Gives them a role
// - Saves configuration in MongoDB
// ============================================================

require("dotenv").config();

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

const mongoose = require("mongoose");

// ============================================================
// CONFIG
// ============================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MONGODB_URI = process.env.MONGODB_URI;

// ============================================================
// CHECK ENVIRONMENT
// ============================================================

if (!TOKEN) {
    console.error("❌ TOKEN is missing from .env");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("❌ CLIENT_ID is missing from .env");
    process.exit(1);
}

if (!GUILD_ID) {
    console.error("❌ GUILD_ID is missing from .env");
    process.exit(1);
}

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing from .env");
    process.exit(1);
}

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
// MONGODB SCHEMA
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

});

const WelcomeConfig = mongoose.model(
    "WelcomeConfig",
    WelcomeConfigSchema
);

// ============================================================
// SLASH COMMAND
// ============================================================

const welcomeCommand = new SlashCommandBuilder()

    .setName("welcome")

    .setDescription(
        "Manage the server welcome system."
    )

    .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild
    )

    // ========================================================
    // /welcome setup
    // ========================================================

    .addSubcommand(subcommand =>

        subcommand

            .setName("setup")

            .setDescription(
                "Configure the welcome system."
            )

            // CHANNEL
            .addChannelOption(option =>

                option

                    .setName("channel")

                    .setDescription(
                        "Channel for welcome messages."
                    )

                    .addChannelTypes(
                        ChannelType.GuildText
                    )

                    .setRequired(true)
            )

            // ROLE
            .addRoleOption(option =>

                option

                    .setName("role")

                    .setDescription(
                        "Role given to new members."
                    )

                    .setRequired(true)
            )

            // IMAGE
            .addStringOption(option =>

                option

                    .setName("image")

                    .setDescription(
                        "URL of your welcome image."
                    )

                    .setRequired(true)
            )

            // MESSAGE
            .addStringOption(option =>

                option

                    .setName("message")

                    .setDescription(
                        "Welcome message."
                    )

                    .setRequired(true)
            )
    )

    // ========================================================
    // /welcome config
    // ========================================================

    .addSubcommand(subcommand =>

        subcommand

            .setName("config")

            .setDescription(
                "Show the current welcome configuration."
            )
    )

    // ========================================================
    // /welcome disable
    // ========================================================

    .addSubcommand(subcommand =>

        subcommand

            .setName("disable")

            .setDescription(
                "Disable the welcome system."
            )
    );

// ============================================================
// REGISTER COMMAND
// ============================================================

async function registerCommands() {

    try {

        console.log(
            "🔄 Registering /welcome command..."
        );

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
                    welcomeCommand.toJSON()
                ]
            }
        );

        console.log(
            "✅ /welcome command registered!"
        );

    } catch (error) {

        console.error(
            "❌ Failed to register command:"
        );

        console.error(error);
    }
}

// ============================================================
// READY
// ============================================================

client.once(
    "ready",
    () => {

        console.log(
            "======================================"
        );

        console.log(
            `🤖 Logged in as ${client.user.tag}`
        );

        console.log(
            "🟢 Welcome bot is online!"
        );

        console.log(
            "======================================"
        );
    }
);

// ============================================================
// INTERACTION HANDLER
// ============================================================

client.on(
    "interactionCreate",
    async interaction => {

        // Ignore non slash commands
        if (!interaction.isChatInputCommand()) {
            return;
        }

        // Only handle /welcome
        if (interaction.commandName !== "welcome") {
            return;
        }

        // ====================================================
        // PERMISSION CHECK
        // ====================================================

        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {

            return interaction.reply({

                content:
                    "❌ You need **Manage Server** permission to use this command.",

                ephemeral: true
            });
        }

        const subcommand =
            interaction.options.getSubcommand();

        // ====================================================
        // DISABLE
        // ====================================================

        if (subcommand === "disable") {

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

            return interaction.reply({

                content:
                    "🔴 **Welcome system disabled.**",

                ephemeral: true
            });
        }

        // ====================================================
        // CONFIG
        // ====================================================

        if (subcommand === "config") {

            const config =
                await WelcomeConfig.findOne({

                    guildId:
                        interaction.guild.id

                });

            if (!config) {

                return interaction.reply({

                    content:
                        "❌ The welcome system has not been configured yet.",

                    ephemeral: true
                });
            }

            const channel =
                config.channelId
                    ? `<#${config.channelId}>`
                    : "Not configured";

            const role =
                config.roleId
                    ? `<@&${config.roleId}>`
                    : "Not configured";

            const image =
                config.image ||
                "Not configured";

            const message =
                config.message ||
                "Not configured";

            const embed =
                new EmbedBuilder()

                    .setColor("#ff003c")

                    .setTitle(
                        "WELCOME CONFIGURATION"
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

                            value: channel,

                            inline: true
                        },

                        {
                            name: "Role",

                            value: role,

                            inline: true
                        },

                        {
                            name: "Image",

                            value: image
                        },

                        {
                            name: "Message",

                            value: message
                        }

                    )

                    .setFooter({

                        text:
                            `${interaction.guild.name} • Welcome System`

                    })

                    .setTimestamp();

            return interaction.reply({

                embeds: [embed],

                ephemeral: true
            });
        }

        // ====================================================
        // SETUP
        // ====================================================

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

            // =================================================
            // CHECK IMAGE URL
            // =================================================

            try {

                new URL(image);

            } catch {

                return interaction.reply({

                    content:
                        "❌ The image must be a valid URL.",

                    ephemeral: true
                });
            }

            // =================================================
            // CHECK ROLE
            // =================================================

            const botMember =
                interaction.guild.members.me;

            if (!botMember) {

                return interaction.reply({

                    content:
                        "❌ I couldn't find my bot member in this server.",

                    ephemeral: true
                });
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {

                return interaction.reply({

                    content:
                        "❌ I cannot give that role because it is **above or equal to my highest role**.\n\nMove my bot role above the welcome role in **Server Settings → Roles**.",

                    ephemeral: true
                });
            }

            // =================================================
            // SAVE CONFIG
            // =================================================

            await WelcomeConfig.findOneAndUpdate(

                {
                    guildId:
                        interaction.guild.id
                },

                {

                    enabled: true,

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

                    upsert: true,

                    new: true

                }
            );

            // =================================================
            // SUCCESS EMBED
            // =================================================

            const embed =
                new EmbedBuilder()

                    .setColor("#ff003c")

                    .setTitle(
                        "WELCOME SYSTEM ENABLED"
                    )

                    .setDescription(
                        "The welcome system has been configured successfully."
                    )

                    .addFields(

                        {
                            name: "📢 Channel",

                            value:
                                `<#${channel.id}>`,

                            inline: true
                        },

                        {
                            name: "🎭 Role",

                            value:
                                `<@&${role.id}>`,

                            inline: true
                        },

                        {
                            name: "🖼️ Image",

                            value:
                                image
                        },

                        {
                            name: "💬 Message",

                            value:
                                message
                        }

                    )

                    .setFooter({

                        text:
                            `${interaction.guild.name} • Welcome System`

                    })

                    .setTimestamp();

            return interaction.reply({

                embeds: [embed],

                ephemeral: true
            });
        }
    }
);

// ============================================================
// MEMBER JOIN
// ============================================================

client.on(
    "guildMemberAdd",
    async member => {

        try {

            // =================================================
            // GET SERVER CONFIG
            // =================================================

            const config =
                await WelcomeConfig.findOne({

                    guildId:
                        member.guild.id

                });

            // Nothing configured
            if (!config) {
                return;
            }

            // Disabled
            if (!config.enabled) {
                return;
            }

            // =================================================
            // GET BOT MEMBER
            // =================================================

            const botMember =
                member.guild.members.me;

            // =================================================
            // GIVE ROLE
            // =================================================

            if (config.roleId) {

                const role =
                    member.guild.roles.cache.get(
                        config.roleId
                    );

                if (role && botMember) {

                    if (
                        botMember.permissions.has(
                            PermissionFlagsBits.ManageRoles
                        )
                    ) {

                        if (
                            role.position <
                            botMember.roles.highest.position
                        ) {

                            await member.roles.add(
                                role
                            );

                            console.log(
                                `🎭 Gave ${role.name} to ${member.user.tag}`
                            );

                        } else {

                            console.log(
                                `❌ Cannot give ${role.name}: role is above the bot.`
                            );
                        }

                    } else {

                        console.log(
                            "❌ Bot doesn't have Manage Roles permission."
                        );
                    }
                }
            }

            // =================================================
            // GET WELCOME CHANNEL
            // =================================================

            const channel =
                member.guild.channels.cache.get(
                    config.channelId
                );

            if (!channel) {

                console.log(
                    "❌ Welcome channel not found."
                );

                return;
            }

            // =================================================
            // CREATE MESSAGE
            // =================================================

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

            // =================================================
            // CREATE EMBED
            // =================================================

            const embed =
                new EmbedBuilder()

                    .setColor("#ff003c")

                    .setTitle(
                        "WELCOME TO THE SERVER"
                    )

                    .setDescription(
                        welcomeMessage
                    )

                    .setThumbnail(
                        member.user.displayAvatarURL({

                            extension: "png",

                            size: 512

                        })
                    )

                    .setImage(
                        config.image
                    )

                    .setFooter({

                        text:
                            `${member.guild.name} • Welcome`

                    })

                    .setTimestamp();

            // =================================================
            // SEND WELCOME
            // =================================================

            await channel.send({

                content:
                    `<@${member.id}>`,

                embeds: [
                    embed
                ]

            });

            console.log(
                `👋 Welcomed ${member.user.tag}`
            );

        } catch (error) {

            console.error(
                "❌ Welcome system error:"
            );

            console.error(error);
        }
    }
);

// ============================================================
// MONGODB
// ============================================================

async function connectMongoDB() {

    try {

        await mongoose.connect(
            MONGODB_URI
        );

        console.log(
            "🟢 MongoDB connected!"
        );

    } catch (error) {

        console.error(
            "🔴 MongoDB connection failed:"
        );

        console.error(error);

        process.exit(1);
    }
}

// ============================================================
// START
// ============================================================

async function startBot() {

    await connectMongoDB();

    await registerCommands();

    await client.login(
        TOKEN
    );
}

startBot();