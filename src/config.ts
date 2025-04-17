export interface Account {
  id: string;
  privateKey: string;
}

export const accounts: Account[] =
  // Update the privatekey based on local node generation
  // [
  //   {
  //     id: "0.0.1035",
  //     privateKey:
  //       "0x5eac14989eee60d1511031e2c53b7e8ad4eea95c181334f9342b1e531631ca67",
  //   },
  //   {
  //     id: "0.0.1036",
  //     privateKey:
  //       "0xacd67ee5839db05f0b8504a93527c9155d6272ba0f9fa2563141d4c02ccc4096",
  //   },
  //   {
  //     id: "0.0.1037",
  //     privateKey:
  //       "0xe57fac782514e0e70e5abbfcc03520b60d37b1d28c342c6e769a9286e72bcddd",
  //   },
  //   {
  //     id: "0.0.1038",
  //     privateKey:
  //       "0x8407887f6e2ef9218d737c5af94996697278ddf7e2f44a7b17a4fae651541e92",
  //   },
  //   {
  //     id: "0.0.1039",
  //     privateKey:
  //       "0x6a978ba2d6b8f7e7368ec486e04fefbdd4947a7f9bccd08231ef3c67de6d9407",
  //   },
  //   {
  //     id: "0.0.1040",
  //     privateKey:
  //       "0x35c67971441d775ba1edeebfae0e53a98a5f87c7a3b416cc44a634163bc7cd7d",
  //   },
  // ];

  //For Test node
  // Accounts needed to funded via faucet

  [
    {
      id: "0.0.5852234",
      privateKey:
        "302e020100300506032b657004220420d5ddd671887828efdab63e3bd8088aa51fb0f0aa38241d3ea242c67c5a5c1996",
    },
    {
      id: "0.0.5852515",
      privateKey:
        "3030020100300706052b8104000a04220420a4db8f65685cf4a5a9b6ca217dde2ee0ba37b4b8ee15b98ee088184eb5c4f4b5",
    },
    {
      id: "0.0.4482933",
      privateKey:
        "302e020100300506032b657004220420ddbcd2dd06b944a760866253bcac98a73e536e5c4447081dfa773971fe33ec18",
    },
    {
      id: "0.0.4482934",
      privateKey:
        "302e020100300506032b6570042204206be6a20416741195b268b2dd6fd5584d141b2bdd07b4126c31a1925d425631cc",
    },
    {
      id: "0.0.4482935",
      privateKey:
        "302e020100300506032b657004220420e6ea695940d0e2a2d747d0cff1ee65c0a48688c8c7381596ee738a0f8e891413",
    },
    {
      id: "0.0.4482936",
      privateKey:
        "302e020100300506032b6570042204200ad3d773e73089909b27a486db9a054402c96ad1ab413c49ef669ae9df509070",
    },
  ];
