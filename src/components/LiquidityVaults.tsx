import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import { Info } from 'lucide-react';

const LiquidityVaults = () => {
  const [currency, setCurrency] = useState<string>('USDC');
  return (
    <div
      className="p-4 flex h-screen flex-col items-center gap-5"
      style={{
        background: 'linear-gradient(139deg, rgba(14,30,31,1) 9%, rgba(26,213,221,1) 100%)',
      }}
    >
      <Button className="w-fit" onClick={() => setCurrency(currency === 'USDC' ? 'JUP' : 'USDC')}>
        {currency}
      </Button>

      <div className="flex flex-wrap gap-12 justify-around">
        <Card
          className="relative w-[300px] p-5 h-80 bg-transparent border-2 border-yellow-400 rounded-4xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 hover:bg-yellow-400"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <div className="bg-yellow-400 absolute top-[-50px] right-[-50px] w-32 h-32 rounded-full transition-transform duration-500 ease-in-out transform scale-100 group-hover:scale-[10] overflow-hidden" />
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="font-bold text-white">{currency}</CardTitle>
              <div className="relative group">
                <Info className="w-4 h-4 cursor-pointer text-white" />
                <div className="absolute -translate-x-6/7 hidden group-hover:block bg-white text-xs px-2 py-1 rounded-lg shadow min-w-[200px] max-w-[400px]">
                  <p>This is a test description.</p>
                </div>
              </div>
            </div>
            <CardDescription>
              <p className="text-sm font-medium tracking-tight text-gray-300">Interest Rate %</p>
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col justify-end items-center gap-2">
            <Button variant="outline" className="bg-white text-black w-1/2">
              Withdraw
            </Button>
            <Button variant="outline" className="bg-white text-black w-1/2">
              Deposit
            </Button>
          </CardContent>
        </Card>

        <Card
          className="relative w-[300px] p-5 h-80 bg-transparent border-2 border-pink-400 rounded-4xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 hover:bg-pink-400"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <div className="bg-pink-400 absolute top-[-50px] right-[-50px] w-32 h-32 rounded-full transition-transform duration-500 ease-in-out transform scale-100 group-hover:scale-[10] overflow-hidden" />
          <CardHeader>
            <CardDescription></CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col justify-end items-center gap-2">Kamino</CardContent>
        </Card>

        <Card
          className="relative w-[300px] p-5 h-80 bg-transparent border-2 border-violet-400 rounded-4xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 hover:bg-violet-400"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <div className="bg-violet-400 absolute top-[-50px] right-[-50px] w-32 h-32 rounded-full transition-transform duration-500 ease-in-out transform scale-100 group-hover:scale-[10] overflow-hidden" />
          <CardHeader>
            <CardDescription></CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col justify-end items-center gap-2">Drift</CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LiquidityVaults;
