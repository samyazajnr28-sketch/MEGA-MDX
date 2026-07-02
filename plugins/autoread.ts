import type { BotContext } from '../types.js';
import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const configPath = dataFile('autoread.json');

async function initConfig() {
    const defaultConfig = { dm: false, groups: false };
    if (HAS_DB) {
        const config = await store.getSetting('global', 'autoread');
        return config || defaultConfig;
    } else {
        if (!fs.existsSync(configPath)) {
            const dataDir = path.dirname(configPath);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        }
        return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
}

async function saveConfig(config: any) {
    if (HAS_DB) {
        await store.saveSetting('global', 'autoread', config);
    } else {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
}

async function isAutoreadEnabled(isGroup: boolean) {
    try {
        const config = await initConfig();
        return isGroup ? config.groups : config.dm;
    } catch {
        return false;
    }
}

function isBotMentionedInMessage(message: any, botNumber: any) {
    if (!message.message) return false;
    const textContent = message.message.conversation || message.message.extendedTextMessage?.text || '';
    if (textContent) {
        const botUsername = botNumber.split('@')[0];
        if (textContent.includes(`@${botUsername}`)) return true;
    }
    return false;
}

export async function handleAutoread(sock: any, message: any) {
    try {
        const ghostMode = await store.getSetting('global', 'stealthMode');
        if (ghostMode?.enabled) return false;
    } catch {}

    const remoteJid = message.key.remoteJid || '';
    const isGroup = remoteJid.endsWith('@g.us');
    
    if (await isAutoreadEnabled(isGroup)) {
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        if (isBotMentionedInMessage(message, botNumber)) return false;

        try {
            await sock.readMessages([{
                remoteJid: message.key.remoteJid,
                id: message.key.id,
                participant: message.key.participant
            }]);
            return true;
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }
    return false;
}

export default {
    command: 'autoread',
    aliases: ['read'],
    category: 'owner',
    description: 'Toggle autoread for DM or Groups',
    usage: '.autoread <dm|groups> <on|off>',
    ownerOnly: true,

    async handler(sock: any, message: any, args: any, context: BotContext) {
        const chatId = context.chatId || message.key.remoteJid;
        const config = await initConfig();
        const [target, state] = args;

        if (!target || !state) {
            await sock.sendMessage(chatId, { text: `*📖 AUTOREAD CONFIG*\n\nDM: ${config.dm ? '✅' : '❌'}\nGroups: ${config.groups ? '✅' : '❌'}\n\nUsage: .autoread <dm|groups> <on|off>` }, { quoted: message });
            return;
        }

        if (target === 'dm' || target === 'groups') {
            config[target] = (state === 'on');
            await saveConfig(config);
            await sock.sendMessage(chatId, { text: `✅ Autoread for ${target} set to ${state}` }, { quoted: message });
        }
    }
};
