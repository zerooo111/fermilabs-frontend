/**
 * Market selector component
 * Allows users to select a market from a dropdown
 */
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { useMarkets, useSelectedMarket } from '../../../entities/market';

export function MarketSelector() {
  const navigate = useNavigate();
  const { markets } = useMarkets();
  const { selectedMarket, setSelectedMarket } = useSelectedMarket();

  return (
    <Select
      value={selectedMarket?.uuid || ''}
      onValueChange={value => {
        const market = markets.find(m => m.uuid === value);
        if (market) {
          setSelectedMarket(market);
          navigate(`/trade/${market.uuid}`);
        }
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a market" />
      </SelectTrigger>
      <SelectContent>
        {markets.map(market => (
          <SelectItem key={market.uuid} value={market.uuid}>
            {market.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
