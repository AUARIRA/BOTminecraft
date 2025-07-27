// --- PHẦN 1: IMPORT CÁC THƯ VIỆN CẦN THIẾT ---
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalFollow } = require('mineflayer-pathfinder').goals;
const express = require('express');
const fs = require('fs');
const readline = require('readline');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // <<< THƯ VIỆN MỚI CỦA GEMINI

// --- PHẦN 2: ĐỌC FILE CẤU HÌNH VÀ CHUẨN BỊ ---
let config;
try {
  config = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
} catch (err) {
  console.error("LỖI: Không thể đọc file settings.json!", err);
  process.exit(1);
}

// <<< KHỞI TẠO GEMINI AI >>>
let genAI, generativeModel;
if (config['gemini-ai']?.enabled && config['gemini-ai']?.apiKey) {
  try {
    genAI = new GoogleGenerativeAI(config['gemini-ai'].apiKey);
    generativeModel = genAI.getGenerativeModel({ model: "gemini-pro" });
    console.log("[AI] Đã kết nối với Google Gemini thành công!");
  } catch (err) {
    console.error("\x1b[31m[AI LỖI] Không thể khởi tạo Gemini. Vui lòng kiểm tra lại API Key trong settings.json\x1b[0m");
    genAI = null; // Vô hiệu hóa AI nếu có lỗi
  }
} else {
  console.log("\x1b[33m[AI] Tính năng Gemini AI chưa được bật hoặc thiếu API Key.\x1b[0m");
}


const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(8000, () => console.log('Web server started to keep the bot alive.'));

let isReconnecting = false;
let hasRestartedToday = { hour: -1 };

// --- PHẦN 3: HÀM TẠO BOT CHÍNH ---
function createBot() {
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
    // ... Phần spawn và các module cũ giữ nguyên ...
    console.log(`\x1b[32m[INFO] Bot ${bot.username} đã vào server thành công!\x1b[0m`);
    // ...
  });

  // --- CÁC TƯƠNG TÁC VỚI NGƯỜI CHƠI ---
  // <<< ĐÁNH DẤU HÀM NÀY LÀ ASYNC ĐỂ CÓ THỂ DÙNG AWAIT CHO AI >>>
  bot.on('chat', async (username, message) => { 
    if (username === bot.username || !message.startsWith('#')) return;

    if (config.utils['chat-log'].enabled) console.log(`\x1b[35m[CHAT] <${username}> ${message}\x1b[0m`);

    const commandWithArgs = message.substring(1).trim();
    const command = commandWithArgs.split(' ')[0].toLowerCase();
    const args = commandWithArgs.substring(command.length).trim();

    if (command === 'giờ' || command === 'ngày' || command === '!theotoi' || command === '!dunglai' || command === 'reset') {
        // Xử lý các lệnh cũ
    } 
    // =================================================================
    // === TÍNH NĂNG MỚI: HỎI ĐÁP VỚI MIKI (GEMINI AI) ===
    // =================================================================
    else if (command === 'hoi') {
      if (!genAI) {
        return bot.chat("Xin lỗi anh, em không thể kết nối với trí tuệ của mình ngay bây giờ.");
      }
      if (!args) {
        return bot.chat("Dạ, anh muốn hỏi em điều gì ạ? (Ví dụ: #hoi thủ đô của Nhật Bản là gì?)");
      }

      try {
        bot.chat("Dạ, anh chờ em một chút để em suy nghĩ nhé...");
        const result = await generativeModel.generateContent(args);
        const response = await result.response;
        const text = response.text();

        // Xử lý và gửi câu trả lời
        const finalResponse = `Miki trả lời anh ${username}: ${text}`;
        
        // Cắt nhỏ tin nhắn nếu quá dài
        const MAX_LENGTH = 250;
        if (finalResponse.length > MAX_LENGTH) {
            const chunks = finalResponse.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'g'));
            for (const chunk of chunks) {
                bot.chat(chunk);
                await new Promise(resolve => setTimeout(resolve, 500)); // Đợi nửa giây giữa các tin nhắn
            }
        } else {
            bot.chat(finalResponse);
        }

      } catch (error) {
        console.error("[AI LỖI] Lỗi khi gọi Gemini API:", error);
        bot.chat(`Xin lỗi anh ${username}, em không thể trả lời câu hỏi này ngay bây giờ. Có thể API Key của em có vấn đề.`);
      }
    }
  });
  
  // ... Phần còn lại của code (readline, handleDisconnect...) giữ nguyên ...
}

// --- PHẦN 4: KHỞI CHẠY BOT LẦN ĐẦU TIÊN ---
createBot();
