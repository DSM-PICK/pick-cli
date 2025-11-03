import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api from '../api.js';

export async function handleApplication() {
  console.clear();

  console.log(boxen(chalk.green.bold('🚪 외출 신청'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'green'
  }));

  const action = await prompts({
    type: 'select',
    name: 'action',
    message: '원하는 작업을 선택하세요:',
    choices: [
      { title: '📝 새 외출 신청', value: 'create' },
      { title: '📋 내 외출 신청 조회', value: 'view' },
      { title: '🔙 돌아가기', value: 'back' }
    ]
  });

  if (action.action === 'create') {
    const form = await prompts([
      {
        type: 'text',
        name: 'reason',
        message: '외출 사유를 입력하세요:',
        validate: value => value.length > 0 || '사유를 입력해주세요'
      },
      {
        type: 'select',
        name: 'application_type',
        message: '신청 유형을 선택하세요:',
        choices: [
          { title: '⏰ 시간 기준 (TIME)', value: 'TIME' },
          { title: '📚 교시 기준 (PERIOD)', value: 'PERIOD' }
        ]
      }
    ]);

    if (!form.reason || !form.application_type) return;

    let timeForm;
    if (form.application_type === 'TIME') {
      timeForm = await prompts([
        {
          type: 'text',
          name: 'start',
          message: '시작 시간 (HH:MM):',
          validate: value => /^\d{2}:\d{2}$/.test(value) || 'HH:MM 형식으로 입력해주세요'
        },
        {
          type: 'text',
          name: 'end',
          message: '종료 시간 (HH:MM):',
          validate: value => /^\d{2}:\d{2}$/.test(value) || 'HH:MM 형식으로 입력해주세요'
        }
      ]);
    } else {
      timeForm = await prompts([
        {
          type: 'number',
          name: 'start',
          message: '시작 교시 (1-10):',
          validate: value => (value >= 1 && value <= 10) || '1-10 사이의 교시를 입력해주세요'
        },
        {
          type: 'number',
          name: 'end',
          message: '종료 교시 (1-10):',
          validate: value => (value >= 1 && value <= 10) || '1-10 사이의 교시를 입력해주세요'
        }
      ]);
    }

    if (timeForm.start && timeForm.end) {
      const spinner = ora('외출 신청 중...').start();
      try {
        await api.application({
          reason: form.reason,
          start: form.application_type === 'TIME' ? timeForm.start : timeForm.start.toString() + "교시",
          end: form.application_type === 'TIME' ? timeForm.end : timeForm.end.toString() + "교시",
          application_type: form.application_type
        });
        spinner.succeed(chalk.green('외출 신청이 완료되었습니다!'));
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        spinner.fail(chalk.red(`신청 실패: ${error.message}`));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else if (action.action === 'view') {
    const spinner = ora('외출 신청 내역 조회 중...').start();
    try {
      const application = await api.queryMyApplication();
      spinner.stop();

      const statusText = application.status === 'OK' ? '승인됨' : 
                        application.status === 'NO' ? '거부됨' : '대기중';
      const statusColor = application.status === 'OK' ? 'green' : 
                         application.status === 'NO' ? 'red' : 'yellow';

      console.log(boxen(
        chalk.white.bold('📋 내 외출 신청 내역\n\n') +
        chalk.white(`사유: ${application.reason}\n`) +
        chalk.white(`기간: ${application.start_date} ~ ${application.end_date}\n`) +
        chalk.white(`시간: ${application.start_time} ~ ${application.end_time}\n`) +
        chalk.white(`담당 선생님: ${application.teacher_name}\n`) +
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