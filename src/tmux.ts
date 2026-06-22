import { tool } from "@opencode-ai/plugin"
import { ensureTmux, listWindows, readText, run, tailLines } from "./core.ts"

export default tool({
  description: "Inspect and control tmux windows created by the custom bash tool.",
  args: {
    action: tool.schema.enum(["list", "peek", "kill"]).describe("Action to run."),
    window: tool.schema.string().optional().describe("Stable tmux window id like @123 for peek or kill."),
    lines: tool.schema.number().int().min(1).max(2000).optional().describe("Lines of output for peek. Default 2000.")
  },
  async execute(args, context) {
    const cwd = context.directory || context.worktree
    await ensureTmux(cwd, context.abort)
    const windows = await listWindows(cwd, context.abort)
    if (args.action === "list") {
      if (windows.length === 0) return "No managed tmux windows."
      return windows.map((w) => `${w.id}\t${w.active ? "running" : "done"}\t${w.name}\t${w.outputFile}`).join("\n")
    }

    if (!args.window) return "window is required"
    const match = windows.find((w) => w.id === args.window)
    if (!match) return `No managed tmux window found for ${args.window}`

    if (args.action === "peek") return tailLines(await readText(match.outputFile), args.lines ?? 2000) || "No output yet."

    const result = await run("tmux", ["kill-window", "-t", match.id], { cwd, signal: context.abort })
    return result.code === 0 ? `Killed ${match.id}` : result.stderr || `Failed to kill ${match.id}`
  }
})
