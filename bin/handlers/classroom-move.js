import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api from '../api.js';

const moveTable = [
  ["산학협력부", "새롬홀", "무한 상상실", "청죽관", "탁구실", "운동장", "밴드부실"],
  [
    "3-1",
    "3-2",
    "3-3",
    "3-4",
    "세미나실 2-1",
    "세미나실 2-2",
    "세미나실 2-3",
    "SW 1실",
    "SW 2실",
    "SW 3실",
    "본부교무실",
    "제 3교무실",
    "카페테리아",
    "창조실",
    "방송실",
    "진로 상담실",
    "여자 헬스장",
  ],
  ["2-1", "2-2", "2-3", "2-4", "세미나실 3-1", "세미나실 3-2", "세미나실 3-3", "보안 1실", "보안 2실", "제 2교무실", "그린존", "남자 헬스장"],
  ["1-1", "1-2", "1-3", "1-4", "세미나실 4-1", "세미나실 4-2", "세미나실 4-3", "세미나실 4-4", "임베 1실", "임베 2실", "제 1교무실"],
  ["음악실", "상담실", "수학실", "과학실", "음악 준비실"],
];

export async function handleClassroom() {
  console.clear();

  console.log(boxen(chalk.magenta.bold('🏠 교실 이동'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'magenta'
  }));

  const action = await prompts({
    type: 'select',
    name: 'action',
    message: '원하는 작업을 선택하세요:',
    choices: [
      { title: '🚀 교실 이동 신청', value: 'move' },
      { title: '📍 현재 위치 조회', value: 'view' },
      { title: '🔙 돌아가기', value: 'back' }
    ]
  });

  if (action.action === 'move') {
    const floorChoice = await prompts({
      type: 'select',
      name: 'floor',
      message: '층수를 선택하세요:',
      choices: moveTable.map((_, index) => ({
        title: `${index + 1}층`,
        value: index + 1
      }))
    });

    if (!floorChoice.floor) return;

    const classroomChoice = await prompts({
      type: 'select',
      name: 'classroom_name',
      message: '교실을 선택하세요:',
      choices: moveTable[floorChoice.floor - 1].map(classroom => ({
        title: classroom,
        value: classroom
      }))
    });

    if (!classroomChoice.classroom_name) return;

    const form = await prompts([
      {
        type: 'number',
        name: 'start',
        message: '시작 교시를 입력하세요 (1-10):',
        validate: value => (value >= 1 && value <= 10) || '1-10 사이의 교시를 입력해주세요'
      },
      {
        type: 'number',
        name: 'end',
        message: '종료 교시를 입력하세요 (1-10):',
        validate: value => (value >= 1 && value <= 10) || '1-10 사이의 교시를 입력해주세요'
      }
    ]);

    if (form.start && form.end) {
      if (form.start > form.end) {
        console.log(chalk.red('시작 교시가 종료 교시보다 클 수 없습니다.'));
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
      }

      const spinner = ora('교실 이동 신청 중...').start();
      try {
        await api.moveClassroom({
          floor: floorChoice.floor,
          classroom_name: classroomChoice.classroom_name,
          start: form.start + "교시",
          end: form.end + "교시"
        });
        spinner.succeed(chalk.green('교실 이동 신청이 완료되었습니다!'));
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        spinner.fail(chalk.red(`이동 실패: ${error.message}`));
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } else if (action.action === 'view') {
    const spinner = ora('현재 위치 조회 중...').start();
    try {
      const location = await api.queryMoveClassroom();
      spinner.stop();

      console.log(boxen(
        chalk.white.bold('📍 현재 위치\n\n') +
        chalk.white(location.classroom_name),
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
      spinner.fail(chalk.red(`조회 실패: ${error.message}`));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}