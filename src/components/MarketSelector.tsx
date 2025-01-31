import { useState } from 'react';
import Button from './ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/DropdownMenu';
import { ChevronDown } from 'lucide-react';

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
