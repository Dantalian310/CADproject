# Git 仓库与华为云部署准备说明

## 1. 文档目的

本文档用于说明本项目后续上传 Git 仓库、从远程仓库下拉、以及部署到华为云 ECS 前需要准备的信息和操作顺序。

当前阶段暂不执行云服务器部署；等用户提供 Git 仓库地址和华为云 ECS 登录信息后，再进入实际接入与部署。

## 2. Git 仓库接入准备

用户需要准备：

1. 一个远程 Git 仓库地址，例如 GitHub、Gitee、GitLab 或学校提供的仓库。
2. 本机到该仓库的认证方式，推荐 HTTPS token 或 SSH key。
3. 仓库默认分支名称，建议使用 `main`。

本项目已准备脚本：

```powershell
scripts\git\setup-remote.cmd <仓库地址>
scripts\git\pull-main.cmd
scripts\git\push-current.cmd "提交说明"
```

首次接入流程：

```powershell
scripts\git\setup-remote.cmd <仓库地址>
scripts\git\push-current.cmd "初始化 Vue + Spring Boot 云 CAD 工程"
```

日常下拉：

```powershell
scripts\git\pull-main.cmd
```

日常提交上传：

```powershell
scripts\git\push-current.cmd "本次修改说明"
```

注意：

1. `.local`、`.cache`、`frontend/node_modules`、`frontend/dist`、后端 `target` 等本地生成目录不应上传。
2. 设计文档、源码、脚本、数据库迁移文件、README 应上传。
3. 上传前建议先运行 `scripts\dev\local-status.cmd` 和核心测试脚本确认本地状态。

## 3. 华为云 ECS 准备

建议 ECS 配置：

| 项目 | 建议 |
| --- | --- |
| 操作系统 | Ubuntu 22.04 LTS 或 openEuler |
| CPU/内存 | 2 核 4 GB 起步 |
| 磁盘 | 40 GB 起步 |
| 安全组 | 放行 22、80、443；开发调试时可临时放行 8080 |
| 域名 | 可选，课程演示阶段可先使用公网 IP |

需要安装或准备：

1. Git。
2. JDK 17。
3. Node.js 18+ 与 npm。
4. PostgreSQL 16 或云数据库 RDS for PostgreSQL。
5. Nginx。
6. PM2 或 systemd，用于后台运行后端。
7. 可选：Docker 与 Docker Compose。

## 4. 云端部署建议路线

课程项目建议先采用简单清晰的单机部署：

```text
浏览器
  -> Nginx 80/443
    -> 前端静态文件 frontend/dist
    -> /api 反向代理到 Spring Boot 8080
    -> /ws 反向代理到 Spring Boot WebSocket
Spring Boot
  -> PostgreSQL
```

首次云端部署顺序：

1. 在 ECS 上安装基础环境。
2. 从 Git 仓库 clone 项目。
3. 配置 PostgreSQL 数据库和账号。
4. 设置后端环境变量：`DB_URL`、`DB_USERNAME`、`DB_PASSWORD`、`JWT_SECRET`、`CORS_ALLOWED_ORIGINS`。
5. 后端执行 `mvn clean package`。
6. 前端配置生产 API 地址并执行 `npm run build`。
7. Nginx 指向 `frontend/dist`，并反向代理 `/api`、`/ws`。
8. 使用 systemd 或 PM2 启动后端 jar。
9. 访问公网 IP 或域名进行验收。

## 5. 后续需要用户提供的信息

Git 接入时请提供：

1. 远程仓库 URL。
2. 使用 HTTPS token 还是 SSH key。
3. 是否需要我创建首个提交并推送。

云部署时请提供：

1. ECS 公网 IP。
2. SSH 登录用户名。
3. 登录方式：密码或私钥。
4. 是否使用云数据库 RDS。
5. 是否已经绑定域名。
6. 是否需要 HTTPS 证书。

## 6. 当前建议

现阶段优先保证本地工程稳定、README 启停清晰、测试脚本可复现。等 Git 仓库和 ECS 准备好后，再按本文档进入远程接入和云部署。
