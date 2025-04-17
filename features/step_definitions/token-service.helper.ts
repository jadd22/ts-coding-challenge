import {
  AccountBalanceQuery,
  AccountCreateTransaction,
  AccountId,
  AccountInfoQuery,
  Client,
  Hbar,
  PrivateKey,
  Status,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenInfoQuery,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransactionId,
  TransactionReceipt,
  TransactionResponse,
  TransferTransaction,
} from "@hashgraph/sdk";
import { accounts } from "../../src/config";
import { sign } from "node:crypto";

// Update the Private Key based on key generation
export const TREASURY_ACCOUNT_ID = accounts[0].id;
export const TREASURY_ACCOUNT_PRIVATEKEY = PrivateKey.fromStringED25519(
  accounts[0].privateKey
);

export const SECOND_ACCOUNT_ID = accounts[1].id;
export const SECOND_ACCOUNT_PRIVATEKEY = PrivateKey.fromStringED25519(
  accounts[1].privateKey
);

export const NEW_ACCOUNT_ID = accounts[2].id;
export const NEW_ACCOUNT_PRIVATEKEY = PrivateKey.fromStringED25519(
  accounts[2].privateKey
);

export const FOURTH_ACCOUNT_ID = accounts[3].id;
export const FOURTH_ACCOUNT_PRIVATEKEY = PrivateKey.fromStringED25519(
  accounts[3].privateKey
);

export const OPERATOR_ID = accounts[4].id;
export const OPERATOR_KEY = PrivateKey.fromStringED25519(
  accounts[3].privateKey
);

export const toDecimal = (amount: number, decimal: number) => {
  return amount * Math.pow(10, decimal);
};

export const toNumber = (amount: number, decimal: number) => {
  return Math.floor(amount / decimal);
};

export async function createNewToken(
  client: Client,
  tokenName: string,
  tokenSymbol: string,
  initialSupply: number,
  tokenDecimal: number,
  treasuryAccountId: string,
  treasuryPrivateKey: PrivateKey,
  maxSupply: number = initialSupply
): Promise<TokenId | null> {
  try {
    // Create Token Transaction
    const txTokenCreate = await new TokenCreateTransaction()
      .setTokenName(tokenName)
      .setTokenSymbol(tokenSymbol)
      .setDecimals(tokenDecimal)
      .setTokenType(TokenType.FungibleCommon)
      .setTreasuryAccountId(treasuryAccountId)
      .setSupplyKey(treasuryPrivateKey)
      .setInitialSupply(maxSupply)
      .freezeWith(client);

    //Sign the transaction with the token treasury account private key
    const signTxTokenCreate = await txTokenCreate.sign(
      TREASURY_ACCOUNT_PRIVATEKEY
    );

    //Sign the transaction with the client operator private key and submit to a Hedera network
    const txTokenCreateResponse = await signTxTokenCreate.execute(client);

    //Get the receipt of the transaction
    const receiptTokenCreateTx = await txTokenCreateResponse.getReceipt(client);

    //Get the transaction consensus status
    const statusTokenCreateTx = await receiptTokenCreateTx.status;

    const tokenId = receiptTokenCreateTx.tokenId;
    if (statusTokenCreateTx.toString() != "SUCCESS") {
      console.error(
        "Failed to create new token!",
        statusTokenCreateTx.toString()
      );
    }
    if (tokenId == null) {
      console.error("Failed to Create Token");
      return null;
    }
    console.log("Create new token", tokenId.num.toString());
    return tokenId;
  } catch (error) {
    console.error("Error creating token:", error);
    return null;
  }
}

export async function mintToken(
  client: Client,
  tokenId: TokenId,
  tokenAmount: number,
  accountPrivateKey: PrivateKey
): Promise<any> {
  try {
    const txTokenMint = await new TokenMintTransaction()
      .setTokenId(tokenId.num.toString())
      .setAmount(toDecimal(tokenAmount, 2))
      .freezeWith(client);
    //Sign with the supply private key of the token
    const signTxTokenMint = await txTokenMint.sign(accountPrivateKey);
    const txTokenMintResponse = await signTxTokenMint.execute(client);
    //Request the receipt of the transaction
    const receiptTokenMintTx = await txTokenMintResponse.getReceipt(client);
    //Get the transaction consensus status
    const statusTokenMintTx = await receiptTokenMintTx.status;
    console.log("statusTokenMintTx", statusTokenMintTx);
    //Get the Transaction ID
    const txTokenMintId = txTokenMintResponse.transactionId.toString();
    console.log("Tx Token Mind Id", txTokenMintId);
    // Verify the tokens were minted by checking the new supply
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId.num.toString())
      .execute(client);

    if (statusTokenMintTx.toString() === "SUCCESS") {
      return tokenInfo.tokenId;
    }
    return null;
  } catch (error) {
    console.error("Error minting tokens:", error);
    return false;
  }
}

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
    console.error(`Error checking token association`, error);
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
    const toAccountBalance = await getAccountTokenBalance(
      toAccountId,
      tokenId,
      client
    );
    // console.log("Before Transfer Balance");
    // console.log(`First Account Balance: ${fromAccountBalance}`);
    // console.log(`Second Account Balance: ${toAccountBalance}`);
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

export async function createTokenTransferTransaction(
  tokenId: string | TokenId,
  from: string | AccountId,
  to: string | AccountId,
  amount: number
): Promise<TransferTransaction> {
  return new TransferTransaction()
    .addTokenTransfer(tokenId, from, -amount)
    .addTokenTransfer(tokenId, to, amount);
}

export async function submitTransactionAndSign(
  transaction: TransferTransaction,
  client: Client,
  privateKey: PrivateKey
): Promise<TransactionReceipt> {
  const signedTx = await transaction.freezeWith(client).sign(privateKey);
  const txResponse: TransactionResponse = await signedTx.execute(client);
  const receipt: TransactionReceipt = await txResponse.getReceipt(client);
  return receipt;
}

export async function submitTransactionWithCustomPayer(
  transaction: TransferTransaction,
  client: Client,
  firstAccountId: AccountId | string,
  firstPrivateKey: PrivateKey,
  secondAccountId: AccountId | string,
  secondPrivateKey: PrivateKey
): Promise<TransactionReceipt> {
  // Set transaction ID with custom payer
  const transactionId = TransactionId.generate(firstAccountId);
  transaction.setTransactionId(transactionId);

  // free the transaction and sign by second account
  let signedTx = await transaction.freezeWith(client).sign(secondPrivateKey);

  // sign the transaction from first account to pay the fee
  signedTx = await signedTx.sign(TREASURY_ACCOUNT_PRIVATEKEY);
  const txResponse: TransactionResponse = await signedTx.execute(client);
  const receipt: TransactionReceipt = await txResponse.getReceipt(client);
  return receipt;
}

export async function multiSignTokenAndDistribution(
  client: Client,
  amount: number
): Promise<any> {
  // For local node
  // // Create the HTT token
  // const OPERATOR_ID = AccountId.fromString("0.0.2");
  // const OPERATOR_KEY = PrivateKey.fromString(
  //   "302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137"
  // );
  // client.setOperator(operatorId, operatorKey);

  client.setOperator(OPERATOR_ID, OPERATOR_KEY);
  const tokenCreateTx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(2)
    .setInitialSupply(toDecimal(1000, 2))
    .setTreasuryAccountId(OPERATOR_ID)
    .setSupplyType(TokenSupplyType.Infinite)
    .freezeWith(client);

  const tokenCreateSign = await tokenCreateTx.sign(OPERATOR_KEY);
  const tokenCreateSubmit = await tokenCreateSign.execute(client);
  const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
  const tokenId = tokenCreateRx.tokenId!;
  console.log(`Created token with ID: ${tokenId.toString()}`);

  // associate all tokens
  await associateAccountWithToken(
    TREASURY_ACCOUNT_ID,
    TREASURY_ACCOUNT_PRIVATEKEY,
    tokenId,
    client
  );
  await associateAccountWithToken(
    SECOND_ACCOUNT_ID,
    SECOND_ACCOUNT_PRIVATEKEY,
    tokenId,
    client
  );
  await associateAccountWithToken(
    NEW_ACCOUNT_ID,
    NEW_ACCOUNT_PRIVATEKEY,
    tokenId,
    client
  );
  await associateAccountWithToken(
    FOURTH_ACCOUNT_ID,
    FOURTH_ACCOUNT_PRIVATEKEY,
    tokenId,
    client
  );
  // Transfer 100 HTT tokens to each of the four accounts
  const fromAccountId = OPERATOR_ID.toString();
  await transferTokenToAccount(
    fromAccountId,
    TREASURY_ACCOUNT_ID,
    tokenId,
    amount,
    client
  );
  await transferTokenToAccount(
    fromAccountId,
    SECOND_ACCOUNT_ID,
    tokenId,
    amount,
    client
  );
  await transferTokenToAccount(
    fromAccountId,
    NEW_ACCOUNT_ID,
    tokenId,
    amount,
    client
  );
  await transferTokenToAccount(
    fromAccountId,
    FOURTH_ACCOUNT_ID,
    tokenId,
    amount,
    client
  );

  return tokenId;
}
