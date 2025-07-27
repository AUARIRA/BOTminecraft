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

// =================================================================
// === KHỞI TẠO GEMINI AI (LOGIC ĐÃ SỬA LẠI) ===
// =================================================================
let genAI, generativeModel;

// Hàm khởi tạo AI
function initializeAI() {
  // Điều kiện 1: Tính năng phải được bật trong config
  if (!config['gemini-ai']?.enabled) {
    console.log("\x1b[33m[AI] Tính năng Gemini AI đã bị tắt trong file settings.json.\x1b[0m");
    return;
  }

  const apiKey = config['gemini-ai']?.apiKey;
  // Điều kiện 2: API Key phải tồn tại và không phải là giá trị mặc định
  if (!apiKey || apiKey === 'DÁN_API_KEY_CỦA_ANH_VÀO_ĐÂY') {
    console.log("\x1b[33m[AI] Thiếu API Key. Vui lòng thêm API Key vào file settings.json để sử dụng tính năng này.\x1b[0m");
    return;
  }
  
  // Nếu tất cả điều kiện đều ổn, thử kết nối
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    generativeModel = genAI.getGenerativeModel({ model: "gemini-pro" });
    console.log("\x1b[32m[AI] Đã kết nối với Google Gemini thành công! Miki đã sẵn sàng.\x1b[0m");
  } catch (error) {
    console.error(`\x1b[31m[AI LỖI] Không thể khởi tạo Gemini. Lý do: ${error.message}\x1b[0m`);
    console.error("\x1b[31m[AI LỖI] Gợi ý: Vui lòng kiểm tra lại API Key có đúng không hoặc kết nối mạng có ổn định không.\x1b[0m");
    genAI = null; // Vô hiệu hóa AI nếu có lỗi
  }
}

// Gọi hàm để khởi tạo AI ngay khi bắt đầu
initializeAI();

// ... Phần còn lại của code (app, isReconnecting, createBot) giữ nguyên ...
const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(8000, () => console.log('Web server started to keep the bot alive.'));

let isReconnecting = false;
let hasRestartedToday = { hour: -1 };

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
    console.log(`\x1b[32m[INFO] Bot ${bot.username} đã vào server thành công!\x1b[0m`);
    console.log('\x1b[36m[CONSOLE] Bạn có thể gõ lệnh hoặc chat trực tiếp vào đây và nhấn Enter.\x1b[0m');
    
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);

    if (config.utils['auto-auth'].enabled) {
      const password = config.utils['auto-auth'].password;
      bot.chat(`/register ${password} ${password}`);
      setTimeout(() => bot.chat(`/login ${password}`), 500);
      console.log("[MODULE] Auto-Auth đã được kích hoạt.");
    }

    if (config.utils['anti-afk'].enabled) {
      console.log("[MODULE] Anti-AFK ngẫu nhiên đã được kích hoạt (1 hành động / 10 giây).");
      const afkActions = [
        () => { bot.setControlState('jump', true); bot.setControlState('jump', false); console.log('[AFK] Hành động: Nhảy.'); },
        () => { const yaw = Math.random() * Math.PI * 2; const pitch = (Math.random() * Math.PI) - (Math.PI / 2); bot.look(yaw, pitch, false); console.log('[AFK] Hành động: Quay đầu.'); },
        () => { bot.swingArm('left'); console.log('[AFK] Hành động: Đấm.'); },
        () => { bot.setControlState('sneak', true); setTimeout(() => bot.setControlState('sneak', false), 1000); console.log('[AFK] Hành động: Cúi người.'); },
        () => { const moveDir = ['forward', 'back', 'left', 'right'][Math.floor(Math.random() * 4)]; bot.setControlState(moveDir, true); setTimeout(() => bot.setControlState(moveDir, false), 500); console.log(`[AFK] Hành động: Di chuyển ${moveDir}.`); }
      ];
      setInterval(() => {
        const randomAction = afkActions[Math.floor(Math.random() * afkActions.length)];
        randomAction();
      }, 10000);
    }

    const scheduler = setInterval(() => {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const currentHour = now.getHours();
        if (currentHour !== 5 && currentHour !== 17) { hasRestartedToday.hour = -1; }
        if ((currentHour === 5 || currentHour === 17) && hasRestartedToday.hour !== currentHour) {
            console.log(`\x1b[33m[SCHEDULER] Đã đến giờ khởi động lại định kỳ (${currentHour}h). Tạm biệt!\x1b[0m`);
            bot.chat("Đã đến giờ khởi động lại định kỳ. Tạm biệt và hẹn gặp lại!");
            hasRestartedToday.hour = currentHour;
            setTimeout(() => bot.quit(), 2000);
        }
    }, 60000);
    bot.once('end', () => clearInterval(scheduler));
  });

  bot.on('chat', async (username, message) => {
    if (username === bot.username || !message.startsWith('#')) return;
    if (config.utils['chat-log'].enabled) console.log(`\x1b[35m[CHAT] <${username}> ${message}\x1b[0m`);
    
    const commandWithArgs = message.substring(1).trim();
    const command = commandWithArgs.split(' ')[0].toLowerCase();
    const args = commandWithArgs.substring(command.length).trim();

    if (command === 'giờ') {
      const vietnamTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
      bot.chat(`Bây giờ là ${vietnamTime} (giờ Việt Nam).`);
    } else if (command === 'ngày') {
      const vietnamDate = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
      bot.chat(`Hôm nay là ngày ${vietnamDate}.`);
    } else if (command === '!theotoi') {
      const player = bot.players[username]?.entity;
      if (!player) return bot.chat("Mình không thấy bạn đâu cả!");
      bot.chat(`Ok, mình sẽ đi theo ${username}. Dùng #!dunglai để dừng.`);
      bot.pathfinder.setGoal(new GoalFollow(player, 1), true);
    } else if (command === '!dunglai') {
      bot.pathfinder.stop();
      bot.chat("Ok, mình đã đứng yên.");
    } else if (command === 'reset') {
      console.log(`\x1b[33m[CONTROL] Người dùng ${username} đã yêu cầu khởi động lại.\x1b[0m`);
      bot.chat("Đã nhận lệnh khởi động lại. Tạm biệt!");
      setTimeout(() => bot.quit(), 1000);
    } else if (command === 'hoi') {
      if (!genAI || !generativeModel) {
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
        bot.chat(`Xin lỗi anh ${username}, em không thể trả lời câu hỏi này ngay bây giờ. Có thể API Key của em có vấn đề.`);
      }
    }
  });
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => {
    if (bot.entity) { bot.chat(line); } 
    else { console.log("Bot chưa vào game, không thể gửi lệnh."); }
  });
  bot.once('end', () => rl.close());

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

// --- PHẦN 4: KHỞI CHẠY BOT LẦN ĐẦU TIÊN ---
createBot();
