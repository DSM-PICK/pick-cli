import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import semver from 'semver';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import prompts from 'prompts';
import { execSync } from 'child_process';
import { loadConfig, saveConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getCurrentVersion() {
  try {
    const packagePath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error('패키지 정보를 읽을 수 없습니다:', error.message);
    return null;
  }
}

async function getLatestVersion(packageName) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.version;
  } catch (error) {
    console.error('최신 버전 확인 실패:', error.message);
    return null;
  }
}

async function performUpdate(packageName) {
  const spinner = ora('업데이트 중...').start();
  try {
    execSync(`npm install -g ${packageName}@latest`, {
      stdio: 'pipe',
      timeout: 30000
    });
    spinner.succeed(chalk.green('업데이트가 완료되었습니다!'));

    console.log(boxen(
      chalk.green.bold('✨ 업데이트 완료!\n\n') +
      chalk.white('새로운 버전이 설치되었습니다.\n') +
      chalk.yellow('변경사항을 적용하려면 CLI를 다시 시작해주세요.'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    ));

    process.exit(0);
  } catch (error) {
    spinner.fail(chalk.red('업데이트 실패'));
    console.error(chalk.red(`오류: ${error.message}`));
    return false;
  }
}

export async function checkForUpdates(packageName = 'pick-cli', silent = false) {
  if (!silent) {
    const spinner = ora('업데이트 확인 중...').start();

    const currentVersion = getCurrentVersion();
    const latestVersion = await getLatestVersion(packageName);

    spinner.stop();

    if (!currentVersion || !latestVersion) {
      if (!silent) {
        console.log(chalk.yellow('⚠️  버전 확인에 실패했습니다.'));
      }
      return false;
    }

    if (semver.gt(latestVersion, currentVersion)) {
      console.log(boxen(
        chalk.yellow.bold('🚀 새로운 버전이 있습니다!\n\n') +
        chalk.white(`현재 버전: ${currentVersion}\n`) +
        chalk.green(`최신 버전: ${latestVersion}\n\n`) +
        chalk.cyan('업데이트를 권장합니다.'),
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
        await performUpdate(packageName);
        return true;
      }
    } else {
      if (!silent) {
        console.log(chalk.green('✅ 최신 버전을 사용 중입니다.'));
      }
    }
  }

  return false;
}

export async function checkForUpdatesQuietly(packageName = 'pick-cli') {
  try {
    const config = loadConfig() || {};
    const lastCheck = config.lastUpdateCheck;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (lastCheck && (now - parseInt(lastCheck)) < oneDay) {
      return false;
    }

    const currentVersion = getCurrentVersion();
    const latestVersion = await getLatestVersion(packageName);

    if (currentVersion && latestVersion && semver.gt(latestVersion, currentVersion)) {
      console.log(boxen(
        chalk.yellow.bold(`🚀 새로운 버전 ${latestVersion}이 있습니다!\n`) +
        chalk.white(`현재 버전: ${currentVersion}\n`) +
        chalk.cyan(`'pick --update'로 업데이트하세요.`),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'yellow',
          margin: { top: 1, bottom: 1 }
        }
      ));

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    config.lastUpdateCheck = now.toString();
    saveConfig(config);

    return false;
  } catch (error) {
    return false;
  }
}