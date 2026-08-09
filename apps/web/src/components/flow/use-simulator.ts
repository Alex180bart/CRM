"use client";

import { useCallback, useState } from "react";
import type { FlowEdge, FlowNode, FlowRunOptions, FlowRunState } from "@elora/core";
import { EMPTY_FLOW_RUN, answerFlow, startFlow } from "@elora/core";

/**
 * Simulador do fluxo — casca de React sobre o runtime.
 *
 * O percurso saiu daqui para `@elora/core/utils/flow-runtime` quando o webchat ao
 * vivo passou a precisar das mesmas regras. Manter duas implementações
 * produziria a divergência que mais custa caro num construtor visual: o fluxo
 * aprovado no simulador se comportando de outro jeito na frente do visitante.
 *
 * O que sobrou aqui é estado de componente. Os nomes exportados continuam os
 * mesmos para não obrigar bot-builder e journey-builder a mudar.
 */

export type SimulatorEntry = FlowRunState["entries"][number];
export type SimulatorStatus = FlowRunState["status"];
export type SimulatorOptions = FlowRunOptions;

export function useFlowSimulator(nodes: FlowNode[], edges: FlowEdge[], options: SimulatorOptions) {
  const [state, setState] = useState<FlowRunState>(EMPTY_FLOW_RUN);

  const start = useCallback(() => {
    setState(startFlow(nodes, edges, options));
  }, [nodes, edges, options]);

  const answer = useCallback(
    (text: string, portId?: string) => {
      setState((current) => answerFlow(current, nodes, edges, options, text, portId));
    },
    [nodes, edges, options],
  );

  const reset = useCallback(() => setState(EMPTY_FLOW_RUN), []);

  return { ...state, start, answer, reset };
}
