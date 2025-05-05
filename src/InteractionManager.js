const { Collection, InteractionType } = require('discord.js');
const Logger = require('./Logger'); // Use internal logger if none provided

/**
 * Manages non-command interactions (Buttons, Select Menus, Modals).
 */
class InteractionManager {
    /**
     * Creates an InteractionManager instance.
     * @param {import('discord.js').Client} client The Discord Client instance.
     * @param {object} [options={}] Configuration options.
     * @param {Logger} [options.logger] A logger instance.
     * @param {string} [options.componentDir] [Concept] Directory to load component handlers from (not fully implemented).
     */
    constructor(client, options = {}) {
         if (!client) throw new Error("InteractionManager requires a Discord Client instance.");
         this.client = client;
         // Stores persistent handlers: <customIdPrefix_or_exactId, { type: 'button'|'select'|'modal', handler: Function }>
         this.handlers = new Collection();
         // Stores temporary stateful handlers (e.g., pagination): <interactionId_or_messageId, handlerData> (Concept)
         this.statefulHandlers = new Collection();
         this.logger = options.logger || new Logger({ level: 'info' }); // Use provided or default logger

         // Start listening for interactions
         this._listen();
         this.logger.info('InteractionManager initialized and listening for interactions.');
    }

    /**
     * Registers a persistent handler for components matching a customId or prefix.
     * Prefixes should end with '*'.
     * @param {string} customId The exact customId or a prefix ending with '*'.
     * @param {'button' | 'select' | 'modal'} type The type of interaction.
     * @param {Function} handler The handler function: async (interaction) => void
     * @throws {Error} If handler is not a function.
     */
    registerHandler(customId, type, handler) {
        if (typeof handler !== 'function') {
            throw new Error(`Handler for customId "${customId}" must be a function.`);
        }
        if (!['button', 'select', 'modal'].includes(type)) {
             throw new Error(`Invalid handler type "${type}" for customId "${customId}". Must be 'button', 'select', or 'modal'.`);
        }
        this.handlers.set(customId, { type, handler });
        this.logger.debug(`Registered persistent ${type} handler for ID/Prefix: ${customId}`);
    }

    // Convenience methods for registering handlers
    registerButtonHandler(customId, handler) {
        this.registerHandler(customId, 'button', handler);
    }
    registerSelectMenuHandler(customId, handler) {
        this.registerHandler(customId, 'select', handler);
    }
    registerModalSubmitHandler(customId, handler) {
        this.registerHandler(customId, 'modal', handler);
    }

    // --- Placeholder/Concept for Stateful Handlers & Pagination ---
    /**
     * [Concept] Registers a temporary handler tied to a specific interaction or message, often with state.
     * @param {string} key Interaction ID or Message ID.
     * @param {object} handlerData Data including the handler function and state.
     * @param {number} timeout Timeout in milliseconds before auto-cleanup.
     */
    // registerStatefulHandler(key, handlerData, timeout) { ... }

    /**
     * [Concept] Removes a stateful handler.
     * @param {string} key The key used during registration.
     */
    // unregisterStatefulHandler(key) { ... }

    /**
     * [Concept] Creates and manages a paginated embed message.
     * @param {import('discord.js').CommandInteraction | import('discord.js').MessageComponentInteraction} interaction The interaction to reply to.
     * @param {import('discord.js').EmbedBuilder[]} pages An array of EmbedBuilders representing the pages.
     * @param {object} [options] Pagination options (buttons, timeout, etc.).
     */
    // async createPagination(interaction, pages, options = {}) { ... }
    // --- End Placeholder ---


    /**
     * Finds the appropriate persistent handler for a given customId and type.
     * Prioritizes exact matches, then checks for prefix matches.
     * @param {string} customId The customId from the interaction.
     * @param {'button' | 'select' | 'modal'} type The interaction type.
     * @returns {Function | null} The handler function or null if not found.
     * @private
     */
    _findHandler(customId, type) {
        // 1. Check for exact match
        let handlerData = this.handlers.get(customId);
        if (handlerData && handlerData.type === type) {
            return handlerData.handler;
        }

        // 2. Check for prefix match (keys ending with '*')
        // Iterate through handlers to find a matching prefix
        for (const [key, data] of this.handlers.entries()) {
            if (key.endsWith('*') && data.type === type && customId.startsWith(key.slice(0, -1))) {
                return data.handler; // Return the first matching prefix handler
            }
        }

        return null; // No handler found
    }

    /**
     * Sets up the listener for the 'interactionCreate' event.
     * @private
     */
    _listen() {
        this.client.on('interactionCreate', async interaction => {
            let handler;
            let handlerType = 'Unknown';
            let customId = interaction.customId || 'N/A'; // Modals don't have customId directly on top level

            try {
                 // --- Placeholder: Check for Stateful Handlers First ---
                 // const statefulHandler = this.statefulHandlers.get(interaction.message?.id || interaction.id);
                 // if (statefulHandler) { handler = statefulHandler.handler; /* ... */ }
                 // --- End Placeholder ---


                // Determine interaction type and find persistent handler
                if (interaction.isButton()) {
                    handlerType = 'button';
                    handler = this._findHandler(interaction.customId, handlerType);
                } else if (interaction.isAnySelectMenu()) { // Catches StringSelectMenu, UserSelectMenu, etc.
                    handlerType = 'select';
                     handler = this._findHandler(interaction.customId, handlerType);
                } else if (interaction.type === InteractionType.ModalSubmit) {
                    handlerType = 'modal';
                    customId = interaction.customId; // Get customId from modal
                    handler = this._findHandler(customId, handlerType);
                } else {
                    // Ignore other interaction types (like commands, handled by CommandHandler)
                    return;
                }

                // Execute the handler if found
                if (handler) {
                     this.logger.info(`Executing ${handlerType} handler for ID "${customId}" triggered by ${interaction.user.tag}`);
                     // Provide context? Maybe pass manager instance? handler(interaction, this);
                     await handler(interaction);
                } else {
                    // No persistent handler found - potentially an old interaction or one managed statefully
                     this.logger.warn(`No persistent ${handlerType} handler found for customId: ${customId}`);
                     // Optionally reply to the user that the interaction is outdated
                     if (!interaction.replied && !interaction.deferred && interaction.isMessageComponent()) {
                         await interaction.reply({ content: 'This interaction is no longer valid or has expired.', ephemeral: true }).catch(() => {});
                     } else if (interaction.type === InteractionType.ModalSubmit && !interaction.replied && !interaction.deferred) {
                          await interaction.reply({ content: 'Could not process this form submission (handler not found).', ephemeral: true }).catch(() => {});
                     }
                }
            } catch (error) {
                this.logger.error(`Error executing ${handlerType} handler for ID "${customId}":`, error);
                 try {
                      const replyMethod = (interaction.replied || interaction.deferred) ? 'followUp' : 'reply';
                      await interaction[replyMethod]({ content: 'An error occurred while processing this interaction!', ephemeral: true });
                 } catch (e) {
                     this.logger.error(`Interaction error fallback reply failed for ID "${customId}":`, e);
                 }
            }
        });
    }
}

module.exports = InteractionManager;