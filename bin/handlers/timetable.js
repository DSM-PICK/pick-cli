import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api from '../api.js';

export async function handleTimetable() {
  console.clear();
  console.log(boxen(chalk.blue.bold('📚 시간표+자감쌤'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue'
  }));
  const date = (() => {
    const date = new Date();
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  })();

  const spinner = ora('시간표 로딩 중...').start();
  try {
    const [timetable, selfStudyTeacher] = await Promise.all([api.getTodayTimetable(), api.queryTodaySelfStudyTeacher({ date })]);
    spinner.stop();

    console.log(boxen(
      chalk.blue.bold(`📅 ${timetable.date}\n\n`) +
      Object.entries(timetable.timetables || {})
        .map(([period, subject]) =>
          chalk.white(`${parseInt(period) + 1}교시: ${subject?.subject_name || '정보 없음'}`)
        ).join('\n') +
      chalk.blueBright.bold(`\n\n👀 자습감독선생님\n`) +
      (selfStudyTeacher.length === 0 ?
        chalk.white('자감쌤이 없습니다') :
        selfStudyTeacher.map(({ floor, teacher_name }) =>
          chalk.white(`${floor}층: ${teacher_name} 선생님`)
        ).join('\n')
      ),
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