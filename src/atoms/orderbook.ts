import { atom } from 'jotai';

const orderbookAtom = atom<Orderbook>({
  buys: [],
  sells: [],
  lastUpdated: new Date(),
});

export default orderbookAtom;
