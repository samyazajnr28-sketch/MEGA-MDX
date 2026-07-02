import type { BotContext } from '../types.js';
import store from '../lib/lightweight_store.js';
import fs from 'fs';

const ANTICALL_PATH = './data/anticall.json';

// --- Logic to check state ---
export async function isAnticallEnabled(): Promise<boolean> {
  try {
    const settings = await store.getSetting('global', 'anticall');
    return settings?.enabled || false;
  } catch {
    return false;
  }
}

// --- Rejection Function (Call this in your main message listener) ---
export async function handleIncomingCall(sock: any, call: any) {
  const enabled = await isAnticallEnabled();
  if (!enabled) return;

  // Reject the call
  await sock.rejectCall(call.id);

  // The Cyber-Security Dashboard Message
  const dashboardMessage = 
    `┌─── 🛡️ *CYBER-SECURITY DASHBOARD* 🛡️ ───┐\n` +
    `│                                       \n` +
    `│ ⚠️ *CONNECTION RESTRICTED* ⚠️          \n` +
    `│                                       \n` +
    `│ *Detected:* Incoming Vector Transmission \n` +
    `│ *Action:* Rejected                       \n` +
    `│ *Status:* Encryption Guard Active        \n` +
    `│                                       \n` +
    `└───────────────────────────────────────┘\n\n` +
    `*Notice:* This account does not allow video or voice transmission vectors. \n` +
    `*Recommendation:* Please proceed via text communication.`;

  await sock.sendMessage(call.from, { text: dashboardMessage });
}

// --- Command Handler ---
export default {
  command: 'anticall',
  aliases: ['acall', 'callblock'],
  category: 'owner',
  description: 'Toggle auto-block for incoming calls',
  usage: '.anticall <on|off>',
  ownerOnly: true,

  async handler(sock: any, message: any, args: any, context: BotContext) {
    const chatId = context.chatId || message.key.remoteJid;
    const sub = args.join(' ').trim().toLowerCase();

    if (sub === 'on' || sub === 'off') {
      const enable = sub === 'on';
      await store.saveSetting('global', 'anticall', { enabled: enable });
      return await sock.sendMessage(chatId, { 
        text: `📵 *Anticall ${enable ? 'ENABLED' : 'DISABLED'}*\n\n` +
              `Status: ${enable ? 'Auto-rejecting calls' : 'Calls allowed'}` 
      }, { quoted: message });
    }

    const state = await isAnticallEnabled();
    await sock.sendMessage(chatId, {
      text: `*ANTICALL DASHBOARD*\n\nStatus: ${state ? '✅ ENABLED' : '❌ DISABLED'}\n\nUsage: .anticall <on/off>`
    }, { quoted: message });
  }
};
