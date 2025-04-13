import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import {
  AccountBalanceQuery,
  AccountId,
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenId,
  TokenInfoQuery,
  TokenMintTransaction,
  TokenType,
} from "@hashgraph/sdk";
import assert from "node:assert";
import {
  TREASURY_ACCOUNT_ID,
  TREASURY_ACCOUNT_PRIVATEKEY,
} from "./token-service.helper";

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
    .setInitialSupply(totalSupply)
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
  const statusTokenCreateTx = receiptTokenCreateTx.status;

  assert.ok(statusTokenCreateTx, "SUCCESS");

  //Get the token ID from the receipt

  if (receiptTokenCreateTx?.tokenId) {
    tokenId = receiptTokenCreateTx?.tokenId;
  }
  // Get a valid token id
  // console.log("receiptTokenCreateTx", receiptTokenCreateTx);
  console.log("tokenId.num", tokenId.num.toString());
  assert.notEqual(tokenId.num.toString(), 0);
});

Then(/^The token has the name "([^"]*)"$/, async function (tokenName: string) {
  //Create a token info query
  const tokenInfoQuery = new TokenInfoQuery().setTokenId(tokenId);
  //Sign with the client operator private key, submit the query to the network and get the token supply
  const tokenInfoQueryResponse = await tokenInfoQuery.execute(client);

  assert.equal(tokenName, tokenInfoQueryResponse.name);
});

Then(
  /^The token has the symbol "([^"]*)"$/,
  async function (tokenSymbol: string) {
    //Create a token info query
    const tokenInfoQuery = new TokenInfoQuery().setTokenId(tokenId);
    //Sign with the client operator private key, submit the query to the network and get the token supply
    const tokenInfoQueryResponse = await tokenInfoQuery.execute(client);

    assert.equal(tokenSymbol, tokenInfoQueryResponse.symbol);
  }
);

Then(/^The token has (\d+) decimals$/, async function (tokenDecimal: string) {
  //Create a token info query
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

// TODO
Then(
  /^An attempt to mint (\d+) additional tokens succeeds$/,
  async function (tokenAmount: number) {
    // Mint 100 tokens
    const txTokenMint = await new TokenMintTransaction()
      .setTokenId(tokenId.toString())
      .setAmount(tokenAmount)
      .freezeWith(client);

    //Get the Transaction ID

    // Valid token id is generated
  }
);
When(
  /^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/,
  async function () {}
);
Then(/^The total supply of the token is (\d+)$/, async function () {});
Then(/^An attempt to mint tokens fails$/, async function () {});
Given(
  /^A first hedera account with more than (\d+) hbar$/,
  async function () {}
);
Given(/^A second Hedera account$/, async function () {});
Given(
  /^A token named Test Token \(HTT\) with (\d+) tokens$/,
  async function () {}
);
Given(/^The first account holds (\d+) HTT tokens$/, async function () {});
Given(/^The second account holds (\d+) HTT tokens$/, async function () {});
When(
  /^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/,
  async function () {}
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
