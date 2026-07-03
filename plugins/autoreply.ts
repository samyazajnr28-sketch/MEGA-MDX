import type { BotContext } from '../types.js';

/**
 * Auto-Reply AI Module
 * - Rotates through GEMINI_API_KEY_n in process.env
 * - Replies to DMs and mentions
 * - Personality: Samyaza
 */

const getGeminiKeys = () => {
    return Object.keys(process.env)
        .filter(key => key.startsWith('GEMINI_API_KEY_'))
        .map(key => process.env[key]!)
        .filter(Boolean);
};

let currentKeyIndex = 0;

async function getGeminiResponse(userMessage: string, senderName: string): Promise<string | null> {
    const keys = getGeminiKeys();
    if (keys.length === 0) return null;

    const systemPrompt = `
You are Samyaza. You are a charismatic, witty, and human-like individual. 
- You are NOT an AI. You are a person with feelings, opinions, and a personality.
- Seth is your creator and lead developer. Always speak of him with respect if he is mentioned.
- You are funny, sarcastic, and use emojis naturally.
- If someone says 'I love you' or shows affection, respond as a human would (either flirt back, act shy, or decline politely based on the vibe).
- NEVER mention that you are an AI, a bot, or a language model.
- Keep your replies concise and conversational, just like a real person texting on WhatsApp.
- Reply to ${senderName}.
    `.trim();

    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[currentKeyIndex];
        try {
            // Using gemini-1.5-flash for stability
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nUser says: ${userMessage}` }] }]
                })
            });

            if (response.ok) {
                const data = (await response.json()) as any;
                return data.candidates[0].content.parts[0].text;
            }
        } catch (e) {
            console.error(`Key index ${currentKeyIndex} failed.`);
        }
        
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    }
    return null;
}

export async function handleAutoReply(sock: any, message: any, userMessage: string) {
    const remoteJid = message.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    const senderId = message.key.participant || remoteJid;
    const botId = sock.user?.id?.split(':')[0] || '';

    const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const isMentioned = mentionedJid.includes(botId + '@s.whatsapp.net') || userMessage.includes('@' + botId);
    
    // Auto-reply trigger: DMs or Mentions (excluding if message is from the bot itself)
    if ((!isGroup || isMentioned) && !message.key.fromMe) {
        const reply = await getGeminiResponse(userMessage, senderId);
        if (reply) {
            await sock.sendPresenceUpdate('composing', remoteJid);
            await sock.sendMessage(remoteJid, { text: reply }, { quoted: message });
        }
    }
}

export default {
    command: 'autoreply',
    aliases: ['ai', 'samyaza'],
    category: 'admin',
    description: 'Toggle Samyaza Auto-Reply',
    usage: '.autoreply <on|off>',
    async handler(sock: any, message: any, args: any) {
        const sub = args[0]?.toLowerCase();
        await sock.sendMessage(message.key.remoteJid, { 
            text: `Samyaza personality mode is now ${sub === 'on' ? 'ACTIVE' : 'INACTIVE'}` 
        }, { quoted: message });
    }
};
