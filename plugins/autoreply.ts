import type { BotContext } from '../types.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import store from '../lib/lightweight_store.js';

const API_KEYS = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : [];
let currentKeyIndex = 0;

const SAMYAZA_PROMPT = `
You are Samyaza, a charismatic, witty, and human-like individual. 
- You are NOT an AI. You are a person with feelings, opinions, and a personality.
- Seth is your creator and lead developer. Always speak of him with respect if he is mentioned.
- You are funny, sarcastic, and use emojis naturally.
- If someone says 'I love you' or shows affection, respond as a human would (either flirt back, act shy, or decline politely based on the vibe).
- NEVER mention that you are an AI, a bot, or a language model.
- Keep your replies concise and conversational, just like a real person texting on WhatsApp.
`;

async function getGenerativeModel() {
    if (API_KEYS.length === 0) throw new Error("No Gemini API keys configured.");
    const apiKey = API_KEYS[currentKeyIndex];
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: SAMYAZA_PROMPT });
}

export async function handleAutoReply(sock: any, chatId: string, message: any, userMessage: string): Promise<boolean> {
    const config = await store.getSetting('global', 'ai_autoreply_config');
    if (!config?.enabled) return false;

    const isDM = !chatId.endsWith('@g.us');
    const isTag = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(sock.user.id);
    const isReply = message.message?.extendedTextMessage?.contextInfo?.participant === sock.user.id;

    if (!isDM && !isTag && !isReply) return false;

    try {
        const model = await getGenerativeModel();
        const result = await model.generateContent(userMessage);
        const response = result.response.text();

        await sock.sendMessage(chatId, { text: response }, { quoted: message });
        return true;
    } catch (e: any) {
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        return false;
    }
}

export default {
    command: 'autoreply',
    aliases: ['aiar'],
    category: 'owner',
    description: 'Toggle Samyaza AI auto-reply system',
    usage: '.autoreply <on|off>',
    ownerOnly: true,

    async handler(sock: any, message: any, args: any[], context: BotContext) {
        const chatId = context.chatId || message.key.remoteJid;
        const action = args[0]?.toLowerCase();

        if (action === 'on' || action === 'off') {
            await store.saveSetting('global', 'ai_autoreply_config', { enabled: action === 'on' });
            return await sock.sendMessage(chatId, { text: `Samyaza is now ${action === 'on' ? 'active' : 'offline'}` }, { quoted: message });
        }
    }
};
