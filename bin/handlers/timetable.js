import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api from '../api.js';

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' });
const ANSI_ESCAPE_REGEX = /\x1B\[[0-9;]*m/g;
const WEEK_COLUMN_SEPARATOR = chalk.gray(' │ ');
const BOX_HORIZONTAL_PADDING = 6;

function getCurrentDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function stripAnsi(value) {
  return value.replace(ANSI_ESCAPE_REGEX, '');
}

function getDisplayWidth(value) {
  let width = 0;

  for (const char of stripAnsi(value)) {
    width += char.charCodeAt(0) > 0x00ff ? 2 : 1;
  }

  return width;
}

function padDisplayRight(value, width) {
  const padding = Math.max(width - getDisplayWidth(value), 0);
  return value + ' '.repeat(padding);
}

function getWeekdayLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return WEEKDAY_FORMATTER.format(date);
}

function getTimetableEntries(timetables) {
  if (Array.isArray(timetables)) {
    return timetables.map((subject, index) => [index, subject]);
  }

  if (timetables && typeof timetables === 'object') {
    return Object.entries(timetables)
      .sort(([leftPeriod], [rightPeriod]) => Number(leftPeriod) - Number(rightPeriod));
  }

  return [];
}

function getTimetableLineList(timetables) {
  const entries = getTimetableEntries(timetables);
  if (entries.length === 0) {
    return [chalk.gray('시간표 정보가 없습니다.')];
  }

  return entries.map(([period, subject]) =>
    chalk.white(`${Number.parseInt(period, 10) + 1}교시: ${subject?.subject_name || '정보 없음'}`)
  );
}

function renderTimetableLines(timetables) {
  return getTimetableLineList(timetables).join('\n');
}

function renderSelfStudyTeacherLines(selfStudyTeacher) {
  if (!Array.isArray(selfStudyTeacher) || selfStudyTeacher.length === 0) {
    return chalk.white('자습감독이 없습니다.');
  }

  return selfStudyTeacher
    .map(({ floor, teacher_name }) => chalk.white(`${floor}층 ${teacher_name} 선생님`))
    .join('\n');
}

function createDayTimetableBlock(dayTimetable) {
  const weekday = getWeekdayLabel(dayTimetable?.date);
  const title = weekday
    ? `${dayTimetable.date} (${weekday})`
    : dayTimetable?.date || '날짜 정보 없음';

  return [
    chalk.cyan.bold(title),
    ...getTimetableLineList(dayTimetable?.timetables)
  ];
}

function renderWeekTimetableVertical(weekTimetable) {
  return weekTimetable
    .map((dayTimetable) => createDayTimetableBlock(dayTimetable).join('\n'))
    .join('\n\n');
}

function renderWeekTimetableHorizontal(weekTimetable) {
  const blocks = weekTimetable.map((dayTimetable) => createDayTimetableBlock(dayTimetable));
  const columnWidths = blocks.map((lines) => (
    lines.reduce((maxWidth, line) => Math.max(maxWidth, getDisplayWidth(line)), 0)
  ));

  const contentWidth = columnWidths.reduce((sum, width) => sum + width, 0)
    + getDisplayWidth(WEEK_COLUMN_SEPARATOR) * Math.max(blocks.length - 1, 0);
  const availableWidth = Math.max((process.stdout.columns ?? 80) - BOX_HORIZONTAL_PADDING, 20);

  if (contentWidth > availableWidth) {
    return null;
  }

  const rowCount = Math.max(...blocks.map((lines) => lines.length));

  return Array.from({ length: rowCount }, (_, rowIndex) => (
    blocks
      .map((lines, columnIndex) => padDisplayRight(lines[rowIndex] ?? '', columnWidths[columnIndex]))
      .join(WEEK_COLUMN_SEPARATOR)
  )).join('\n');
}

function renderWeekTimetable(weekTimetable) {
  if (!Array.isArray(weekTimetable) || weekTimetable.length === 0) {
    return chalk.gray('이번 주 시간표 정보가 없습니다.');
  }

  const horizontalLayout = renderWeekTimetableHorizontal(weekTimetable);
  return horizontalLayout ?? renderWeekTimetableVertical(weekTimetable);
}

async function pause() {
  await prompts({
    type: 'text',
    name: 'continue',
    message: chalk.gray('Enter를 눌러 계속...')
  });
}

async function showTodayTimetable() {
  const date = getCurrentDateString();
  const spinner = ora('시간표 로딩 중...').start();

  try {
    const [timetable, selfStudyTeacher] = await Promise.all([
      api.getTodayTimetable(),
      api.queryTodaySelfStudyTeacher({ date })
    ]);
    spinner.stop();

    console.log(boxen(
      chalk.blue.bold(`📅 ${timetable.date}\n\n`) +
      renderTimetableLines(timetable.timetables) +
      chalk.blueBright.bold('\n\n📚 자습감독 선생님\n') +
      renderSelfStudyTeacherLines(selfStudyTeacher),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'blue'
      }
    ));

    await pause();
  } catch (error) {
    spinner.fail(chalk.red(`시간표 로딩 실패: ${error.message}`));
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function showWeekTimetable() {
  const spinner = ora('주간 시간표 로딩 중...').start();

  try {
    const weekTimetable = await api.getWeekTimetable();
    spinner.stop();

    console.log(boxen(
      chalk.blue.bold('🗓️ 이번 주 시간표\n\n') +
      renderWeekTimetable(weekTimetable),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'blue'
      }
    ));

    await pause();
  } catch (error) {
    spinner.fail(chalk.red(`주간 시간표 로딩 실패: ${error.message}`));
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

export async function handleTimetable() {
  console.clear();
  console.log(boxen(chalk.blue.bold('📚 시간표 조회'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue'
  }));

  const action = await prompts({
    type: 'select',
    name: 'action',
    message: '원하는 기능을 선택하세요.',
    choices: [
      { title: '📅 오늘 시간표', value: 'today' },
      { title: '🗓️ 일주일 시간표', value: 'week' },
      { title: '⬅️ 뒤로 가기', value: 'back' }
    ]
  });

  if (action.action === 'today') {
    await showTodayTimetable();
  } else if (action.action === 'week') {
    await showWeekTimetable();
  }
}
