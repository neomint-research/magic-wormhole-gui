import { spawn, ChildProcess } from 'child_process';
import { ProcessResult } from '../../shared/types';

/**
 * Spawns a process with timeout handling.
 * Returns stdout, stderr, exit code, and timeout flag.
 */
export function spawnWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let child: ChildProcess | null = null;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      if (child) {
        child.kill('SIGTERM');
        
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (child && !child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000);
      }
    }, timeoutMs);

    try {
      child = spawn(command, args, {
        shell: false,
        windowsHide: true,
      });

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeoutId);
        resolve({
          exitCode: code ?? -1,
          stdout,
          stderr,
          timedOut,
        });
      });

      child.on('error', (err: Error) => {
        clearTimeout(timeoutId);
        resolve({
          exitCode: -1,
          stdout,
          stderr: err.message,
          timedOut: false,
        });
      });
    } catch (err) {
      clearTimeout(timeoutId);
      resolve({
        exitCode: -1,
        stdout: '',
        stderr: err instanceof Error ? err.message : 'Unknown error',
        timedOut: false,
      });
    }
  });
}
