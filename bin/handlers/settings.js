import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { loadConfig, clearSavedAuth } from '../utils/config.js';
import { checkForUpdates, isAutoUpdateEnabled, setAutoUpdateEnabled } from '../utils/updater.js';

export async function handleSettings() {
  console.clear();

  const autoUpdateEnabled = isAutoUpdateEnabled();

  console.log(boxen(
    chalk.magenta.bold('⚙️ 설정\n\n') +
    chalk.white(`자동 업데이트: ${autoUpdateEnabled ? '켜짐' : '꺼짐'}`),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'magenta'
    }
  ));

  const settingsAction = await prompts({
    type: 'select',
    name: 'action',
    message: '설정 메뉴를 선택하세요',
    choices: [
      {
        title: autoUpdateEnabled ? '🔕 자동 업데이트 끄기' : '🔔 자동 업데이트 켜기',
        value: 'toggle_auto_update'
      },
      { title: '🗑️ 자동 로그인 정보 삭제', value: 'clear_login' },
      { title: '🔄 업데이트 확인', value: 'check_update' },
      { title: '↩ 뒤로 가기', value: 'back' }
    ]
  });

  if (settingsAction.action === 'toggle_auto_update') {
    const nextValue = !autoUpdateEnabled;
    setAutoUpdateEnabled(nextValue);

    console.log(boxen(
      chalk.green(`자동 업데이트가 ${nextValue ? '켜졌습니다' : '꺼졌습니다'}.`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    ));

    await new Promise((resolve) => setTimeout(resolve, 1500));
    return;
  }

  if (settingsAction.action === 'clear_login') {
    const confirmSpinner = ora('자동 로그인 정보 삭제 중...').start();
    try {
      const config = loadConfig();

      if (config.auth || config.credentials) {
        clearSavedAuth();
        confirmSpinner.succeed(chalk.green('자동 로그인 정보가 삭제되었습니다.'));
      } else {
        confirmSpinner.info(chalk.yellow('삭제할 자동 로그인 정보가 없습니다.'));
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      confirmSpinner.fail(chalk.red('삭제 실패'));
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } else if (settingsAction.action === 'check_update') {
    await checkForUpdates();
  }
}
