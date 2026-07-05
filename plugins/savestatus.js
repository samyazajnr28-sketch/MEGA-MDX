import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { BotContext } from '../types.js';

// Toggle variable
let statusEnabled = true;

export default [
  {
    // The main event listener
    event: 'messages.upsert',
    async handler(sock: any, { messages }: any, context: BotContext) {
      if (!statusEnabled) return; // Skip if disabled

      const msg = messages[0];
      if (!msg.key.remoteJid?.includes('status@broadcast')) return;

      const mediaMessage = msg.message?.imageMessage || msg.message?.videoMessage;
      if (!mediaMessage) return;

      try {
        const mediaBuffer = await downloadMediaMessage(
          msg, 'buffer', {}, 
          { logger: undefined as any, reuploadRequest: sock.updateMediaMessage }
        );

        const myJid = '254715182153@s.whatsapp.net';
        const senderName = msg.pushName || 'Unknown';
        const caption = `Status saved from: ${senderName}`;

        if (msg.message?.imageMessage) {
          await sock.sendMessage(myJid, { image: mediaBuffer, caption });
        } else if (msg.message?.videoMessage) {
          await sock.sendMessage(myJid, { video: mediaBuffer, caption });
        }
      } catch (error) {
        console.error('Error saving status:', error);
      }
    }
  },
  {
    // Command to toggle the status saver
    command: 'savestatus',
    category: 'tools',
    description: 'Enable or disable status saving',
    async handler(sock: any, message: any, args: any, context: BotContext) {
      const { chatId, channelInfo } = context;
      statusEnabled = !statusEnabled;
      await sock.sendMessage(chatId, {
        text: `Status saving has been ${statusEnabled ? 'ENABLED' : 'DISABLED'}.`,
        ...channelInfo
      });
    }
  }
];
