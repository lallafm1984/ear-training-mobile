const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');
const CONSUMER_RULES_MARKER = '// melodygen-scoped-amazon-consumer-rules';

/** prebuild를 다시 해도 릴리스 R8 난독화·최적화 설정을 유지한다. */
module.exports = function withAndroidReleaseOptimization(config) {
  config = withGradleProperties(config, (mod) => {
    const properties = {
      'android.enableMinifyInReleaseBuilds': 'true',
      'android.enableShrinkResourcesInReleaseBuilds': 'true',
      'android.enableR8.fullMode': 'true',
    };
    mod.modResults = mod.modResults.filter(
      (item) => item.type !== 'property' || !Object.hasOwn(properties, item.key),
    );
    for (const [key, value] of Object.entries(properties)) {
      mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });

  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('Android 릴리스 최적화 플러그인은 Groovy build.gradle이 필요합니다.');
    }
    const defaults = /getDefaultProguardFile\((['"])proguard-android(?:-optimize)?\.txt\1\)/;
    if (!defaults.test(mod.modResults.contents)) {
      throw new Error('Android 릴리스의 기본 ProGuard 규칙 위치를 찾지 못했습니다.');
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      defaults,
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    );
    const ownedBlock =
      /^\/\/ melodygen-scoped-amazon-consumer-rules\nandroid\.buildTypes\.named\("release"\) \{[\s\S]*?\n\}\n?/m;
    if (
      mod.modResults.contents.includes(CONSUMER_RULES_MARKER) &&
      !ownedBlock.test(mod.modResults.contents)
    ) {
      throw new Error('기존 릴리스 호환성 블록의 형식이 바뀌었습니다. native 설정을 확인하세요.');
    }
    // purchases-store-amazon 9.29.0의 -dontoptimize만 앱 전체에 전파되지 않게 한다.
    // 해당 버전의 나머지 보호 규칙은 별도 파일에 동일하게 보존한다.
    mod.modResults.contents =
      mod.modResults.contents.replace(ownedBlock, '').trimEnd() +
      `

${CONSUMER_RULES_MARKER}
android.buildTypes.named("release") {
    optimization.keepRules { rules ->
        rules.ignoreFrom("com.revenuecat.purchases:purchases-store-amazon:9.29.0")
    }
    proguardFiles rootProject.file("../plugins/release-compatibility.pro")
}
`;
    return mod;
  });
};
