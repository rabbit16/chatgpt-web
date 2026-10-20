# 部署说明

## 环境要求

- Node.js：`18.20.8`（见 `.nvmrc`）
- nginx（或同类静态服务器）用于托管 `dist/` 并反向代理 LLM 接口

真实的服务器地址、登录凭据、域名等**不写入仓库**。部署前请通过 `.env.production` 和下面的占位符自行填写。

## 构建

```bash
source ~/.nvm/nvm.sh
nvm use
cp .env.example .env.production   # 首次部署，填入真实值
npm run build
```

构建产物位于 `dist/`。

## 发布

使用 SSH 密钥登录，不要使用密码登录：

```bash
rsync -avz --delete dist/ <DEPLOY_USER>@<DEPLOY_HOST>:<DEPLOY_PATH>/
```

- `<DEPLOY_USER>` / `<DEPLOY_HOST>` / `<DEPLOY_PATH>` 替换为你的部署账号、主机和目录
- `--delete` 会删除远端发布目录中本地构建不存在的旧文件，请确认该目录只用于本站点

## Nginx 参考配置

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # LLM 接口同域反向代理，对应 VITE_LLM_BASE_URL=/v1
    location /v1/ {
        proxy_pass https://<UPSTREAM_LLM_HOST>/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

## 发布后检查

```bash
curl -I https://<YOUR_DOMAIN>/
curl -sS https://<YOUR_DOMAIN>/ | head
```

如果站点前面有 CDN 或反向代理，发布后可能需要刷新缓存。
