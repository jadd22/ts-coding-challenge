import {
  AccountBalanceQuery,
  AccountId,
  AccountInfoQuery,
  Client,
  PrivateKey,
  Status,
  TokenAssociateTransaction,
  TokenId,
  TransferTransaction,
} from "@hashgraph/sdk";
import { accounts } from "../../src/config";

export const TREASURY_ACCOUNT_ID = accounts[0].id;
export const TREASURY_ACCOUNT_PRIVATEKEY = PrivateKey.fromStringED25519(
  accounts[0].privateKey
);

export const SECOND_ACCOUNT_ID = accounts[1].id;
export const SECOND_ACCOUNT_PRIVATEKEY = PrivateKey.fromStringECDSA(
  accounts[1].privateKey
);

export const NEW_ACCOUNT_ID = accounts[2].id;
export const NEW_ACCOUNT_PRIVATEKEY = PrivateKey.fromStringED25519(
  accounts[2].privateKey
);

export const toDecimal = (amount: number, decimal: number) => {
  return amount * Math.pow(10, decimal);
};

export const toNumber = (amount: number, decimal: number) => {
  return Math.floor(amount / decimal);
};
export async function getAccountTokenBalance(
  accountId: string,
  tokenId: TokenId,
  client: Client
): Promise<number> {
  try {
    const accountBalanceQuery = new AccountBalanceQuery().setAccountId(
      accountId
    );
    const accountBalanceResponse = await accountBalanceQuery.execute(client);

    if (
      accountBalanceResponse.tokens &&
      accountBalanceResponse.tokens.get(tokenId)
    ) {
      const balance = accountBalanceResponse.tokens.get(tokenId);
      return balance ? balance.toNumber() : 0;
    }
    return 0;
  } catch (error) {
    console.error("Failed to fetch account balance");
    return 0;
  }
}

async function isAccountAssociatedWithToken(
  accountId: string,
  tokenId: TokenId,
  client: Client
): Promise<any> {
  try {
    // Create the query to get account info
    const query = new AccountInfoQuery().setAccountId(accountId);
    const accountInfo = await query.execute(client);

    // Check if the token relationship exists in the account's token relationships
    const tokenRelationships = accountInfo.tokenRelationships;
    return tokenRelationships && tokenRelationships.get(tokenId);
  } catch (error) {
    console.error(`Error checking token association`);
    return false;
  }
}

export async function associateAccountWithToken(
  newAccountId: string,
  newAccountPrivateKey: PrivateKey,
  tokenId: TokenId,
  client: Client
): Promise<boolean> {
  try {
    const response = await isAccountAssociatedWithToken(
      newAccountId,
      tokenId,
      client
    );

    if (response) {
      return true;
    }

    const txAssociate = await new TokenAssociateTransaction()
      .setAccountId(newAccountId)
      .setTokenIds([tokenId])
      .freezeWith(client);

    const signTxAssociateTransfer = await txAssociate.sign(
      newAccountPrivateKey
    );

    const txAssociateResponse = await signTxAssociateTransfer.execute(client);
    const receiptTxAssociate = await txAssociateResponse.getReceipt(client);
    console.log("Internal status", receiptTxAssociate.status.toString());

    return true;
  } catch (error) {
    console.error("Associate Token Transaction Failed");
    return false;
  }
}

export async function transferTokenToAccount(
  fromAccountId: string,
  toAccountId: string,
  tokenId: TokenId,
  amountInDecimal: number,
  client: Client
): Promise<boolean> {
  try {
    const isAccountAssociated = await isAccountAssociatedWithToken(
      toAccountId,
      tokenId,
      client
    );
    if (!isAccountAssociated) {
      console.error("Associate Account Before Transferring");
      return false;
    }

    const fromAccountBalance = await getAccountTokenBalance(
      fromAccountId,
      tokenId,
      client
    );

    // Check sufficient token balance
    if (fromAccountBalance < amountInDecimal) {
      console.error(
        `Account ${fromAccountId}: balance: ${fromAccountBalance} tokens: ${amountInDecimal}`
      );
      return false;
    }

    const txTransfer = await new TransferTransaction()
      .addTokenTransfer(tokenId, fromAccountId, -amountInDecimal)
      .addTokenTransfer(tokenId, toAccountId, amountInDecimal)
      .freezeWith(client);

    const signTxTokenTransfer = await txTransfer.sign(
      TREASURY_ACCOUNT_PRIVATEKEY
    );
    //Sign the transaction with the client operator private key and submit to a Hedera network
    const txTokenTransferResponse = await signTxTokenTransfer.execute(client);

    //Get the receipt of the transaction
    const receiptTokenTransferTx = await txTokenTransferResponse.getReceipt(
      client
    );

    //Get the transaction status
    const statusTokenTransferTx = await receiptTokenTransferTx.status;

    console.log("statusTokenTransferTx", statusTokenTransferTx.toString());
    return true;
  } catch (error) {
    console.log(
      `from account: ${fromAccountId} for tokenId: ${tokenId.toString()}`
    );
    console.error("Failed to Transfer", error);
    return false;
  }
}
