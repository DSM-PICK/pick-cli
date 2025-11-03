import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api from '../api.js';

export async function handleEarlyReturn() {
  console.clear();

  console.log(boxen(chalk.yellow.bold('🏃 조기 귀가'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'yellow'
  }));

  const action = await prompts({
    type: 'select',
    name: 'action',
    message: '원하는 작업을 선택하세요:',
    choices: [
      { title: '📝 새 조기 귀가 신청', value: 'create' },
      { title: '📋 내 조기 귀가 신청 조회', value: 'view' },
      { title: '🔙 돌아가기', value: 'back' }
    ]
  });

  if (action.action === 'create') {
    const form = await prompts([
      {
        type: 'text',
        name: 'reason',
        message: '조기 귀가 사유를 입력하세요:',
        validate: value => value.length > 0 || '사유를 입력해주세요'
      },
      {
        type: 'text',
        name: 'start',
        message: '시작 시간 (HH:MM):',
        validate: value => /^\d{2}:\d{2}$/.test(value) || 'HH:MM 형식으로 입력해주세요'
      }
    ]);

    if (form.reason && form.start) {
      const spinner = ora('조기 귀가 신청 중...').start();
      try {
        await api.createEarlyReturn({
          reason: form.reason,
          start: form.start
        });
        spinner.succeed(chalk.green('조기 귀가 신청이 완료되었습니다!'));
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        spinner.fail(chalk.red(`신청 실패: ${error.message}`));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else if (action.action === 'view') {
    const spinner = ora('조기 귀가 신청 내역 조회 중...').start();
    try {
      const earlyReturn = await api.queryMyEarlyReturn();
      spinner.stop();

      const statusText = earlyReturn.status === 'OK' ? '승인됨' : 
                        earlyReturn.status === 'NO' ? '거부됨' : '대기중';
      const statusColor = earlyReturn.status === 'OK' ? 'green' : 
                         earlyReturn.status === 'NO' ? 'red' : 'yellow';

      console.log(boxen(
        chalk.white.bold('📋 내 조기 귀가 신청 내역\n\n') +
        chalk.white(`사유: ${earlyReturn.reason}\n`) +
        chalk.white(`기간: ${earlyReturn.start_date} ~ ${earlyReturn.end_date}\n`) +
        chalk.white(`시간: ${earlyReturn.start_time} ~ ${earlyReturn.end_time}\n`) +
        chalk.white(`담당 선생님: ${earlyReturn.teacher_name}\n`) +
        chalk[statusColor](`상태: ${statusText}`),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: statusColor
        }
      ));

      await prompts({
        type: 'text',
        name: 'continue',
        message: chalk.gray('Enter를 눌러 계속...')
      });
    } catch (error) {
      spinner.fail(chalk.red(`조회 실패: ${error.message}`));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}