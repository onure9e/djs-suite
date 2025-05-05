const { Guild, User, Role } = require('discord.js'); // For JSDoc type hinting

/**
 * Collection of common utility functions.
 */
const CommonUtils = {
    /**
     * Resolves a User object from an ID, mention, or tag.
     * @param {Guild} guild The guild to search within.
     * @param {string | User} userResolvable The user ID, mention, tag, or User object.
     * @returns {Promise<User | null>} The resolved User object or null if not found.
     */
    async resolveUser(guild, userResolvable) {
        if (!guild || !userResolvable) return null;
        if (userResolvable instanceof User) return userResolvable; // Already a User object

        try {
            // Try fetching by ID first
            let user = await guild.client.users.fetch(userResolvable).catch(() => null);
            if (user) return user;

            // Try matching mention (<@id> or <@!id>)
            const mentionMatch = userResolvable.match(/^<@!?(\d+)>$/);
            if (mentionMatch) {
                user = await guild.client.users.fetch(mentionMatch[1]).catch(() => null);
                if (user) return user;
            }

            // Try searching members by query (username#tag or username) - potentially slower
            // Use with caution, might return unexpected results if names are similar
            // const members = await guild.members.search({ query: userResolvable, limit: 1 }).catch(() => null);
            // if (members && members.size > 0) return members.first().user;

        } catch (error) {
            // Log the error internally maybe?
            // console.error("[CommonUtils.resolveUser] Error:", error);
        }
        return null; // Not found
    },

    /**
     * Resolves a Role object from an ID, mention, or name.
     * @param {Guild} guild The guild to search within.
     * @param {string | Role} roleResolvable The role ID, mention, name, or Role object.
     * @returns {Role | null} The resolved Role object or null if not found.
     */
    resolveRole(guild, roleResolvable) {
         if (!guild || !roleResolvable) return null;
         if (roleResolvable instanceof Role) return roleResolvable; // Already a Role object

         // Try getting from cache by ID
         let role = guild.roles.cache.get(roleResolvable);
         if (role) return role;

         // Try matching mention (<@&id>)
         const mentionMatch = roleResolvable.match(/^<@&(\d+)>$/);
         if (mentionMatch) {
             role = guild.roles.cache.get(mentionMatch[1]);
             if (role) return role;
         }

         // Try finding by name (case-insensitive)
         role = guild.roles.cache.find(r => r.name.toLowerCase() === roleResolvable.toLowerCase());
         if (role) return role;

         return null; // Not found
    },

    /**
     * Truncates text to a specified maximum length, appending '...'.
     * @param {string} text The text to truncate.
     * @param {number} [maxLength=1000] The maximum length allowed.
     * @returns {string} The truncated text.
     */
    truncateText(text, maxLength = 1000) {
        if (typeof text !== 'string') return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    },

    /**
     * Formats milliseconds into a human-readable duration string (e.g., 1d 2h 3m 4s).
     * @param {number} ms Duration in milliseconds.
     * @returns {string} The formatted duration string.
     */
    formatDuration(ms) {
        if (ms < 0) ms = -ms;
        const time = {
          d: Math.floor(ms / 86400000),
          h: Math.floor(ms / 3600000) % 24,
          m: Math.floor(ms / 60000) % 60,
          s: Math.floor(ms / 1000) % 60,
        };
        return Object.entries(time)
          .filter(([, val]) => val !== 0)
          .map(([key, val]) => `${val}${key}`)
          .join(' ') || '0s'; // Return '0s' if duration is zero
      },

    /**
     * Generates a random decimal color code suitable for embeds.
     * @returns {number} A random color code (0 to 16777215).
     */
    randomColor() {
        return Math.floor(Math.random() * 0xFFFFFF); // 0xFFFFFF is 16777215
    },

    /**
     * Cleans Discord mentions (everyone, here, users, roles, channels) from a string,
     * optionally replacing them with display names.
     * @param {string} content The content to clean.
     * @param {import('discord.js').Message} [message] The message object for context (guild needed for name resolution).
     * @param {boolean} [resolveNames=true] Whether to replace mentions with names.
     * @returns {string} The cleaned content.
     */
    cleanContent(content, message, resolveNames = true) {
        if (typeof content !== 'string') return '';
        let cleaned = content
            .replace(/@everyone/g, '@\u200Beveryone') // Zero-width space to break mention
            .replace(/@here/g, '@\u200Bhere');

        if (resolveNames && message?.guild) {
            // Replace user mentions
            cleaned = cleaned.replace(/<@!?(\d+)>/g, (match, id) => {
                const member = message.guild.members.cache.get(id);
                return member ? `@${member.displayName}` : match;
            });
            // Replace role mentions
            cleaned = cleaned.replace(/<@&(\d+)>/g, (match, id) => {
                 const role = message.guild.roles.cache.get(id);
                 return role ? `@${role.name}` : match;
            });
             // Replace channel mentions
             cleaned = cleaned.replace(/<#(\d+)>/g, (match, id) => {
                 const channel = message.guild.channels.cache.get(id);
                 return channel ? `#${channel.name}` : match;
            });
        } else {
             // Just break mentions without resolving names
             cleaned = cleaned.replace(/<(@!?\d+|@&\d+|#\d+)>/g, '<\\$1>'); // Escapes the mention
        }
        return cleaned;
    }
};

module.exports = CommonUtils;
