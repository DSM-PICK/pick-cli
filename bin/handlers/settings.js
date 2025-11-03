import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { existsSync, writeFileSync } from 'fs';
import { CONFIG_PATH } from '../utils/config.js';
import { checkForUpdates } from '../utils/updater.js';

export async function handleSettings() {
  console.clear();
  console.log(boxen(chalk.magenta.bold('⚙️ 설정'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'magenta'
  }));

  const settingsAction = await prompts({
    type: 'select',
    name: 'action',
    message: '설정을 선택하세요:',
    choices: [
      { title: '🗑️  자동 로그인 정보 삭제', value: 'clear_login' },
      { title: '🔄 업데이트 확인', value: 'check_update' },
      { title: '🔙 돌아가기', value: 'back' }
    ]
  });

  if (settingsAction.action === 'clear_login') {
    const confirmSpinner = ora('자동 로그인 정보 삭제 중...').start();
    try {
      if (existsSync(CONFIG_PATH)) {
        writeFileSync(CONFIG_PATH, '{}');
        confirmSpinner.succeed(chalk.green('자동 로그인 정보가 삭제되었습니다.'));
      } else {
        confirmSpinner.info(chalk.yellow('삭제할 정보가 없습니다.'));
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      confirmSpinner.fail(chalk.red('삭제 실패'));
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  } else if (settingsAction.action === 'check_update') {
    await checkForUpdates();
  }
}