const { PermissionsBitField, GuildMember } = require('discord.js');
const CommonUtils = require('./CommonUtils'); // Needed for role resolution

/**
 * Utility functions for checking user permissions and roles.
 */
const PermissionUtils = {
    /**
     * Checks if a GuildMember has the specified Discord permission(s).
     * @param {GuildMember | null} member The member to check.
     * @param {import('discord.js').PermissionResolvable | import('discord.js').PermissionResolvable[]} permission The permission(s) required.
     * @returns {boolean} True if the member has the permission(s), false otherwise.
     */
    hasPermission(member, permission) {
        if (!member || !(member instanceof GuildMember) || !member.permissions) return false;
        try {
            // Administrator permission overrides all others
            if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return true;
            }
            // Ensure permission is an array for consistent handling
            const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
            return member.permissions.has(permissionsToCheck);
        } catch (e) {
            // Log error?
            // console.error("[PermissionUtils.hasPermission] Error:", e);
            return false;
        }
    },

    /**
     * Checks if a GuildMember has a specific role (by name, ID, or Role object).
     * @param {GuildMember | null} member The member to check.
     * @param {string | import('discord.js').Role} roleResolvable The role name (case-insensitive), ID, or Role object required.
     * @returns {boolean} True if the member has the role, false otherwise.
     */
    hasRole(member, roleResolvable) {
         if (!member || !(member instanceof GuildMember) || !member.roles || !member.guild) return false;
         const role = CommonUtils.resolveRole(member.guild, roleResolvable);
         // Check if the role exists and the member has it in their cache
         return role ? member.roles.cache.has(role.id) : false;
    },

    /**
     * Checks if a GuildMember has the Administrator permission.
     * @param {GuildMember | null} member The member to check.
     * @returns {boolean} True if the member is an administrator, false otherwise.
     */
    isAdmin(member) {
        return this.hasPermission(member, PermissionsBitField.Flags.Administrator);
    }
};

module.exports = PermissionUtils;
