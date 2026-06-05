interface ProviderMeta {
  name: string;
  slug: string;
  logo: string;
}

const KNOWN_PROVIDERS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  'meta-llama': 'Meta',
  mistralai: 'Mistral AI',
  cohere: 'Cohere',
  qwen: 'Qwen',
  nvidia: 'NVIDIA',
  'x-ai': 'xAI',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
  perplexity: 'Perplexity',
  '01-ai': '01.AI',
  databricks: 'Databricks',
  nousresearch: 'Nous Research',
  allenai: 'Allen AI',
  phind: 'Phind',
};

const toTitleCase = (slug: string): string =>
  slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const getProviderMeta = (slug: string): ProviderMeta => ({
  name: KNOWN_PROVIDERS[slug] ?? toTitleCase(slug),
  slug,
  logo: `/providers/${slug}.svg`,
});
