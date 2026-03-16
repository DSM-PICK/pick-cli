import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api from '../api.js';

let userInfo = null;

async function showUserInfo() {
  if (!userInfo) {
    const spinner = ora('사용자 정보 로딩 중...').start();
    try {
      userInfo = await api.queryUserSimpleInfo();
      spinner.stop();
    } catch (error) {
      spinner.fail('사용자 정보 로드 실패');
      return;
    }
  }

  const userBox = boxen(
    chalk.white.bold(`👤 ${userInfo.user_name}\n`) +
    chalk.gray(`${userInfo.grade}학년 ${userInfo.class_num}반 ${userInfo.num}번`),
    {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: 'blue'
    }
  );

  console.log(userBox);
}

export async function showMainMenu() {
  console.clear();

  await showUserInfo();

  const choice = await prompts({
    type: 'select',
    name: 'action',
    message: chalk.cyan('원하는 기능을 선택하세요'),
    choices: [
      { title: '📅 시간표 조회', value: 'timetable' },
      { title: '🍚 급식', value: 'meal' },
      { title: '🏃 조기 귀가', value: 'early_return' },
      { title: '📝 외출 신청', value: 'application' },
      { title: '🏫 교실 이동', value: 'classroom' },
      { title: '⚙️ 설정', value: 'settings' },
      { title: '🚪 종료', value: 'exit' }
    ]
  });

  return choice.action;
}

export async function initUserInfo() {
  try {
    userInfo = await api.queryUserSimpleInfo();
  } catch (error) {
    console.log(chalk.yellow('사용자 정보 로드 실패'));
  }
}
