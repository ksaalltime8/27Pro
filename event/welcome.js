const {
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const {
    WelcomeConfig
} = require("../database/welcomeConfig");

module.exports = {

    name: "guildMemberAdd",

    async execute(member) {

        try {

            // ==========================================
            // GET SERVER CONFIG
            // ==========================================

            const config =
                await WelcomeConfig.findOne({
                    guildId: member.guild.id
                });

            if (!config) return;

            if (!config.enabled) return;

            // ==========================================
            // GIVE ROLE
            // ==========================================

            if (config.roleId) {

                const role =
                    member.guild.roles.cache.get(
                        config.roleId
                    );

                const botMember =
                    member.guild.members.me;

                if (
                    role &&
                    botMember &&
                    botMember.permissions.has(
                        PermissionsBitField.Flags.ManageRoles
                    ) &&
                    role.position <
                    botMember.roles.highest.position
                ) {

                    await member.roles.add(role);

                    console.log(
                        `🎭 Gave ${role.name} to ${member.user.tag}`
                    );

                } else {

                    console.log(
                        "❌ Could not give welcome role."
                    );
                }
            }

            // ==========================================
            // GET CHANNEL
            // ==========================================

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

            // ==========================================
            // REPLACE VARIABLES
            // ==========================================

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

            // ==========================================
            // CREATE EMBED
            // ==========================================

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

            // ==========================================
            // SEND
            // ==========================================

            await channel.send({
                content:
                    `<@${member.id}>`,
                embeds: [embed]
            });

            console.log(
                `👋 Welcomed ${member.user.tag}`
            );

        } catch (error) {

            console.error(
                "❌ Welcome system error:",
                error
            );

        }
    }
};