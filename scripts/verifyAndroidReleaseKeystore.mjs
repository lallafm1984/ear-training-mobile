import { spawnSync } from 'node:child_process';
import { getAndroidSigningConfig } from './androidLocalBuildEnv.mjs';

const listAliasesOnly = process.argv.includes('--list-aliases');

try {
  const signing = getAndroidSigningConfig({
    requireKeyAlias: !listAliasesOnly,
    requireKeyPassword: !listAliasesOnly,
  });

  const args = [
    '-list',
    '-v',
    '-keystore',
    signing.keystorePathAbsolute,
    '-storepass',
    signing.keystorePassword,
  ];

  if (!listAliasesOnly) {
    args.push('-alias', signing.keyAlias);
  }

  const result = spawnSync('keytool', args, {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(output || 'keytool 검증에 실패했습니다.');
  }

  if (listAliasesOnly) {
    const aliasLines = result.stdout
      .split(/\r?\n/)
      .filter((line) => /Alias name:|alias name:|별칭/i.test(line));
    console.log(aliasLines.join('\n') || 'alias 목록을 출력하지 못했습니다.');
    console.log('필요한 alias를 MELODYGEN_ANDROID_KEY_ALIAS에 입력하세요.');
  } else {
    console.log('Android 릴리스 키스토어 검증 완료');
    console.log(`- keystorePath: ${signing.keystorePath}`);
    console.log(`- keyAlias: ${signing.keyAlias}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
