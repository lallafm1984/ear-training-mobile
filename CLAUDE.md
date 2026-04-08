
언어는 무조건 한국어를 사용한다.

## 데이터 아키텍처 원칙

- **로그인/계정 관련** (인증, 프로필, 구독 상태): Supabase API 사용 허용
- **컨텐츠 관련** (연습 기록, 실력 프로필, 시험 결과, 악보 등): **API 미사용, AsyncStorage 로컬 저장 전용**
- 컨텐츠 자체(악보, 문제)는 클라이언트에서 동적 생성 (서버 의존 없음)

## 프로젝트 인덱싱

- 파일이나 코드를 검색할 때 반드시 `PROJECT_INDEX.md`를 먼저 참조하여 해당 파일의 위치를 확인한다.
- 프로젝트 구조가 변경되거나 (파일 추가/삭제/이동, 디렉토리 변경 등) 인덱싱이 바뀌면 반드시 `PROJECT_INDEX.md`도 함께 수정한다.
- 새로운 화면, 컴포넌트, 훅, 라이브러리 모듈을 추가하면 해당 섹션에 항목을 추가한다.
- 기능별 파일 매핑이 변경되면 "기능별 파일 매핑" 섹션도 업데이트한다.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
