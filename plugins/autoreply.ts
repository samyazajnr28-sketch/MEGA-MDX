export async function handleAutoReply(sock: any, message: any, userMessage: string) {
    if (!isAutoReplyEnabled) return;

    const remoteJid = message.key.remoteJid;
    if (!remoteJid || message.key.fromMe) return;

    const isGroup = remoteJid.endsWith('@g.us');
    const botId = sock.user?.id?.split(':')[0] || '';
    
    // Get text content safely, checking both normal messages and extended text messages
    const textContent = (userMessage || '').toLowerCase();
    
    // 1. Check for Mentions (Bot ID or @all/everyone)
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = contextInfo?.mentionedJid || [];
    const isMentioned = mentionedJid.includes(botId + '@s.whatsapp.net') || 
                        textContent.includes('@' + botId) ||
                        textContent.includes('@all') ||
                        textContent.includes('Samyaza');

    // 2. Check for Replies (if user replied to the bot's previous message)
    // Note: Some versions of WA-Web/Baileys use contextInfo.stanzaId to match replies
    const isReplyToMe = contextInfo?.participant?.includes(botId) || 
                        (message.message?.extendedTextMessage?.contextInfo?.stanzaId !== undefined);

    // 3. Check for specific trigger words
    const triggerWords = ['samyaza', 'seth'];
    const containsTrigger = triggerWords.some(word => textContent.includes(word));

    // Logic: In a group, only proceed if one of the triggers is hit
    if (isGroup) {
        if (!(isMentioned || isReplyToMe || containsTrigger)) {
            return;
        }
    }

    const reply = await getGeminiResponse(userMessage);
    
    if (reply) {
        await sock.sendPresenceUpdate('composing', remoteJid);
        await new Promise(resolve => setTimeout(resolve, 800));
        await sock.sendMessage(remoteJid, { text: reply }, { quoted: message });
    }
}
