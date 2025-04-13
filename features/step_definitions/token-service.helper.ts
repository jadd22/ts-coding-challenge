import { PrivateKey } from "@hashgraph/sdk";
import { accounts } from "../../src/config";

export const TREASURY_ACCOUNT_ID = accounts[0].id;
export const TREASURY_ACCOUNT_PRIVATEKEY = PrivateKey.fromStringED25519(
  accounts[0].privateKey
);
