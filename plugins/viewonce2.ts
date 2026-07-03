import type { BotContext } from '../types.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
  command: 'viewonce2',
  aliases: ['vv2'],
  category: 'general',
  description: 'Re-send a view-once image or video to your personal DM.',
  usage: '.viewonce2 (reply to a view-once media)',

  async handler(sock: any, message: any, args: any, context: BotContext) {
    const chatId = context.chatId || message.key.remoteJid;
    // Automatically get your own JID from the socket
    const myJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';

    try {
      const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedImage = quoted?.imageMessage;
      const quotedVideo = quoted?.videoMessage;

      if (!quotedImage && !quotedVideo) {
        return await sock.sendMessage(chatId, {
          text: '*Please reply to a view-once image or video.*'
        }, { quoted: message });
      }

      if (quotedImage && quotedImage.viewOnce) {
        const stream = await downloadContentFromMessage(quotedImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        
        await sock.sendMessage(myJid, {
          image: buffer,
          caption: `📸 ViewOnce captured from: ${chatId}\nCaption: ${quotedImage.caption || ''}`
        });
        await sock.sendMessage(chatId, { text: '✅ View-once media sent to your DM.' }, { quoted: message });
      }
      else if (quotedVideo && quotedVideo.viewOnce) {
        const stream = await downloadContentFromMessage(quotedVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        
        await sock.sendMessage(myJid, {
          video: buffer,
          caption: `🎥 ViewOnce captured from: ${chatId}\nCaption: ${quotedVideo.caption || ''}`
        });
        await sock.sendMessage(chatId, { text: '✅ View-once media sent to your DM.' }, { quoted: message });
      }
      else {
        await sock.sendMessage(chatId, {
          text: '*The replied message is not a view-once media.*'
        }, { quoted: message });
      }

    } catch(error: any) {
      console.error('Error in viewonce2Command:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Failed to forward the view-once media to your DM.'
      }, { quoted: message });
    }
  }
};
