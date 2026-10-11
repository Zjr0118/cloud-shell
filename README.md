# Cloud Shell · GitHub Actions macos-14

在网页里输入命令，命令在 **GitHub Actions 云端 macOS 14 runner** 上执行，结果自动回显到网页。

> ⚠️ 安全：仓库内**不存任何 token**。token 通过 `GH_PAT` 环境变量传入本地网页服务。
> ⚠️ 命令在云端执行，权限极大，**严禁**把面板/触发接口暴露到公网。

## 架构

```
浏览器网页 ──触发──> GitHub repository_dispatch ──> macos-14 runner 执行 cmd
                                                        │ 写 result.txt
浏览器网页 <──轮询状态+下载 artifact── <────────────────┘
```

## 快速开始（本地 Mac）

```bash
# 1. 安装依赖
npm install

# 2. 设置 token（你有 repo 权限的 GitHub PAT）
export GH_PAT="github_pat_xxxxxxxx"

# 3. 启动面板
npm start
# 打开 http://127.0.0.1:3000
```

网页里输入命令点「执行」，等待 runner 启动（macos 队列可能几十秒到几分钟），完成后自动显示输出。

## 直接命令行触发（不用网页）

```bash
echo '{"event_type":"cloud-shell","client_payload":{"cmd":"uname -a; sw_vers"}}' \
  | gh api repos/Zjr0118/cloud-shell/dispatches -X POST --input -

# 看运行状态
gh run list -R Zjr0118/cloud-shell --workflow cloud-shell.yml

# 下载结果
gh run download <run_id> -R Zjr0118/cloud-shell -n cmd-result
cat result.txt
```

## 文件说明

| 文件 | 作用 |
|---|---|
| `.github/workflows/cloud-shell.yml` | 云端工作流：`runs-on: macos-14`，收 dispatch 的 `cmd` 执行并上传 artifact |
| `server.js` | 本地 Node 控制面板：触发 dispatch、轮询状态、下载 artifact 回显 |
| `public/index.html` | 网页 UI |

## 限制

- runner 每次全新启动，**不保存状态**（文件、环境变量都不保留）
- macos-14 免费额度有限、启动需排队
- 单次最多 55 分钟，命令非交互式（一次性执行）
