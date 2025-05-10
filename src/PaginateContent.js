const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

/**
 * Uzun içeriği otomatik olarak sayfalara böler ve Discord'da sayfa sistemini gösterir.
 * @param {Interaction|Message} interaction - Komut interaction'ı
 * @param {string[]} items - Liste halinde içerikler (her satır bir içerik)
 * @param {Object} options - Ek ayarlar
 * @param {string} [options.title] - Embed başlığı
 * @param {number} [options.itemsPerPage=5] - Her sayfada kaç içerik gösterilsin
 * @param {number} [options.timeout=60] - Süre (sn) sonunda düğmeler pasifleşsin
 */
async function paginateContent(interaction, items, options = {}) {
    const {
        title = 'Sample Pagination',
        itemsPerPage = 5,
        timeout = 60
    } = options;

    if (!Array.isArray(items) || items.length === 0)
        throw new Error('Gösterilecek içerik listesi boş veya geçersiz.');

    const pages = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
        const chunk = items.slice(i, i + itemsPerPage);
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(chunk.join('\n'))
            .setFooter({ text: `${Math.floor(i / itemsPerPage) + 1}/${Math.ceil(items.length / itemsPerPage)}` });
        pages.push(embed);
    }

    let currentPage = 0;

    const getButtons = () => new ActionRowBuilder().addComponents(
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
        components: [getButtons()],
        fetchReply: true,
        ephemeral: false
    });

    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: timeout * 1000
    });

    collector.on('collect', async i => {
        if (i.customId === 'prev' && currentPage > 0) currentPage--;
        else if (i.customId === 'next' && currentPage < pages.length - 1) currentPage++;

        await i.update({
            embeds: [pages[currentPage]],
            components: [getButtons()]
        });
    });

    collector.on('end', async () => {
        try {
            await message.edit({ components: [] });
        } catch (_) {}
    });
}

module.exports = { paginateContent };
