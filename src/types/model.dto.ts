export type ProviderDto = {
  name: string;
  slug: string;
  logo: string;
  count: number;
};

export type ModelDto = {
  id: string;
  name: string;
  provider: string;
  providerSlug: string;
  providerLogo: string;
  description: string;
  contextLength: number;
  isFree: boolean;
  isPaid: boolean;
  inputPrice: number;
  outputPrice: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsStreaming: boolean;
  featured: boolean;
};

export type ModelsResponseDto = {
  filters: {
    providers: ProviderDto[];
    pricing: { free: number; paid: number };
  };
  models: ModelDto[];
};
