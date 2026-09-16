const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

const {
    WelcomeConfig
} = require("../database/welcomeConfig");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("welcome")
        .setDescription("Manage the welcome system.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        // ==========================================
        // SETUP
        // ==========================================

        .addSubcommand(subcommand =>
            subcommand
                .setName("setup")
                .setDescription("Configure the welcome system.")

                .addChannelOption(option =>
                    option
                        .setName("channel")
                        .setDescription(
                            "Channel where welcome messages are sent."
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
                            "Role given to new members."
                        )
                        .setRequired(true)
                )

                .addStringOption(option =>
                    option
                        .setName("image")
                        .setDescription(
                            "URL of your welcome image."
                        )
                        .setRequired(true)
                )

                .addStringOption(option =>
                    option
                        .setName("message")
                        .setDescription(
                            "Welcome message."
                        )
                        .setRequired(true)
                )
        )

        // ==========================================
        // CONFIG
        // ==========================================

        .addSubcommand(subcommand =>
            subcommand
                .setName("config")
                .setDescription(
                    "Show the current welcome configuration."
                )
        )

        // ==========================================
        // DISABLE
        // ==========================================

        .addSubcommand(subcommand =>
            subcommand
                .setName("disable")
                .setDescription(
                    "Disable the welcome system."
                )
        ),

    async execute(interaction) {

        const subcommand =
            interaction.options.getSubcommand();

        // ==========================================
        // DISABLE
        // ==========================================

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

        // ==========================================
        // CONFIG
        // ==========================================

        if (subcommand === "config") {

            const config =
                await WelcomeConfig.findOne({
                    guildId: interaction.guild.id
                });

            if (!config) {

                return interaction.reply({
                    content:
                        "❌ Welcome system has not been configured yet.",
                    ephemeral: true
                });
            }

            const embed =
                new EmbedBuilder()
                    .setColor("#ff003c")
                    .setTitle(
                        "WELCOME CONFIGURATION"
                    )
                    .addFields(
                        {
                            name: "Status",
                            value: config.enabled
                                ? "🟢 Enabled"
                                : "🔴 Disabled",
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
                            name: "Image",
                            value:
                                config.image ||
                                "Not configured"
                        },
                        {
                            name: "Message",
                            value:
                                config.message ||
                                "Not configured"
                        }
                    )
                    .setTimestamp();

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        // ==========================================
        // SETUP
        // ==========================================

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

        // Make sure the image is a URL
        try {

            new URL(image);

        } catch {

            return interaction.reply({
                content:
                    "❌ Please provide a valid image URL.",
                ephemeral: true
            });
        }

        // ==========================================
        // SAVE
        // ==========================================

        await WelcomeConfig.findOneAndUpdate(
            {
                guildId: interaction.guild.id
            },
            {
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

        // ==========================================
        // RESPONSE
        // ==========================================

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
                        value: `<#${channel.id}>`,
                        inline: true
                    },
                    {
                        name: "🎭 Role",
                        value: `<@&${role.id}>`,
                        inline: true
                    },
                    {
                        name: "🖼️ Image",
                        value: image
                    },
                    {
                        name: "💬 Message",
                        value: message
                    }
                )
                .setTimestamp();

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};
