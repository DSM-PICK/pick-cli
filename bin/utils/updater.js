import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import process from 'process';
import semver from 'semver';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import prompts from 'prompts';
import { loadConfig, saveConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTO_UPDATE_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const REGISTRY_TIMEOUT_MS = 5000;
const UPDATE_LOG_LINE_LIMIT = 8;

function getPackageJson() {
  const packagePath = join(__dirname, '../../package.json');
  return JSON.parse(readFileSync(packagePath, 'utf8'));
}

function getPackageInfo() {
  try {
    const packageJson = getPackageJson();
    return {
      name: packageJson.name,
      version: packageJson.version
    };
  } catch (error) {
    console.error('패키지 정보를 읽을 수 없습니다:', error.message);
    return null;
  }
}

function getUpdateConfig(config = {}) {
  const update = config.update ?? {};
  const lastCheck = Number.parseInt(config.lastUpdateCheck ?? '0', 10);
  const lastAttemptAt = Number.parseInt(update.lastAutoUpdateAttempt ?? '0', 10);

  return {
    ...update,
    autoInstall: update.autoInstall ?? true,
    pendingVersion: update.pendingVersion ?? null,
    lastAttemptedVersion: update.lastAttemptedVersion ?? null,
    lastAutoUpdateAttempt: Number.isNaN(lastAttemptAt) ? 0 : lastAttemptAt,
    lastUpdateCheck: Number.isNaN(lastCheck) ? 0 : lastCheck
  };
}

function saveUpdateConfig(config, updatePatch = {}, extraPatch = {}) {
  saveConfig({
    ...config,
    ...extraPatch,
    update: {
      ...(config.update ?? {}),
      ...updatePatch
    }
  });
}

function saveLastUpdateCheck(config, now) {
  saveConfig({
    ...config,
    lastUpdateCheck: now.toString()
  });
}

function maybeShowCompletedUpdate(packageInfo, config) {
  const updateConfig = getUpdateConfig(config);
  if (!updateConfig.pendingVersion) {
    return config;
  }

  if (!semver.gte(packageInfo.version, updateConfig.pendingVersion)) {
    return config;
  }

  const nextConfig = {
    ...config,
    update: {
      ...(config.update ?? {}),
      pendingVersion: null,
      lastCompletedVersion: packageInfo.version
    }
  };

  saveConfig(nextConfig);

  console.log(boxen(
    chalk.green.bold('업데이트 적용 완료!\n\n') +
    chalk.white(`현재 버전: ${packageInfo.version}\n`) +
    chalk.cyan('최신 버전이 적용되었습니다.'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
      margin: { top: 1, bottom: 1 }
    }
  ));

  return nextConfig;
}

async function fetchJsonWithTimeout(url, timeoutMs = REGISTRY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getLatestVersion(packageName) {
  try {
    const data = await fetchJsonWithTimeout(`https://registry.npmjs.org/${packageName}/latest`);
    return data.version;
  } catch (error) {
    console.error('최신 버전 확인 실패:', error.message);
    return null;
  }
}

function escapeForPowerShell(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function escapeForSh(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function getUpdatePackageSpec(packageName) {
  return `${packageName}@latest`;
}

function spawnDetachedUpdate(packageName) {
  const packageSpec = getUpdatePackageSpec(packageName);

  if (process.platform === 'win32') {
    const script = [
      '$ErrorActionPreference = "Stop"',
      'Start-Sleep -Seconds 2',
      `npm install -g ${escapeForPowerShell(packageSpec)}`
    ].join('; ');

    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      script
    ], {
      detached: true,
      stdio: 'ignore'
    });

    child.unref();
    return;
  }

  const child = spawn('sh', [
    '-lc',
    `sleep 2 && npm install -g ${escapeForSh(packageSpec)}`
  ], {
    detached: true,
    stdio: 'ignore'
  });

  child.unref();
}

function runManualUpdate(packageName) {
  const packageSpec = getUpdatePackageSpec(packageName);

  return new Promise((resolve, reject) => {
    const child = process.platform === 'win32'
      ? spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$ErrorActionPreference = "Stop"; npm install -g ${escapeForPowerShell(packageSpec)}; exit $LASTEXITCODE`
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
      : spawn('sh', [
        '-lc',
        `npm install -g ${escapeForSh(packageSpec)}`
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

function shouldAttemptAutoUpdate(updateConfig, latestVersion, now) {
  if (!updateConfig.autoInstall) {
    return false;
  }

  if (
    updateConfig.lastAttemptedVersion === latestVersion &&
    updateConfig.lastAutoUpdateAttempt &&
    (now - updateConfig.lastAutoUpdateAttempt) < AUTO_UPDATE_COOLDOWN_MS
  ) {
    return false;
  }

  return true;
}

function formatUpdateLog(stdout, stderr) {
  const lines = [stderr, stdout]
    .filter(Boolean)
    .flatMap((output) => output.split(/\r?\n/))
    .map((line) => line.trimEnd())
    .filter(Boolean);

  return lines.slice(-UPDATE_LOG_LINE_LIMIT).join('\n');
}

function scheduleAutoUpdate(config, packageName, latestVersion) {
  const spinner = ora('자동 업데이트 준비 중...').start();

  try {
    spawnDetachedUpdate(packageName);

    saveUpdateConfig(config, {
      pendingVersion: latestVersion,
      lastAttemptedVersion: latestVersion,
      lastAutoUpdateAttempt: Date.now().toString()
    });

    spinner.succeed(chalk.green('자동 업데이트를 시작합니다.'));

    console.log(boxen(
      chalk.green.bold('자동 업데이트 시작\n\n') +
      chalk.white(`대상 버전: ${latestVersion}\n`) +
      chalk.yellow('설치가 백그라운드에서 진행됩니다.\n') +
      chalk.cyan('잠시 후 CLI를 다시 실행해 주세요.'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    ));

    process.exit(0);
  } catch (error) {
    spinner.fail(chalk.red('자동 업데이트 시작 실패'));
    console.error(chalk.red(error.message));
    return false;
  }
}

async function installUpdateManually(packageName, latestVersion) {
  const spinner = ora('업데이트 설치 중...').start();

  try {
    const result = await runManualUpdate(packageName);

    if (result.code === 0) {
      spinner.succeed(chalk.green('업데이트가 설치되었습니다.'));
      console.log(boxen(
        chalk.green.bold('업데이트 완료\n\n') +
        chalk.white(`설치 버전: ${latestVersion}\n`) +
        chalk.cyan('CLI를 다시 실행하면 최신 버전이 적용됩니다.'),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      ));

      return true;
    }

    const installLog = formatUpdateLog(result.stdout, result.stderr);
    spinner.fail(chalk.red('업데이트 설치 실패'));
    console.log(boxen(
      chalk.red.bold('업데이트 실패\n\n') +
      chalk.white(`대상 버전: ${latestVersion}\n`) +
      chalk.white(`종료 코드: ${result.code ?? 'unknown'}`) +
      (installLog
        ? `${chalk.yellow('\n\n설치 로그\n')}${chalk.gray(installLog)}`
        : `\n\n${chalk.gray('설치 로그를 확인하지 못했습니다.')}`),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'red'
      }
    ));

    return false;
  } catch (error) {
    spinner.fail(chalk.red('업데이트 설치 실패'));
    console.log(boxen(
      chalk.red.bold('업데이트 실패\n\n') +
      chalk.gray(error.message),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'red'
      }
    ));

    return false;
  }
}

export async function checkForUpdates(packageName) {
  const packageInfo = getPackageInfo();
  const resolvedPackageName = packageName || packageInfo?.name;
  const currentVersion = packageInfo?.version;

  const spinner = ora('업데이트 확인 중...').start();
  const latestVersion = resolvedPackageName ? await getLatestVersion(resolvedPackageName) : null;
  spinner.stop();

  if (!currentVersion || !latestVersion || !resolvedPackageName) {
    console.log(chalk.yellow('버전 정보를 확인하지 못했습니다.'));
    return false;
  }

  if (!semver.gt(latestVersion, currentVersion)) {
    console.log(chalk.green('이미 최신 버전을 사용 중입니다.'));
    return false;
  }

  console.log(boxen(
    chalk.yellow.bold('새 버전이 있습니다!\n\n') +
    chalk.white(`현재 버전: ${currentVersion}\n`) +
    chalk.green(`최신 버전: ${latestVersion}\n\n`) +
    chalk.cyan('지금 업데이트할 수 있습니다.'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'yellow'
    }
  ));

  const shouldUpdate = await prompts({
    type: 'confirm',
    name: 'update',
    message: '지금 업데이트하시겠습니까?',
    initial: true
  });

  if (shouldUpdate.update) {
    return installUpdateManually(resolvedPackageName, latestVersion);
  }

  return false;
}

export async function checkForUpdatesQuietly(packageName) {
  try {
    const packageInfo = getPackageInfo();
    if (!packageInfo) {
      return false;
    }

    let config = loadConfig();
    config = maybeShowCompletedUpdate(packageInfo, config);

    const updateConfig = getUpdateConfig(config);
    const resolvedPackageName = packageName || packageInfo.name;
    const now = Date.now();

    if (updateConfig.lastUpdateCheck && (now - updateConfig.lastUpdateCheck) < UPDATE_CHECK_INTERVAL_MS) {
      return false;
    }

    const latestVersion = await getLatestVersion(resolvedPackageName);
    saveLastUpdateCheck(config, now);
    config = {
      ...config,
      lastUpdateCheck: now.toString()
    };

    if (!latestVersion || !semver.gt(latestVersion, packageInfo.version)) {
      return false;
    }

    if (shouldAttemptAutoUpdate(updateConfig, latestVersion, now)) {
      return scheduleAutoUpdate(config, resolvedPackageName, latestVersion);
    }

    console.log(boxen(
      chalk.yellow.bold(`새 버전 ${latestVersion}이 있습니다.\n`) +
      chalk.white(`현재 버전: ${packageInfo.version}\n`) +
      chalk.cyan(`'pick --update'로 업데이트하세요.`),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
        margin: { top: 1, bottom: 1 }
      }
    ));

    return false;
  } catch (error) {
    return false;
  }
}

export function setAutoUpdateEnabled(enabled) {
  const config = loadConfig();
  saveUpdateConfig(config, {
    autoInstall: enabled
  });
}

export function isAutoUpdateEnabled() {
  const config = loadConfig();
  return getUpdateConfig(config).autoInstall;
}
