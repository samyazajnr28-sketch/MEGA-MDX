import { BotContext } from '../types.js';
import fs from 'fs';
import path from 'path';
import { dataFile } from '../lib/paths.js';
import store from '../lib/lightweight_store.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const configPath = dataFile('autoStatus.json');
const downloadDir = path.join(process.cwd(), 'downloads', 'statuses');

if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

if (!HAS_DB && !fs.existsSync(configPath)) {
    if (!fs.existsSync(path.dirname(configPath))) {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify({
        enabled: false,
        reactOn: false,
        saveOn: false
    }, null, 2));
}

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363319098372999@newsletter',
            newsletterName: 'GlobalTechInc',
            serverMessageId: -1
        }
    }
};

async function readConfig() {
    try {
        if (HAS_DB) {
            const config = await store.getSetting('global', 'autoStatus');
            return config || { enabled: false, reactOn: false, saveOn: false };
        } else {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return {
                enabled: !!config.enabled,
                reactOn: !!config.reactOn,
                saveOn: !!config.saveOn
            };
        }
    } catch(error: any) {
        console.error('Error reading auto status config:', error);
        return { enabled: false, reactOn: false, saveOn: false };
    }
}

async function writeConfig(config: any) {
    try {
        if (HAS_DB) {
            await store.saveSetting('global', 'autoStatus', config);
        } else {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
    } catch(error: any) {
        console.error('Error writing auto status config:', error);
    }
}

async function isAutoStatusEnabled() {
    const config = await readConfig();
    return config.enabled;
}

async function isStatusReactionEnabled() {
    const config = await readConfig();
    return config.reactOn;
}

async function isStatusSaveEnabled() {
    const config = await readConfig();
    return config.saveOn;
}

async function saveStatus(sock: any, msg: any) {
    try {
        if (!(await isStatusSaveEnabled())) return;

        const message = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.extendedTextMessage;
        if (!message) return;

        const type = msg.message?.imageMessage ? 'image' : 'video';
        const stream = await downloadContentFromMessage(msg.message?.imageMessage ? msg.message.imageMessage : msg.message.videoMessage, type);
        
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const fileName = `${msg.key.id || Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`;
        fs.writeFileSync(path.join(downloadDir, fileName), buffer);
        console.log(`💾 Successfully saved status: ${fileName}`);
    } catch (error: any) {
        console.error('❌ Error saving status:', error.message);
    }
}

async function reactToStatus(sock: any, statusKey: any) {
    try {
        if (!(await isStatusReactionEnabled())) return;

        await sock.relayMessage(
            'status@broadcast',
            {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: statusKey.participant || statusKey.remoteJid,
                        fromMe: false
                    },
                    text: '🤍'
                }
            },
            {
                messageId: statusKey.id,
                statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid]
            }
        );
        console.log('✅ Reacted to status');
    } catch(error: any) {
        console.error('❌ Error reacting to status:', error.message);
    }
}

async function handleStatusUpdate(sock: any, status: any) {
    try {
        if (!(await isAutoStatusEnabled())) return;
        await new Promise(resolve => setTimeout(resolve, 1000));

        const msg = status.messages ? status.messages[0] : status;
        if (msg.key && msg.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            console.log('✅ Viewed status');

            await reactToStatus(sock, msg.key);
            await saveStatus(sock, msg);
        }
    } catch(error: any) {
        console.error('❌ Error in auto status view:', error.message);
    }
}

export default {
    command: 'autostatus',
    aliases: ['autoview', 'statusview'],
    category: 'owner',
    description: 'Automatically view, react, and save WhatsApp statuses',
    usage: '.autostatus <on|off|react on|react off|save on|save off>',
    ownerOnly: true,

    async handler(sock: any, message: any, args: any, context: BotContext) {
        const chatId = context.chatId || message.key.remoteJid;
        const config = await readConfig();

        if (!args || args.length === 0) {
            await sock.sendMessage(chatId, {
                text: `🔄 *Auto Status Settings*\n\n` +
                      `📱 *Auto View:* ${config.enabled ? '✅' : '❌'}\n` +
                      `💫 *Reactions:* ${config.reactOn ? '✅' : '❌'}\n` +
                      `💾 *Auto Save:* ${config.saveOn ? '✅' : '❌'}\n\n` +
                      `*Usage:*\n.autostatus on/off\n.autostatus react on/off\n.autostatus save on/off`,
                ...channelInfo
            }, { quoted: message });
            return;
        }

        const cmd = args[0].toLowerCase();
        if (cmd === 'on' || cmd === 'off') {
            config.enabled = (cmd === 'on');
        } else if (cmd === 'react' && args[1]) {
            config.reactOn = (args[1].toLowerCase() === 'on');
        } else if (cmd === 'save' && args[1]) {
            config.saveOn = (args[1].toLowerCase() === 'on');
        } else {
            return await sock.sendMessage(chatId, { text: '❌ Invalid arguments.' }, { quoted: message });
        }

        await writeConfig(config);
        await sock.sendMessage(chatId, { text: `✅ Settings updated successfully.` }, { quoted: message });
    },

    handleStatusUpdate,
    isAutoStatusEnabled,
    isStatusReactionEnabled,
    isStatusSaveEnabled,
    reactToStatus,
    saveStatus,
    readConfig,
    writeConfig
};
