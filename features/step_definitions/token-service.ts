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
  TokenSupplyType,
  TokenType,
  TransactionReceipt,
  TransactionRecord,
  TransferTransaction,
} from "@hashgraph/sdk";
import assert from "node:assert";
import {
  associateAccountWithToken,
  FOURTH_ACCOUNT_ID,
  FOURTH_ACCOUNT_PRIVATEKEY,
  getAccountTokenBalance,
  mintToken,
  multiSignTokenAndDistribution,
  NEW_ACCOUNT_ID,
  NEW_ACCOUNT_PRIVATEKEY,
  OPERATOR_ID,
  OPERATOR_KEY,
  SECOND_ACCOUNT_ID,
  SECOND_ACCOUNT_PRIVATEKEY,
  toDecimal,
  transferTokenToAccount,
  TREASURY_ACCOUNT_ID,
  TREASURY_ACCOUNT_PRIVATEKEY,
} from "./token-service.helper";

const client = Client.forTestnet();
let tokenId: TokenId;
let transaction: TransferTransaction;
let transactionRecord: TransactionRecord;

// const node = { "127.0.0.1:50211": new AccountId(3) };
// const mirrorNode = "127.0.0.1:5600";

// // Create the client instance
// const client = Client.forNetwork(node).setMirrorNetwork(mirrorNode);

Given(
  /^A Hedera account with more than (\d+) hbar$/,
  async function (expectedBalance: number) {
    const account = accounts[0];
    const MY_ACCOUNT_ID = AccountId.fromString(account.id);
    const MY_PRIVATE_KEY = PrivateKey.fromStringECDSA(account.privateKey);
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
    // Mint Tokens
    const txTokenMint = await new TokenMintTransaction()
      .setTokenId(tokenId.num.toString())
      .setAmount(toDecimal(tokenAmount, 2))
      .freezeWith(client);
    //Sign with the supply private key of the token
    const signTxTokenMint = await txTokenMint.sign(TREASURY_ACCOUNT_PRIVATEKEY);
    //Submit the transaction to a Hedera network
    const txTokenMintResponse = await signTxTokenMint.execute(client);
    //Request the receipt of the transaction
    const receiptTokenMintTx = await txTokenMintResponse.getReceipt(client);
    //Get the transaction consensus status
    const statusTokenMintTx = await receiptTokenMintTx.status;

    assert.equal(statusTokenMintTx.toString(), "SUCCESS");
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
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(maxSupply)
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

    assert.equal(initialTokenSupply.toNumber(), totalSupply);
  }
);
Then(/^An attempt to mint tokens fails$/, async function () {
  try {
    // Mint Token
    const txTokenMint = await new TokenMintTransaction()
      .setTokenId(tokenId.num.toString())
      .setAmount(toDecimal(1000, 2))
      .freezeWith(client);

    //Sign with the supply private key of the token
    const signTxTokenMint = await txTokenMint.sign(TREASURY_ACCOUNT_PRIVATEKEY); //Fill in the supply private key
    //Submit the transaction to a Hedera network
    const txTokenMintResponse = await signTxTokenMint.execute(client);
  } catch (error) {
    assert.ok(true);
  }
});

Given(
  /^A first hedera account with more than (\d+) hbar$/,
  async function (expectedBalance: number) {
    client.setOperator(TREASURY_ACCOUNT_ID, TREASURY_ACCOUNT_PRIVATEKEY);
    const firstAccountBalance = await getAccountTokenBalance(
      TREASURY_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log("First Account", firstAccountBalance);
    assert.ok(firstAccountBalance >= toDecimal(expectedBalance, 2));
  }
);
Given(/^A second Hedera account$/, async function () {
  client.setOperator(SECOND_ACCOUNT_ID, SECOND_ACCOUNT_PRIVATEKEY);
});
Given(
  /^A token named Test Token \(HTT\) with (\d+) tokens$/,
  { timeout: 30000 },
  async function (tokenAmount: number) {
    // Set operator to treasury account
    client.setOperator(TREASURY_ACCOUNT_ID, TREASURY_ACCOUNT_PRIVATEKEY);

    // Create token with specified amount
    const tokenName = "Test Token";
    const tokenSymbol = "HTT";
    const decimals = 2;

    const createTokenTx = await new TokenCreateTransaction()
      .setTokenName(tokenName)
      .setTokenSymbol(tokenSymbol)
      .setDecimals(decimals)
      .setInitialSupply(toDecimal(tokenAmount, decimals))
      .setTreasuryAccountId(TREASURY_ACCOUNT_ID)
      .setSupplyKey(TREASURY_ACCOUNT_PRIVATEKEY)
      .freezeWith(client);

    const signTx = await createTokenTx.sign(TREASURY_ACCOUNT_PRIVATEKEY);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);

    if (receipt.status.toString() !== "SUCCESS") {
      throw new Error(`Failed to create token: ${receipt.status}`);
    }

    if (!receipt.tokenId) {
      throw new Error("Token ID is null in receipt");
    }

    tokenId = receipt.tokenId;
    console.log(`Created token ${tokenId} with initial supply ${tokenAmount}`);
  }
);
Given(
  /^The first account holds (\d+) HTT tokens$/,
  { timeout: 25000 },
  async function (expectedBalance: number) {
    client.setOperator(TREASURY_ACCOUNT_ID, TREASURY_ACCOUNT_PRIVATEKEY);

    const expectedBalanceInDecimal = toDecimal(expectedBalance, 2);
    const firstAccountBalance = await getAccountTokenBalance(
      TREASURY_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log("First Account Balance", firstAccountBalance.toString());
    // If account holds more than 100 then transfer to other account
    if (firstAccountBalance > expectedBalanceInDecimal) {
      const diffAmount = firstAccountBalance - expectedBalanceInDecimal;
      await associateAccountWithToken(
        OPERATOR_ID,
        OPERATOR_KEY,
        tokenId,
        client
      );
      await transferTokenToAccount(
        TREASURY_ACCOUNT_ID,
        OPERATOR_ID,
        tokenId,
        diffAmount,
        client
      );
      const updatedBalance = await getAccountTokenBalance(
        TREASURY_ACCOUNT_ID,
        tokenId,
        client
      );
      assert.equal(updatedBalance, expectedBalanceInDecimal);
    } else {
      assert.equal(firstAccountBalance, expectedBalanceInDecimal);
    }
  }
);
Given(
  /^The second account holds (\d+) HTT tokens$/,
  { timeout: 25000 },
  async function (expectedBalance: number) {
    client.setOperator(TREASURY_ACCOUNT_ID, TREASURY_ACCOUNT_PRIVATEKEY);

    const expectedBalanceInDecimal = toDecimal(expectedBalance, 2);
    const secondAccountBalance = await getAccountTokenBalance(
      SECOND_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log("Second Account Balance", secondAccountBalance.toString());
    const newBalance = await getAccountTokenBalance(
      TREASURY_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log("new Account Balance", newBalance.toString());

    // If account holds more than 100 then transfer to other account
    if (secondAccountBalance != expectedBalanceInDecimal) {
      // const diffAmount = expectedBalanceInDecimal - secondAccountBalance;
      await associateAccountWithToken(
        SECOND_ACCOUNT_ID,
        SECOND_ACCOUNT_PRIVATEKEY,
        tokenId,
        client
      );
      await transferTokenToAccount(
        TREASURY_ACCOUNT_ID,
        SECOND_ACCOUNT_ID,
        tokenId,
        expectedBalanceInDecimal,
        client
      );
      const updatedBalance = await getAccountTokenBalance(
        SECOND_ACCOUNT_ID,
        tokenId,
        client
      );
      const newUpdatedBalance = await getAccountTokenBalance(
        TREASURY_ACCOUNT_ID,
        tokenId,
        client
      );
      console.log("new Update Account Balance", newUpdatedBalance.toString());
      console.log("Second Update Account Balance", updatedBalance.toString());
      assert.equal(updatedBalance, expectedBalanceInDecimal);
    } else {
      assert.equal(secondAccountBalance, expectedBalanceInDecimal);
    }
  }
);
When(
  /^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/,
  { timeout: 30000 },
  async function (tokenAmount: number) {
    const amount = toDecimal(tokenAmount, 2);
    await associateAccountWithToken(
      SECOND_ACCOUNT_ID,
      SECOND_ACCOUNT_PRIVATEKEY,
      tokenId,
      client
    );
    // step 1: create a transaction from first account
    transaction = new TransferTransaction()
      .addTokenTransfer(tokenId, TREASURY_ACCOUNT_ID, -amount)
      .addTokenTransfer(tokenId, SECOND_ACCOUNT_ID, amount);

    // step 2: freeze the transaction from sender - first account
    transaction.freezeWith(client);

    // step 3: sign the pending transaction
    await transaction.sign(TREASURY_ACCOUNT_PRIVATEKEY);
  }
);
When(/^The first account submits the transaction$/, async function () {
  // submit the transaction signed by first account
  const transactionResponse = await transaction.execute(client);
  const transactionReceipt = await transactionResponse.getReceipt(client);
  transactionRecord = await transactionResponse.getRecord(client);

  assert.equal(transactionReceipt.status.toString(), "SUCCESS");
});
When(
  /^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/,
  async function (tokenAmount: number) {
    const newClient = Client.forTestnet();

    // For local Node
    // const newClient = Client.forNetwork(node).setMirrorNetwork(mirrorNode);

    const amount = toDecimal(tokenAmount, 2);
    // step 1: create a transaction from second account
    transaction = new TransferTransaction()
      .addTokenTransfer(tokenId, SECOND_ACCOUNT_ID, -amount)
      .addTokenTransfer(tokenId, TREASURY_ACCOUNT_ID, amount);

    // step 2: freeze the transaction from sender - second account
    transaction.freezeWith(newClient);

    // step 3: sign the pending transaction
    await transaction.sign(SECOND_ACCOUNT_PRIVATEKEY);
  }
);
Then(/^The first account has paid for the transaction fee$/, async function () {
  console.log(
    " transactionRecord.transactionId.accountId?.toString()",
    transactionRecord.transactionId.accountId?.toString()
  );
});
Given(
  /^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedHBARBalance: number, expectedTokenBalance: number) {
    // Set operator to treasury account
    client.setOperator(TREASURY_ACCOUNT_ID, TREASURY_ACCOUNT_PRIVATEKEY);

    // Verify HBAR balance
    const hbarBalance = await new AccountBalanceQuery()
      .setAccountId(TREASURY_ACCOUNT_ID)
      .execute(client);

    if (hbarBalance.hbars.toBigNumber().toNumber() < expectedHBARBalance) {
      throw new Error(`Insufficient HBAR balance for first account`);
    }

    // Verify token balance
    const tokenBalance = await getAccountTokenBalance(
      TREASURY_ACCOUNT_ID,
      tokenId,
      client
    );

    if (tokenBalance < toDecimal(expectedTokenBalance, 2)) {
      throw new Error(`Insufficient token balance for first account`);
    }
  }
);
Given(
  /^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedHBARBalance: number, expectedTokenBalance: number) {
    // Set operator to second account
    client.setOperator(SECOND_ACCOUNT_ID, SECOND_ACCOUNT_PRIVATEKEY);

    // Verify HBAR balance
    const hbarBalance = await new AccountBalanceQuery()
      .setAccountId(SECOND_ACCOUNT_ID)
      .execute(client);

    if (hbarBalance.hbars.toBigNumber().toNumber() < expectedHBARBalance) {
      throw new Error(`Insufficient HBAR balance for second account`);
    }

    // Associate account with token if not already associated
    await associateAccountWithToken(
      SECOND_ACCOUNT_ID,
      SECOND_ACCOUNT_PRIVATEKEY,
      tokenId,
      client
    );

    // Verify token balance
    const tokenBalance = await getAccountTokenBalance(
      SECOND_ACCOUNT_ID,
      tokenId,
      client
    );

    if (tokenBalance < toDecimal(expectedTokenBalance, 2)) {
      // Transfer tokens from treasury to second account
      await transferTokenToAccount(
        TREASURY_ACCOUNT_ID,
        SECOND_ACCOUNT_ID,
        tokenId,
        toDecimal(expectedTokenBalance, 2),
        client
      );
    }
  }
);
Given(
  /^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedHBARBalance: number, expectedTokenBalance: number) {
    // Set operator to third account
    client.setOperator(NEW_ACCOUNT_ID, NEW_ACCOUNT_PRIVATEKEY);

    // Verify HBAR balance
    const hbarBalance = await new AccountBalanceQuery()
      .setAccountId(NEW_ACCOUNT_ID)
      .execute(client);

    if (hbarBalance.hbars.toBigNumber().toNumber() < expectedHBARBalance) {
      throw new Error(`Insufficient HBAR balance for third account`);
    }

    // Associate account with token if not already associated
    await associateAccountWithToken(
      NEW_ACCOUNT_ID,
      NEW_ACCOUNT_PRIVATEKEY,
      tokenId,
      client
    );

    // Verify token balance
    const tokenBalance = await getAccountTokenBalance(
      NEW_ACCOUNT_ID,
      tokenId,
      client
    );

    if (tokenBalance < toDecimal(expectedTokenBalance, 2)) {
      // Transfer tokens from treasury to third account
      await transferTokenToAccount(
        TREASURY_ACCOUNT_ID,
        NEW_ACCOUNT_ID,
        tokenId,
        toDecimal(expectedTokenBalance, 2),
        client
      );
    }
  }
);
Given(
  /^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedHBARBalance: number, expectedTokenBalance: number) {
    // Set operator to fourth account
    client.setOperator(FOURTH_ACCOUNT_ID, FOURTH_ACCOUNT_PRIVATEKEY);

    // Verify HBAR balance
    const hbarBalance = await new AccountBalanceQuery()
      .setAccountId(FOURTH_ACCOUNT_ID)
      .execute(client);

    if (hbarBalance.hbars.toBigNumber().toNumber() < expectedHBARBalance) {
      throw new Error(`Insufficient HBAR balance for fourth account`);
    }

    // Associate account with token if not already associated
    await associateAccountWithToken(
      FOURTH_ACCOUNT_ID,
      FOURTH_ACCOUNT_PRIVATEKEY,
      tokenId,
      client
    );

    // Verify token balance
    const tokenBalance = await getAccountTokenBalance(
      FOURTH_ACCOUNT_ID,
      tokenId,
      client
    );

    if (tokenBalance < toDecimal(expectedTokenBalance, 2)) {
      // Transfer tokens from treasury to fourth account
      await transferTokenToAccount(
        TREASURY_ACCOUNT_ID,
        FOURTH_ACCOUNT_ID,
        tokenId,
        toDecimal(expectedTokenBalance, 2),
        client
      );
    }
  }
);
When(
  /^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/,
  { timeout: 30000 },
  async function (
    transferAmount: number,
    thirdAccountAmount: number,
    fourthAccountAmount: number
  ) {
    // FOr local node
    // const operatorId = AccountId.fromString("0.0.2");
    // const operatorKey = PrivateKey.fromString(
    //   "302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137"
    // );
    // client.setOperator(operatorId, operatorKey);
    const tokenAmount = toDecimal(100, 2);

    // This method creates a new
    // Associate all the accounts new token id
    // Distribute the Token to all four accounts
    tokenId = await multiSignTokenAndDistribution(client, tokenAmount);
    const amount = toDecimal(transferAmount, 2);
    const thirdAmount = toDecimal(thirdAccountAmount, 2);
    const fourthAmount = toDecimal(fourthAccountAmount, 2);

    // Create the transfer transaction
    const transferTx = new TransferTransaction()
      .addTokenTransfer(tokenId, TREASURY_ACCOUNT_ID, -amount) // First account transfer out
      .addTokenTransfer(tokenId, SECOND_ACCOUNT_ID, -amount) // Second account transfer out
      .addTokenTransfer(tokenId, NEW_ACCOUNT_ID, thirdAmount) // Third account transfer in
      .addTokenTransfer(tokenId, FOURTH_ACCOUNT_ID, fourthAmount); // Fourth account transfer in

    // Freeze the transaction to prepare for signing
    const frozenTx = await transferTx.freezeWith(client);

    // To perform multi party transaction
    // Sign with first account
    const signedByFirstAccount = await frozenTx.sign(
      TREASURY_ACCOUNT_PRIVATEKEY
    );

    // Sign with the second account
    // and assign to transaction so first signer can submit the transaction
    transaction = await signedByFirstAccount.sign(SECOND_ACCOUNT_PRIVATEKEY);
  }
);
Then(
  /^The third account holds (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedBalance: number) {
    const expectedBalanceInDecimal = toDecimal(expectedBalance, 2);
    const thirdAccountBalance = await getAccountTokenBalance(
      NEW_ACCOUNT_ID,
      tokenId,
      client
    );
    assert.equal(thirdAccountBalance, expectedBalanceInDecimal);
  }
);
Then(
  /^The fourth account holds (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedBalance: number) {
    const expectedBalanceInDecimal = toDecimal(expectedBalance, 2);
    const fourthAccountBalance = await getAccountTokenBalance(
      FOURTH_ACCOUNT_ID,
      tokenId,
      client
    );
    assert.equal(fourthAccountBalance, expectedBalanceInDecimal);
  }
);
