import { StyleSheet, Dimensions } from 'react-native';

export const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },

  // ── 상단 앱바 ──
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff',
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },

  // ── 재생 컨트롤 바 ──
  playBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  playBarBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#ffffff',
  },

  // ── 하단 재생 버튼 ──
  bottomPlayContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    position: 'relative', paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  floatingPlayBtn: {
    backgroundColor: '#6366f1', paddingHorizontal: 32, paddingVertical: 12,
    borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  floatingPlayBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  // ── 하단 네비게이션 바 ──
  bottomNavBar: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#ffffff',
  },
  navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 3 },
  navBtnCenter: {
    backgroundColor: '#fcd34d', borderRadius: 14, marginHorizontal: 4,
    marginVertical: 6, paddingVertical: 8, borderWidth: 1, borderColor: '#fbbf24',
  },
  navBtnText: { fontSize: 10, fontWeight: '600' },

  // ── 악보 표시 ──
  scoreContainer: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', height: 160 },
  emptyTitle: { fontSize: 13, fontWeight: 'bold', color: '#94a3b8', marginTop: 12 },
  emptySubtitle: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4 },

  // ── 하단 고정 팔레트 ──
  bottomFixedPalette: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
    backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 10,
  },
  statusBarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1 },
  statusBarText: { fontSize: 11, color: '#94a3b8' },

  // ── 서브메뉴 ──
  subMenuContainer: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 8,
    paddingBottom: 6, gap: 6, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  subMenuChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderColor: '#e2e8f0' },
  subMenuChipText: { fontSize: 13, fontWeight: 'bold' },

  // ── 팔레트 행 ──
  paletteRow1: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  iconButton: { width: 32, height: 28, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },

  paletteRow2: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4 },
  octaveBtn: { width: 32, height: 28, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  octaveBtnText: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  octaveText: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: '#1e293b' },
  divider: { width: 1, height: 20, backgroundColor: '#e2e8f0', marginHorizontal: 2 },
  optionChip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, height: 28, borderRadius: 8, borderColor: '#e2e8f0', marginRight: 4 },
  optionChipText: { fontSize: 11, fontWeight: 'bold' },

  paletteRow3: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 4, gap: 4 },
  durBtn: { flex: 1, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderColor: '#e2e8f0' },
  durBtnText: { fontSize: 11, fontWeight: 'bold' },

  paletteRow4: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingBottom: 8 },
  pitchBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  pitchBtnText: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  pitchBtnSubText: { fontSize: 9, fontWeight: 'bold' },

  // ── 저장 관리 ──
  bsPrimaryBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  bsPrimaryBtnText: { fontSize: 13, fontWeight: 'bold', color: '#ffffff' },
  savedCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 8 },
  savedBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  // ── 잠긴 기능 ──
  lockedFeatureText: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' },

  // ── Gen 배지 (상단 바) ──
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 4, gap: 3, borderWidth: 1,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '700' },

  // ── ABC 테스트 버튼 ──
  abcTestBtn: {
    position: 'absolute', left: 16, top: 12, width: 44, height: 44,
    borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', zIndex: 2,
  },
  abcTestBtnDisabled: { opacity: 0.45 },

  // ── 재생 옵션 ──
  playOptLabel: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  commonSettingsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  commonSettingsCard: {
    flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', gap: 6,
  },
  commonSettingsLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  commonSettingsInput: {
    fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'center',
    minWidth: 60, paddingVertical: 2, borderBottomWidth: 1.5, borderBottomColor: '#c7d2fe',
  },
  modeAccordion: { marginBottom: 10 },
  modeCard: {
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#ffffff',
    marginBottom: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  modeCardActive: {
    backgroundColor: '#6366f1', borderColor: '#6366f1',
    shadowColor: '#6366f1', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardActiveAP: {
    backgroundColor: '#2563eb', borderColor: '#2563eb',
    shadowColor: '#2563eb', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardActiveKR: {
    backgroundColor: '#d97706', borderColor: '#d97706',
    shadowColor: '#d97706', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardActiveEcho: {
    backgroundColor: '#16a34a', borderColor: '#16a34a',
    shadowColor: '#16a34a', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardActiveCustom: {
    backgroundColor: '#9333ea', borderColor: '#9333ea',
    shadowColor: '#9333ea', shadowOpacity: 0.25, elevation: 4,
  },
  modeCardLocked: {
    backgroundColor: '#f8fafc', borderColor: '#e2e8f0',
    shadowOpacity: 0, elevation: 0, opacity: 0.65,
  },
  modeCardTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  modeCardTitleActive: { color: '#ffffff' },
  modeCardDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  modeCardDescActive: { color: 'rgba(255,255,255,0.85)' },
  modeCardExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
  modeSettingsBox: {
    backgroundColor: '#f1f5f9', borderWidth: 1.5, borderTopWidth: 0,
    borderColor: '#cbd5e1', borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    padding: 14, marginBottom: 0,
  },
  modeCountChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff',
  },
  modeCountChipText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
  modeOptRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  modeOptLabel: { fontSize: 12, color: '#475569', flex: 1 },
  modeOptInput: {
    width: 72, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0',
    fontSize: 13, fontWeight: 'bold', textAlign: 'center', color: '#1e293b',
  },
  modeSeqBox: {
    backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12,
  },
  modeSeqText: { fontSize: 11, color: '#64748b', lineHeight: 18 },
  modeSeqHighlight: { fontSize: 11, fontWeight: 'bold', color: '#1e293b' },

  // ── AI 생성 로딩 모달 ──
  aiLoadingOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  aiLoadingContainer: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 15, minWidth: 240,
  },
  aiLoadingTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginTop: 16, textAlign: 'center' },
  aiLoadingSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 6 },
  aiLoadingDots: { flexDirection: 'row', gap: 6, marginTop: 16 },
  aiLoadingDot: { width: 8, height: 8, borderRadius: 4 },
});
