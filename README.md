> ## 🍴 This is a fork of [amirlehmam/wmux](https://github.com/amirlehmam/wmux)
>
> Maintained by [tawman](https://github.com/tawman). I use wmux for active software-development work,
> running local builds out of the **`production/local`** branch and pulling upstream changes back in
> through **`master`**.
>
> **Why this fork exists:**
> - 🔒 **Harden wmux for an enterprise environment**
> - 🛡️ **Patch CVEs** in shipped dependencies and the runtime
> - 🧰 **Fix usability features** for daily development use
> - 🔁 **Contribute changes back upstream** to wmux where they fit

## 🤖 Additional Setup Required for Claude Orchestration

This fork is distributed as a **portable ZIP**. The GUI (`wmux.exe`) is fully self-contained and runs on its own, but to drive wmux from **Claude Code** — the multi-agent orchestration this fork is built around — two one-time setup steps are needed.

### 1. Install the wmux-orchestrator plugin (fork)

The orchestrator is a Claude Code plugin that decomposes a task into parallel agents, one per visible wmux pane. This fork maintains its own copy at **[tawman/wmux-orchestrator](https://github.com/tawman/wmux-orchestrator)** (hardened and kept in lockstep with `production/local`). Register it as a Claude Code marketplace and install the plugin:

```bash
claude plugin marketplace add tawman/wmux-orchestrator
claude plugin install wmux-orchestrator@wmux-orchestrator
```

> wmux also auto-installs a **bundled** copy of the plugin into `~/.claude/plugins/cache/` on startup, so basic orchestration works out of the box. Installing from the fork gives you the standalone, independently-updatable version — see the [orchestrator fork README](https://github.com/tawman/wmux-orchestrator#readme) for full usage and requirements.

### 2. Install the `wmux` CLI shims (`setup.ps1`)

Agents drive wmux through the `wmux` **CLI** (`wmux split`, `wmux browser open`, `wmux send`, …). From the extracted ZIP folder (the one containing `wmux.exe`), run:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

It installs two shims — `wmux` (bash) and `wmux.cmd` (cmd) — into `~/.local/bin` and adds that folder to your user PATH. **Node.js must be installed** — the CLI is a Node script (the GUI is not).

### Why this is needed — and why *not* to PATH the install folder

The GUI (`wmux.exe`) and the CLI both want the command name `wmux`. On PATH, `.EXE` wins over `.CMD` (PATHEXT ordering), so **adding the install folder to PATH does not expose the CLI — it shadows it**: `wmux <command>` would launch the GUI instead of running the pipe client. `setup.ps1` avoids this by placing the shims in `~/.local/bin`, a directory with no `wmux.exe`. Inside a wmux pane the CLI already works via bundled shell integration; the shims cover shells that don't load it — external terminals and Claude Code's own Bash tool.

- ✅ **Do** add `~/.local/bin` to PATH (`setup.ps1` does this for you).
- ❌ **Don't** add the wmux install folder to PATH.

<h1 align="center">wmux</h1>
<p align="center">A visibility layer for Claude Code on Windows — see what your AI agent does in real-time</p>

<p align="center">
  Built on Electron + xterm.js. Inspired by <a href="https://github.com/manaflow-ai/cmux">cmux</a>.
</p>

---

**📖 For the full feature list, install instructions, CLI reference, screenshots, and usage docs, see the [upstream wmux README](https://github.com/amirlehmam/wmux/blob/master/README.md).**

## Based on cmux

wmux is an independent, from-scratch Windows reimplementation inspired by [cmux](https://github.com/manaflow-ai/cmux), the macOS terminal for multitasking. It shares cmux's design philosophy and is wire-compatible with its socket protocol — tools built for cmux's API work with wmux — but it does not reuse cmux's source code.

## Contributing

- [GitHub Issues](https://github.com/amirlehmam/wmux/issues) — bug reports and feature requests
- [GitHub Discussions](https://github.com/amirlehmam/wmux/discussions) — questions and ideas

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/amirlehmam-wmux-badge.png)](https://mseep.ai/app/amirlehmam-wmux)


## License

wmux is open source under the [MIT License](LICENSE). It is an independent reimplementation inspired by cmux and does not incorporate cmux's source code.
