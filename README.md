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

## 🤖 Additional Setup for Claude Orchestration

This fork is distributed as a **portable ZIP**, and the GUI (`wmux.exe`) is fully self-contained. To drive wmux from **Claude Code** — the multi-agent orchestration this fork is built around — you only need to install the orchestrator plugin. The `wmux` CLI is wired up automatically.

### Install the wmux-orchestrator plugin (fork)

The orchestrator is a Claude Code plugin that decomposes a task into parallel agents, one per visible wmux pane. This fork maintains its own copy at **[tawman/wmux-orchestrator](https://github.com/tawman/wmux-orchestrator)** (hardened and kept in lockstep with `production/local`). Register it as a Claude Code marketplace and install the plugin:

```bash
claude plugin marketplace add tawman/wmux-orchestrator
claude plugin install wmux-orchestrator@wmux-orchestrator
```

> wmux also auto-installs a **bundled** copy of the plugin into `~/.claude/plugins/cache/` on startup, so basic orchestration works out of the box. Installing from the fork gives you the standalone, independently-updatable version — see the [orchestrator fork README](https://github.com/tawman/wmux-orchestrator#readme) for full usage and requirements.

### The `wmux` CLI — automatic inside wmux

Agents drive wmux through the `wmux` **CLI** (`wmux split`, `wmux browser open`, `wmux send`, …). **You don't need to set this up:** wmux prepends a bundled shim directory to `PATH` in every shell it spawns, so bare `wmux` works out of the box in the shells that run orchestration — Claude Code's Bash tool, the orchestrator's hook scripts, and interactive panes alike. **Node.js must be on PATH** — the CLI is a Node script (the GUI is not); Claude Code orchestration needs Node anyway.

> **Why the install folder is *not* on PATH.** The GUI (`wmux.exe`) and the CLI both want the name `wmux`, and on PATH `.EXE` shadows `.CMD` (PATHEXT ordering), so putting the *install* folder on PATH would make `wmux <command>` launch the GUI instead of the CLI. wmux sidesteps this by putting the shims — a directory with **no** `wmux.exe` — on the PATH of the shells it spawns, never the install folder. **Don't add the install folder to PATH.**

### Optional: `wmux` in an external terminal (`setup.ps1`)

The automatic wiring above applies only to shells **wmux spawns**. To run `wmux` from a terminal wmux did *not* spawn (a standalone PowerShell / Git Bash window), run — once — from the extracted ZIP folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

It installs `wmux`/`wmux.cmd` shims into `~/.local/bin` and adds that folder (never the install folder) to your user PATH. Not needed for orchestration.

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
