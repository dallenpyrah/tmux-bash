# tmux-bash

OpenCode custom `bash` replacement that runs commands in managed tmux windows.

## Install

```bash
npm install --prefix ~/.config/opencode git+https://github.com/dallenpyrah/tmux-bash.git
mkdir -p ~/.config/opencode/tools
cat > ~/.config/opencode/tools/bash.ts <<'EOF'
export { default } from "tmux-bash/bash"
EOF
cat > ~/.config/opencode/tools/tmux.ts <<'EOF'
export { default } from "tmux-bash/tmux"
EOF
```

Requires `tmux` on `PATH`.

## Tools

`bash` runs every command in the `opencode-background` tmux session. Foreground calls wait up to `timeout` seconds, then default to leaving the command in the background.

`tmux` lists, peeks, and kills managed windows.
