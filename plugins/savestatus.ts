import { BotContext } from '../types.js';
import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const configPath = dataFile('saveStatus.json');

// Ensure config exists
if (!HAS_DB && !fs.existsSync(configPath)) {
    if (!fs.existsSync(path.dirname(configPath))) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({ enabled: false }, null, 2));
}

async function readConfig() {
    try {
        if (HAS_DB) {
            const config = await store.getSetting('global', 'saveStatus');
            return config || { enabled: false };
        } else {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch {
        return { enabled: false };
    }
}

async function writeConfig(config: any) {
    if (HAS_DB) {
        await store.saveSetting('global', 'saveStatus', config);
    } else {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
}

export default {
    command: 'savestatus',
    aliases: ['statusdl'],
    category: 'owner',
    description: 'Toggle automatic status saving to your DM',
    usage: '.savestatus <on|off>',
    ownerOnly: true,

    async handler(sock: any, message: any, args: any, context: BotContext) {
        const chatId = context.chatId || message.key.remoteJid;
        const config = await readConfig();

        if (!args[0]) {
            await sock.sendMessage(chatId, { text: `Status Saving is currently: ${config.enabled ? '✅ Enabled' : '❌ Disabled'}` });
            return;
        }

        config.enabled = args[0].toLowerCase() === 'on';
        await writeConfig(config);
        await sock.sendMessage(chatId, { text: `Status Saving has been ${config.enabled ? 'ENABLED' : 'DISABLED'}.` });
    },

    // This handles the incoming status events
    async handleStatusUpdate(sock: any, status: any) {
        const config = await readConfig();
        if (!config.enabled) return;

        const msg = status.messages ? status.messages[0] : status;
        if (msg?.key?.remoteJid !== 'status@broadcast') return;

        const mediaMessage = msg.message?.imageMessage || msg.message?.videoMessage;
        if (!mediaMessage) return;

        try {
            const mediaBuffer = await downloadMediaMessage(
                msg, 'buffer', {}, 
                { logger: undefined as any, reuploadRequest: sock.updateMediaMessage }
            );

            // Using your ID found in logs
            const myJid = '254715182153@s.whatsapp.net';
            const senderName = msg.pushName || 'Unknown';
            const caption = `Status saved from: ${senderName}`;

            await sock.sendMessage(myJid, { 
                [msg.message?.imageMessage ? 'image' : 'video']: mediaBuffer, 
                caption 
            });
        } catch (error) {
            console.error('Error in status saver:', error);
        }
    }
};
