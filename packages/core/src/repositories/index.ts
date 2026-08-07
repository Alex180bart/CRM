import { aiGatewayRepository } from "./ai-gateway";
import { memoryRepositories } from "./memory";
import type { Repositories } from "./types";

export * from "./types";
export { memoryRepositories, aiGatewayRepository };

/**
 * Ponto único de resolução da camada de dados.
 *
 * Quando o Supabase entrar, este arquivo passa a escolher a implementação por
 * variável de ambiente — e nenhuma tela precisa mudar.
 *
 * `ai` já sai daqui apontando para o AI Gateway real (`/api/ai/copilot`),
 * porque inteligência não tem versão em memória que valha algo: uma resposta
 * fixa não ensina nada sobre latência, custo ou qualidade do prompt.
 */
export const repositories: Repositories = {
  ...memoryRepositories,
  ai: aiGatewayRepository,
};

export * from "./events-memory";
