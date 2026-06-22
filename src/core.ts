import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"

export const sessionName = "opencode-background"
export const outputRoot = join(tmpdir(), "opencode-tmux-bash")

export interface CommandResult {
  readonly stdout: string
  readonly stderr: string
  readonly code: number | null
}

export interface WindowRecord {
  readonly id: string
  readonly name: string
  readonly active: boolean
  readonly outputFile: string
  readonly doneFile: string
}

export const run = (
  cmd: string,
  args: ReadonlyArray<string>,
  options: { readonly cwd?: string; readonly signal?: AbortSignal } = {}
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: options.cwd, signal: options.signal, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.stderr.on("data", (chunk) => (stderr += chunk))
    child.on("error", reject)
    child.on("close", (code) => resolve({ stdout, stderr, code }))
  })

export const ensureTmux = async (cwd: string, signal?: AbortSignal) => {
  const hasTmux = await run("/bin/sh", ["-lc", "command -v tmux"], { cwd, signal }).catch(() => undefined)
  if (hasTmux?.code !== 0) throw new Error("tmux is not installed or not on PATH")
  const session = await run("tmux", ["has-session", "-t", sessionName], { cwd, signal }).catch(() => undefined)
  if (session?.code !== 0) {
    await run("tmux", ["new-session", "-d", "-s", sessionName, "-n", "idle"], { cwd, signal })
  }
}

export const makeScript = async (command: string, cwd: string) => {
  await mkdir(outputRoot, { recursive: true })
  const dir = await mkdtemp(join(outputRoot, "cmd-"))
  const script = join(dir, "run.sh")
  const outputFile = join(dir, "output.txt")
  const doneFile = join(dir, "done")
  await writeFile(
    script,
    [
      "#!/usr/bin/env bash",
      "set +e",
      `cd ${JSON.stringify(cwd)}`,
      `printf '%s\n' ${JSON.stringify(`$ ${command}`)} > ${JSON.stringify(outputFile)}`,
      `(${command}) >> ${JSON.stringify(outputFile)} 2>&1`,
      "code=$?",
      `printf '\n[exit %s]\n' "$code" >> ${JSON.stringify(outputFile)}`,
      `printf '%s' "$code" > ${JSON.stringify(doneFile)}`,
      "while :; do sleep 3600; done"
    ].join("\n")
  )
  return { script, outputFile, doneFile }
}

export const readText = async (file: string) => readFile(file, "utf8").catch(() => "")

export const isDone = async (file: string) => (await readText(file)).trim().length > 0

export const listWindows = async (cwd: string, signal?: AbortSignal): Promise<ReadonlyArray<WindowRecord>> => {
  await ensureTmux(cwd, signal)
  const result = await run("tmux", ["list-windows", "-t", sessionName, "-F", "#{window_id}\t#{window_name}\t#{pane_current_command}"], { cwd, signal })
  if (result.code !== 0) return []
  const windows = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id = "", name = ""] = line.split("\t")
      const outputFile = join(outputRoot, name, "output.txt")
      const doneFile = join(outputRoot, name, "done")
      return { id, name, outputFile, doneFile }
    })
    .filter((window) => window.name.startsWith("cmd-"))
  return Promise.all(windows.map(async (window) => ({ ...window, active: !(await isDone(window.doneFile)) })))
}

export const tailLines = (text: string, lines: number) => text.split("\n").slice(-lines).join("\n")
