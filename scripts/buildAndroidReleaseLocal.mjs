import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  getAndroidOutputDir,
  getAndroidSigningConfig,
  projectRoot,
} from './androidLocalBuildEnv.mjs';

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return result.status === 0;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 실패`);
  }
}

function requireAndroidSdk() {
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    throw new Error('ANDROID_HOME 또는 ANDROID_SDK_ROOT가 필요합니다. Android Studio SDK 경로를 설정하세요.');
  }
}

function incrementAndroidVersionCode() {
  const appJsonPath = path.join(projectRoot, 'app.json');
  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const currentVersionCode = appConfig?.expo?.android?.versionCode;

  if (!Number.isInteger(currentVersionCode)) {
    throw new Error('app.json의 expo.android.versionCode가 숫자가 아닙니다.');
  }

  const nextVersionCode = currentVersionCode + 1;
  appConfig.expo.android.versionCode = nextVersionCode;
  fs.writeFileSync(appJsonPath, `${JSON.stringify(appConfig, null, 2)}\n`);
  return nextVersionCode;
}

try {
  getAndroidSigningConfig();
  requireAndroidSdk();

  if (!commandExists('keytool', ['-help'])) {
    throw new Error('keytool을 찾지 못했습니다. Java JDK 설치 상태를 확인하세요.');
  }

  const easCliBin = process.env.EAS_CLI_BIN;
  if (!easCliBin && !commandExists('npx')) {
    throw new Error('npx를 찾지 못했습니다. Node.js LTS와 npm을 먼저 설치하세요.');
  }

  run(process.execPath, ['scripts/createAndroidLocalCredentials.mjs']);

  const versionCode = incrementAndroidVersionCode();
  const { outputDirAbsolute } = getAndroidOutputDir();
  fs.mkdirSync(outputDirAbsolute, { recursive: true });

  const outputPath = path.join(outputDirAbsolute, `melodygen-android-v${versionCode}.aab`);
  const easArgs = [
    'build',
    '-p',
    'android',
    '--profile',
    'production',
    '--local',
    '--non-interactive',
    '--output',
    outputPath,
  ];

  if (easCliBin) {
    run(easCliBin, easArgs);
  } else {
    run('npx', ['eas-cli@latest', ...easArgs]);
  }

  console.log(`Android 로컬 릴리스 빌드 완료: ${outputPath}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
