# 鹈鹕镇拼豆桌游店计费系统

这是一个用于桌游店的计费管理系统，使用React、Firebase和Tailwind CSS构建。

## 功能特性

- 实时计费系统
- Firebase云端数据同步
- 手机尾号识别
- 预设倒计时功能
- 实时费用计算
- 响应式设计

## 安装和运行

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动开发服务器：
   ```bash
   npm start
   ```

3. 构建生产版本：
   ```bash
   npm run build
   ```

## 配置Firebase

在Firebase控制台创建项目，并配置以下环境变量：

- `__firebase_config`: Firebase配置对象
- `__app_id`: 应用ID
- `__initial_auth_token`: 初始认证令牌（可选）

## 使用说明

1. 输入客人手机尾号开始计费
2. 可选设置预设倒计时
3. 系统实时显示计费时间和费用
4. 点击结账完成收款