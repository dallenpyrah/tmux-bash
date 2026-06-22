# tmux-bash

OpenCode plugin that replaces `bash` with a tmux-backed implementation and adds a `tmux` inspection tool.

## Install

```json
{
  "plugin": ["git+https://github.com/dallenpyrah/tmux-bash.git"]
}
```

Requires `tmux` on `PATH`.

## Tools

The plugin registers `bash` and `tmux`. Because the `bash` tool name matches OpenCode's built-in tool, it takes precedence.

`bash` runs every command in the `opencode-background` tmux session. Foreground calls wait up to `timeout` seconds, then default to leaving the command in the background.

`tmux` lists, peeks, and kills managed windows.
