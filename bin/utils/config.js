import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';

const CONFIG_PATH = join(homedir(), '.PiCK-cli-config.json');

export function saveConfig(config) {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.log(chalk.red('설정 저장 실패'));
    return false;
  }
}

export function loadConfig() {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return {};
    }

    const raw = readFileSync(CONFIG_PATH, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.log(chalk.yellow('설정 로드 실패'));
    return {};
  }
}

export function clearSavedAuth() {
  const config = loadConfig();
  delete config.auth;
  delete config.credentials;
  saveConfig(config);
}

export { CONFIG_PATH };
