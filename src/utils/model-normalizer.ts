import { AppError } from '@middlewares/error.middleware';
import { getProviderMeta } from './provider-map';
import type { ModelDto, ModelsResponseDto, ProviderDto } from '@/types/model.dto';

const FEATURED_IDS = new Set([
  'openai/gpt-4o',
  'openai/gpt-4.1',
  'anthropic/claude-opus-4',
  'anthropic/claude-sonnet-4-5',
  'google/gemini-2.5-pro',
  'deepseek/deepseek-chat-v3-0324',
  'meta-llama/llama-3.3-70b-instruct',
  'x-ai/grok-3',
]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

const num = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

const hasParam = (item: Record<string, unknown>, param: string): boolean => {
  const params = item.supported_parameters;
  return Array.isArray(params) && params.some((p) => p === param);
};

const detectVision = (item: Record<string, unknown>): boolean => {
  const arch = item.architecture;
  if (!isRecord(arch)) return false;

  // Try input_modalities array first
  const inputModalities = arch.input_modalities;
  if (Array.isArray(inputModalities)) {
    return inputModalities.some(
      (m) => typeof m === 'string' && (m.includes('image') || m.includes('vision')),
    );
  }

  // Fall back to modality string e.g. "text+image->text"
  const modality = str(arch.modality) ?? '';
  return modality.includes('image') || modality.includes('vision');
};

const detectReasoning = (item: Record<string, unknown>): boolean => {
  if (hasParam(item, 'reasoning')) return true;
  const id = str(item.id)?.toLowerCase() ?? '';
  const name = str(item.name)?.toLowerCase() ?? '';
  return (
    id.includes('thinking') ||
    id.includes('reasoning') ||
    id.includes('/o1') ||
    id.includes('/o3') ||
    name.includes('thinking') ||
    name.includes('reasoning')
  );
};

const normalizeModel = (item: unknown): ModelDto | null => {
  if (!isRecord(item)) return null;

  const id = str(item.id);
  if (!id) return null;

  const providerSlug = id.split('/')[0] ?? id;
  const { name: provider, logo: providerLogo } = getProviderMeta(providerSlug);

  const pricing = isRecord(item.pricing) ? item.pricing : {};
  const inputPrice = num(pricing.prompt);
  const outputPrice = num(pricing.completion);
  const isFree = inputPrice === 0 && outputPrice === 0;

  return {
    id,
    name: str(item.name) ?? id,
    provider,
    providerSlug,
    providerLogo,
    description: str(item.description) ?? '',
    contextLength: num(item.context_length),
    isFree,
    isPaid: !isFree,
    inputPrice,
    outputPrice,
    supportsVision: detectVision(item),
    supportsTools: hasParam(item, 'tools') || hasParam(item, 'tool_choice'),
    supportsReasoning: detectReasoning(item),
    supportsStreaming: hasParam(item, 'stream') || true, // nearly all models support streaming
    featured: FEATURED_IDS.has(id),
  };
};

const sortModels = (models: ModelDto[]): ModelDto[] =>
  [...models].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

const buildProviderFilters = (models: ModelDto[]): ProviderDto[] => {
  const map = new Map<string, ProviderDto>();

  for (const model of models) {
    const existing = map.get(model.providerSlug);
    if (existing) {
      existing.count++;
    } else {
      map.set(model.providerSlug, {
        name: model.provider,
        slug: model.providerSlug,
        logo: model.providerLogo,
        count: 1,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count);
};

export const buildModelsResponse = (raw: unknown): ModelsResponseDto => {
  if (!isRecord(raw) || !Array.isArray(raw.data)) {
    throw new AppError(
      'OpenRouter returned an unexpected models response.',
      502,
      'OPENROUTER_MODELS_RESPONSE_INVALID',
    );
  }

  const models = sortModels(
    raw.data.flatMap((item): ModelDto[] => {
      const normalized = normalizeModel(item);
      return normalized ? [normalized] : [];
    }),
  );

  return {
    filters: {
      providers: buildProviderFilters(models),
      pricing: {
        free: models.filter((m) => m.isFree).length,
        paid: models.filter((m) => m.isPaid).length,
      },
    },
    models,
  };
};
