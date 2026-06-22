import { tool } from "@opencode-ai/plugin"
import { basename, dirname } from "node:path"
import { ensureTmux, isDone, listWindows, makeScript, readText, run, sessionName, tailLines } from "./core.ts"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForDone = async (doneFile: string, timeoutMs: number) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isDone(doneFile)) return true
    await sleep(250)
  }
  return false
}

export default tool({
  description:
    "Execute a bash command in a managed tmux window. Long-running commands can keep running in the background and be inspected with the tmux tool.",
  args: {
    command: tool.schema.string().describe("Bash command to execute."),
    name: tool.schema.string().optional().describe("Short label for the tmux window."),
    timeout: tool.schema.number().int().min(1).max(600).optional().describe("Seconds to wait in foreground. Default 30."),
    timeoutAction: tool.schema.enum(["background", "kill"]).optional().describe("What to do when timeout is reached. Default background."),
    background: tool.schema.boolean().optional().describe("Return immediately and leave command running in tmux."),
    lines: tool.schema.number().int().min(1).max(2000).optional().describe("Output lines to return. Default 2000.")
  },
  async execute(args, context) {
    const cwd = context.directory || context.worktree
    await ensureTmux(cwd, context.abort)
    const script = await makeScript(args.command, cwd)
    const label = (args.name ?? args.command).replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "bash"
    const windowName = basename(dirname(script.outputFile))
    const result = await run("tmux", ["new-window", "-d", "-P", "-F", "#{window_id}", "-t", sessionName, "-n", windowName, "bash", script.script], {
      cwd,
      signal: context.abort
    })
    if (result.code !== 0) return { output: result.stderr || "failed to create tmux window", metadata: { exitCode: result.code } }
    const window = result.stdout.trim()
    context.metadata({ title: `bash ${window}: ${label}`, metadata: { window, session: sessionName, outputFile: script.outputFile } })

    if (args.background) {
      return { output: `Started in tmux window ${window}. Use tmux peek with window ${window}.`, metadata: { window, session: sessionName, outputFile: script.outputFile } }
    }

    const timeout = (args.timeout ?? 30) * 1000
    const completed = await waitForDone(script.doneFile, timeout)
    const output = tailLines(await readText(script.outputFile), args.lines ?? 2000)
    if (completed) return { output, metadata: { window, session: sessionName, outputFile: script.outputFile, completed: true } }

    if (args.timeoutAction === "kill") {
      await run("tmux", ["kill-window", "-t", window], { cwd, signal: context.abort }).catch(() => undefined)
      return { output: `${output}\n\n[timed out after ${args.timeout ?? 30}s; killed ${window}]`, metadata: { window, completed: false, killed: true } }
    }

    return { output: `${output}\n\n[timed out after ${args.timeout ?? 30}s; still running in ${window}]`, metadata: { window, completed: false, windows: await listWindows(cwd, context.abort) } }
  }
})
