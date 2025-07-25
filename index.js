// Import các thư viện cần thiết
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

// Import file cấu hình
const config = require('./settings.json');

// Tạo máy chủ web để giữ bot thức 24/7 với UptimeRobot
const express = require('express');
const app = express();
app.get('/', (req, res) => {
  res.send('Bot is active and running.');
});
app.listen(8000, () => {
  console.log('Web server for UptimeRobot started successfully.');
});

// Hàm chính để tạo và chạy bot
function createBot() {
   // Tạo bot với thông tin từ file settings.json
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });

   // Tải các plugin và dữ liệu cần thiết
   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version);
   const defaultMove = new Movements(bot, mcData);
   bot.settings.colorsEnabled = false;

   // Sự kiện được kích hoạt một lần khi bot vào được thế giới
   bot.once('spawn', () => {
      console.log('\x1b[33m[AfkBot] Bot joined the server\x1b[0m');

      // Module: Tự động đăng nhập / đăng ký
      if (config.utils['auto-auth'].enabled) {
         console.log('[INFO] Started auto-auth module');
         const password = config.utils['auto-auth'].password;
         setTimeout(() => {
            bot.chat(`/register ${password} ${password}`);
            bot.chat(`/login ${password}`);
         }, 500);
         console.log(`[Auth] Authentication commands executed.`);
      }

      // Module: Tự động chat các tin nhắn
      if (config.utils['chat-messages'].enabled) {
         console.log('[INFO] Started chat-messages module');
         const messages = config.utils['chat-messages']['messages'];
         if (config.utils['chat-messages'].repeat) {
            const delay = config.utils['chat-messages']['repeat-delay'];
            let i = 0;
            setInterval(() => {
               bot.chat(`${messages[i]}`);
               if (i + 1 == messages.length) {
                  i = 0;
               } else i++;
            }, delay * 1000);
         } else {
            messages.forEach((msg) => {
               bot.chat(msg);
            });
         }
      }

      // Module: Di chuyển đến tọa độ định sẵn
      const pos = config.position;
      if (config.position.enabled) {
         console.log(`\x1b[32m[AfkBot] Moving to target location (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`);
         bot.pathfinder.setMovements(defaultMove);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      // Module: ANTI-AFK Nâng Cao
      if (config.utils['anti-afk'].enabled) {
         console.log('[INFO] Started ADVANCED anti-afk module.');
         setInterval(() => {
            bot.setControlState('forward', true);
            setTimeout(() => { bot.setControlState('forward', false); bot.setControlState('left', true); }, 500);
            setTimeout(() => { bot.setControlState('left', false); bot.setControlState('back', true); }, 1000);
            setTimeout(() => { bot.setControlState('back', false); bot.setControlState('right', true); }, 1500);
            setTimeout(() => { bot.setControlState('right', false); }, 2000);
         }, 2100);
         setInterval(() => { bot.setControlState('jump', true); bot.setControlState('jump', false); }, 3000);
         setInterval(() => {
            bot.setControlState('sneak', true);
            setTimeout(() => { bot.setControlState('sneak', false); }, 3000);
         }, 10000);
         setInterval(() => {
            const yaw = Math.random() * Math.PI * 2;
            const pitch = (Math.random() * Math.PI) - (Math.PI / 2);
            bot.look(yaw, pitch, false);
         }, 8000);
      }
   });

   // Trình xử lý sự kiện CHAT (ĐÃ THÊM TÍNH NĂNG MỚI)
   bot.on('chat', (username, message) => {
      // Bỏ qua tin nhắn của chính bot
      if (username === bot.username) return;

      // Log tin nhắn ra console nếu được bật
      if (config.utils['chat-log']) {
         console.log(`[ChatLog] <${username}> ${message}`);
      }

      // TÍNH NĂNG MỚI: Trả lời thời gian và ngày tháng
      const command = message.toLowerCase().trim();

      if (command === 'giờ') {
         // Lấy giờ Việt Nam (UTC+7)
         const vietnamTime = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
         bot.chat(`Bây giờ là ${vietnamTime} (giờ Việt Nam).`);
      }

      if (command === 'ngày') {
         // Lấy ngày Việt Nam (UTC+7) và định dạng lại
         const vietnamDate = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
         bot.chat(`Hôm nay là ngày ${vietnamDate} (lịch Việt Nam).`);
      }
   });

   // Các trình xử lý sự kiện khác
   bot.on('goal_reached', () => {
      console.log(`\x1b[32m[AfkBot] Bot arrived at target location. ${bot.entity.position}\x1b[0m`);
   });

   bot.on('death', () => {
      console.log(`\x1b[33m[AfkBot] Bot has died and was respawned at ${bot.entity.position}\x1b[0m`);
   });

   // Module: Tự động kết nối lại khi mất kết nối
   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         console.log(`\x1b[33m[AfkBot] Disconnected. Reconnecting in ${config.utils['auto-recconect-delay'] / 1000} seconds...\x1b[0m`);
         setTimeout(createBot, config.utils['auto-recconect-delay']);
      });
   }

   // Xử lý khi bị lỗi
   bot.on('error', (err) =>
      console.log(`\x1b[31m[ERROR] ${err.message}\x1b[0m`)
   );

   // TÍNH NĂNG MỚI: Tự động kết nối lại khi bị kick
   bot.on('kicked', (reason) => {
      console.log(`\x1b[33m[AfkBot] Kicked from server. Reason: \n${reason}\x1b[0m`);
      // Chỉ kết nối lại nếu tính năng được bật trong file config
      if (config.utils['auto-reconnect']) {
         console.log(`\x1b[33mReconnecting in ${config.utils['auto-recconect-delay'] / 1000} seconds...\x1b[0m`);
         setTimeout(createBot, config.utils['auto-recconect-delay']);
      }
   });
}

// Khởi chạy bot lần đầu tiên
createBot();
