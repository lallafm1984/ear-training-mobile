export const ADMISSIONS_PROMOTION_ID = 'admissions_support_2026';

interface PromotionRpcResult {
  data: unknown;
  error: { message: string } | null;
}

export type PromotionRpc = (
  fn: 'is_promotion_active',
  args: { p_promotion_id: string },
) => PromiseLike<PromotionRpcResult>;

/**
 * 기기 시간이 아닌 PostgreSQL 서버 시간으로 프로모션 활성 여부를 판정한다.
 * RPC 실패 시 호출자가 fail-closed 처리할 수 있도록 오류를 전달한다.
 */
export async function fetchAdmissionsPromotionActive(rpc: PromotionRpc): Promise<boolean> {
  const { data, error } = await rpc('is_promotion_active', {
    p_promotion_id: ADMISSIONS_PROMOTION_ID,
  });

  if (error) throw new Error(error.message);
  return data === true;
}
