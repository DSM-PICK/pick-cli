import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api from '../api.js';

export async function handleWeekendMeal() {
  console.clear();

  console.log(boxen(chalk.blue.bold('🍽️ 주말 급식 신청'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue'
  }));

  const spinner = ora('주말 급식 상태 확인 중...').start();
  try {
    const status = await api.queryMyWeekendMealStatus();
    spinner.stop();

    const currentStatus = status.status === 'OK' ? '신청됨' : '미신청';
    console.log(boxen(
      chalk.white(`현재 상태: ${chalk.bold(currentStatus)}`),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: status.status === 'OK' ? 'green' : 'yellow'
      }
    ));

    const action = await prompts({
      type: 'select',
      name: 'action',
      message: '어떤 작업을 하시겠습니까?',
      choices: [
        { title: '✅ 신청하기', value: 'OK' },
        { title: '❌ 취소하기', value: 'NO' },
        { title: '🔙 돌아가기', value: 'back' }
      ]
    });

    if (action.action !== 'back') {
      const updateSpinner = ora('상태 변경 중...').start();
      try {
        await api.changeStatus({ status: action.action });
        updateSpinner.succeed(chalk.green('상태가 변경되었습니다!'));
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
        updateSpinner.fail(chalk.red(`변경 실패: ${error.message}`));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    spinner.fail(chalk.red(`오류: ${error.message}`));
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}