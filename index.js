// --- PHẦN 1: IMPORT CÁC THƯ VIỆN CẦN THIẾT ---
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalFollow } = require('mineflayer-pathfinder').goals;
const express = require('express');
const fs = require('fs');
const readline = require('readline');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- PHẦN 2: ĐỌC FILE CẤU HÌNH VÀ CHUẨN BỊ ---
let config;
try {
  config = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
} catch (err) {
  console.error("LỖI: Không thể đọc file settings.json!", err);
  process.exit(1);
}

// Khai báo các biến trạng thái toàn cục
let genAI, generativeModel, aiStatus = 'Đã bị tắt hoặc thiếu API Key.';
let botStartTime = Date.now(); // Ghi lại thời gian khởi động

// Hàm khởi tạo AI (Logic mới, chắc chắn hơn)
function initializeAI() {
  if (!config['gemini-ai']?.enabled) {
    aiStatus = 'Đã bị tắt trong settings.json.';
    console.log(`\x1b[33m[AI] ${aiStatus}\x1b[0m`);
    return;
  }
  const apiKey = config['gemini-ai']?.apiKey;
  if (!apiKey || apiKey.includes('DÁN_API_KEY')) {
    aiStatus = 'Thiếu API Key trong settings.json.';
    console.log(`\x1b[33m[AI] ${aiStatus}\x1b[0m`);
    return;
  }
  
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    generativeModel = genAI.getGenerativeModel({ model: "gemini-pro" });
    aiStatus = 'Đang hoạt động tốt.';
    console.log(`\x1b[32m[AI] ${aiStatus} Miki đã sẵn sàng!\x1b[0m`);
  } catch (error) {
    aiStatus = `Gặp lỗi khi khởi tạo: ${error.message}`;
    console.error(`\x1b[31m[AI LỖI] ${aiStatus}\x1b[0m`);
    genAI = null;
  }
}

initializeAI(); // Gọi hàm khởi tạo ngay lập tức

const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(8000, () => console.log('Web server started to keep the bot alive.'));

let isReconnecting = false;
let hasRestartedToday = { hour: -1 };

// --- PHẦN 3: HÀM TẠO BOT CHÍNH ---
function createBot() {
  botStartTime = Date.now(); // Reset thời gian hoạt động mỗi khi bot kết nối lại
  const bot = mineflayer.createBot({
    host: config.server.ip,
    port: config.server.port,
    username: config['bot-account'].username,
    password: config['bot-account'].password,
    auth: config['bot-account'].type,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log(`\x1b[32m[INFO] Bot ${bot.username} đã vào server thành công!\x1b[0m`);
    console.log('\x1b[36m[CONSOLE] Bạn có thể gõ lệnh hoặc chat trực tiếp vào đây và nhấn Enter.\x1b[0m');
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);
    // ... (Các module cũ giữ nguyên)
  });

  bot.on('chat', async (username, message) => {
    if (username === bot.username || !message.startsWith('#')) return;
    if (config.utils['chat-log'].enabled) console.log(`\x1b[35m[CHAT] <${username}> ${message}\x1b[0m`);
    
    const commandWithArgs = message.substring(1).trim();
    const command = commandWithArgs.split(' ')[0].toLowerCase();
    const args = commandWithArgs.substring(command.length).trim();

    // =================================================================
    // === TÍNH NĂNG MỚI: KIỂM TRA TOÀN DIỆN ===
    // =================================================================
    if (command === 'check') {
        bot.chat(`--- Báo cáo Trạng thái của Miki ---`);
        await new Promise(resolve => setTimeout(resolve, 300));

        bot.chat(`> Tên em: ${bot.username} (v1.1)`);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Tính toán thời gian hoạt động
        const uptimeMs = Date.now() - botStartTime;
        const hours = Math.floor(uptimeMs / 3600000);
        const minutes = Math.floor((uptimeMs % 3600000) / 60000);
        bot.chat(`> Thời gian hoạt động: ${hours} giờ ${minutes} phút.`);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Báo cáo trạng thái AI
        bot.chat(`> Trạng thái AI (Gemini): ${aiStatus}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Báo cáo các module khác
        bot.chat(`> Module Anti-AFK: ${config.utils['anti-afk'].enabled ? 'Đang bật' : 'Đã tắt'}.`);
        await new Promise(resolve => setTimeout(resolve, 300));

        bot.chat(`> Module Tự kết nối lại: ${config.utils['auto-reconnect'].enabled ? 'Đang bật' : 'Đã tắt'}.`);
        await new Promise(resolve => setTimeout(resolve, 300));

        bot.chat(`--- Kết thúc báo cáo ---`);
        return; // Dừng lại sau khi báo cáo xong
    }

    // Các lệnh khác
    if (command === 'hoi') {
      if (!genAI || !generativeModel) {
        return bot.chat("Xin lỗi anh, em không thể kết nối với trí tuệ của mình ngay bây giờ. Anh hãy thử dùng lệnh #check để xem lỗi nhé.");
      }
      if (!args) {
        return bot.chat("Dạ, anh muốn hỏi em điều gì ạ? (Ví dụ: #hoi thủ đô của Nhật Bản là gì?)");
      }
      try {
        bot.chat("Dạ, anh chờ em một chút để em suy nghĩ nhé...");
        const result = await generativeModel.generateContent(args);
        const response = await result.response;
        const text = response.text();
        const finalResponse = `Miki trả lời anh ${username}: ${text}`;
        const MAX_LENGTH = 250;
        if (finalResponse.length > MAX_LENGTH) {
            const chunks = finalResponse.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'g'));
            for (const chunk of chunks) {
                bot.chat(chunk);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } else {
            bot.chat(finalResponse);
        }
      } catch (error) {
        console.error("[AI LỖI] Lỗi khi gọi Gemini API:", error);
        bot.chat(`Xin lỗi anh ${username}, em không thể trả lời câu hỏi này ngay bây giờ. Lỗi: ${error.message}`);
        aiStatus = `Gặp lỗi khi trả lời: ${error.message}`; // Cập nhật trạng thái lỗi
      }
    } 
    // ... (Các lệnh cũ khác như giờ, ngày, theotoi...)
  });
  
  // ... (Phần còn lại của code giữ nguyên y hệt phiên bản trước)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => {
    if (bot.entity) { bot.chat(line); } 
    else { console.log("Bot chưa vào game, không thể gửi lệnh."); }
  });
  bot.once('end', () => { rl.close(); });
  bot.on('kicked', handleDisconnect);
  bot.on('end', handleDisconnect);
  bot.on('error', (err) => console.log(`\x1b[31m[LỖI] Đã xảy ra lỗi: ${err.message}\x1b[0m`));
  function handleDisconnect(reason) {
    console.log(`\x1b[33m[KẾT NỐI] Bot đã bị ngắt kết nối. Lý do: ${String(reason)}\x1b[0m`);
    if (config.utils['auto-reconnect'].enabled && !isReconnecting) {
      isReconnecting = true;
      const delay = config.utils['auto-reconnect'].delay;
      console.log(`[KẾT NỐI] Sẽ thử kết nối lại sau ${delay / 1000} giây...`);
      setTimeout(() => {
        isReconnecting = false;
        createBot();
      }, delay);
    }
  }
}

createBot();
