// import axios from 'axios';
// import { useEffect, useState } from 'react';

// const BASE_URL = 'http://54.80.177.213:8082';

// type Orderbook = {
//   buys: any;
//   sells: any;
//   lastUpdated: Date;
// };

// async function fetchOrderbook() {
//   const response = await axios.get(BASE_URL + '/orderbook');
//   return response.data.data;
// }

// export default function Orderbook() {
//   const [orderbook, setOrderbook] = useState<Orderbook | null>({
//     buys: [],
//     sells: [],
//     lastUpdated: new Date(),
//   });

//   useEffect(() => {
//     fetchOrderbook().then(data => {
//       setOrderbook({
//         buys: data.buys,
//         sells: data.sells,
//         lastUpdated: new Date(),
//       });
//     });
//   }, []);

//   return (
//     <div className="flex flex-col gap-4">
//       <h2 className="text-xl font-medium">Orderbook</h2>
//     </div>
//   );
// }
