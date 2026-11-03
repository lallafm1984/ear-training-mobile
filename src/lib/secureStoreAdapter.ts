export interface AsyncKeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface SupabaseStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface ChunkMetadata {
  version: 1;
  generation: string;
  chunkCount: number;
}

const DEFAULT_CHUNK_BYTES = 1800;
const MAX_CHUNK_COUNT = 128;
const METADATA_SUFFIX = '.chunkmeta';
const CHUNK_SUFFIX = '.chunk';

const utf8ByteLength = (character: string): number => {
  const codePoint = character.codePointAt(0) ?? 0;
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
};

export const splitByUtf8Bytes = (value: string, maxChunkBytes: number): string[] => {
  if (!Number.isInteger(maxChunkBytes) || maxChunkBytes < 4) {
    throw new Error('SecureStore chunk size must be an integer of at least 4 bytes.');
  }

  if (value.length === 0) return [''];

  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;

  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (chunkBytes + characterBytes > maxChunkBytes && chunk.length > 0) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }

  chunks.push(chunk);
  return chunks;
};

const metadataKey = (key: string): string => `${key}${METADATA_SUFFIX}`;
const chunkKey = (key: string, generation: string, index: number): string =>
  `${key}${CHUNK_SUFFIX}.${generation}.${index}`;

const parseMetadata = (value: string | null): ChunkMetadata | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ChunkMetadata>;
    if (
      parsed.version !== 1 ||
      typeof parsed.generation !== 'string' ||
      !/^[a-zA-Z0-9_-]+$/.test(parsed.generation) ||
      !Number.isInteger(parsed.chunkCount) ||
      (parsed.chunkCount ?? 0) < 1 ||
      (parsed.chunkCount ?? 0) > MAX_CHUNK_COUNT
    ) {
      return null;
    }

    return parsed as ChunkMetadata;
  } catch {
    return null;
  }
};

const defaultGeneration = (): string =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const deleteChunks = async (
  store: AsyncKeyValueStore,
  key: string,
  metadata: ChunkMetadata | null,
): Promise<void> => {
  if (!metadata) return;
  await Promise.all(
    Array.from({ length: metadata.chunkCount }, (_, index) =>
      store.deleteItemAsync(chunkKey(key, metadata.generation, index)),
    ),
  );
};

/**
 * Supabase 세션을 작은 암호화 항목으로 나눠 저장한다.
 *
 * Expo SecureStore의 네이티브 저장소는 큰 문자열을 거부할 수 있으므로 메타데이터를
 * 마지막에 기록해 새 세대가 완전히 저장된 뒤에만 읽기 대상으로 전환한다. 기존의
 * 단일 키 저장값도 계속 읽어 앱 업데이트 후 로그인 세션을 보존한다.
 */
export const createChunkedSecureStoreAdapter = (
  store: AsyncKeyValueStore,
  options: {
    maxChunkBytes?: number;
    createGeneration?: () => string;
  } = {},
): SupabaseStorageAdapter => {
  const maxChunkBytes = options.maxChunkBytes ?? DEFAULT_CHUNK_BYTES;
  const createGeneration = options.createGeneration ?? defaultGeneration;

  return {
    async getItem(key) {
      const metadata = parseMetadata(await store.getItemAsync(metadataKey(key)));
      if (!metadata) {
        return store.getItemAsync(key);
      }

      const chunks = await Promise.all(
        Array.from({ length: metadata.chunkCount }, (_, index) =>
          store.getItemAsync(chunkKey(key, metadata.generation, index)),
        ),
      );

      if (chunks.some((chunk) => chunk === null)) {
        return null;
      }
      return chunks.join('');
    },

    async setItem(key, value) {
      const previousMetadata = parseMetadata(await store.getItemAsync(metadataKey(key)));
      const generation = createGeneration();
      if (!/^[a-zA-Z0-9_-]+$/.test(generation)) {
        throw new Error('SecureStore generation contains unsupported characters.');
      }

      const chunks = splitByUtf8Bytes(value, maxChunkBytes);
      if (chunks.length > MAX_CHUNK_COUNT) {
        throw new Error(`SecureStore value exceeds ${MAX_CHUNK_COUNT} chunks.`);
      }

      await Promise.all(
        chunks.map((chunk, index) => store.setItemAsync(chunkKey(key, generation, index), chunk)),
      );

      const metadata: ChunkMetadata = {
        version: 1,
        generation,
        chunkCount: chunks.length,
      };
      await store.setItemAsync(metadataKey(key), JSON.stringify(metadata));

      await Promise.all([store.deleteItemAsync(key), deleteChunks(store, key, previousMetadata)]);
    },

    async removeItem(key) {
      const metadata = parseMetadata(await store.getItemAsync(metadataKey(key)));
      await Promise.all([
        deleteChunks(store, key, metadata),
        store.deleteItemAsync(metadataKey(key)),
        store.deleteItemAsync(key),
      ]);
    },
  };
};
