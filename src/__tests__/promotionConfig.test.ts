import {
  ADMISSIONS_PROMOTION_ID,
  fetchAdmissionsPromotionActive,
  type PromotionRpc,
} from '../lib/promotionConfig';

describe('admissions promotion', () => {
  it('uses the server RPC result instead of the device clock', async () => {
    const rpc = jest.fn<ReturnType<PromotionRpc>, Parameters<PromotionRpc>>().mockResolvedValue({
      data: true,
      error: null,
    });

    await expect(fetchAdmissionsPromotionActive(rpc)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('is_promotion_active', {
      p_promotion_id: ADMISSIONS_PROMOTION_ID,
    });
  });

  it('does not accept truthy non-boolean RPC values', async () => {
    const rpc = jest.fn<ReturnType<PromotionRpc>, Parameters<PromotionRpc>>().mockResolvedValue({
      data: 'true',
      error: null,
    });

    await expect(fetchAdmissionsPromotionActive(rpc)).resolves.toBe(false);
  });

  it('propagates RPC errors so the provider can fail closed', async () => {
    const rpc = jest.fn<ReturnType<PromotionRpc>, Parameters<PromotionRpc>>().mockResolvedValue({
      data: null,
      error: { message: 'promotion RPC unavailable' },
    });

    await expect(fetchAdmissionsPromotionActive(rpc)).rejects.toThrow('promotion RPC unavailable');
  });
});
