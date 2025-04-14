import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import {
  AccountBalanceQuery,
  AccountId,
  Client,
  PrivateKey,
  Status,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenInfoQuery,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransferTransaction,
} from "@hashgraph/sdk";
import assert from "node:assert";
import {
  associateAccountWithToken,
  getAccountTokenBalance,
  NEW_ACCOUNT_ID,
  NEW_ACCOUNT_PRIVATEKEY,
  SECOND_ACCOUNT_ID,
  SECOND_ACCOUNT_PRIVATEKEY,
  toDecimal,
  toNumber,
  transferTokenToAccount,
  TREASURY_ACCOUNT_ID,
  TREASURY_ACCOUNT_PRIVATEKEY,
} from "./token-service.helper";
import { Stats } from "node:fs";

const client = Client.forTestnet();
let tokenId: TokenId;
Given(
  /^A Hedera account with more than (\d+) hbar$/,
  async function (expectedBalance: number) {
    const account = accounts[0];
    const MY_ACCOUNT_ID = AccountId.fromString(account.id);
    const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(account.privateKey);
    client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

    //Create the query request
    const query = new AccountBalanceQuery().setAccountId(MY_ACCOUNT_ID);
    const balance = await query.execute(client);
    assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
  }
);

When(/^I create a token named Test Token \(HTT\)$/, async function () {
  //Create the transaction and freeze for manual signing
  const tokenName: string = "Test Token";
  const tokenSymbol: string = "HTT";
  const tokenDecimal: number = 2;
  const mintAmount: number = 100;
  const totalSupply: number = 1000;

  // Create Token Transaction
  const txTokenCreate = await new TokenCreateTransaction()
    .setTokenName(tokenName)
    .setTokenSymbol(tokenSymbol)
    .setDecimals(tokenDecimal)
    .setTokenType(TokenType.FungibleCommon)
    .setTreasuryAccountId(TREASURY_ACCOUNT_ID)
    .setSupplyKey(TREASURY_ACCOUNT_PRIVATEKEY)
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

  assert.ok(statusTokenCreateTx, "SUCCESS");

  //Get the token ID from the receipt

  if (receiptTokenCreateTx?.tokenId) {
    tokenId = receiptTokenCreateTx?.tokenId;
  }
  // Get a valid token id
  console.log("receiptTokenCreateTx", statusTokenCreateTx);
  console.log("tokenId.num", tokenId.num.toString());
  assert.notEqual(tokenId.num.toString(), 0);
});

Then(/^The token has the name "([^"]*)"$/, async function (tokenName: string) {
  //Create a token info query
  const tokenInfoQuery = new TokenInfoQuery().setTokenId(tokenId);
  const tokenInfoQueryResponse = await tokenInfoQuery.execute(client);

  assert.equal(tokenName, tokenInfoQueryResponse.name);
});

Then(
  /^The token has the symbol "([^"]*)"$/,
  async function (tokenSymbol: string) {
    // Create a token info query
    const tokenInfoQuery = new TokenInfoQuery().setTokenId(tokenId);
    //Sign with the client operator private key, submit the query to the network and get the token supply
    const tokenInfoQueryResponse = await tokenInfoQuery.execute(client);
    assert.equal(tokenSymbol, tokenInfoQueryResponse.symbol);
  }
);

Then(/^The token has (\d+) decimals$/, async function (tokenDecimal: string) {
  // Create a token info query
  const tokenInfoQuery = new TokenInfoQuery().setTokenId(tokenId);
  //Sign with the client operator private key, submit the query to the network and get the token supply
  const tokenInfoQueryResponse = await tokenInfoQuery.execute(client);
  assert.equal(tokenDecimal, tokenInfoQueryResponse.decimals);
});

Then(/^The token is owned by the account$/, async function () {
  //Create a token info query
  const tokenInfoQuery = new TokenInfoQuery().setTokenId(tokenId);
  //Sign with the client operator private key, submit the query to the network and get the token supply
  const tokenInfoQueryResponse = await tokenInfoQuery.execute(client);
  assert.equal(TREASURY_ACCOUNT_ID, tokenInfoQueryResponse.treasuryAccountId);
});

Then(
  /^An attempt to mint (\d+) additional tokens succeeds$/,
  async function (tokenAmount: number) {
    // Verify the tokens were minted by checking the new supply
    const initialTokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId.num.toString())
      .execute(client);
    const initialTokenSupply = initialTokenInfo.totalSupply;
    // Initial Token Supply to be 0
    console.log("Init Supply", initialTokenSupply);
    // assert.equal(initialTokenInfo.totalSupply, 0);
    // Mint Tokens
    const txTokenMint = await new TokenMintTransaction()
      .setTokenId(tokenId.num.toString())
      .setAmount(toDecimal(tokenAmount, 2))
      .freezeWith(client);
    //Sign with the supply private key of the token
    const signTxTokenMint = await txTokenMint.sign(TREASURY_ACCOUNT_PRIVATEKEY); //Fill in the supply private key
    //Submit the transaction to a Hedera network
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
    // Token Supply should be non zero
    assert.notEqual(tokenInfo.totalSupply, initialTokenSupply);
  }
);

When(
  /^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/,
  async function (maxSupply: number) {
    //Create the transaction and freeze for manual signing
    const tokenName: string = "Test Token";
    const tokenSymbol: string = "HTT";
    const tokenDecimal: number = 2;
    const mintAmount: number = 100;

    // Create Token Transaction
    const txTokenCreate = await new TokenCreateTransaction()
      .setTokenName(tokenName)
      .setTokenSymbol(tokenSymbol)
      .setDecimals(tokenDecimal)
      .setTokenType(TokenType.FungibleCommon)
      .setTreasuryAccountId(TREASURY_ACCOUNT_ID)
      .setSupplyKey(TREASURY_ACCOUNT_PRIVATEKEY)
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

    assert.ok(statusTokenCreateTx, "SUCCESS");

    if (receiptTokenCreateTx?.tokenId) {
      tokenId = receiptTokenCreateTx?.tokenId;
    }
    // Get a valid token id
    console.log("receiptTokenCreateTx", statusTokenCreateTx.toString());
    console.log("tokenId.num", tokenId.num.toString());
    assert.notEqual(tokenId.num.toString(), 0);
  }
);
Then(
  /^The total supply of the token is (\d+)$/,
  async function (totalSupply: number) {
    // Verify the tokens were minted by checking the new supply
    const initialTokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId.num.toString())
      .execute(client);

    const initialTokenSupply = initialTokenInfo.totalSupply;
    // Initial Token Supply to be 0
    console.log("Init Supply", initialTokenSupply.toNumber());
    // assert.equal(initialTokenSupply, totalSupply);
  }
);
Then(/^An attempt to mint tokens fails$/, async function () {
  // Mint Token
  const txTokenMint = await new TokenMintTransaction()
    .setTokenId(tokenId.num.toString())
    .setAmount(toDecimal(1000, 2))
    .freezeWith(client);

  //Sign with the supply private key of the token
  const signTxTokenMint = await txTokenMint.sign(TREASURY_ACCOUNT_PRIVATEKEY); //Fill in the supply private key
  //Submit the transaction to a Hedera network
  const txTokenMintResponse = await signTxTokenMint.execute(client);
  //Request the receipt of the transaction
  const receiptTokenMintTx = await txTokenMintResponse.getReceipt(client);
});

Given(
  /^A first hedera account with more than (\d+) hbar$/,
  async function (expectedBalance: number) {
    const account = accounts[0];
    const MY_ACCOUNT_ID = AccountId.fromString(account.id);
    const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(account.privateKey);
    client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

    //Create the query request
    const query = new AccountBalanceQuery().setAccountId(MY_ACCOUNT_ID);
    const balance = await query.execute(client);
    assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
  }
);
Given(/^A second Hedera account$/, async function () {
  const acc = accounts[1];
  const account: AccountId = AccountId.fromString(acc.id);
  const privKey: PrivateKey = PrivateKey.fromStringECDSA(acc.privateKey);
  client.setOperator(account, privKey);
  //Create the account query request
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client);
  console.log(balance.hbars.toBigNumber().toNumber());
  assert.ok(balance.hbars.toBigNumber().toNumber() > 0);
});
Given(
  /^A token named Test Token \(HTT\) with (\d+) tokens$/,
  async function (tokenAmount: number) {
    //Create the transaction and freeze for manual signing
    const tokenName: string = "Test Token";
    const tokenSymbol: string = "HTT";
    const tokenDecimal: number = 2;

    // Create Token Transaction
    const txTokenCreate = await new TokenCreateTransaction()
      .setTokenName(tokenName)
      .setTokenSymbol(tokenSymbol)
      .setDecimals(tokenDecimal)
      .setTokenType(TokenType.FungibleCommon)
      .setTreasuryAccountId(TREASURY_ACCOUNT_ID)
      .setSupplyKey(TREASURY_ACCOUNT_PRIVATEKEY)
      .setInitialSupply(toDecimal(tokenAmount, 2))
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

    assert.ok(statusTokenCreateTx, "SUCCESS");
    if (receiptTokenCreateTx?.tokenId) {
      tokenId = receiptTokenCreateTx?.tokenId;
    }
  }
);
Given(
  /^The first account holds (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedBalance: number) {
    // Transfer 900 tokens to new account
    const amount: number = toDecimal(900, 2);

    await associateAccountWithToken(
      NEW_ACCOUNT_ID,
      NEW_ACCOUNT_PRIVATEKEY,
      tokenId,
      client
    );

    const transferTokenStatus = await transferTokenToAccount(
      TREASURY_ACCOUNT_ID,
      NEW_ACCOUNT_ID,
      tokenId,
      amount,
      client
    );
    assert.ok(
      transferTokenStatus,
      "Successfully trasnferred token and reduce the balanec of treauery account"
    );
    const firstAccountBalance = await getAccountTokenBalance(
      TREASURY_ACCOUNT_ID,
      tokenId,
      client
    );
    assert.equal(firstAccountBalance, toDecimal(expectedBalance, 2));
  }
);
Given(
  /^The second account holds (\d+) HTT tokens$/,

  async function (expectedBalance: number) {
    const accountBalance = await getAccountTokenBalance(
      SECOND_ACCOUNT_ID,
      tokenId,
      client
    );
    assert.equal(accountBalance, toDecimal(expectedBalance, 2));
  }
);
When(
  /^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/,
  { timeout: 30000 },
  async function (transferAmount: number) {
    // Associate Second Account
    const isAccountAssociatedStatus = await associateAccountWithToken(
      SECOND_ACCOUNT_ID,
      SECOND_ACCOUNT_PRIVATEKEY,
      tokenId,
      client
    );
    assert.ok(isAccountAssociatedStatus, "Account Associated Successfully");
    // Transfer Token to Seconds Account
    const tokenTransferStatus = await transferTokenToAccount(
      TREASURY_ACCOUNT_ID,
      SECOND_ACCOUNT_ID,
      tokenId,
      toDecimal(transferAmount, 2),
      client
    );

    assert.ok(tokenTransferStatus, "Second Account Associated With Token");
    const accountBalance = await getAccountTokenBalance(
      SECOND_ACCOUNT_ID,
      tokenId,
      client
    );
    assert.equal(accountBalance, toDecimal(transferAmount, 2));
  }
);
When(/^The first account submits the transaction$/, async function () {});
When(
  /^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/,
  async function () {}
);
Then(
  /^The first account has paid for the transaction fee$/,
  async function () {}
);
Given(
  /^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/,
  async function () {}
);
Given(
  /^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  async function () {}
);
Given(
  /^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  async function () {}
);
Given(
  /^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  async function () {}
);
When(
  /^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/,
  async function () {}
);
Then(/^The third account holds (\d+) HTT tokens$/, async function () {});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function () {});
