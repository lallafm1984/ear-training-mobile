/* eslint-disable no-console -- 모든 콘솔 출력은 이 개발 전용 경계에서만 허용한다. */

type LogArguments = unknown[];

export const logger = {
  debug(...args: LogArguments): void {
    if (__DEV__) console.log(...args);
  },
  warn(...args: LogArguments): void {
    if (__DEV__) console.warn(...args);
  },
  error(...args: LogArguments): void {
    if (__DEV__) console.error(...args);
  },
};
