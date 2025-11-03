import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api from '../api.js';

export async function handleTimetable() {
  console.clear();
  console.log(boxen(chalk.blue.bold('📚 오늘 시간표'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue'
  }));

  const spinner = ora('시간표 로딩 중...').start();
  try {
    const timetable = await api.getTodayTimetable();
    spinner.stop();

    console.log(boxen(
      chalk.blue.bold(`📅 ${timetable.date}\n\n`) +
      Object.entries(timetable.timetables || {})
        .map(([period, subject]) =>
          chalk.white(`${parseInt(period) + 1}교시: ${subject?.subject_name || '정보 없음'}`)
        )
        .join('\n'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'blue'
      }
    ));

    await prompts({
      type: 'text',
      name: 'continue',
      message: chalk.gray('Enter를 눌러 계속...')
    });
  } catch (error) {
    spinner.fail(chalk.red(`시간표 로드 실패: ${error.message}`));
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}