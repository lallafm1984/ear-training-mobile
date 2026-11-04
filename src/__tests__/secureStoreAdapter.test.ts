import {
  AsyncKeyValueStore,
  createChunkedSecureStoreAdapter,
  splitByUtf8Bytes,
} from '../lib/secureStoreAdapter';

const createMemoryStore = () => {
  const values = new Map<string, string>();
  const store: AsyncKeyValueStore = {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };

  return { store, values };
};

describe('splitByUtf8Bytes', () => {
  it('한글과 이모지를 코드 포인트 중간에서 자르지 않는다', () => {
    expect(splitByUtf8Bytes('가나다😀라', 6)).toEqual(['가나', '다', '😀', '라']);
  });
});

describe('createChunkedSecureStoreAdapter', () => {
  it('큰 Supabase 세션을 제한보다 작은 청크로 저장하고 복원한다', async () => {
    const { store, values } = createMemoryStore();
    const adapter = createChunkedSecureStoreAdapter(store, {
      maxChunkBytes: 8,
      createGeneration: () => 'generation1',
    });
    const session = '{"access_token":"가나다라마바사아자차카타파하"}';

    await adapter.setItem('session-key', session);

    expect(await adapter.getItem('session-key')).toBe(session);
    expect(values.has('session-key')).toBe(false);
    expect(
      [...values.entries()]
        .filter(([key]) => key.includes('.chunk.generation1.'))
        .every(([, value]) => Buffer.byteLength(value, 'utf8') <= 8),
    ).toBe(true);
  });

  it('업데이트 전 단일 키에 저장한 로그인 세션을 그대로 읽는다', async () => {
    const { store, values } = createMemoryStore();
    values.set('session-key', 'legacy-session');
    const adapter = createChunkedSecureStoreAdapter(store);

    await expect(adapter.getItem('session-key')).resolves.toBe('legacy-session');
  });

  it('새 세대 메타데이터를 기록한 뒤 이전 청크를 정리한다', async () => {
    const { store, values } = createMemoryStore();
    const generations = ['first', 'second'];
    const adapter = createChunkedSecureStoreAdapter(store, {
      maxChunkBytes: 5,
      createGeneration: () => generations.shift() ?? 'fallback',
    });

    await adapter.setItem('session-key', 'first session value');
    await adapter.setItem('session-key', 'second session value');

    expect(await adapter.getItem('session-key')).toBe('second session value');
    expect([...values.keys()].some((key) => key.includes('.chunk.first.'))).toBe(false);
  });

  it('메타데이터가 가리키는 청크가 없으면 손상된 세션을 반환하지 않는다', async () => {
    const { store, values } = createMemoryStore();
    values.set(
      'session-key.chunkmeta',
      JSON.stringify({ version: 1, generation: 'missing', chunkCount: 2 }),
    );
    values.set('session-key.chunk.missing.0', 'partial');
    const adapter = createChunkedSecureStoreAdapter(store);

    await expect(adapter.getItem('session-key')).resolves.toBeNull();
  });

  it('로그아웃 시 청크, 메타데이터, 기존 단일 키를 모두 제거한다', async () => {
    const { store, values } = createMemoryStore();
    const adapter = createChunkedSecureStoreAdapter(store, {
      maxChunkBytes: 5,
      createGeneration: () => 'generation1',
    });
    values.set('session-key', 'legacy-session');

    await adapter.setItem('session-key', 'active session value');
    await adapter.removeItem('session-key');

    expect([...values.keys()].filter((key) => key.startsWith('session-key'))).toEqual([]);
  });
});
