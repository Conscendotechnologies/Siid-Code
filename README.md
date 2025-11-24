<div align="center">
<sub>

<b>English</b> • [Català](locales/ca/README.md) • [Deutsch](locales/de/README.md) • [Español](locales/es/README.md) • [Français](locales/fr/README.md) • [हिंदी](locales/hi/README.md) • [Bahasa Indonesia](locales/id/README.md) • [Italiano](locales/it/README.md) • [日本語](locales/ja/README.md)

</sub>
<sub>

[한국어](locales/ko/README.md) • [Nederlands](locales/nl/README.md) • [Polski](locales/pl/README.md) • [Português (BR)](locales/pt-BR/README.md) • [Русский](locales/ru/README.md) • [Türkçe](locales/tr/README.md) • [Tiếng Việt](locales/vi/README.md) • [简体中文](locales/zh-CN/README.md) • [繁體中文](locales/zh-TW/README.md)

</sub>
</div>
<br>
<div align="center">
  <h1>Siid Code</h1>
  <p align="center">
  <img src="https://via.placeholder.com/800x400/4A90E2/FFFFFF?text=Siid+Code+Demo" width="100%" alt="Siid Code Demo" />
  </p>
  <p>AI-powered coding assistant for enhanced productivity and development workflow.</p>
  
</div>
<br>
<br>

<div align="center">

<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code" target="_blank"><img src="https://img.shields.io/badge/Download%20on%20VS%20Marketplace-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Download on VS Marketplace"></a>
<a href="https://github.com/Conscendotechnologies/Siid-Code/issues" target="_blank"><img src="https://img.shields.io/badge/Issues-red?style=for-the-badge&logo=github&logoColor=white" alt="Issues"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/Rate%20%26%20Review-green?style=for-the-badge" alt="Rate & Review"></a>

</div>

**Siid Code** is an AI-powered **autonomous coding agent** that lives in your editor. It can:

- Communicate in natural language
- Read and write files directly in your workspace
- Run terminal commands
- Automate browser actions
- Integrate with any OpenAI-compatible or custom API/model
- Adapt its “personality” and capabilities through **Custom Modes**

Whether you’re seeking a flexible coding partner, a system architect, or specialized roles like a QA engineer or product manager, Siid Code can help you build software more efficiently.

Check out the [CHANGELOG](CHANGELOG.md) for detailed updates and fixes.

---

## 🎉 Latest Release

Siid Code brings powerful features and continuous improvements to enhance your development workflow!

- **Message Queueing** - Queue multiple messages while the AI is working, allowing you to continue planning your workflow without interruption.
- **Custom Slash Commands** - Create personalized slash commands for quick access to frequently used prompts and workflows, with full UI management.
- **Enhanced AI Tools** - Advanced capabilities including URL context and search grounding for real-time web information and enhanced research abilities.

---

## What Can Siid Code Do?

- 🚀 **Generate Code** from natural language descriptions
- 🔧 **Refactor & Debug** existing code
- 📝 **Write & Update** documentation
- 🤔 **Answer Questions** about your codebase
- 🔄 **Automate** repetitive tasks
- 🏗️ **Create** new files and projects

## Quick Start

1. **Install Siid Code** from the [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.siid-code)
2. **Connect Your AI Provider** - Configure your preferred AI model (OpenAI, Anthropic, Google, etc.)
3. **Try Your First Task** - Open the Siid Code panel and start coding with AI assistance

## Key Features

### Multiple Modes

Siid Code adapts to your needs with specialized modes:

- **Code Mode:** For general-purpose coding tasks
- **Architect Mode:** For planning and technical leadership
- **Ask Mode:** For answering questions and providing information
- **Debug Mode:** For systematic problem diagnosis
- **Custom Modes:** Create unlimited specialized personas for security auditing, performance optimization, documentation, or any other task

### Smart Tools

Siid Code comes with powerful tools that can:

- Read and write files in your project
- Execute commands in your VS Code terminal
- Control a web browser
- Use external tools via MCP (Model Context Protocol)

MCP extends Siid Code's capabilities by allowing you to add unlimited custom tools. Integrate with external APIs, connect to databases, or create specialized development tools - MCP provides the framework to expand Siid Code's functionality to meet your specific needs.

### Customization

Make Siid Code work your way with:

- **Custom Instructions** for personalized behavior
- **Custom Modes** for specialized tasks
- **Local Models** for offline use
- **Auto-Approval Settings** for faster workflows

## Resources

### Support

- **GitHub Issues:** Report [issues](https://github.com/Conscendotechnologies/Siid-Code/issues) or request features
- **GitHub Discussions:** Share experiences and get help from the community

---

## Local Setup & Development

1. **Clone** the repo:

```sh
git clone https://github.com/Conscendotechnologies/Siid-Code.git
```

2. **Install dependencies**:

```sh
pnpm install
```

3. **Run the extension**:

There are several ways to run the Siid Code extension:

### Development Mode (F5)

For active development, use VSCode's built-in debugging:

Press `F5` (or go to **Run** → **Start Debugging**) in VSCode. This will open a new VSCode window with the Siid Code extension running.

- Changes to the webview will appear immediately.
- Changes to the core extension will also hot reload automatically.

### Automated VSIX Installation

To build and install the extension as a VSIX package directly into VSCode:

```sh
pnpm install:vsix [-y] [--editor=<command>]
```

This command will:

- Ask which editor command to use (code/cursor/code-insiders) - defaults to 'code'
- Uninstall any existing version of the extension.
- Build the latest VSIX package.
- Install the newly built VSIX.
- Prompt you to restart VS Code for changes to take effect.

Options:

- `-y`: Skip all confirmation prompts and use defaults
- `--editor=<command>`: Specify the editor command (e.g., `--editor=cursor` or `--editor=code-insiders`)

### Manual VSIX Installation

If you prefer to install the VSIX package manually:

1.  First, build the VSIX package:
    ```sh
    pnpm vsix
    ```
2.  A `.vsix` file will be generated in the `bin/` directory (e.g., `bin/siid-code-<version>.vsix`).
3.  Install it manually using the VSCode CLI:
    ```sh
    code --install-extension bin/siid-code-<version>.vsix
    ```

---

We use [changesets](https://github.com/changesets/changesets) for versioning and publishing. Check our `CHANGELOG.md` for release notes.

---

## Disclaimer

**Please note** that Conscendo Technologies does **not** make any representations or warranties regarding any code, models, or other tools provided or made available in connection with Siid Code, any associated third-party tools, or any resulting outputs. You assume **all risks** associated with the use of any such tools or outputs; such tools are provided on an **"AS IS"** and **"AS AVAILABLE"** basis. Such risks may include, without limitation, intellectual property infringement, cyber vulnerabilities or attacks, bias, inaccuracies, errors, defects, viruses, downtime, property loss or damage, and/or personal injury. You are solely responsible for your use of any such tools or outputs (including, without limitation, the legality, appropriateness, and results thereof).

---

## Contributing

We welcome community contributions! Get started by reading our [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[Apache 2.0 © 2025 Conscendo Technologies](./LICENSE)

---

**Enjoy Siid Code!** We can’t wait to see what you build. If you have questions or feature ideas, visit our [GitHub repository](https://github.com/Conscendotechnologies/Siid-Code). Happy coding!
