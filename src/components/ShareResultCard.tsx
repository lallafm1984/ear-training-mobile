// ─────────────────────────────────────────────────────────────
// ShareResultCard — 공유용 결과 카드 (캡처 대상 뷰)
// ─────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Music2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { COLORS } from '../theme/colors';
import MascotCharacter from './MascotCharacter';
import { normalizeShareStats, type ShareCardData } from '../lib/shareCard';

export const SHARE_CARD_WIDTH = 320;

interface Props {
  data: ShareCardData;
}

export default function ShareResultCard({ data }: Props) {
  const { t } = useTranslation(['share']);
  const accent = data.accent ?? COLORS.primary600;
  const stats = normalizeShareStats(data.stats);

  return (
    <View style={styles.card}>
      {/* 상단 히어로 */}
      <View style={[styles.hero, { backgroundColor: accent }]}>
        <View style={[styles.deco, styles.decoLarge]} />
        <View style={[styles.deco, styles.decoSmall]} />

        <View style={styles.brandRow}>
          <View style={styles.brandLeft}>
            <View style={styles.brandMark}>
              <Music2 size={12} color={accent} strokeWidth={2.5} />
            </View>
            <Text style={styles.brandText}>{t('share:card.brand')}</Text>
          </View>
          <Text style={styles.dateText}>{data.date}</Text>
        </View>

        <View style={styles.heroBody}>
          <View style={styles.mascotRing}>
            <MascotCharacter size={64} level={data.mascotLevel ?? 1} happy={data.happy ?? true} />
          </View>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {data.title}
            </Text>
            {data.subtitle ? (
              <Text style={styles.heroSub} numberOfLines={2}>
                {data.subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* 본문 */}
      <View style={styles.body}>
        <Text style={[styles.headline, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
          {data.headline}
        </Text>
        {data.headlineLabel ? (
          <Text style={styles.headlineLabel} numberOfLines={2}>
            {data.headlineLabel}
          </Text>
        ) : null}

        {stats.length > 0 && (
          <View style={styles.statsRow}>
            {stats.map((s, i) => (
              <View key={`${s.label}-${i}`} style={styles.statChip}>
                <Text style={styles.statValue} numberOfLines={1}>
                  {s.value}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 푸터 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('share:card.tagline')}</Text>
        <Text style={[styles.footerTag, { color: accent }]}>{t('share:card.hashtags')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
  },
  hero: {
    padding: 18,
    paddingBottom: 20,
    gap: 16,
    overflow: 'hidden',
  },
  deco: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  decoLarge: { width: 180, height: 180, top: -70, right: -50 },
  decoSmall: { width: 90, height: 90, bottom: -40, left: -20 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandMark: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  dateText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mascotRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTexts: { flex: 1, gap: 4 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '900', lineHeight: 24 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '600', lineHeight: 17 },
  body: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    alignItems: 'center',
    gap: 6,
  },
  headline: { fontSize: 44, fontWeight: '900', lineHeight: 52, letterSpacing: -0.5 },
  headlineLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate500,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  statChip: {
    minWidth: 82,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.slate50,
    borderWidth: 1,
    borderColor: COLORS.slate100,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 15, fontWeight: '900', color: COLORS.slate800 },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.slate400 },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.slate100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerText: { fontSize: 11, fontWeight: '700', color: COLORS.slate500, flexShrink: 1 },
  footerTag: { fontSize: 11, fontWeight: '800' },
});
