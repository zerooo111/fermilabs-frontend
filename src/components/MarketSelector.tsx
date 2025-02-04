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
  const [selectedMarket, setSelectedMarket] = useState({
    coin: 'JUP/USDC',
    img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fimage-cdn.solana.fm%2Fimages%2F%3FimageUrl%3Dhttps%3A%2F%2Fstatic.jup.ag%2Fjup%2Ficon.png',
  });

  const [searchQuery, setSearchQuery] = useState('');

  const dummyMarket = [
    {
      coin: 'SOL/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fraw.githubusercontent.com%2Fsolana-labs%2Ftoken-list%2Fmain%2Fassets%2Fmainnet%2FSo11111111111111111111111111111111111111112%2Flogo.png',
    },
    {
      coin: 'WETH/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fraw.githubusercontent.com%2Fsolana-labs%2Ftoken-list%2Fmain%2Fassets%2Fmainnet%2F7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs%2Flogo.png',
    },
    {
      coin: 'WBTC/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fshdw-drive.genesysgo.net%2F8LmPHjD6fcsBFd27cWM5Zcqbp5FQMjpVSStVZjx4vzFQ%2Fbtcportal.PNG',
    },
    {
      coin: 'cbBTC/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fipfs.io%2Fipfs%2FQmZ7L8yd5j36oXXydUiYFiFsRHbi3EdgC4RuFwvM7dcqge',
    },
    {
      coin: 'Bonk/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Farweave.net%2FhQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I%3Fext%3Dpng',
    },
    {
      coin: '$WIF/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fbafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link',
    },
    {
      coin: 'POPCAT/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Farweave.net%2FA1etRNMKxhlNGTf-gNBtJ75QJJ4NJtbKh_UXQTlLXzI',
    },
    {
      coin: 'MOODENG/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fipfs.io%2Fipfs%2FQmf1g7dJZNDJHRQru7E7ENwDjcvu7swMUB6x9ZqPXr4RV2',
    },
    {
      coin: 'GOAT/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fipfs.io%2Fipfs%2FQmapAq9WtNrtyaDtjZPAHHNYmpSZAQU6HywwvfSWq4dQVV',
    },
    {
      coin: 'JUP/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fimage-cdn.solana.fm%2Fimages%2F%3FimageUrl%3Dhttps%3A%2F%2Fstatic.jup.ag%2Fjup%2Ficon.png',
    },
    {
      coin: 'JTO/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fimage-cdn.solana.fm%2Fimages%2F%3FimageUrl%3Dhttps%3A%2F%2Fmetadata.jito.network%2Ftoken%2Fjto%2Fimage',
    },
    {
      coin: 'PYTH/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=https%3A%2F%2Fpyth.network%2Ftoken.svg',
    },
    {
      coin: 'DRIFT/USDC',
      img: 'https://wsrv.nl/?w=128&h=128&default=1&url=http%3A%2F%2Fmetadata.drift.foundation%2Fdrift.png',
    },
  ];

  const filteredMarkets = dummyMarket.filter(market =>
    market['coin'].toLowerCase().includes(searchQuery.toLowerCase())
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
              <span className="w-[25px] h-[25px] rounded-full overflow-hidden">
                <img src={selectedMarket.img} alt="" className="w-full h-full object-cover" />
              </span>
              {selectedMarket.coin}
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
                      setSelectedMarket({ coin: market['coin'], img: market.img });
                      setSearchQuery('');
                    }}
                  >
                    <span className="w-[25px] h-[25px] rounded-full overflow-hidden">
                      <img src={market['img']} alt="" className="w-full h-full object-cover" />
                    </span>
                    {market['coin']}
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
