import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─────────────────────────────────────────────────────────────
// RevenueCat Webhook Handler
// 환불/취소/만료 이벤트를 받아 profiles 테이블의 tier를 업데이트한다.
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // RC 웹훅 시크릿 검증 (RC 대시보드에서 설정한 Authorization 헤더값)
  const authHeader = req.headers.get('Authorization');
  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

  if (expectedSecret && authHeader !== expectedSecret) {
    console.warn('[RC Webhook] Unauthorized request');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = payload?.event;
  if (!event) {
    return new Response('Missing event', { status: 400 });
  }

  const appUserId: string = event.app_user_id;
  const eventType: string = event.type;
  const expirationMs: number | null = event.expiration_at_ms ?? null;

  console.log(`[RC Webhook] type=${eventType} user=${appUserId} exp=${expirationMs}`);

  if (!appUserId) {
    return new Response('Missing app_user_id', { status: 400 });
  }

  // Service Role 클라이언트 (RLS 우회)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const update: Record<string, unknown> = {};

  switch (eventType) {
    // ── Pro 활성화 ──────────────────────────────────────────
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'NON_RENEWING_PURCHASE':
    case 'UNCANCELLATION':
      update.tier = 'pro';
      update.subscription_expires_at = expirationMs
        ? new Date(expirationMs).toISOString()
        : null;
      break;

    // ── 취소: 만료일까지는 Pro 유지, 만료일만 업데이트 ────────
    case 'CANCELLATION':
      update.subscription_expires_at = expirationMs
        ? new Date(expirationMs).toISOString()
        : null;
      // tier는 변경하지 않음 — EXPIRATION 이벤트에서 free로 전환
      break;

    // ── 즉시 Free 전환 (환불 or 만료) ──────────────────────
    case 'EXPIRATION':
    case 'REFUND':
    case 'SUBSCRIBER_ALIAS':
      update.tier = 'free';
      update.subscription_expires_at = null;
      break;

    default:
      console.log(`[RC Webhook] 처리하지 않는 이벤트: ${eventType}`);
      return new Response('OK', { status: 200 });
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', appUserId);

  if (error) {
    console.error('[RC Webhook] DB 업데이트 실패:', error.message);
    return new Response('DB Error', { status: 500 });
  }

  console.log(`[RC Webhook] 완료: ${eventType} → ${JSON.stringify(update)}`);
  return new Response('OK', { status: 200 });
});
