#!/usr/bin/env node

import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import process from 'process';
import api from './api.js';
import { login } from './handlers/auth.js';
import { handleTimetable } from './handlers/timetable.js';
import { handleWeekendMeal } from './handlers/weekend-meal.js';
import { handleEarlyReturn } from './handlers/early-return.js';
import { handleApplication } from './handlers/out-application.js';
import { handleClassroom } from './handlers/classroom-move.js';
import { handleSettings } from './handlers/settings.js';
import { showMainMenu, initUserInfo } from './ui/menu.js';
import { checkForUpdates, checkForUpdatesQuietly } from './utils/updater.js';

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 안녕히 가세요!'));
  process.exit(0);
});

async function checkConnection() {
  const spinner = ora('네트워크 연결 확인 중...').start();
  try {
    await api.healthCheck();
    spinner.succeed(chalk.green('서버 연결 성공'));
    return true;
  } catch (error) {
    spinner.fail(chalk.red('서버 연결 실패 - 네트워크를 확인해주세요'));
    return false;
  }
}

async function main() {
  console.clear();

  const args = process.argv.slice(2);
  if (args.includes('--update') || args.includes('-u')) {
    await checkForUpdates();
    return;
  }

  console.log(boxen(
    chalk.cyan.bold('🎓 DSM PiCK CLI'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyan',
      textAlignment: 'center'
    }
  ));

  checkForUpdatesQuietly().catch(() => {});

  const connected = await checkConnection();
  if (!connected) {
    process.exit(1);
  }

  const loginSuccess = await login(true);
  if (!loginSuccess) return;

  await initUserInfo();

  while (true) {
    const action = await showMainMenu();

    if (action === 'exit') {
      console.clear();
      console.log(boxen(chalk.yellow.bold('👋 안녕히 가세요!'), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
        textAlignment: 'center'
      }));
      process.exit(0);
    }

    try {
      switch (action) {
        case 'timetable':
          await handleTimetable();
          break;

        case 'meal':
          await handleWeekendMeal();
          break;

        case 'early_return':
          await handleEarlyReturn();
          break;

        case 'application':
          await handleApplication();
          break;

        case 'classroom':
          await handleClassroom();
          break;

        case 'settings':
          await handleSettings();
          break;

        default:
          console.clear();
          console.log(boxen(chalk.yellow('🚧 해당 기능은 준비 중입니다.'), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'yellow'
          }));
          await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.clear();
      console.log(boxen(chalk.red(`❌ 오류: ${error.message}`), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red'
      }));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

main().catch(console.error);