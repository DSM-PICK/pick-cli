import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import api, { userTokenRefresh } from '../api.js';
import { saveConfig, loadConfig, clearSavedAuth } from '../utils/config.js';

function saveRefreshToken(refreshToken) {
  const config = loadConfig();
  saveConfig({
    ...config,
    auth: {
      refreshToken
    }
  });
}

async function tryRefreshTokenLogin(refreshToken) {
  const response = await userTokenRefresh({
    'X-Refresh-Token': refreshToken
  });

  api.accessToken.set(response.access_token);

  if (response.refresh_token) {
    saveRefreshToken(response.refresh_token);
  }
}

async function tryLegacyCredentialLogin(credentials) {
  const response = await api.login({ ...credentials, device_token: '' });
  api.accessToken.set(response.access_token);

  if (response.refresh_token) {
    saveRefreshToken(response.refresh_token);
  }

  const config = loadConfig();
  delete config.credentials;
  saveConfig(config);
}

export async function login(autoLogin = false) {
  const config = loadConfig();

  if (autoLogin && config?.auth?.refreshToken) {
    const spinner = ora('자동 로그인 중...').start();
    try {
      await tryRefreshTokenLogin(config.auth.refreshToken);
      spinner.succeed(chalk.green('자동 로그인 성공'));
      await new Promise((resolve) => setTimeout(resolve, 800));
      console.clear();
      return true;
    } catch (error) {
      clearSavedAuth();
      spinner.fail(chalk.yellow('자동 로그인 실패 - 수동 로그인을 진행합니다'));
      await new Promise((resolve) => setTimeout(resolve, 1200));
      console.clear();
    }
  } else if (autoLogin && config?.credentials) {
    const spinner = ora('자동 로그인 중...').start();
    try {
      await tryLegacyCredentialLogin(config.credentials);
      spinner.succeed(chalk.green('자동 로그인 성공'));
      await new Promise((resolve) => setTimeout(resolve, 800));
      console.clear();
      return true;
    } catch (error) {
      clearSavedAuth();
      spinner.fail(chalk.yellow('자동 로그인 실패 - 수동 로그인을 진행합니다'));
      await new Promise((resolve) => setTimeout(resolve, 1200));
      console.clear();
    }
  }

  console.log(boxen(chalk.cyan.bold('🔐 DSM PiCK CLI - 로그인'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan'
  }));

  const credentials = await prompts([
    {
      type: 'text',
      name: 'account_id',
      message: chalk.blue('아이디를 입력하세요'),
      validate: (value) => value.length > 0 || '아이디를 입력해 주세요'
    },
    {
      type: 'password',
      name: 'password',
      message: chalk.blue('비밀번호를 입력하세요'),
      validate: (value) => value.length > 0 || '비밀번호를 입력해 주세요'
    }
  ]);

  if (!credentials.account_id || !credentials.password) {
    console.log(chalk.red('로그인이 취소되었습니다'));
    return false;
  }

  const spinner = ora('로그인 중...').start();
  try {
    const response = await api.login({ ...credentials, device_token: '' });
    api.accessToken.set(response.access_token);
    spinner.succeed(chalk.green('로그인 성공!'));

    const saveLogin = await prompts({
      type: 'confirm',
      name: 'save',
      message: chalk.blue('다음에 자동 로그인하시겠습니까?'),
      initial: true
    });

    if (saveLogin.save && response.refresh_token) {
      saveRefreshToken(response.refresh_token);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.clear();
    return true;
  } catch (error) {
    spinner.fail(chalk.red(`로그인 실패: ${error.message}`));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return false;
  }
}
