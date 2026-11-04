// EAS 로그인 없이 Expo prebuild + Gradle로 Android 릴리스 AAB(또는 APK)를 만드는 스크립트.
//
//   npm run android:build:gradle            # versionCode +1 → prebuild → :app:bundleRelease
//   npm run android:build:gradle -- --no-bump   # versionCode 그대로 다시 빌드
//   npm run android:build:gradle -- --apk       # AAB 대신 APK(:app:assembleRelease)
//   npm run android:build:gradle -- --clean     # android/ 폴더를 지우고 prebuild부터 다시
//   npm run android:build:gradle -- --keep-android  # 기존 android/ 재사용(prebuild 생략)
//
// 서명 정보는 .env.local(MELODYGEN_ANDROID_*)에서 읽어 환경 변수로만 Gradle에 전달하고,
// 비밀값은 어떤 파일에도 쓰지 않고 출력도 하지 않는다.
// 번들에 들어가는 EXPO_PUBLIC_* 값은 eas.json의 build.production.env를 그대로 사용한다.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  getAndroidOutputDir,
  getAndroidSigningConfig,
  projectRoot,
} from './androidLocalBuildEnv.mjs';

const SIGNING_MARKER = '// melodygen-release-signing';

export function parseArgs(argv) {
  return {
    bump: !argv.includes('--no-bump'),
    apk: argv.includes('--apk'),
    clean: argv.includes('--clean'),
    keepAndroid: argv.includes('--keep-android'),
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 실패 (exit ${result.status ?? 'signal'})`);
  }
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function commandExists(command, args = ['--version']) {
  return spawnSync(command, args, { encoding: 'utf8' }).status === 0;
}

function ensureAndroidSdk() {
  if (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT) {
    return process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  }
  const fallback = path.join(os.homedir(), 'Library/Android/sdk');
  if (fs.existsSync(fallback)) {
    process.env.ANDROID_HOME = fallback;
    process.env.ANDROID_SDK_ROOT = fallback;
    return fallback;
  }
  throw new Error('ANDROID_HOME 또는 ANDROID_SDK_ROOT가 필요합니다. Android Studio SDK 경로를 설정하세요.');
}

function warnNonAsciiPath() {
  // 2026-08 릴리스에서 한글 경로 때문에 Gradle/CMake 빌드가 깨져 영문 임시 경로로 옮긴 전례가 있다.
  if (/[^\x20-\x7e]/.test(projectRoot)) {
    console.warn(
      `[경고] 프로젝트 경로에 ASCII 이외 문자가 있습니다: ${projectRoot}\n` +
        '       네이티브 빌드(CMake/NDK/Hermes)가 실패하면 영문 경로 워크트리에서 다시 실행하세요.',
    );
  }
}

export function loadProductionPublicEnv(easJsonText) {
  const easConfig = JSON.parse(easJsonText);
  const env = easConfig?.build?.production?.env ?? {};
  const applied = [];
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('EXPO_PUBLIC_')) {
      continue;
    }
    if (process.env[key] === undefined) {
      process.env[key] = String(value);
      applied.push(key);
    }
  }
  return { env, applied };
}

export function bumpVersionCode(appJsonText) {
  const appConfig = JSON.parse(appJsonText);
  const current = appConfig?.expo?.android?.versionCode;
  if (!Number.isInteger(current)) {
    throw new Error('app.json의 expo.android.versionCode가 숫자가 아닙니다.');
  }
  // JSON.stringify로 다시 쓰면 Prettier 서식이 깨져 diff가 커지므로 해당 줄만 바꾼다.
  const pattern = new RegExp(`("versionCode":\\s*)${current}\\b`, 'g');
  const matches = appJsonText.match(pattern) ?? [];
  if (matches.length !== 1) {
    throw new Error(`app.json에서 "versionCode": ${current} 줄을 정확히 하나 찾지 못했습니다.`);
  }
  return {
    text: appJsonText.replace(pattern, `$1${current + 1}`),
    previous: current,
    next: current + 1,
    versionName: appConfig.expo.version,
  };
}

export function readVersion(appJsonText) {
  const appConfig = JSON.parse(appJsonText);
  return {
    versionCode: appConfig?.expo?.android?.versionCode,
    versionName: appConfig?.expo?.version,
  };
}

// Expo 템플릿 build.gradle의 signingConfigs에 release 설정을 넣고
// buildTypes.release가 그것을 쓰도록 바꾼다. 비밀값은 System.getenv로만 읽는다.
export function patchBuildGradle(gradleText) {
  if (gradleText.includes(SIGNING_MARKER)) {
    return { text: gradleText, changed: false };
  }

  const signingIdx = gradleText.indexOf('signingConfigs {');
  if (signingIdx < 0) {
    throw new Error('android/app/build.gradle에서 signingConfigs 블록을 찾지 못했습니다.');
  }
  const signingLineEnd = gradleText.indexOf('\n', signingIdx);
  const releaseSigning = [
    '',
    `        release { ${SIGNING_MARKER}`,
    '            storeFile file(System.getenv("MELODYGEN_ANDROID_KEYSTORE_FILE"))',
    '            storePassword System.getenv("MELODYGEN_ANDROID_KEYSTORE_PASSWORD")',
    '            keyAlias System.getenv("MELODYGEN_ANDROID_KEY_ALIAS")',
    '            keyPassword System.getenv("MELODYGEN_ANDROID_KEY_PASSWORD")',
    '        }',
  ].join('\n');
  let text =
    gradleText.slice(0, signingLineEnd) + releaseSigning + gradleText.slice(signingLineEnd);

  const buildTypesIdx = text.indexOf('buildTypes {');
  if (buildTypesIdx < 0) {
    throw new Error('android/app/build.gradle에서 buildTypes 블록을 찾지 못했습니다.');
  }
  const releaseIdx = text.indexOf('release {', buildTypesIdx);
  if (releaseIdx < 0) {
    throw new Error('android/app/build.gradle에서 buildTypes.release 블록을 찾지 못했습니다.');
  }
  const target = 'signingConfig signingConfigs.debug';
  const targetIdx = text.indexOf(target, releaseIdx);
  if (targetIdx < 0) {
    throw new Error('buildTypes.release의 signingConfig signingConfigs.debug 줄을 찾지 못했습니다.');
  }
  text =
    text.slice(0, targetIdx) +
    'signingConfig signingConfigs.release' +
    text.slice(targetIdx + target.length);

  return { text, changed: true };
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function extractSha256(text) {
  const match = text.match(/SHA256:\s*([0-9A-Fa-f:]{95})/);
  return match ? match[1].replace(/:/g, '').toLowerCase() : null;
}

function verifyArtifact(artifactPath, signing, publicEnv) {
  const report = [];

  const printcert = capture('keytool', ['-printcert', '-jarfile', artifactPath]);
  const artifactCert = extractSha256(printcert.stdout);
  report.push(`- 산출물 서명 인증서 SHA-256: ${artifactCert ?? '확인 실패'}`);

  const keystoreList = capture('keytool', [
    '-list',
    '-v',
    '-keystore',
    signing.keystorePathAbsolute,
    '-storepass',
    signing.keystorePassword,
    '-alias',
    signing.keyAlias,
  ]);
  const keystoreCert = extractSha256(keystoreList.stdout);
  if (artifactCert && keystoreCert) {
    report.push(
      artifactCert === keystoreCert
        ? `- 키스토어(${signing.keystorePath}) 인증서와 일치`
        : `- [경고] 키스토어 인증서(${keystoreCert})와 다릅니다`,
    );
  } else {
    report.push('- [경고] 키스토어 인증서 지문을 비교하지 못했습니다');
  }

  if (commandExists('jarsigner', ['-help'])) {
    const verify = capture('jarsigner', ['-verify', artifactPath]);
    const firstLine =
      (verify.stdout + verify.stderr)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => /verified|확인|오류|error/i.test(line)) ?? '';
    report.push(`- jarsigner -verify: ${verify.ok ? '통과' : '실패'} ${firstLine}`.trim());
  }

  const supabaseUrl = publicEnv.EXPO_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && commandExists('unzip', ['-v'])) {
    const host = new URL(supabaseUrl).host;
    const bundle = spawnSync('unzip', ['-p', artifactPath, 'base/assets/index.android.bundle'], {
      maxBuffer: 256 * 1024 * 1024,
    });
    if (bundle.status === 0 && bundle.stdout) {
      const found = bundle.stdout.includes(host);
      report.push(
        found
          ? `- JS 번들에 Supabase 호스트(${host}) 포함 확인`
          : `- [경고] JS 번들에서 Supabase 호스트(${host})를 찾지 못했습니다. EXPO_PUBLIC_* 환경 변수를 확인하세요`,
      );
    } else {
      report.push('- JS 번들 검사 생략(base/assets/index.android.bundle 추출 실패 또는 APK)');
    }
  }

  const stats = fs.statSync(artifactPath);
  report.push(`- 크기: ${(stats.size / (1024 * 1024)).toFixed(1)} MB`);
  report.push(`- 파일 SHA-256: ${sha256File(artifactPath)}`);
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const startedAt = Date.now();

  const signing = getAndroidSigningConfig();
  const sdkRoot = ensureAndroidSdk();
  warnNonAsciiPath();

  if (!commandExists('keytool', ['-help'])) {
    throw new Error('keytool을 찾지 못했습니다. Java JDK 17 설치 상태를 확인하세요.');
  }
  if (!commandExists('npx')) {
    throw new Error('npx를 찾지 못했습니다. Node.js LTS와 npm을 먼저 설치하세요.');
  }

  const easJsonPath = path.join(projectRoot, 'eas.json');
  const { env: publicEnv, applied } = loadProductionPublicEnv(fs.readFileSync(easJsonPath, 'utf8'));
  console.log(
    `[1/5] 환경 준비: ANDROID_HOME=${sdkRoot}, eas.json production env 적용: ${
      applied.length > 0 ? applied.join(', ') : '(이미 설정됨)'
    }`,
  );

  const appJsonPath = path.join(projectRoot, 'app.json');
  let version;
  if (options.bump) {
    const bumped = bumpVersionCode(fs.readFileSync(appJsonPath, 'utf8'));
    fs.writeFileSync(appJsonPath, bumped.text);
    version = { versionCode: bumped.next, versionName: bumped.versionName };
    console.log(`[2/5] app.json versionCode ${bumped.previous} → ${bumped.next} (version ${bumped.versionName})`);
  } else {
    version = readVersion(fs.readFileSync(appJsonPath, 'utf8'));
    console.log(`[2/5] versionCode 유지: ${version.versionCode} (version ${version.versionName})`);
  }

  const androidDir = path.join(projectRoot, 'android');
  if (options.clean && fs.existsSync(androidDir)) {
    fs.rmSync(androidDir, { recursive: true, force: true });
    console.log('      기존 android/ 폴더 삭제');
  }
  if (options.keepAndroid && fs.existsSync(androidDir)) {
    console.log('[3/5] prebuild 생략: 기존 android/ 재사용 (app.json 변경은 반영되지 않을 수 있음)');
  } else {
    console.log('[3/5] npx expo prebuild --platform android --no-install');
    run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], {
      env: { ...process.env, CI: '1' },
    });
  }

  const gradlePath = path.join(androidDir, 'app', 'build.gradle');
  const patched = patchBuildGradle(fs.readFileSync(gradlePath, 'utf8'));
  if (patched.changed) {
    fs.writeFileSync(gradlePath, patched.text);
    console.log('      android/app/build.gradle에 release 서명 설정 추가(환경 변수 참조)');
  }

  const gradleTask = options.apk ? ':app:assembleRelease' : ':app:bundleRelease';
  console.log(`[4/5] ./gradlew ${gradleTask}`);
  run('./gradlew', [gradleTask], {
    cwd: androidDir,
    env: {
      ...process.env,
      MELODYGEN_ANDROID_KEYSTORE_FILE: signing.keystorePathAbsolute,
      MELODYGEN_ANDROID_KEYSTORE_PASSWORD: signing.keystorePassword,
      MELODYGEN_ANDROID_KEY_ALIAS: signing.keyAlias,
      MELODYGEN_ANDROID_KEY_PASSWORD: signing.keyPassword,
    },
  });

  const built = options.apk
    ? path.join(androidDir, 'app/build/outputs/apk/release/app-release.apk')
    : path.join(androidDir, 'app/build/outputs/bundle/release/app-release.aab');
  if (!fs.existsSync(built)) {
    throw new Error(`빌드 산출물을 찾지 못했습니다: ${built}`);
  }

  const { outputDirAbsolute } = getAndroidOutputDir();
  fs.mkdirSync(outputDirAbsolute, { recursive: true });
  const outputPath = path.join(
    outputDirAbsolute,
    `melodygen-android-v${version.versionCode}.${options.apk ? 'apk' : 'aab'}`,
  );
  fs.copyFileSync(built, outputPath);

  console.log('[5/5] 산출물 검증');
  const report = verifyArtifact(outputPath, signing, publicEnv);
  const minutes = ((Date.now() - startedAt) / 60000).toFixed(1);

  console.log('');
  console.log(`Android 릴리스 빌드 완료 (${minutes}분): ${outputPath}`);
  console.log(`- versionName ${version.versionName}, versionCode ${version.versionCode}`);
  for (const line of report) {
    console.log(line);
  }
  console.log('');
  console.log('다음 단계: app.json(versionCode)만 커밋하세요. android/와 build/는 .gitignore 대상입니다.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
