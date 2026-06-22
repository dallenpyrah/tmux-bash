import type { Plugin } from "@opencode-ai/plugin"
import bash from "./bash.ts"
import tmux from "./tmux.ts"

const TmuxBashPlugin = (async () => ({
  tool: {
    bash,
    tmux
  }
})) satisfies Plugin

export default TmuxBashPlugin
export { TmuxBashPlugin as server }
