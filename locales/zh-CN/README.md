<div align="center">
<sub>

[English](../../README.md) • [Català](../ca/README.md) • [Deutsch](../de/README.md) • [Español](../es/README.md) • [Français](../fr/README.md) • [हिन्दी](../hi/README.md) • [Bahasa Indonesia](../id/README.md) • [Italiano](../it/README.md) • [日本語](../ja/README.md)

</sub>
<sub>

[한국어](../ko/README.md) • [Nederlands](../nl/README.md) • [Polski](../pl/README.md) • [Português (BR)](../pt-BR/README.md) • [Русский](../ru/README.md) • [Türkçe](../tr/README.md) • [Tiếng Việt](../vi/README.md) • <b>简体中文</b> • [繁體中文](../zh-TW/README.md)

</sub>
</div>
<br>

<br>
<br>

<div align="center">
<h1>Siid Code</h1>
<p align="center">
<img src="https://via.placeholder.com/800x400/4A90E2/FFFFFF?text=Siid+Code+Demo" width="100%" alt="Siid Code Demo" />
</p>

<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code" target="_blank"><img src="https://img.shields.io/badge/%E5%9C%A8%20VS%20Marketplace%20%E4%B8%8A%E4%B8%8B%E8%BD%BD-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="在 VS Marketplace 上下载"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/%E8%AF%84%E5%88%86%20%26%20%E8%AF%84%E8%AE%BA-green?style=for-the-badge" alt="评分 & 评论"></a>
</div>

**Siid Code** 是一个 AI 驱动的**自主编码代理**，它存在于您的编辑器中。它可以：

- 用自然语言沟通
- 直接在您的工作区读写文件
- 运行终端命令
- 自动化浏览器操作
- 与任何 OpenAI 兼容或自定义的 API/模型集成
- 通过**自定义模式**调整其"个性"和能力

无论您是寻找灵活的编码伙伴、系统架构师，还是像 QA 工程师或产品经理这样的专业角色，Siid Code 都可以帮助您更高效地构建软件。

查看 [CHANGELOG](../../CHANGELOG.md) 获取详细更新和修复信息。

---

## 🎉 Siid Code 3.25 已发布

Siid Code 3.25 带来强大的新功能和重大改进，提升您的开发工作流程。

- **Hugging Face 提供者** - 通过新的 Hugging Face 提供者直接访问大量优秀的开源模型，具有无缝集成和模型选择功能。
- **内联命令控制** - 新的自动批准和拒绝控制功能为命令执行提供精确控制，具有可自定义的权限设置。
- **AGENTS.md 规则支持** - 添加对项目根目录中社区标准 AGENTS.md 文件的支持。

---

## Siid Code 能做什么？

- 🚀 从自然语言描述**生成代码**
- 🔧 **重构和调试**现有代码
- 📝 **编写和更新**文档
- 🤔 **回答关于**您代码库的问题
- 🔄 **自动化**重复任务
- 🏗️ **创建**新文件和项目

## 快速入门

1. 安装 Siid Code
2. 连接您的 AI 提供者
3. 尝试您的第一个任务

## 主要特性

### 多种模式

Siid Code 通过专业化的模式适应您的需求：

- **代码模式：** 用于通用编码任务
- **架构师模式：** 用于规划和技术领导
- **询问模式：** 用于回答问题和提供信息
- **调试模式：** 用于系统性问题诊断
- **自定义模式：** 创建无限专业角色，用于安全审计、性能优化、文档编写或任何其他任务

### 智能工具

Siid Code 配备了强大的工具，可以：

- 读写项目中的文件
- 在 VS Code 终端中执行命令
- 控制网络浏览器
- 通过 MCP（模型上下文协议）使用外部工具

MCP 通过允许您添加无限自定义工具来扩展 Siid Code 的能力。与外部 API 集成、连接数据库或创建专业开发工具 - MCP 提供了扩展 Siid Code 功能以满足您特定需求的框架。

### 自定义

使 Siid Code 按照您的方式工作：

- 自定义指令实现个性化行为
- 自定义模式用于专业任务
- 本地模型用于离线使用
- 自动批准设置加快工作流程

## 资源

### 文档

- 基本使用指南
- 高级功能
- 常见问题

### 社区

- **Discord：** [加入我们的 Discord 服务器](https://github.com/Conscendotechnologies/Siid-Code)获取实时帮助和讨论
- **GitHub：** 报告[问题](https://github.com/Conscendotechnologies/Siid-Code/issues)或请求[功能](https://github.com/Conscendotechnologies/Siid-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## 本地设置和开发

1. **克隆**仓库：

```sh
git clone https://github.com/Conscendotechnologies/Siid-Code.git
```

2. **安装依赖**：

```sh
npm run install:all
```

3. **启动网页视图（Vite/React 应用，带热模块替换）**：

```sh
npm run dev
```

4. **调试**：
   在 VSCode 中按 `F5`（或**运行** → **开始调试**）打开一个加载了 Siid Code 的新会话。

网页视图的更改将立即显示。核心扩展的更改将需要重启扩展主机。

或者，您可以构建一个 .vsix 文件并直接在 VSCode 中安装：

```sh
npm run build
```

`bin/` 目录中将出现一个 `.vsix` 文件，可以用以下命令安装：

```sh
code --install-extension bin/siid-code-<version>.vsix
```

我们使用 [changesets](https://github.com/changesets/changesets) 进行版本控制和发布。查看我们的 `CHANGELOG.md` 获取发布说明。

---

## 免责声明

**请注意**，Conscendo Technologies **不**对与 Siid Code 相关提供或可用的任何代码、模型或其他工具，任何相关的第三方工具，或任何结果作出任何陈述或保证。您承担使用任何此类工具或输出的**所有风险**；此类工具按**"原样"**和**"可用性"**提供。此类风险可能包括但不限于知识产权侵权、网络漏洞或攻击、偏见、不准确、错误、缺陷、病毒、停机时间、财产损失或损坏和/或人身伤害。您对任何此类工具或输出的使用（包括但不限于其合法性、适当性和结果）负全部责任。

---

## 贡献

我们热爱社区贡献！通过阅读我们的 [CONTRIBUTING.md](CONTRIBUTING.md) 开始。

---

## 许可证

[Apache 2.0 © 2025 Conscendo Technologies](../LICENSE)

---

**享受 Siid Code！** 无论您是让它保持短绳还是让它自主漫游，我们都迫不及待地想看看您会构建什么。如果您有问题或功能想法，请访问我们的 [Reddit 社区](https://github.com/Conscendotechnologies/Siid-Code)或 GitHub。编码愉快！
