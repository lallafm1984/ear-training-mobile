# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-06

### Added
- **음표 입력 시스템**: 피아노 건반과 악보 기반 음표 선택 인터페이스
- **자동 채점 기능**: 사용자 입력 악보와 모범 답안 비교하여 정확도 평가
- **DurationToolbar 컴포넌트**: 음길이(8분음표, 16분음표, 셋잇단음표 등) 선택 UI
- **PianoKeyboard 컴포넌트**: 스크롤 가능한 피아노 건반 인터페이스
- **GradingResult 컴포넌트**: 채점 결과 시각화 및 점수 표시
- **useNoteInput 훅**: 음표 입력 상태 관리 및 이벤트 처리
- **grading 로직**: normalizeNotes와 gradeNotes를 통한 정확한 채점 알고리즘

### Changed
- NotationPracticeScreen을 선율/2성부 입력 및 채점 모드로 개편
- 악보 편집 인터페이스 전체 UI 리뉴얼 (마디별 순차 입력 → 전체 악보 + 커서 방식)
- 드래그 스크롤 동작을 기존 ScoreEditor 패턴으로 통일

### Fixed
- 답안 악보 두 번째 줄 렌더링 (stretchLast=true로 전체 너비 표시)
- 연속 쉼표 자동 병합 및 마디 무결성 유지
- 셋잇단음표 beam 연결 및 정확한 duration 렌더링.

---

## [1.0.0] - 2026-03-20

Initial release with core ear training features.
