const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

/**
 * Discord mesajına sayfa sistemi ekler.
 * @param {Interaction|Message} interaction - Komut interaction'ı veya mesaj
 * @param {EmbedBuilder[]} pages - Embed sayfaları (her biri ayrı embed)
 * @param {number} timeout - Kaç saniye sonra düğmeler pasifleşsin (default: 60)
 */
async function createPagination(interaction, pages, timeout = 60) {
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
        throw new Error('Embed pages must be a non-empty array.');
    }

    let currentPage = 0;

    const buttons = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId('next')
            .setLabel('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === pages.length - 1)
    );

    const message = await interaction.reply({
        embeds: [pages[currentPage]],
        components: [buttons()],
        fetchReply: true,
        ephemeral: false
    });

    const collector = message.createMessageComponentCollector({
        time: timeout * 1000,
        filter: i => i.user.id === interaction.user.id
    });

    collector.on('collect', async i => {
        if (i.customId === 'prev' && currentPage > 0) currentPage--;
        else if (i.customId === 'next' && currentPage < pages.length - 1) currentPage++;

        await i.update({
            embeds: [pages[currentPage]],
            components: [buttons()]
        });
    });

    collector.on('end', async () => {
        try {
            await message.edit({ components: [] });
        } catch (_) {}
    });
}

module.exports = { createPagination };
