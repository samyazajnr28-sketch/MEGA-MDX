import type { BotContext } from '../types.js';
import { igdl } from 'ruhend-scraper';

/**
 * Optimized Instagram Downloader
 * Improvements:
 * 1. Sequential processing with controlled intervals for stability.
 * 2. Robust error handling for individual media items.
 * 3. Specific URL validation for Instagram.
 */

const processedMessages = new Set<string>();

export default {
  command: 'instagram',
  aliases: ['ig', 'igdl', 'insta'],
  category: 'download',
  description: 'Download Instagram posts, reels & videos',
  usage: '.ig <instagram link>',

  async handler(sock: any, message: any, args: any, context: BotContext) {
    const chatId = context.chatId || message.key.remoteJid;
    const text = args.join(' ') || message.message?.conversation || message.message?.extendedTextMessage?.text;

    if (processedMessages.has(message.key.id)) return;
    processedMessages.add(message.key.id);
    setTimeout(() => processedMessages.delete(message.key.id), 300000);

    if (!text) {
      return await sock.sendMessage(chatId, { 
        text: '📸 *Instagram Downloader*\n\nUsage:\n.ig <post | reel | video link>' 
      }, { quoted: message });
    }

    const igRegex = /https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|tv)\/[a-zA-Z0-9_-]+/i;
    if (!igRegex.test(text)) {
      return await sock.sendMessage(chatId, { 
        text: '❌ Invalid link. Please send a valid Instagram post, reel, or video URL.' 
      }, { quoted: message });
    }

    try {
      await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

      const res = await igdl(text).catch(() => null);

      if (!res?.data || !Array.isArray(res.data) || res.data.length === 0) {
        return await sock.sendMessage(chatId, { 
          text: '❌ Could not retrieve media. The link might be private or broken.' 
        }, { quoted: message });
      }

      // Deduplicate and limit
      const mediaList = res.data
        .filter((item: any, index: number, self: any[]) => 
          item?.url && self.findIndex(t => t.url === item.url) === index
        )
        .slice(0, 5);

      // Using sequential processing to prevent message collisions and "error throwing"
      for (const media of mediaList) {
        try {
          const isVideo = media.type === 'video' || /mp4|mov|webm/i.test(media.url);
          
          await sock.sendMessage(chatId, {
            [isVideo ? 'video' : 'image']: { url: media.url },
            ...(isVideo ? { mimetype: 'video/mp4' } : {}),
            caption: '📥 *Downloaded by MEGA-MD*'
          }, { quoted: message });

          // Small delay to ensure sequential stability
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (subErr) {
          console.error('Media stream error:', subErr);
        }
      }

      await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err: any) {
      console.error('Instagram plugin fatal error:', err);
      await sock.sendMessage(chatId, { 
        text: '⚠️ An error occurred while processing your request. Please try again later.' 
      }, { quoted: message });
    }
  }
};
