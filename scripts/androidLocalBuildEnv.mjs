import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const projectRoot = path.resolve(scriptDir, '..');
export const defaultKeystorePath = 'credentials/android/melodygen-release.jks';
export const defaultOutputDir = 'build';

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadLocalEnv() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = stripQuotes(rawValue);
    }
  }
}

export function resolveProjectPath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(projectRoot, inputPath);
}

export function getAndroidSigningConfig(options = {}) {
  const {
    requireStorePassword = true,
    requireKeyAlias = true,
    requireKeyPassword = true,
  } = options;

  loadLocalEnv();

  const keystorePath = process.env.MELODYGEN_ANDROID_KEYSTORE_PATH || defaultKeystorePath;
  const keystorePathAbsolute = resolveProjectPath(keystorePath);
  const keystorePassword = process.env.MELODYGEN_ANDROID_KEYSTORE_PASSWORD || '';
  const keyAlias = process.env.MELODYGEN_ANDROID_KEY_ALIAS || '';
  const keyPassword = process.env.MELODYGEN_ANDROID_KEY_PASSWORD || keystorePassword;

  const missing = [];
  if (!fs.existsSync(keystorePathAbsolute)) {
    missing.push(`MELODYGEN_ANDROID_KEYSTORE_PATH 파일 없음: ${keystorePath}`);
  }
  if (requireStorePassword && !keystorePassword) {
    missing.push('MELODYGEN_ANDROID_KEYSTORE_PASSWORD');
  }
  if (requireKeyAlias && !keyAlias) {
    missing.push('MELODYGEN_ANDROID_KEY_ALIAS');
  }
  if (requireKeyPassword && !keyPassword) {
    missing.push('MELODYGEN_ANDROID_KEY_PASSWORD');
  }

  if (missing.length > 0) {
    throw new Error(
      [
        'Android 릴리스 서명 설정이 아직 완성되지 않았습니다.',
        ...missing.map((item) => `- ${item}`),
        '',
        '.env.local.example을 .env.local로 복사한 뒤 값을 채워주세요.',
      ].join('\n'),
    );
  }

  return {
    keystorePath,
    keystorePathAbsolute,
    keystorePassword,
    keyAlias,
    keyPassword,
  };
}

export function getAndroidOutputDir() {
  loadLocalEnv();
  const outputDir = process.env.MELODYGEN_ANDROID_OUTPUT_DIR || defaultOutputDir;
  return {
    outputDir,
    outputDirAbsolute: resolveProjectPath(outputDir),
  };
}
