import { Result, DockerStatus, ErrorCode } from '../../shared/types';
import { ERROR_MESSAGES, DOCKER_IMAGE, DOCKER_CHECK_TIMEOUT_MS } from '../../shared/constants';
import { spawnWithTimeout } from '../utils/process';

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
