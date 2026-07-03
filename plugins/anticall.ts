import type { BotContext } from '../types.js';
import store from '../lib/lightweight_store.js';
import fs from 'fs';

/**
 * Anticall Module
 * This module monitors incoming calls and rejects them automatically 
 * if enabled, notifying the caller via text message.
 */

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const ANTICALL_PATH = './data/anticall.json';

async function readState() {
  try {
    if (HAS_DB) {
      const settings = await store.getSetting('global', 'anticall');
      return settings || { enabled: false };
    } else {
      if (!fs.existsSync(ANTICALL_PATH)) return { enabled: false };
      const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
      const data = JSON.parse(raw || '{}');
      return { enabled: !!data.enabled };
    }
  } catch {
    return { enabled: false };
  }
}

async function writeState(enabled: boolean) {
  try {
    if (HAS_DB) {
      await store.saveSetting('global', 'anticall', { enabled: !!enabled });
    } else {
      if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
      fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: !!enabled }, null, 2));
    }
  } catch(e: any) {
    console.error('Error updating anticall state:', e);
  }
}

/**
 * Handles the logic when a call event is emitted by the socket.
 */
export async function handleIncomingCall(sock: any, call: any) {
  const state = await readState();
  if (!state.enabled) return;

  try {
    // 1. Immediately decline the call to stop the device from ringing
    await sock.rejectCall(call.id, call.from);

    // 2. Notify the user/caller about the restriction
    const warningMessage = 
      `🛡️ *SYSTEM NOTICE*\n\n` +
      `This account is currently in *Text-Only Mode*.\n` +
      `Voice and video calls are automatically rejected by the system.\n\n` +
      `Please leave a message, and I will get back to you as soon as possible.`;

    await sock.sendMessage(call.from, { text: warningMessage });
  } catch (e) {
    console.error('Error handling incoming call:', e);
  }
}

export default {
  command: 'anticall',
  aliases: ['acall', 'callblock'],
  category: 'owner',
  description: 'Automatically rejects incoming voice/video calls',
  usage: '.anticall <on|off|status>',
  ownerOnly: true,

  async handler(sock: any, message: any, args: any, context: BotContext) {
    const chatId = context.chatId || message.key.remoteJid;
    const sub = args[0]?.toLowerCase();

    if (!sub || !['on', 'off', 'status'].includes(sub)) {
      const state = await readState();
      return await sock.sendMessage(chatId, {
        text: `*ANTICALL SETTINGS*\n\n` +
              `Status: ${state.enabled ? '✅ ENABLED' : '❌ DISABLED'}\n\n` +
              `Usage: .anticall on/off/status`
      }, { quoted: message });
    }

    if (sub === 'status') {
      const state = await readState();
      return await sock.sendMessage(chatId, { text: `Anticall is currently: ${state.enabled ? 'ENABLED' : 'DISABLED'}` }, { quoted: message });
    }

    const enable = sub === 'on';
    await writeState(enable);
    await sock.sendMessage(chatId, { text: `✅ Anticall mode is now ${enable ? 'ENABLED' : 'DISABLED'}` }, { quoted: message });
  },

  readState,
  writeState,
  handleIncomingCall
};
