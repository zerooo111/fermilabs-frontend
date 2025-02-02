import { useState } from 'react';
import Button from './ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/DropdownMenu';
import { ChevronDown, Search } from 'lucide-react';

const MarketSelector = () => {
  const [selectedMarket, setSelectedMarket] = useState('JUP/USDC');
  const dummyMarket = [
    'SOL/USDC',
    'WETH/USDC',
    'WBTC/USDC',
    'cbBTC/USDC',
    'Bonk/USDC',
    '$WIF/USDC',
    'POPCAT/USDC',
    'MOODENG/USDC',
    'GOAT/USDC',
    'JUP/USDC',
    'JTO/USDC',
    'PYTH/USDC',
    'DRIFT/USDC',
  ];
  return (
    <div className="">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="mr-20">
            <Button variant="outline" className="w-full">
              {selectedMarket}
              <ChevronDown />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            <div className="mb-0.5">
              <div className="flex justify-around items-center rounded-lg gap-1.5 h-10 border-2 border-orange-600">
                <span className="pl-1">
                  <Search className="w-[18px] h-[18px]" />
                </span>
                <input
                  type="text"
                  placeholder="Search"
                  autoFocus={true}
                  className="w-full focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto hide-scrollbar">
              {dummyMarket.map((value, index) => (
                <DropdownMenuItem key={index} className="" onClick={() => setSelectedMarket(value)}>
                  {value}
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default MarketSelector;
