// --- PHẦN 1: IMPORT CÁC THƯ VIỆN CẦN THIẾT ---
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalFollow } = require('mineflayer-pathfinder').goals;
const express = require('express');
const fs = require('fs');

// --- PHẦN 2: ĐỌC FILE CẤU HÌNH VÀ CHUẨN BỊ ---
let config;
try {
  config = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
} catch (err) {
  console.error("LỖI: Không thể đọc file settings.json!", err);
  process.exit(1); // Thoát nếu không có file cấu hình
}

// Tạo máy chủ web nhỏ để giữ bot thức (cho Replit, Termux, etc.)
const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(8000, () => console.log('Web server started to keep the bot alive.'));


// --- PHẦN 3: HÀM TẠO BOT CHÍNH ---
function createBot() {
  const bot = mineflayer.createBot({
    host: config.server.ip,
    port: config.server.port,
    username: config.bot-account.username,
    password: config.bot-account.password,
    auth: config.bot-account.type,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);

  // --- CÁC HÀNH ĐỘNG KHI BOT VÀO GAME ---
  bot.once('spawn', () => {
    console.log(`\x1b[32m[INFO] Bot ${bot.username} đã vào server thành công!\x1b[0m`);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.pathfinder.setMovements(defaultMove);

    // Module: Tự động đăng nhập
    if (config.utils['auto-auth'].enabled) {
      const password = config.utils['auto-auth'].password;
      bot.chat(`/register ${password} ${password}`);
      setTimeout(() => bot.chat(`/login ${password}`), 500);
      console.log("[MODULE] Auto-Auth đã được kích hoạt.");
    }

    // Module: Chống AFK phức tạp
    if (config.utils['anti-afk'].enabled) {
      console.log("[MODULE] Anti-AFK nâng cao đã được kích hoạt.");
      // ... (Code hành vi AFK)
      setInterval(() => { bot.swingArm('left'); }, 20000); // Vung tay mỗi 20s
      setInterval(() => { bot.setControlState('jump', true); bot.setControlState('jump', false); }, 15000); // Nhảy mỗi 15s
      setInterval(() => { const yaw = Math.random() * Math.PI * 2; bot.look(yaw, 0); }, 30000); // Quay đầu ngẫu nhiên mỗi 30s
    }
  });

  // --- CÁC TƯƠNG TÁC VỚI NGƯỜI CHƠI ---
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    if (config.utils['chat-log'].enabled) console.log(`[CHAT] <${username}> ${message}`);

    const command = message.toLowerCase().trim();

    // Lệnh: giờ / ngày
    if (command === 'giờ') {
      const vietnamTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
      bot.chat(`Bây giờ là ${vietnamTime} (giờ Việt Nam).`);
    } else if (command === 'ngày') {
      const vietnamDate = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
      bot.chat(`Hôm nay là ngày ${vietnamDate}.`);
    }

    // Lệnh: !theotoi / !dunglai
    else if (command === '!theotoi') {
      const player = bot.players[username]?.entity;
      if (!player) return bot.chat("Mình không thấy bạn đâu cả!");
      bot.chat(`Ok, mình sẽ đi theo ${username}. Dùng !dunglai để dừng.`);
      bot.pathfinder.setGoal(new GoalFollow(player, 1), true);
    } else if (command === '!dunglai') {
      bot.pathfinder.stop();
      bot.chat("Ok, mình đã đứng yên.");
    }
  });

  // --- XỬ LÝ CÁC SỰ KIỆN KHÁC CỦA BOT ---
  bot.on('kicked', handleDisconnect);
  bot.on('end', handleDisconnect);
  bot.on('error', (err) => console.log(`\x1b[31m[LỖI] Đã xảy ra lỗi: ${err.message}\x1b[0m`));

  function handleDisconnect(reason) {
    console.log(`\x1b[33m[KẾT NỐI] Bot đã bị ngắt kết nối. Lý do: ${reason}\x1b[0m`);
    if (config.utils['auto-reconnect'].enabled) {
      const delay = config.utils['auto-reconnect'].delay;
      console.log(`[KẾT NỐI] Sẽ thử kết nối lại sau ${delay / 1000} giây...`);
      setTimeout(createBot, delay);
    }
  }
}

// --- PHẦN 4: KHỞI CHẠY BOT LẦN ĐẦU TIÊN ---
createBot();
