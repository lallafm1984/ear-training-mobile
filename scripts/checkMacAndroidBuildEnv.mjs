import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadLocalEnv } from './androidLocalBuildEnv.mjs';

loadLocalEnv();

function run(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return {
    ok: result.status === 0,
    output: output.split(/\r?\n/)[0] || '',
  };
}

function commandCheck(label, command, args) {
  const result = run(command, args);
  return {
    label,
    ok: result.ok,
    detail: result.ok ? result.output : `${command}를 PATH에서 찾지 못했습니다.`,
  };
}

function androidSdkCheck() {
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(os.homedir(), 'Library/Android/sdk');

  const exists = fs.existsSync(sdkRoot);
  return {
    label: 'Android SDK',
    ok: exists,
    detail: exists ? sdkRoot : 'ANDROID_HOME 또는 ANDROID_SDK_ROOT를 설정하세요.',
    sdkRoot,
  };
}

function adbCheck(sdkRoot) {
  const pathResult = run('adb', ['version']);
  if (pathResult.ok) {
    return {
      label: 'adb',
      ok: true,
      detail: pathResult.output,
    };
  }

  const sdkAdb = path.join(sdkRoot, 'platform-tools', 'adb');
  return {
    label: 'adb',
    ok: fs.existsSync(sdkAdb),
    detail: fs.existsSync(sdkAdb)
      ? `${sdkAdb} 존재, PATH 추가 필요`
      : 'platform-tools/adb를 찾지 못했습니다.',
  };
}

const sdk = androidSdkCheck();
const checks = [
  {
    label: 'node',
    ok: true,
    detail: process.version,
  },
  commandCheck('npm', 'npm', ['--version']),
  commandCheck('npx', 'npx', ['--version']),
  commandCheck('java', 'java', ['-version']),
  commandCheck('keytool', 'keytool', ['-help']),
  sdk,
  adbCheck(sdk.sdkRoot),
];

let failed = false;
for (const check of checks) {
  const mark = check.ok ? 'OK' : 'MISSING';
  console.log(`[${mark}] ${check.label}: ${check.detail}`);
  if (!check.ok) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
