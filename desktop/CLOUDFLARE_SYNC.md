# Tadado Cloudflare 登录与同步

这一版保持浏览器本地数据为主，并增加 Cloudflare Pages Functions + D1 的账号与同步。

## 1. 创建 D1

```bash
npx wrangler d1 create tadado
```

把返回的 `database_id` 填进 `desktop/wrangler.example.toml`；如果用 Pages 控制台绑定 D1，也可以不使用这个文件。

然后初始化：

```bash
npx wrangler d1 execute tadado --remote --file=functions/schema.sql
```

如果 Pages 的 Root directory 设置为 `desktop`，以上命令请在 `desktop/` 目录执行；否则把路径按你的项目根目录调整。

## 2. Pages 绑定

Cloudflare Pages 项目 → Settings → Functions → D1 database bindings：

- Variable name: `DB`
- D1 database: `tadado`

如果使用 `wrangler.toml` 部署，则确保 `DB` 绑定与配置一致。

## 3. 构建

Build command:

```bash
npm run build
```

Build output directory:

```text
dist
```

Root directory:

```text
desktop
```

## 4. 功能

- 未登录：继续使用本地数据。
- 注册 / 登录：邮箱 + 至少 8 位密码。
- 登录后：自动同步任务、标签、进度、状态、活动时间线和分区列表。
- 数据仍先写本地；联网后再同步。
- D1 保存的是任务快照和账号/session，不保存密码明文。
- 分区口令与空闲锁定暂不上传云端，继续留在本机。

## 注意

这是第一版同步。它已经有版本号和冲突重试，但如果两台设备在长时间完全离线状态下同时修改同一个任务，应该进一步把任务级 `updated_at` / 操作日志做成真正的 CRDT/操作同步。当前版本适合个人多设备正常使用。
