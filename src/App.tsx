/**
 * App.tsx
 * Main application component with wallet context integration
 */
import React, { useEffect, useState } from 'react';
import { useMarket } from '@/hooks/useMarket';
import { ErrorPage } from './components/ErrorPage';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from './atoms/fermiClient';
import Header from './components/Header';
import { CandlestickChart } from './components/CandlestickChart';

const App = () => {
  const { marketAccount, marketAddress, error, isLoading } = useMarket();
  const client = useAtomValue(fermiClientAtom);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const m = '8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6';
    fetch(
      `http://localhost:3001/api/v1/candles?market=${m}&interval=1m&from=${Math.floor(Date.now() / 1000 - 24 * 60 * 60)}&to=${Math.floor(Date.now() / 1000)}`
    )
      .then(res => res.json())
      .then(res => {
        // Transform the date string to Unix timestamp and sort by time ascending
        const transformedData = res.data
          .map((candle: any) => ({
            ...candle,
            time: Math.floor(new Date(candle.time).getTime() / 1000),
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: parseFloat(candle.volume),
          }))
          .sort((a: any, b: any) => a.time - b.time); // Sort in ascending order

        console.log('Transformed data:', transformedData);
        setChartData(transformedData);
      })
      .catch(err => {
        console.error(err);
      });
  }, []);

  if (error) {
    return (
      <ErrorPage
        title="Invalid Market"
        message="The specified market address is not valid. Please check the URL and try again."
        actionText="Go to Default Market"
        onAction={() => {
          window.location.href = window.location.pathname;
        }}
      />
    );
  }

  if (isLoading || !marketAddress || !marketAccount || !client) {
    return <div className="min-h-screen grid place-items-center">Loading market data...</div>;
  }

  return (
    <main className="flex flex-col max-w-[2160px] container mx-auto min-h-screen p-4 gap-4">
      <Header />
      <div className="flex gap-2 h-full flex-1">
        {/* Trading column */}
        <div className="flex flex-col gap-2 basis-3/4">
          <div className="flex h-full gap-2">
            <div className="basis-1/3 card-outer">
              <div className="card-inner">{/* <TradePanel /> */}</div>
            </div>
            <div className="basis-2/3 card-outer">
              <div className="card-inner h-full">
                <CandlestickChart
                  data={chartData}
                  colors={{
                    backgroundColor: 'white',
                    textColor: 'black',
                    upColor: '#26a69a',
                    downColor: '#ef5350',
                    wickUpColor: '#26a69a',
                    wickDownColor: '#ef5350',
                  }}
                />
              </div>
            </div>
          </div>
          <div className="basis-3/3 card-outer">
            <div className="card-inner">{/* <AccountSection /> */}</div>
          </div>
        </div>
        {/* Orderbook column */}
        <div className=" basis-1/4">{/* <Orderbook /> */}</div>
      </div>
    </main>
  );
};

export default App;
