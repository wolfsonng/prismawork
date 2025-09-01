import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { randomUUID } from 'crypto';
import { resolveRuntimeEnv, loadEnvState } from './envFile';

export type Task = {
  id: string;
  cmd: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  proc: ChildProcessWithoutNullStreams;
  logs: { type: 'stdout' | 'stderr' | 'info'; message: string; ts: number }[];
  done: boolean;
  exitCode: number | null;
};

const tasks = new Map<string, Task>();

export function getTask(id: string) {
  return tasks.get(id) || null;
}

export function listTasks() {
  return Array.from(tasks.values()).map((t) => ({ id: t.id, cmd: t.cmd, args: t.args, done: t.done, exitCode: t.exitCode }));
}

function pushLog(task: Task, type: Task['logs'][number]['type'], message: string) {
  task.logs.push({ type, message, ts: Date.now() });
}

export function startPrismaTask(args: string[], envOverrides: Record<string, string> = {}) {
  const id = randomUUID();
  const cwd = process.cwd();
  const state = loadEnvState();
  const runtime = resolveRuntimeEnv(state);

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...runtime,
    ...envOverrides,
  };

  // Prefer npx prisma to leverage local project install.
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const fullArgs = ['prisma', ...args, '--schema', 'prisma/schema.prisma'];
  const proc = spawn(cmd, fullArgs, { cwd, env });

  const task: Task = { id, cmd, args: fullArgs, env, cwd, proc, logs: [], done: false, exitCode: null };
  tasks.set(id, task);

  pushLog(task, 'info', `Starting: ${cmd} ${fullArgs.join(' ')}`);

  proc.stdout.on('data', (d) => pushLog(task, 'stdout', d.toString()));
  proc.stderr.on('data', (d) => pushLog(task, 'stderr', d.toString()));
  proc.on('close', (code) => {
    task.done = true;
    task.exitCode = code === null ? -1 : code;
    pushLog(task, 'info', `Exited with code ${task.exitCode}`);
  });

  return { id, task };
}

export function startTask(cmd: string, args: string[], envOverrides: Record<string, string> = {}, cwd?: string) {
  const id = randomUUID();
  const state = loadEnvState();
  const runtime = resolveRuntimeEnv(state);

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...runtime,
    ...envOverrides,
  };
  const proc = spawn(cmd, args, { cwd: cwd || process.cwd(), env });
  const task: Task = { id, cmd, args, env, cwd: cwd || process.cwd(), proc, logs: [], done: false, exitCode: null };
  tasks.set(id, task);

  pushLog(task, 'info', `Starting: ${cmd} ${args.join(' ')}`);
  proc.stdout.on('data', (d) => pushLog(task, 'stdout', d.toString()));
  proc.stderr.on('data', (d) => pushLog(task, 'stderr', d.toString()));
  proc.on('close', (code) => {
    task.done = true;
    task.exitCode = code === null ? -1 : code;
    pushLog(task, 'info', `Exited with code ${task.exitCode}`);
  });
  return { id, task };
}
