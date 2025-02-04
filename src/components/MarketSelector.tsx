import { useRef, useState } from 'react';
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
  const inputRef = useRef(null);
  const [selectedMarket, setSelectedMarket] = useState('JUP/USDC');
  const [searchQuery, setSearchQuery] = useState('');
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
  const filteredMarkets = dummyMarket.filter(market =>
    market.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const handleSearchChange = (e: any) => {
    setSearchQuery(e.target.value);
  };
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
        <DropdownMenuContent className="w-56" onCloseAutoFocus={e => e.preventDefault()}>
          <DropdownMenuGroup>
            <div className="mb-0.5">
              <div className="flex justify-around items-center rounded-lg gap-1.5 h-10 border-2 border-orange-600">
                <span className="pl-1">
                  <Search className="w-[18px] h-[18px]" />
                </span>
                <input
                  type="text"
                  placeholder="Search"
                  ref={inputRef}
                  value={searchQuery}
                  autoFocus={true}
                  onChange={handleSearchChange}
                  onClick={e => e.stopPropagation()} // Prevents click from closing the dropdown
                  onKeyDown={e => e.stopPropagation()} // Prevents keypress from affecting dropdown focus
                  className="w-full focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto hide-scrollbar">
              {filteredMarkets.length > 0 ? (
                filteredMarkets.map((market, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => {
                      setSelectedMarket(market);
                      setSearchQuery('');
                    }}
                  >
                    {market}
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="p-2 text-center text-gray-500">No markets found</div>
              )}
            </div>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default MarketSelector;
