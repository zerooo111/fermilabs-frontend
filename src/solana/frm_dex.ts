export type FrmDex = {
  version: '0.1.0';
  name: 'frm_dex';
  instructions: [
    {
      name: 'initialize';
      accounts: [];
      args: [];
    },
    {
      name: 'settleBatch';
      docs: ['settle_batch processes a batch of matched trades.'];
      accounts: [
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'ixSysvar';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'settlementBatch';
          type: {
            defined: 'SettlementBatch';
          };
        },
      ];
    },
  ];
  types: [
    {
      name: 'SignedOrderData';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'orderId';
            type: 'u64';
          },
          {
            name: 'owner';
            type: 'publicKey';
          },
          {
            name: 'side';
            type: {
              defined: 'OrderSide';
            };
          },
          {
            name: 'price';
            type: 'u64';
          },
          {
            name: 'quantity';
            type: 'u64';
          },
          {
            name: 'expiry';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'OrderIntent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'orderId';
            type: 'u64';
          },
          {
            name: 'owner';
            type: 'publicKey';
          },
          {
            name: 'side';
            type: {
              defined: 'OrderSide';
            };
          },
          {
            name: 'price';
            type: 'u64';
          },
          {
            name: 'quantity';
            type: 'u64';
          },
          {
            name: 'expiry';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'MatchedTrade';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'buyerOrder';
            type: {
              defined: 'OrderIntent';
            };
          },
          {
            name: 'buyerSignature';
            type: {
              array: ['u8', 64];
            };
          },
          {
            name: 'sellerOrder';
            type: {
              defined: 'OrderIntent';
            };
          },
          {
            name: 'sellerSignature';
            type: {
              array: ['u8', 64];
            };
          },
          {
            name: 'executionPrice';
            type: 'u64';
          },
          {
            name: 'tradeQuantity';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'SettlementBatch';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'batchId';
            type: 'u64';
          },
          {
            name: 'trades';
            type: {
              vec: {
                defined: 'MatchedTrade';
              };
            };
          },
        ];
      };
    },
    {
      name: 'OrderSide';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Buy';
          },
          {
            name: 'Sell';
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'SigVerificationFailed';
      msg: 'Signature verification failed.';
    },
  ];
};

export const IDL: FrmDex = {
  version: '0.1.0',
  name: 'frm_dex',
  instructions: [
    {
      name: 'initialize',
      accounts: [],
      args: [],
    },
    {
      name: 'settleBatch',
      docs: ['settle_batch processes a batch of matched trades.'],
      accounts: [
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'ixSysvar',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'settlementBatch',
          type: {
            defined: 'SettlementBatch',
          },
        },
      ],
    },
  ],
  types: [
    {
      name: 'SignedOrderData',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'orderId',
            type: 'u64',
          },
          {
            name: 'owner',
            type: 'publicKey',
          },
          {
            name: 'side',
            type: {
              defined: 'OrderSide',
            },
          },
          {
            name: 'price',
            type: 'u64',
          },
          {
            name: 'quantity',
            type: 'u64',
          },
          {
            name: 'expiry',
            type: 'u64',
          },
        ],
      },
    },
    {
      name: 'OrderIntent',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'orderId',
            type: 'u64',
          },
          {
            name: 'owner',
            type: 'publicKey',
          },
          {
            name: 'side',
            type: {
              defined: 'OrderSide',
            },
          },
          {
            name: 'price',
            type: 'u64',
          },
          {
            name: 'quantity',
            type: 'u64',
          },
          {
            name: 'expiry',
            type: 'u64',
          },
        ],
      },
    },
    {
      name: 'MatchedTrade',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'buyerOrder',
            type: {
              defined: 'OrderIntent',
            },
          },
          {
            name: 'buyerSignature',
            type: {
              array: ['u8', 64],
            },
          },
          {
            name: 'sellerOrder',
            type: {
              defined: 'OrderIntent',
            },
          },
          {
            name: 'sellerSignature',
            type: {
              array: ['u8', 64],
            },
          },
          {
            name: 'executionPrice',
            type: 'u64',
          },
          {
            name: 'tradeQuantity',
            type: 'u64',
          },
        ],
      },
    },
    {
      name: 'SettlementBatch',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'batchId',
            type: 'u64',
          },
          {
            name: 'trades',
            type: {
              vec: {
                defined: 'MatchedTrade',
              },
            },
          },
        ],
      },
    },
    {
      name: 'OrderSide',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Buy',
          },
          {
            name: 'Sell',
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: 'SigVerificationFailed',
      msg: 'Signature verification failed.',
    },
  ],
};
