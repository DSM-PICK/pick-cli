import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import chalk from 'chalk';

const CONFIG_PATH = join(homedir(), '.PiCK-cli-config.json');

export function saveConfig(config) {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.log(chalk.red('설정 저장 실패'));
  }
}

export function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (error) {
    console.log(chalk.yellow('설정 로드 실패'));
  }
  return null;
}

export { CONFIG_PATH };