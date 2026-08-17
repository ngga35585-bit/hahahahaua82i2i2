import http from 'http';
import { Client } from "discord.js-selfbot-v13";
import { DiscordStreamClient } from "discord-stream-client";
import ytDlp from "yt-dlp-exec";

// 1. SERVER WEB PENTRU UPTIME
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write("Selfbot is alive 24/7!");
    res.end();
}).listen(process.env.PORT || 3000, () => {
    console.log("[System] Serverul de mentinere uptime a pornit.");
});

// 2. CONFIGURARE SELFBOT
const client = new Client({ checkUpdate: false, patchVoice: true });
const StreamClient = new DiscordStreamClient(client);

StreamClient.setResolution('720p'); 

const PREFIX = "!";
let activeStream = null;
let activeVoice = null;

// Culori ANSI pentru Discord
const RESET = "\u001b[0m";
const BOLD = "\u001b[1m";
const RED = "\u001b[31m";
const GREEN = "\u001b[32m";
const YELLOW = "\u001b[33m";
const BLUE = "\u001b[34m";
const CYAN = "\u001b[36m";

async function getRawStreamUrl(url) {
    try {
        console.log(`[Extractor] Se proceseaza link-ul: ${url}`);
        const output = await ytDlp(url, {
            dumpSingleJson: true,
            noWarnings: true,
            preferFreeFormats: true,
            format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        });
        return output.url;
    } catch (error) {
        console.error("[Extractor] Eroare:", error);
        return null;
    }
}

client.on("ready", () => {
    console.log("=========================================");
    console.log("STATUS: CONECTAT LA DISCORD CU SUCCES!");
    console.log(`Cont activat: ${client.user.tag}`);
    console.log("=========================================");
});

// Ascultam mesajele primite prin evenimentul compatibil de utilizator
client.on("message", async (message) => {
    // Reactioneaza doar daca TU trimiti comanda
    if (message.author.id !== client.user.id) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // COMANDA: !help
    if (command === "help") {
        const cmdArg = args[0]?.toLowerCase();
        
        if (!cmdArg) {
            return message.reply(
                "```ansi\n" +
                `${BLUE}${BOLD}=== MENIU CONTROL SELFBOT (NODE.JS) ===${RESET}\n` +
                `Prefix curent: ${CYAN}!${RESET}\n\n` +
                `${YELLOW}!help${RESET}        - Afiseaza acest panou informativ\n` +
                `${YELLOW}!help <cmd>${RESET}  - Detalii specifice despre o comanda\n` +
                `${YELLOW}!play <link>${RESET} - Porneste screenshare video + audio (YouTube/Site-uri)\n` +
                `${YELLOW}!stop${RESET}        - Opreste transmisiunea live si paraseste canalul\n\n` +
                `${BLUE}Sistem adaptat complet fara emoji-uri si optimizat ANSI.${RESET}\n` +
                "```"
            );
        }

        if (cmdArg === "play") {
            return message.reply(
                "```ansi\n" +
                `${BLUE}${BOLD}DETALII COMANDA: !play${RESET}\n\n` +
                `${GREEN}Sintaxa:${RESET} !play <URL_Video>\n` +
                `${GREEN}Descriere:${RESET} Te urmareste automat pe orice canal vocal,\n` +
                `           deschide o sesiune de Screenshare (Go Live) si\n` +
                `           redirectioneaza imaginea si sunetul extras din link.\n` +
                "```"
            );
        }

        if (cmdArg === "stop") {
            return message.reply(
                "```ansi\n" +
                `${BLUE}${BOLD}DETALII COMANDA: !stop${RESET}\n\n` +
                `${GREEN}Sintaxa:${RESET} !stop\n` +
                `${GREEN}Descriere:${RESET} Opreste instant playerul video/audio si\n` +
                `           inchide sesiunea de streaming de pe server.\n` +
                "```"
            );
        }
    }

    // COMANDA: !play <link>
    if (command === "play") {
        const videoUrl = args[0]; // Extrage corect link-ul stocat in primul argument
        if (!videoUrl) {
            return message.reply(`\`\`\`ansi\n${RED}[WARN]${RESET} Sintaxa incorecta. Adauga link: !play <link>\n\`\`\``);
        }

        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) {
            return message.reply(`\`\`\`ansi\n${RED}[WARN]${RESET} Trebuie sa fii conectat intr-un canal vocal.\n\`\`\``);
        }

        const statusMsg = await message.reply(`\`\`\`ansi\n${YELLOW}[SYSTEM]${RESET} Se extrage stream-ul video si audio...\n\`\`\``);

        const rawUrl = await getRawStreamUrl(videoUrl);
        if (!rawUrl) {
            return statusMsg.edit(`\`\`\`ansi\n${RED}[ERROR]${RESET} Nu s-a putut decoda acest link.\n\`\`\``);
        }

        try {
            if (activeStream) {
                try { activeStream.stop(); } catch(e){}
                try { activeVoice.disconnect(); } catch(e){}
            }

            const targetChannel = await client.channels.fetch(voiceChannel.id);

            activeVoice = await StreamClient.joinVoiceChannel(
                targetChannel,
                { selfDeaf: false, selfMute: false, selfVideo: false }
            );

            activeStream = await activeVoice.createStream();

            const player = StreamClient.createPlayer(rawUrl, activeStream.udp);
            
            player.on('start', async () => {
                await statusMsg.edit(
                    "```ansi\n" +
                    `${GREEN}[SUCCESS]${RESET} Transmisiune pornita pe: ${BOLD}${voiceChannel.name}${RESET}\n` +
                    `${CYAN}[LIVE SCREENSHARE]${RESET} Fluxul video ruleaza acum.\n` +
                    "```"
                );
            });

            player.play();

        } catch (error) {
            console.error(error);
            await statusMsg.edit(`\`\`\`ansi\n${RED}[ERROR]${RESET} Eroare la deschiderea fluxului video: ${error.message}\n\`\`\``);
        }
    }

    // COMANDA: !stop
    if (command === "stop") {
        if (activeVoice) {
            try { activeStream.stop(); } catch(e){}
            activeVoice.disconnect();
            activeStream = null;
            activeVoice = null;
            await message.reply(`\`\`\`ansi\n${CYAN}[INFO]${RESET} Sesiunea de screenshare a fost inchisa.\n\`\`\``);
        } else {
            await message.reply(`\`\`\`ansi\n${RED}[WARN]${RESET} Nu exista nicio transmisiune activa pe acest server.\n\`\`\``);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
