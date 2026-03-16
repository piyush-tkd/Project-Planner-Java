import { useMutation } from '@tanstack/react-query';
import apiClient from './client';
import { SimulationRequest, SimulationResult } from '../types';

export function useSimulateTimeline() {
  return useMutation<SimulationResult, Error, SimulationRequest>({
    mutationFn: (data: SimulationRequest) =>
      apiClient.post('/simulator/timeline', data).then(r => r.data),
  });
}
