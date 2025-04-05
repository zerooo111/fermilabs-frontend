/**
 * useSequencerApi.tsx
 * Custom hook for making API calls to the sequencer
 * Adapts to the selected server from entities/server/model.ts
 */
import { useCallback } from 'react';
import axios, { AxiosResponse } from 'axios';
import { useSelectedServer } from '../../entities/server';
import { tryCatch } from '../lib/try-catch';
import { Market, Orderbook, Order } from './sequencer';

export function useSequencerApi() {
  const { selectedServer } = useSelectedServer();
  const baseUrl = selectedServer.url;

  // Memoized API calls
  const ping = useCallback(async () => {
    const healthCheck = await axios.get(`${baseUrl}/health`);
    return healthCheck;
  }, [baseUrl]);

  const getMarkets = useCallback(async () => {
    const { data, error } = await tryCatch<
      AxiosResponse<{
        data: {
          data: Market[];
        };
      }>
    >(axios.get(`${baseUrl}/markets`));

    if (error) {
      throw error;
    }

    return data.data.data;
  }, [baseUrl]);

  const submitOrderToSequencer = useCallback(
    async (body: any) => {
      const { data, error } = await tryCatch(axios.post(`${baseUrl}/orders`, body));

      if (error) {
        throw error;
      }

      return data.data;
    },
    [baseUrl]
  );

  const fetchOrderbook = useCallback(
    async (marketId: string) => {
      const { data, error } = await tryCatch<
        AxiosResponse<{
          data: {
            data: Orderbook;
          };
        }>
      >(axios.get(`${baseUrl}/markets/${marketId}/orderbook`));

      if (error) {
        throw error;
      }

      return data.data.data;
    },
    [baseUrl]
  );

  const submitCancelOrderToSequencer = useCallback(
    async (body: any) => {
      const { data, error } = await tryCatch<AxiosResponse<Order>>(
        axios.post(`${baseUrl}/cancel_order`, body)
      );

      if (error) {
        throw error;
      }

      return data.data;
    },
    [baseUrl]
  );

  return {
    ping,
    getMarkets,
    submitOrderToSequencer,
    fetchOrderbook,
    submitCancelOrderToSequencer,
  };
}
