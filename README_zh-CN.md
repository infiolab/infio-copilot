<h1 align="center">Obsidian-Infio-Copilot</h1>

**让你的 Obsidian 秒变个人 AI 工作站！**

Infio Copilot 是一款可高度个人定制化的 Obsidian AI 插件，旨在帮助用户在本地工作流中轻松使用各类强大的 AI 大模型，为知识库提供交互式对话、内联编辑、智能补全、全库检索问答等功能。

<a href="README.md" target="_blank"><b>English</b></a>  |  <a href="README_zh-CN.md" target="_blank"><b>中文</b></a>  |  <a href="README_ko.md" target="_blank"><b>한국어</b></a>

[Chat with me on Twitter](https://x.com/buyiyouxi)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/felixduan)

# Pro Version


# 🚀 新版本发布：引入工作区、洞察与本地模型！

我们很高兴地宣布一个重要更新，它将彻底改变您的知识管理体验。此版本引入了强大的新功能，如工作区、洞察、以及开箱即用的本地嵌入模型，让您更深入地与笔记互动。

---
*   **🧠 内置本地嵌入模型**：现在默认包含 `LocalProdver(bge-micro-v2)` 模型。无需任何额外配置，即可享受强大的本地语义搜索和分析功能。

*   **🗂️ 工作区 (Workspaces)**：引入全新的工作区功能，帮助您更好地组织和隔离不同的项目和知识领域，让您的工作流更加清晰。

*   **💡 洞察 (Insights)**：我们增加了强大的“洞察”功能。您可以从笔记中提取关键摘要、进行反思或生成内容大纲，从您的知识库中发现深层联系。

*   **🔍 多维度查询与对话**：像与人交谈一样与您的笔记互动。现在您可以根据时间、任务状态等多种维度进行查询，轻松找到所需信息。

*   **✍️ 全新 `write` 模式**：一个专为写作而生的新模式，提供更专注、更流畅的创作体验，帮助您将想法转化为结构清晰的文档。

## 功能特点

| 功能 | 描述 |
|------|------|
| 💬 对话与编辑 | 获取即时 AI 协助，一键应用建议的改进 |
| 📝 智能补全 | 在输入时获取上下文感知的写作建议 |
| ✏️ 内联编辑 | 直接在当前文件中编辑笔记 |
| 🔍 全库对话 | 使用 AI 与整个 Obsidian vault 交互 |
| 语义搜索 |   |
| ⌨️ 快捷命令 | 创建和管理自定义快捷命令，实现快速操作 |
| 🎯 自定义Mode | 定义具有特定行为的个性化 AI 模式 |
| 🔌 MCP | 管理模型上下文协议集成 |
| 🗂️ 工作空间 | 组织项目、研究和个人笔记，无缝切换上下文 |
| 💡 深度洞察 | 综合信息、发现连接、获得更深层次的理解 |
| 🔍 多维查询 | 基于时间、任务和元数据执行复杂查询 |
| ✍️ 新写作模式 | 重构的写作体验，提供直观、强大且无干扰的界面 |

### 🖋️ 内联编辑

选中文本 → 直接与 AI 讨论 → 一键应用到原段落

![inline-edit](asserts/edit-inline.gif)

### 💬 对话式改写

与单个笔记进行智能对话，轻松修改或重写原文内容

![chat-with-select](asserts/chat-with-select.gif)

### 📝 智能自动补全

输入时获取上下文感知的写作建议

![autocomplte](asserts/autocomplete.gif)

### 🔍 全库问答 (RAG)

针对整个 Vault 提问，跨笔记检索并整合答案

![rag](asserts/rag.gif)

🖼️ **图片识别**

支持 Vault 内或本地图片上传→AI 智能识别并分析（v0.1.7+）

## 开始使用

> **⚠️ 重要提示：安装程序版本要求**
> Infio-Copilot 需要较新版本的 Obsidian 安装程序。如果您遇到插件无法正常加载的问题：
>
> 1. 首先，尝试在 `设置 > 通用 > 检查更新` 中正常更新 Obsidian。
> 2. 如果问题仍然存在，手动更新您的 Obsidian 安装程序：
>
>    - 从 [Obsidian 下载页面](https://obsidian.md/download) 下载最新安装程序
>    - 完全关闭 Obsidian
>    - 运行新的安装程序

1. 打开 Obsidian 设置
2. 导航至"社区插件"并点击"浏览"
3. 搜索 "Infio Copilot" 并点击安装
4. 在社区插件中启用该插件
5. 在插件设置中配置您的 API 密钥
   - SiliconFlow : [SiliconFlow API Keys](https://cloud.siliconflow.cn/account/ak)
   - OpenRouter : [OpenRouter API Keys](https://openrouter.ai/settings/keys)
	 - Alibaba Bailian : [Bailian API Keys](https://help.aliyun.com/zh/dashscope/developer-reference/activate-dashscope-and-create-an-api-key)
   - DeepSeek：[DeepSeek API Keys](https://platform.deepseek.com/api_keys/)
   - OpenAI：[ChatGPT API Keys](https://platform.openai.com/api-keys)
   - Anthropic：[Claude API Keys](https://console.anthropic.com/settings/keys)
   - Gemini：[Gemini API Keys](https://aistudio.google.com/apikey)
   - Groq：[Groq API Keys](https://console.groq.com/keys)
6. 设置快捷键以快速访问：
   - 转到 设置 > 快捷键
   - 搜索 "Infio Copilot"
   - 推荐的快捷键绑定：
     * Infio Copilot: Infio add selection to chat -> cmd + shift + L
     * Infio Copilot: Infio Inline Edit -> cmd + shift + K
![autocomplte](asserts/doc-set-hotkey.png)

## 反馈与支持
我们重视您的意见，并希望确保您能轻松分享想法和报告问题：

- **错误报告**：如果您遇到任何错误或意外行为，请在我们的 [GitHub Issues](https://github.com/infiolab/infio-copilot/issues) 页面提交问题。请确保包含尽可能多的细节，以帮助我们重现和解决问题。
- **功能请求**：对于新功能想法或改进建议，请使用我们的 [GitHub Discussions - Ideas & Feature Requests](https://github.com/infiolab/infio-copilot/discussions/categories/ideas) 页面。创建新的讨论来分享您的建议。

## 交流
![wx- group](https://github.com/user-attachments/assets/b6b8f982-bca2-4819-8b43-572fefcacf2e)

## 致谢

本项目站在巨人的肩膀上。我们要向以下开源项目表示感谢：

- [obsidian-copilot-auto-completion](https://github.com/j0rd1smit/obsidian-copilot-auto-completion) - 提供自动补全实现和 TypeScript 架构灵感
- [obsidian-smart-composer](https://github.com/glowingjade/obsidian-smart-composer) - 提供聊天/应用 UI 模式和 PgLite 集成示例
- [continue](https://github.com/continuedev/continue) & [cline](https://github.com/cline/cline) - 提供提示工程和 LLM 交互模式
- [pglite](https://github.com/electric-sql/pglite) - 提供对话/向量数据存储和示例代码

## 许可证

本项目采用 [MIT 许可证](LICENSE) 授权。
