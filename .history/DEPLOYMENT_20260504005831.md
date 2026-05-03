# GitHub Pages 部署指南

## 已完成的工作

✅ 代码已提交到GitHub main分支  
✅ 应用已编译打包成功  
✅ 三大功能已实现：
  - 📊 每小时费率可手动调整
  - 📝 订单支持备注功能（随时修改）
  - 💳 拆分付款功能（多人会话可拆分结账）

## 部署步骤

### 方法一：手动部署（推荐）

1. **在GitHub上启用Pages**
   - 访问 https://github.com/WRERFSD/jifei
   - 点击 Settings → Pages
   - Source: 选择 "Deploy from a branch"
   - Branch: 选择 "gh-pages" 分支
   - Folder: 选择 "/ (root)"
   - 点击 Save

2. **在本地尝试部署**
   ```bash
   cd /Users/qzh/Desktop/Dictionary/code/JiFei
   npm run deploy
   ```

3. **如果部署失败，使用备选方案**
   ```bash
   # 方案A: 使用GitHub CLI (推荐)
   gh repo view WRERFSD/jifei --web
   # 在Settings中手动配置Pages

   # 方案B: 使用GitHub Actions
   # 在项目根目录创建 .github/workflows/deploy.yml 文件
   ```

### 方法二：使用GitHub Actions自动部署（推荐）

创建文件 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./build
```

然后推送此文件即可自动部署：
```bash
git add .github/workflows/deploy.yml
git commit -m "ci: 添加GitHub Actions自动部署"
git push
```

## 应用地址

部署成功后，访问：**https://WRERFSD.github.io/jifei**

## 功能说明

### 1. 费率调整
- 点击顶部导航栏的"费率：X.XX元 / 小时"
- 输入新的费率
- 点击"保存"即可

### 2. 备注功能
- 在每个订单卡片中，点击"点击添加备注..."区域
- 输入或修改备注内容
- 点击"保存"保存备注

### 3. 拆分付款
- 当订单中有多人时，卡片下方会显示"拆分付款"按钮
- 点击后选择需要先结账的客人
- 该客人的账单会单独结账，其他人继续计时

## 故障排除

### 部署失败 (HTTP 400 错误)
这通常是网络问题。解决方案：
1. 检查网络连接
2. 使用VPN或更换网络
3. 使用GitHub Actions自动部署（更稳定）

### Pages未显示
1. 确保gh-pages分支已创建
2. 在Settings → Pages中正确配置Source为gh-pages
3. 等待几分钟后刷新

### 应用加载为空白
检查浏览器控制台(F12)查看错误信息，可能需要检查Firebase配置

## 下次更新流程

```bash
# 1. 修改代码后
git add -A
git commit -m "feat: 描述更改内容"

# 2. 推送到GitHub
git push

# 3. 自动部署（如果已配置GitHub Actions）
# 如果未配置，手动运行：
npm run deploy
```

## 支持的浏览器

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 技术栈

- React 18
- Tailwind CSS
- Firebase Firestore
- gh-pages 部署
