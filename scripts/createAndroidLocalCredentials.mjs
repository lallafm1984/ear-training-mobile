import fs from 'node:fs';
import path from 'node:path';
import { getAndroidSigningConfig, projectRoot } from './androidLocalBuildEnv.mjs';

try {
  const signing = getAndroidSigningConfig();
  const credentialsPath = path.join(projectRoot, 'credentials.json');
  const keystorePathForEas = signing.keystorePath.startsWith('.')
    ? signing.keystorePath
    : `./${signing.keystorePath}`;

  const credentials = {
    android: {
      keystore: {
        keystorePath: keystorePathForEas,
        keystorePassword: signing.keystorePassword,
        keyAlias: signing.keyAlias,
        keyPassword: signing.keyPassword,
      },
    },
  };

  fs.writeFileSync(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.chmodSync(credentialsPath, 0o600);

  console.log('credentials.json 생성 완료');
  console.log(`- keystorePath: ${keystorePathForEas}`);
  console.log('- 비밀번호 값은 출력하지 않았습니다.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
