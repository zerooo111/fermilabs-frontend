import { BN } from '@coral-xyz/anchor';

import { BookSideAccount, EventHeapAccount, FermiClient, FillEvent, OutEvent } from './fermiClient';

export const parseBookSideAccount = (client: FermiClient, acc: BookSideAccount) => {
  const nodes =
    acc &&
    client.getLeafNodes(acc).map((node: any) => ({
      ...node,
      key: node.key.toString(),
      price: new BN(node.key).shrn(64).toString(),
      quantity: node.quantity.toString(),
      timestamp: node.timestamp.toString(),
      clientOrderId: node.clientOrderId.toString(),
    }));

  return nodes;
};

export const parseEventHeap = (client: FermiClient, eventHeap: EventHeapAccount | null) => {
  if (eventHeap == null) throw new Error('Event Heap not found');
  const fillDirectEvents: any = [];
  const fillEvents: any = [];
  const outEvents: any = [];
  // let nodes: any = [];
  if (eventHeap !== null) {
    // find nodes having eventType = 2
    (eventHeap.nodes as any).forEach((node: any, i: number) => {
      if (node.event.eventType === 2) {
        const fillDirectEvent: any = client.program.coder.types.decode(
          'FillEventDirect',
          Buffer.from([0, ...node.event.padding])
        );
        if (fillDirectEvent.timestamp.toString() !== '0') {
          fillDirectEvents.push({
            ...fillDirectEvent,
            index: i,
            maker: fillDirectEvent.maker.toString(),
            taker: fillDirectEvent.taker.toString(),
            price: fillDirectEvent.price.toString(),
            quantity: fillDirectEvent.quantity.toString(),
            makerClientOrderId: fillDirectEvent.makerClientOrderId.toString(),
            takerClientOrderId: fillDirectEvent.takerClientOrderId.toString(),
          });
        }
      } else if (node.event.eventType === 0) {
        const fillEvent: FillEvent = client.program.coder.types.decode(
          'FillEvent',
          Buffer.from([0, ...node.event.padding])
        );
        if (fillEvent.timestamp.toString() !== '0') {
          fillEvents.push({
            ...fillEvent,
            index: i,
            maker: fillEvent.maker.toString(),
            taker: fillEvent.taker.toString(),
            price: fillEvent.price.toString(),
            quantity: fillEvent.quantity.toString(),
            makerClientOrderId: fillEvent.makerClientOrderId.toString(),
            takerClientOrderId: fillEvent.takerClientOrderId.toString(),
          });
        }
      } else if (node.event.eventType === 1) {
        const outEvent: OutEvent = client.program.coder.types.decode(
          'OutEvent',
          Buffer.from([0, ...node.event.padding])
        );

        if (outEvent.timestamp.toString() !== '0') outEvents.push({ ...outEvent, index: i });
      }
    });
  }
  console.log('fillEvents', fillEvents);
  console.log('outEvents', outEvents);
  console.log('fillDirectEvents', fillDirectEvents);

  return { fillEvents, outEvents, fillDirectEvents };
};
