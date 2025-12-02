import { spawn, ChildProcess } from 'child_process';
import { Result, DockerStatus, ErrorCode, ProgressEvent } from '../../shared/types';
import { ERROR_MESSAGES, DOCKER_IMAGE, DOCKER_CHECK_TIMEOUT_MS, WORMHOLE_CODE_REGEX, PROGRESS_REGEX } from '../../shared/constants';
import { spawnWithTimeout } from '../utils/process';

// Track active send processes for cleanup
let activeSendProcess: ChildProcess | null = null;

/**
 * Checks if Docker is available and running.
 */
export async function checkDocker(): Promise<Result<DockerStatus>> {
  // Check if docker command exists
  const versionResult = await spawnWithTimeout(
    'docker',
    ['--version'],
    DOCKER_CHECK_TIMEOUT_MS
  );

  if (versionResult.exitCode !== 0) {
    return {
      success: false,
      error: {
        code: ErrorCode.DOCKER_NOT_INSTALLED,
        message: ERROR_MESSAGES[ErrorCode.DOCKER_NOT_INSTALLED],
        details: versionResult.stderr,
      },
    };
  }

  // Check if daemon is running
  const infoResult = await spawnWithTimeout(
    'docker',
    ['info'],
    DOCKER_CHECK_TIMEOUT_MS
  );

  if (infoResult.exitCode !== 0) {
    return {
      success: false,
      error: {
        code: ErrorCode.DOCKER_NOT_RUNNING,
        message: ERROR_MESSAGES[ErrorCode.DOCKER_NOT_RUNNING],
        details: infoResult.stderr,
      },
    };
  }

  // Check if our image exists
  const imageResult = await spawnWithTimeout(
    'docker',
    ['image', 'inspect', DOCKER_IMAGE],
    DOCKER_CHECK_TIMEOUT_MS
  );

  if (imageResult.exitCode !== 0) {
    return {
      success: false,
      error: {
        code: ErrorCode.DOCKER_IMAGE_MISSING,
        message: ERROR_MESSAGES[ErrorCode.DOCKER_IMAGE_MISSING],
        details: `Image '${DOCKER_IMAGE}' not found`,
      },
    };
  }

  return {
    success: true,
    data: {
      available: true,
      version: versionResult.stdout.trim(),
    },
  };
}

/**
 * Runs a docker command with the wormhole-cli image.
 * Waits for process to complete.
 */
export async function runDockerCommand(
  args: string[],
  volumeMount: { hostPath: string; containerPath: string; readOnly?: boolean },
  timeoutMs: number
): Promise<Result<{ stdout: string; stderr: string }>> {
  const volumeArg = volumeMount.readOnly
    ? `${volumeMount.hostPath}:${volumeMount.containerPath}:ro`
    : `${volumeMount.hostPath}:${volumeMount.containerPath}`;

  const dockerArgs = [
    'run',
    '--rm',
    '-t',
    '-e', 'PYTHONUNBUFFERED=1',
    '-v',
    volumeArg,
    DOCKER_IMAGE,
    ...args,
  ];

  const result = await spawnWithTimeout('docker', dockerArgs, timeoutMs);

  if (result.timedOut) {
    return {
      success: false,
      error: {
        code: ErrorCode.DOCKER_TIMEOUT,
        message: ERROR_MESSAGES[ErrorCode.DOCKER_TIMEOUT],
      },
    };
  }

  if (result.exitCode !== 0) {
    return {
      success: false,
      error: {
        code: ErrorCode.DOCKER_EXIT_NONZERO,
        message: ERROR_MESSAGES[ErrorCode.DOCKER_EXIT_NONZERO],
        details: result.stderr || result.stdout,
      },
    };
  }

  return {
    success: true,
    data: {
      stdout: result.stdout,
      stderr: result.stderr,
    },
  };
}

/**
 * Runs wormhole send and returns the code as soon as it's available.
 * The process continues running in the background until transfer completes.
 * Optional onProgress callback receives progress updates during transfer.
 * Optional onComplete callback fires when transfer finishes.
 */
export function runDockerSend(
  filePath: string,
  volumeMount: { hostPath: string; containerPath: string },
  timeoutMs: number,
  onProgress?: (event: ProgressEvent) => void,
  onComplete?: (success: boolean) => void
): Promise<Result<{ code: string }>> {
  return new Promise((resolve) => {
    // Kill any previous send process
    if (activeSendProcess) {
      activeSendProcess.kill();
      activeSendProcess = null;
    }

    const volumeArg = `${volumeMount.hostPath}:${volumeMount.containerPath}:ro`;

    const dockerArgs = [
      'run',
      '--rm',
      '-t',
      '-e', 'PYTHONUNBUFFERED=1',
      '-v',
      volumeArg,
      DOCKER_IMAGE,
      'wormhole',
      'send',
      filePath,
    ];

    const proc = spawn('docker', dockerArgs, {
      shell: false,
      windowsHide: true,
    });

    activeSendProcess = proc;

    let stdout = '';
    let stderr = '';
    let resolved = false;
    let codeFound = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        activeSendProcess = null;
        resolve({
          success: false,
          error: {
            code: ErrorCode.DOCKER_TIMEOUT,
            message: ERROR_MESSAGES[ErrorCode.DOCKER_TIMEOUT],
          },
        });
      }
    }, timeoutMs);

    const checkForCode = (data: string) => {
      if (resolved) return;

      const combined = stdout + stderr + data;
      const match = combined.match(WORMHOLE_CODE_REGEX);

      if (match) {
        resolved = true;
        codeFound = true;
        clearTimeout(timeout);
        // Don't kill process - let it wait for receiver
        resolve({
          success: true,
          data: {
            code: match[1],
          },
        });
      }
    };

    const checkForProgress = (data: string) => {
      if (!onProgress) return;
      const match = data.match(PROGRESS_REGEX);
      if (match) {
        onProgress({
          type: 'send',
          percent: parseInt(match[1], 10),
          transferred: match[2].trim(),
          total: match[3].trim(),
        });
      }
    };

    proc.stdout.on('data', (data: Buffer) => {
      const str = data.toString();
      stdout += str;
      checkForCode(str);
      checkForProgress(str);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const str = data.toString();
      stderr += str;
      checkForCode(str);
      checkForProgress(str);
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        activeSendProcess = null;
        resolve({
          success: false,
          error: {
            code: ErrorCode.DOCKER_EXIT_NONZERO,
            message: ERROR_MESSAGES[ErrorCode.DOCKER_EXIT_NONZERO],
            details: err.message,
          },
        });
      }
    });

    proc.on('close', (exitCode) => {
      activeSendProcess = null;
      
      // If code was found, this is a completion event
      if (codeFound && onComplete) {
        onComplete(exitCode === 0);
      }
      
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          success: false,
          error: {
            code: ErrorCode.CODE_PARSE_FAILED,
            message: ERROR_MESSAGES[ErrorCode.CODE_PARSE_FAILED],
            details: `Process exited with code ${exitCode}. Output: ${(stdout + stderr).substring(0, 500)}`,
          },
        });
      }
    });
  });
}

/**
 * Cancels any active send operation.
 */
export function cancelSend(): void {
  if (activeSendProcess) {
    activeSendProcess.kill();
    activeSendProcess = null;
  }
}

/**
 * Runs a docker command with streaming output for progress tracking.
 * Used for receive operations where we need progress updates.
 */
export function runDockerCommandWithProgress(
  args: string[],
  volumeMount: { hostPath: string; containerPath: string; readOnly?: boolean },
  timeoutMs: number,
  onProgress?: (event: ProgressEvent) => void
): Promise<Result<{ stdout: string; stderr: string }>> {
  return new Promise((resolve) => {
    const volumeArg = volumeMount.readOnly
      ? `${volumeMount.hostPath}:${volumeMount.containerPath}:ro`
      : `${volumeMount.hostPath}:${volumeMount.containerPath}`;

    const dockerArgs = [
      'run',
      '--rm',
      '-t',
      '-e', 'PYTHONUNBUFFERED=1',
      '-v',
      volumeArg,
      DOCKER_IMAGE,
      ...args,
    ];

    const proc = spawn('docker', dockerArgs, {
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve({
          success: false,
          error: {
            code: ErrorCode.DOCKER_TIMEOUT,
            message: ERROR_MESSAGES[ErrorCode.DOCKER_TIMEOUT],
          },
        });
      }
    }, timeoutMs);

    const checkForProgress = (data: string) => {
      if (!onProgress) return;
      const match = data.match(PROGRESS_REGEX);
      if (match) {
        onProgress({
          type: 'receive',
          percent: parseInt(match[1], 10),
          transferred: match[2].trim(),
          total: match[3].trim(),
        });
      }
    };

    proc.stdout.on('data', (data: Buffer) => {
      const str = data.toString();
      stdout += str;
      checkForProgress(str);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const str = data.toString();
      stderr += str;
      checkForProgress(str);
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          success: false,
          error: {
            code: ErrorCode.DOCKER_EXIT_NONZERO,
            message: ERROR_MESSAGES[ErrorCode.DOCKER_EXIT_NONZERO],
            details: err.message,
          },
        });
      }
    });

    proc.on('close', (exitCode) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (exitCode !== 0) {
          resolve({
            success: false,
            error: {
              code: ErrorCode.DOCKER_EXIT_NONZERO,
              message: ERROR_MESSAGES[ErrorCode.DOCKER_EXIT_NONZERO],
              details: stderr || stdout,
            },
          });
        } else {
          resolve({
            success: true,
            data: { stdout, stderr },
          });
        }
      }
    });
  });
}
