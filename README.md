# 末日城市 FPS：Cloudflare 联机原型（2–3 人）

## 先说明当前版本范围
此包包含 Durable Objects + WebSocket 房间服务端、房间号加入、最多 3 人连接、玩家位置同步和队友占位模型。服务器根据连接人数设置僵尸目标数：1 人 10 只、2 人 16 只、3 人 22 只。

**这是联机接入原型，不是完整的服务器权威多人游戏。** 现有 HTML 的僵尸 AI、命中检测、伤害、弹药和死亡仍主要由各客户端本地处理。服务端目前没有把原游戏中的僵尸实体完整迁移到共享状态，因此尚不能保证所有玩家看到同一只僵尸的相同位置、血量和死亡结果。还需要进一步把敌人生成、AI、射击命中与伤害结算改为服务端驱动。

## 文件结构
- `src/index.js`：Cloudflare Worker + Durable Object 房间服务
- `wrangler.json`：Durable Object 绑定与 SQLite migration
- `site/index.html`：现有游戏，增加联机配置入口
- `site/multiplayer-client.js`：房间 UI、WebSocket 客户端与远端队友模型

## 一、部署 WebSocket Worker
前提：安装 Node.js 当前 LTS 版本，并有 Cloudflare 账号。

1. 解压 ZIP，进入 `cloudflare-zombie-multiplayer` 文件夹。
2. 在此文件夹打开终端/命令提示符。
3. 安装依赖：
   ```bash
   npm install
   ```
4. 登录 Cloudflare：
   ```bash
   npx wrangler login
   ```
   浏览器会打开授权页面，按提示登录并授权。
5. 本地测试：
   ```bash
   npm run dev
   ```
   Wrangler 会显示本地地址。完成后按 `Ctrl+C` 停止。
6. 发布：
   ```bash
   npm run deploy
   ```
7. 终端会显示 Worker 的网址，类似：
   `https://zombie-coop-server.你的子域名.workers.dev`
8. 打开 `https://...workers.dev/health`，应看到 `{"ok":true,...}`。

## 二、配置游戏连接 Worker
1. 打开 `site/index.html`。
2. 在靠近 `</head>` 的位置找到：
   ```html
   window.COOP_SERVER_URL = "wss://REPLACE-WITH-YOUR-WORKER.workers.dev/ws";
   ```
3. 把占位地址替换为真实地址，注意协议要用 `wss://`，路径结尾是 `/ws`。例如 Worker 地址是 `https://zombie-coop-server.abc.workers.dev`，则填：
   ```html
   window.COOP_SERVER_URL = "wss://zombie-coop-server.abc.workers.dev/ws";
   ```

## 三、部署网页到 Cloudflare Pages
1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages**。
2. 选择 **Direct Upload**（直接上传静态文件）。
3. 上传 `site` 文件夹里的文件，确保 `index.html` 和 `multiplayer-client.js` 位于网站根目录。
4. 完成部署，记下 `https://项目名.pages.dev` 网址。
5. 如果后续改动了 `index.html` 或 `multiplayer-client.js`，重新上传 `site` 文件夹内容。

## 四、联机测试
1. 电脑和手机分别打开 Pages 网址。
2. 输入相同房间号（例如 `ABCD`），但使用不同昵称，点击“加入”。
3. 最多允许 3 个连接；第 4 个连接会收到房间已满提示。
4. 联机面板显示房间人数和按人数调整的僵尸目标数。

## 常见问题
- 显示“请先在 index.html 配置 Worker 的 wss 地址”：还没有替换占位地址。
- 连接失败：确认 Worker 已部署，并且地址是 `wss://.../ws`。
- `/health` 能打开但房间不能连接：检查 Worker 域名和 `/ws` 路径是否正确。
- 这是开发原型；真正上线前还需要实现服务端权威僵尸 AI、伤害验证、重连处理、速率限制与移动端触控优化。

官方文档：
- Durable Objects WebSocket： https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Durable Objects 入门： https://developers.cloudflare.com/durable-objects/get-started/
- Cloudflare Pages Direct Upload： https://developers.cloudflare.com/pages/get-started/direct-upload/
