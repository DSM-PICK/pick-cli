import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api from '../api.js';
import { handleWeekendMeal } from './weekend-meal.js';

const MEAL_LABELS = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁'
};

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function renderMealSection(type, meal) {
  const title = MEAL_LABELS[type] || type;
  const hasMenu = Array.isArray(meal?.menu) && meal.menu.length > 0;
  const menuText = hasMenu
    ? meal.menu.map((item) => chalk.white(`• ${item}`)).join('\n')
    : chalk.gray('등록된 식단이 없습니다.');
  const calorieText = meal?.cal
    ? `\n${chalk.gray(`칼로리: ${meal.cal}`)}`
    : '';

  return `${chalk.cyan.bold(`[${title}]`)}\n${menuText}${calorieText}`;
}

async function promptMealDate() {
  const response = await prompts({
    type: 'text',
    name: 'date',
    message: chalk.cyan('조회할 날짜를 입력하세요 (YYYY-MM-DD)'),
    initial: formatDate(new Date()),
    validate: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? true : 'YYYY-MM-DD 형식으로 입력하세요.'
  });

  return response.date;
}

async function handleMealLookup() {
  const date = await promptMealDate();
  if (!date) return;

  const spinner = ora('급식 정보 조회 중...').start();

  try {
    const meal = await api.getMealByDate({ date });
    spinner.stop();

    const sections = ['breakfast', 'lunch', 'dinner']
      .map((type) => renderMealSection(type, meal?.meal_list?.[type]))
      .join('\n\n');

    console.log(boxen(
      chalk.blue.bold(`🍚 ${meal.date || date}\n\n`) + sections,
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
    spinner.fail(chalk.red(`급식 조회 실패: ${error.message}`));
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

export async function handleMeal() {
  console.clear();
  console.log(boxen(chalk.blue.bold('🍚 급식'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue'
  }));

  const action = await prompts({
    type: 'select',
    name: 'action',
    message: '원하는 기능을 선택하세요',
    choices: [
      { title: '🍽️ 날짜별 급식 조회', value: 'lookup' },
      { title: '🗓️ 주말 급식 신청', value: 'weekend' },
      { title: '↩ 뒤로 가기', value: 'back' }
    ]
  });

  if (action.action === 'lookup') {
    await handleMealLookup();
  } else if (action.action === 'weekend') {
    await handleWeekendMeal();
  }
}
