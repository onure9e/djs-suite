# @onurege3467/djs-suite
A comprehensive and customizable suite of tools and utilities designed to streamline discord.js v14 bot development. Includes advanced command handling, interaction management, embed builders, permission utilities, common helpers, and a configurable logger.

## Features

*   **✨ Modular Design:** Import only the components you need.
*   **🚀 Advanced Command Handler:**
    *   File-based command loading (recursive directory scanning).
    *   Supports Slash Commands, User Context Menus, Message Context Menus, and traditional Prefix (legacy) commands in a unified way.
    *   Automatic registration of Application (slash) commands (guild or global).
    *   Built-in permission checks (Discord permissions & custom roles).
    *   Command cooldown management.
    *   Alias support for legacy commands.
*   **🖱️ Interaction Manager:**
    *   Easily manage Button, Select Menu, and Modal Submit interactions.
    *   Register persistent handlers based on exact `customId` or prefixes (`myPrefix_*`).
    *   Simplifies routing interaction events to the correct logic.
*   **🎨 Enhanced Embed Builder (`SuiteEmbed`):**
    *   Extends discord.js `EmbedBuilder`.
    *   Built-in templates (`success`, `error`, `warning`, `info`).
    *   Use predefined templates or provide your own custom template functions.
    *   Static helper methods for quick template usage (`SuiteEmbed.success('Done!')`).
*   **🛡️ Permission Utilities:**
    *   Simplified checks for Discord permissions (`hasPermission`).
    *   Easy checks for specific roles (`hasRole`).
    *   Admin check shortcut (`isAdmin`).
*   **🔧 Common Utilities:**
    *   Resolve users and roles from IDs, mentions, or names.
    *   Text truncation, duration formatting, random color generation, content cleaning.
*   **📝 Configurable Logger:**
    *   Multiple log levels (`debug`, `info`, `warn`, `error`).
    *   Multiple transports (currently `console`, placeholders for `file`, `discordChannel`).
    *   Timestamped and colored console output (using `@onurege3467/easycolor`).
    *   Integrates seamlessly with other suite components.

## Installation

```bash
npm install @onurege3467/djs-suite discord.js
```

## Core Concepts
The suite is designed to be modular. You import the specific classes you need for your bot.
```js
const {
    CommandHandler,
    InteractionManager,
    SuiteEmbed,
    PermissionUtils,
    CommonUtils,
    Logger
} = require('@onurege3467/djs-suite');
```

## Getting Started: Basic Bot Setup
Here's a minimal example of how to set up your main bot file:
```js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { CommandHandler, InteractionManager, Logger } = require('@onurege3467/djs-suite');
require('dotenv').config(); // If using environment variables for token

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // Needed for permission checks, user resolving
        GatewayIntentBits.MessageContent // Needed for legacy prefix commands
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember] // Recommended for reliable event handling
});

// 1. Initialize Logger (Optional, but recommended)
const logger = new Logger({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

// 2. Initialize Command Handler
const commandHandler = new CommandHandler(client, {
    commandDir: './commands',          // Directory where your command files are located
    prefix: '!',                       // Prefix for legacy commands (optional)
    devGuildId: process.env.DEV_GUILD_ID, // Guild ID for rapid slash command testing (optional)
    // registerGlobally: true,         // Set to true to register commands globally (default depends on devGuildId)
    logger: logger                     // Pass the logger instance
});

// 3. Initialize Interaction Manager (If using buttons, select menus, modals)
const interactionManager = new InteractionManager(client, {
    logger: logger
});

// Example: Register a persistent button handler
interactionManager.registerButtonHandler('delete_message_*', async (interaction) => {
    const messageId = interaction.customId.split('_').pop();
    try {
        const msg = await interaction.channel.messages.fetch(messageId);
        // Add permission checks here if needed!
        if (msg) {
            await msg.delete();
            await interaction.reply({ content: 'Message deleted.', ephemeral: true });
        }
    } catch (err) {
        logger.error(`Button delete failed for message ${messageId}:`, err);
        await interaction.reply({ content: 'Could not delete message.', ephemeral: true }).catch(() => {});
    }
});


// Client Ready Event
client.once('ready', () => {
    logger.info(`Logged in as ${client.user.tag}!`);
    logger.info(`Bot operating in ${client.guilds.cache.size} servers.`);
    // Slash command registration is handled automatically by CommandHandler on ready
});

// Login
if (!process.env.BOT_TOKEN) {
    logger.error("BOT_TOKEN is missing in your environment variables!");
    process.exit(1);
}
client.login(process.env.BOT_TOKEN);

// Optional: Global Error Handling
process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', error => {
     logger.error('Uncaught exception:', error);
     // Consider graceful shutdown or logging and continuing
});
```

## Components Deep Dive
`CommandHandler`

Manages loading, registering, and executing commands.

# Directory Structure:
Place your command files inside the directory specified by commandDir (e.g., ./commands). Subdirectories are supported.
```
./
├── bot.js
├── commands/
│   ├── utility/
│   │   └── ping.js
│   │   └── help.js
│   ├── moderation/
│   │   └── kick.js
│   └── context/
│       └── userInfo.js
├── interactions/ (Example for InteractionManager components)
│   └── buttons/
│       └── deleteHandler.js
├── node_modules/
├── package.json
└── .env
```

# Options (CommandHandler constructor):

    client: Your discord.js Client instance (required).

    options.commandDir: Path to your commands directory (defaults to ./commands).

    options.prefix: String prefix for legacy message commands (optional).

    options.devGuildId: Guild ID string for registering slash commands only to that guild during development (faster updates). If not provided, registerGlobally defaults to true.

    options.registerGlobally: Boolean. If true, registers slash commands globally. If false, requires devGuildId. Defaults to !options.devGuildId.

    options.logger: An instance of the Logger class or a compatible logger object (optional, defaults to internal basic logger).

# Command File Structure:

Each .js file in the commandDir should export an object with the following properties:
```js
const { SlashCommandBuilder } = require('discord.js');
const { SuiteEmbed } = require('@onurege3467/djs-suite');

module.exports = {
    // --- For Slash Commands (and Context Menus) ---
    data: new SlashCommandBuilder() // Or UserContextMenuCommandBuilder / MessageContextMenuCommandBuilder
        .setName('ping')
        .setDescription('Replies with Pong and latency!'),

    // --- For Legacy Prefix Commands (Optional) ---
    name: 'ping',           // Legacy command name
    aliases: ['p', 'latency'], // Legacy command aliases (optional)
    description: 'Replies with Pong and latency!', // Used for help commands etc.

    // --- Common Properties ---
    permissions: [], // Array of Discord permissions (strings) required by the user (e.g., ['KickMembers'])
    roles: [],       // Array of role names or IDs required by the user (e.g., ['Moderator', '123456789012345678'])
    botPermissions: [], // Array of Discord permissions required by the *bot* (e.g., ['SendMessages', 'EmbedLinks'])
    cooldown: 5,     // Cooldown duration in seconds (optional)
    devOnly: false,  // If true, only usable by bot owner(s) (requires owner IDs setup) (optional)
    guildOnly: true, // If true, command cannot be used in DMs (optional, default: true for most)

    /**
     * The main execution logic for the command.
     * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').Message} interactionOrMessage
     * @param {string[]} [args] Optional arguments array for legacy commands
     */
    async execute(interactionOrMessage, args) {
        const isInteraction = interactionOrMessage.isChatInputCommand?.();
        const client = interactionOrMessage.client;

        const replyMethod = isInteraction ? 'reply' : 'channel.send';
        const editMethod = isInteraction ? 'editReply' : 'edit';

        const initialReply = await interactionOrMessage[replyMethod]({
            embeds: [SuiteEmbed.info('Calculating ping...')],
            fetchReply: isInteraction // Fetch reply needed for interaction editing
        });

        const latency = initialReply.createdTimestamp - interactionOrMessage.createdTimestamp;
        const wsLatency = client.ws.ping;

        const resultEmbed = SuiteEmbed.success()
            .setTitle('🏓 Pong!')
            .setDescription(`Roundtrip Latency: \`${latency}ms\`\nWebSocket Heartbeat: \`${wsLatency}ms\``);

        await initialReply[editMethod]({ embeds: [resultEmbed] });
    }
};
```
`InteractionManager`

Handles non-command interactions like buttons, select menus, and modals.

# Options (InteractionManager constructor):

    client: Your discord.js Client instance (required).

    options.logger: A logger instance (optional).

    options.componentDir: [Concept - Not fully implemented in base code] Path to load interaction handlers from files (similar to CommandHandler).

# Registering Handlers:

Use the registration methods to link a customId (or a prefix ending in *) to a handler function.
```js
const { InteractionManager } = require('@onurege3467/djs-suite');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const interactionManager = new InteractionManager(client, { logger });

// Handler for a specific button
interactionManager.registerButtonHandler('confirm_action_123', async (interaction) => {
    await interaction.update({ content: 'Action confirmed!', components: [] });
});

// Handler for any button starting with 'user_profile_'
interactionManager.registerButtonHandler('user_profile_*', async (interaction) => {
    const targetUserId = interaction.customId.split('_').pop();
    // ... fetch user profile and display ...
    await interaction.reply({ content: `Showing profile for user ID: ${targetUserId}`, ephemeral: true });
});

// Handler for a select menu
interactionManager.registerSelectMenuHandler('role_selector', async (interaction) => {
    const selectedRoles = interaction.values; // Array of selected role IDs
    // ... assign roles ...
    await interaction.update({ content: 'Roles updated!', components: [] });
});

// Handler for a modal submission
interactionManager.registerModalSubmitHandler('application_form', async (interaction) => {
    const feedback = interaction.fields.getTextInputValue('feedbackInput');
    const suggestion = interaction.fields.getTextInputValue('suggestionInput');
    // ... process form data ...
    await interaction.reply({ content: 'Application received!', ephemeral: true });
});

// Example of sending a button that the manager can handle
// (Inside a command's execute function)
const row = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('user_profile_987654321') // Matches the 'user_profile_*' handler
            .setLabel('View Profile')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('delete_message_11223344') // Matches another handler
            .setLabel('Delete Original Message')
            .setStyle(ButtonStyle.Danger)
    );
await interaction.reply({ content: 'User Actions:', components: [row] });
```
`SuiteEmbed`

An enhanced version of discord.js's EmbedBuilder.
```js
const { SuiteEmbed } = require('@onurege3467/djs-suite');

// Using static methods for quick embeds
const successEmbed = SuiteEmbed.success('User was successfully kicked.', 'Action Complete');
const errorEmbed = SuiteEmbed.error('Could not find the specified user.');

// Using instance methods and chaining
const warningEmbed = new SuiteEmbed()
    .useTemplate('warning', { description: 'This command will soon be deprecated.' })
    .setTimestamp()
    .setFooter({ text: 'Please update your workflows.' });

// Using a custom template during instantiation
const myTemplates = {
    custom: (data = {}) => ({
        color: 0x7289DA, // Discord Blurple
        title: `✨ ${data.title || 'Custom Event'} ✨`,
        description: data.description || 'Something unique happened!',
        fields: data.fields || []
    })
};
const customEmbed = new SuiteEmbed({}, myTemplates) // Pass custom templates here
    .useTemplate('custom', { title: 'Level Up!', description: 'You reached level 10!', fields: [{ name: 'Reward', value: '+50 XP' }] });

// Send the embed (inside command/interaction)
await interaction.reply({ embeds: [successEmbed] });
await interaction.followUp({ embeds: [warningEmbed], ephemeral: true });
```
`PermissionUtils`

Helper functions for checking permissions.
```js
const { PermissionUtils } = require('@onurege3467/djs-suite');

// Inside command execute or interaction handler
const member = interactionOrMessage.member;

if (!PermissionUtils.hasPermission(member, 'KickMembers')) {
    return interactionOrMessage.reply({ content: 'You do not have permission to kick members.', ephemeral: true });
}

if (!PermissionUtils.hasRole(member, 'Moderator')) { // Checks for role named 'Moderator' (case-insensitive) or role ID
    return interactionOrMessage.reply({ content: 'Only Moderators can use this command.', ephemeral: true });
}

if (PermissionUtils.isAdmin(member)) {
    // Maybe bypass cooldowns or grant special access
}
```
`CommonUtils`

A collection of general-purpose utility functions.
```js
const { CommonUtils } = require('@onurege3467/djs-suite');

const user = await CommonUtils.resolveUser(interactionOrMessage.guild, args[0] || interactionOrMessage.user); // Resolve user from arg or interaction author
const role = CommonUtils.resolveRole(interactionOrMessage.guild, 'Muted');

const duration = CommonUtils.formatDuration(3600000); // Output: "1h"
const embedColor = CommonUtils.randomColor();
const shortDesc = CommonUtils.truncateText(longDescription, 100);
```
`Logger`

Handles logging throughout the bot and the suite itself.

# Options (Logger constructor):

    options.level: Minimum log level to output ('debug', 'info', 'warn', 'error'). Defaults to 'info'.

    options.transport: Where to send logs ('console', 'file', 'discordChannel'). Defaults to 'console'. Note: 'file' and 'discordChannel' are placeholders in this base implementation.

    options.filePath: Path for the log file if transport is 'file'.

    options.client: Discord Client instance if transport is 'discordChannel'.

    options.channelId: Channel ID for logs if transport is 'discordChannel'.
```js
// Logger is usually initialized once in bot.js and passed to other components
logger.debug('Detailed information for debugging.');
logger.info('User used the ping command.');
logger.warn('Could not find the role specified.');
logger.error('Failed to connect to database:', errorObject);
```
## Customization

    Options: Most components accept an options object in their constructor for configuration.

    Command Files: Define your bot's logic entirely within your command files.

    Embed Templates: Pass your own template functions to the SuiteEmbed constructor.

    Modular Imports: Only use the parts of the suite you actually need.

    Logging: Configure log level and output (potentially extend transports).