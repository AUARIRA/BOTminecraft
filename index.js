// --- PHẦN 1: IMPORT CÁC THƯ VIỆN CẦN THIẾT ---
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalFollow } = require('mineflayer-pathfinder').goals;
const express = require('express');
const fs = require('fs');
const readline = require('readline');

// --- PHẦN 2: ĐỌC FILE CẤU HÌNH VÀ CHUẨN BỊ ---
let config;
try {
  config = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
} catch (err) {
  console.error("LỖI: Không thể đọc file settings.json!", err);
  process.exit(1);
}

const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(8000, () => console.log('Web server started to keep the bot alive.'));

let isReconnecting = false;
let hasRestartedToday = { hour: -1 }; // Biến để kiểm tra đã restart trong khung giờ này chưa

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

  // --- CÁC HÀNH ĐỘNG KHI BOT VÀO GAME ---
  bot.once('spawn', () => {
    console.log(`\x1b[32m[INFO] Bot ${bot.username} đã vào server thành công!\x1b[0m`);
    console.log('\x1b[36m[CONSOLE] Bạn có thể gõ lệnh hoặc chat trực tiếp vào đây và nhấn Enter.\x1b[0m');
    
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

    // Module: Anti-AFK
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

    // =================================================================
    // === TÍNH NĂNG MỚI: LẬP LỊCH TỰ ĐỘNG KHỞI ĐỘNG LẠI ===
    // =================================================================
    const scheduler = setInterval(() => {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const currentHour = now.getHours();

        // Đặt lại cờ nếu đã qua khung giờ restart
        if (currentHour !== 5 && currentHour !== 17) {
            hasRestartedToday.hour = -1;
        }

        // Kiểm tra điều kiện restart
        if ((currentHour === 5 || currentHour === 17) && hasRestartedToday.hour !== currentHour) {
            console.log(`\x1b[33m[SCHEDULER] Đã đến giờ khởi động lại định kỳ (${currentHour}h). Tạm biệt!\x1b[0m`);
            bot.chat("Đã đến giờ khởi động lại định kỳ. Tạm biệt và hẹn gặp lại!");
            hasRestartedToday.hour = currentHour; // Đánh dấu đã restart trong giờ này
            setTimeout(() => bot.quit(), 2000); // Đợi 2s rồi thoát
        }
    }, 60000); // Kiểm tra mỗi phút

    bot.once('end', () => clearInterval(scheduler)); // Dọn dẹp khi bot thoát
  });

  // --- CÁC TƯƠNG TÁC VỚI NGƯỜI CHƠI (ĐÃ THAY ĐỔI) ---
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    // CHỈ XỬ LÝ TIN NHẮN BẮT ĐẦU BẰNG '#'
    if (!message.startsWith('#')) return;

    if (config.utils['chat-log'].enabled) console.log(`\x1b[35m[CHAT] <${username}> ${message}\x1b[0m`);

    const command = message.substring(1).toLowerCase().trim(); // Bỏ dấu '#' và xử lý lệnh

    if (command === 'giờ') {
      const vietnamTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
      bot.chat(`Bây giờ là ${vietnamTime} (giờ Việt Nam).`);
    } else if (command === 'ngày') {
      const vietnamDate = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
      bot.chat(`Hôm nay là ngày ${vietnamDate}.`);
    } else if (command === '!theotoi') { // Giữ nguyên ! để tương thích
      const player = bot.players[username]?.entity;
      if (!player) return bot.chat("Mình không thấy bạn đâu cả!");
      bot.chat(`Ok, mình sẽ đi theo ${username}. Dùng #!dunglai để dừng.`);
      bot.pathfinder.setGoal(new GoalFollow(player, 1), true);
    } else if (command === '!dunglai') {
      bot.pathfinder.stop();
      bot.chat("Ok, mình đã đứng yên.");
    } else if (command === 'reset') {
      // TÍNH NĂNG MỚI: Lệnh khởi động lại bot
      console.log(`\x1b[33m[CONTROL] Người dùng ${username} đã yêu cầu khởi động lại.\x1b[0m`);
      bot.chat("Đã nhận lệnh khởi động lại. Tạm biệt!");
      setTimeout(() => bot.quit(), 1000);
    }
  });
  
  // Điều khiển từ console (giữ nguyên)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => {
    if (bot.entity) { bot.chat(line); } 
    else { console.log("Bot chưa vào game, không thể gửi lệnh."); }
  });
  bot.once('end', () => rl.close());


  // --- XỬ LÝ CÁC SỰ KIỆN KHÁC CỦA BOT ---
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
