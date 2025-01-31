import { Info, Settings2Icon } from 'lucide-react';
import Button from './ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/Dialog';
import { useState } from 'react';

const Setting = () => {
  const [feeSelected, setFeeSelected] = useState('Normal');
  const [slippageSelected, setSlippageSelected] = useState('0.1');
  return (
    <div className="mr-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button>
            <Settings2Icon />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[480px] bg-white backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div>
            {/* Priority fees */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-1 mb-2">
                <p className="text-xs tracking-tighter">PRIORITY FEE</p>
                <div className="relative group">
                  <Info className="text-sm w-[12px] h-[12px] bg-[#d5c4c4] rounded-full cursor-pointer" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block bg-white text-xs px-2 py-1 rounded-lg shadow min-w-[200px] max-w-[400px]">
                    <p>
                      Higher priority fees increase the likelihood your orders are included by the
                      Solana network.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-between gap-4">
                {['Normal', 'Fast', 'Quick'].map((speed, index) => (
                  <div
                    key={index}
                    role="button"
                    onClick={() => setFeeSelected(speed)}
                    className={`flex flex-col flex-1 bg-[#F1F1F1] justify-center items-center rounded-lg cursor-pointer select-none p-4 hover:text-orange-600
                      ${feeSelected === speed ? 'border-2 border-orange-500' : 'bg-[#F1F1F1]'}
                    `}
                  >
                    <p className="font-bold">{speed}</p>
                    <p className="text-sm">
                      {speed === 'Normal' ? '0.00002' : speed === 'Fast' ? '0.0002' : '0.01'}
                    </p>
                    <p className="text-sm">SOL</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Slippage */}
            <div className="mt-4 flex flex-col">
              <div className="flex items-center space-x-1 mb-2">
                <p className="text-xs tracking-tighter">SLIPPAGE</p>
                <div className="relative group">
                  <Info className="text-sm w-[12px] h-[12px] bg-[#d5c4c4] rounded-full cursor-pointer" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block bg-white text-xs px-2 py-1 rounded-lg shadow min-w-[200px] max-w-[400px]">
                    <p>The most your executed trade price can differ from the estimated price</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-between gap-8">
                {['0.1', '0.5', '1.0'].map((num, index) => (
                  <div
                    key={index}
                    role="button"
                    onClick={() => setSlippageSelected(num)}
                    className={`bg-[#F1F1F1] text-sm flex flex-1 items-center justify-center cursor-pointer select-none px-4 py-1 rounded-lg hover:text-orange-600 ${slippageSelected === num ? 'border-2 border-orange-500' : 'bg-[#F1F1F1]'}`}
                  >
                    {num}%
                  </div>
                ))}
                <div className="flex items-center bg-gray-100 rounded-full px-4 py-1 w-32">
                  <input
                    type="text"
                    placeholder="0.00"
                    autoFocus={false}
                    className="text-right text-sm focus:outline-none bg-[#F1F1F1] w-full rounded-lg"
                  />
                  <span className="pl-1 text-sm">%</span>
                </div>
              </div>
            </div>

            {/* show open order on chart */}
            <div className="mt-4 flex items-center justify-center">
              <div>
                <p className="text-xs tracking-tighter">SHOW OPEN ORDERS ON CHART</p>
              </div>
              <div className="flex flex-1 justify-end gap-2">
                <Button>On</Button>
                <Button>Off</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Setting;
