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
