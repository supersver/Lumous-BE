export type ModelPricingDto = {
  prompt: string;
  completion: string;
};

export type ModelDto = {
  id: string;
  name: string;
  contextLength: number;
  pricing: ModelPricingDto;
};
