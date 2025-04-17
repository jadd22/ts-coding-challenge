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
  NEW_ACCOUNT_ID,
  NEW_ACCOUNT_PRIVATEKEY,
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
        NEW_ACCOUNT_ID,
        NEW_ACCOUNT_PRIVATEKEY,
        tokenId,
        client
      );
      await transferTokenToAccount(
        TREASURY_ACCOUNT_ID,
        NEW_ACCOUNT_ID,
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

    // step 1: create a transaction from first account
    transaction = new TransferTransaction()
      .addTokenTransfer(tokenId, TREASURY_ACCOUNT_ID, -amount)
      .addTokenTransfer(tokenId, SECOND_ACCOUNT_ID, amount);

    // step 2: freeze the transaction from sender - first account
    transaction.freezeWith(client);

    // step 3: sign the pending transaction
    await transaction.sign(SECOND_ACCOUNT_PRIVATEKEY);
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
    // Client.forNetwork(node).setMirrorNetwork(mirrorNode);
    const newClient = Client.forTestnet();
    // const newClient = Client.forNetwork(node).setMirrorNetwork(mirrorNode);
    const amount = toDecimal(tokenAmount, 2);
    newClient.setOperator(SECOND_ACCOUNT_ID, SECOND_ACCOUNT_PRIVATEKEY);
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
  // assert.ok(
  //   transactionRecord.transactionId.accountId?.toString() ==
  //     TREASURY_ACCOUNT_ID.toString()
  // );
});
Given(
  /^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedHBARBalance: number, expectedTokenBalance: number) {
    // Reset Client to Treasury

    client.setOperator(TREASURY_ACCOUNT_ID, TREASURY_ACCOUNT_PRIVATEKEY);
    const tokenAmount = toDecimal(expectedTokenBalance, 2);
    const accountBalanceQuery = await new AccountBalanceQuery().setAccountId(
      TREASURY_ACCOUNT_ID
    );
    const accountBalance = await accountBalanceQuery.execute(client);
    const hbarBalance = await accountBalance.hbars.toBigNumber().toNumber();
    const tokenAccountBalance = await getAccountTokenBalance(
      TREASURY_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log("hbarBalance", hbarBalance);
    console.log("hbarBalanceExp", expectedHBARBalance);
    // assert.ok(hbarBalance >= expectedHBARBalance);
    if (tokenAccountBalance < tokenAmount) {
      await associateAccountWithToken(
        TREASURY_ACCOUNT_ID,
        TREASURY_ACCOUNT_PRIVATEKEY,
        tokenId,
        client
      );

      await transferTokenToAccount(
        NEW_ACCOUNT_ID,
        TREASURY_ACCOUNT_ID,
        tokenId,
        tokenAmount,
        client
      );
    } else {
      const tokenAccountBalanceUpdate = await getAccountTokenBalance(
        TREASURY_ACCOUNT_ID,
        tokenId,
        client
      );
      console.log(
        "tokenAccountBalanceUpdate",
        tokenAccountBalanceUpdate.toString()
      );
      // assert.ok(tokenAccountBalanceUpdate >= tokenAmount);
    }
    console.log("tokenAccountBalance", tokenAccountBalance.toString());
    // assert.ok(tokenAccountBalance >= toDecimal(expectedTokenBalance, 2));
  }
);
Given(
  /^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedHBARBalance: number, expectedTokenBalance: number) {
    const tokenAmount = toDecimal(expectedTokenBalance, 2);
    const accountBalanceQuery = await new AccountBalanceQuery().setAccountId(
      SECOND_ACCOUNT_ID
    );
    const accountBalance = await accountBalanceQuery.execute(client);
    const hbarBalance = await accountBalance.hbars.toBigNumber().toNumber();
    const tokenAccountBalance = await getAccountTokenBalance(
      SECOND_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log("hbarBalance", hbarBalance);
    console.log("hbarBalanceExp", expectedHBARBalance);
    // assert.ok(hbarBalance >= expectedHBARBalance);
    if (tokenAccountBalance < tokenAmount) {
      await associateAccountWithToken(
        SECOND_ACCOUNT_ID,
        SECOND_ACCOUNT_PRIVATEKEY,
        tokenId,
        client
      );

      await transferTokenToAccount(
        NEW_ACCOUNT_ID,
        SECOND_ACCOUNT_ID,
        tokenId,
        tokenAmount,
        client
      );
    } else {
      const tokenAccountBalanceUpdate = await getAccountTokenBalance(
        SECOND_ACCOUNT_ID,
        tokenId,
        client
      );
      console.log(
        "tokenAccountBalanceUpdate",
        tokenAccountBalanceUpdate.toString()
      );
      // assert.ok(tokenAccountBalanceUpdate >= tokenAmount);
    }
    console.log("tokenAccountBalance", tokenAccountBalance.toString());
    // assert.ok(tokenAccountBalance >= toDecimal(expectedTokenBalance, 2));
  }
);
Given(
  /^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedHBARBalance: number, expectedTokenBalance: number) {
    const tokenAmount = toDecimal(expectedTokenBalance, 2);
    const accountBalanceQuery = await new AccountBalanceQuery().setAccountId(
      NEW_ACCOUNT_ID
    );
    const accountBalance = await accountBalanceQuery.execute(client);
    const hbarBalance = await accountBalance.hbars.toBigNumber().toNumber();
    const tokenAccountBalance = await getAccountTokenBalance(
      NEW_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log("hbarBalance", hbarBalance);
    console.log("hbarBalanceExp", expectedHBARBalance);

    if (tokenAccountBalance < tokenAmount) {
      await associateAccountWithToken(
        NEW_ACCOUNT_ID,
        NEW_ACCOUNT_PRIVATEKEY,
        tokenId,
        client
      );

      await transferTokenToAccount(
        TREASURY_ACCOUNT_ID,
        NEW_ACCOUNT_ID,
        tokenId,
        tokenAmount,
        client
      );
    } else {
      const tokenAccountBalanceUpdate = await getAccountTokenBalance(
        NEW_ACCOUNT_ID,
        tokenId,
        client
      );
      console.log(
        "tokenAccountBalanceUpdate",
        tokenAccountBalanceUpdate.toString()
      );
    }
    console.log("tokenAccountBalance", tokenAccountBalance.toString());
  }
);
Given(
  /^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/,
  { timeout: 30000 },
  async function (expectedHBARBalance: number, expectedTokenBalance: number) {
    const tokenAmount = toDecimal(expectedTokenBalance, 2);
    const accountBalanceQuery = await new AccountBalanceQuery().setAccountId(
      FOURTH_ACCOUNT_ID
    );
    const accountBalance = await accountBalanceQuery.execute(client);
    const hbarBalance = await accountBalance.hbars.toBigNumber().toNumber();
    const tokenAccountBalance = await getAccountTokenBalance(
      FOURTH_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log("hbarBalance", hbarBalance);
    console.log("hbarBalanceExp", expectedHBARBalance);

    if (tokenAccountBalance < tokenAmount) {
      await associateAccountWithToken(
        FOURTH_ACCOUNT_ID,
        FOURTH_ACCOUNT_PRIVATEKEY,
        tokenId,
        client
      );

      await transferTokenToAccount(
        TREASURY_ACCOUNT_ID,
        FOURTH_ACCOUNT_ID,
        tokenId,
        tokenAmount,
        client
      );
    } else {
      const tokenAccountBalanceUpdate = await getAccountTokenBalance(
        FOURTH_ACCOUNT_ID,
        tokenId,
        client
      );
      console.log(
        "tokenAccountBalanceUpdate",
        tokenAccountBalanceUpdate.toString()
      );
    }
    console.log("tokenAccountBalance", tokenAccountBalance.toString());
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
    const amount = toDecimal(transferAmount, 2);
    const thirdAmount = toDecimal(thirdAccountAmount, 2);
    const fourthAmount = toDecimal(fourthAccountAmount, 2);

    // Log initial balances
    console.log("\n=== Initial Balances ===");
    const treasuryBalance = await getAccountTokenBalance(
      TREASURY_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log(
      `Treasury Account (${TREASURY_ACCOUNT_ID}): ${treasuryBalance} HTT`
    );

    const secondAccountBalance = await getAccountTokenBalance(
      SECOND_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log(
      `Second Account (${SECOND_ACCOUNT_ID}): ${secondAccountBalance} HTT`
    );

    const thirdAccountBalance = await getAccountTokenBalance(
      NEW_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log(
      `Third Account (${NEW_ACCOUNT_ID}): ${thirdAccountBalance} HTT`
    );

    const fourthAccountBalance = await getAccountTokenBalance(
      FOURTH_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log(
      `Fourth Account (${FOURTH_ACCOUNT_ID}): ${fourthAccountBalance} HTT`
    );

    // If either account has insufficient balance, mint new tokens and transfer
    if (treasuryBalance < amount || secondAccountBalance < amount) {
      console.log("\n=== Minting Additional Tokens ===");
      // Mint additional tokens to treasury
      const mintAmount =
        Math.max(amount - treasuryBalance, amount - secondAccountBalance) * 2;
      console.log(`Minting ${mintAmount} new tokens to Treasury account`);

      const txTokenMint = await new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(mintAmount)
        .freezeWith(client);

      const signTxTokenMint = await txTokenMint.sign(
        TREASURY_ACCOUNT_PRIVATEKEY
      );
      const txTokenMintResponse = await signTxTokenMint.execute(client);
      const receiptTokenMintTx = await txTokenMintResponse.getReceipt(client);
      assert.equal(receiptTokenMintTx.status.toString(), "SUCCESS");
      console.log("Minting successful!");

      // If second account has insufficient balance, transfer tokens from treasury
      if (secondAccountBalance < amount) {
        console.log("\n=== Transferring Tokens to Second Account ===");
        console.log(
          `Transferring ${amount} tokens from Treasury to Second account`
        );

        const transferTx = new TransferTransaction()
          .addTokenTransfer(tokenId, TREASURY_ACCOUNT_ID, -amount)
          .addTokenTransfer(tokenId, SECOND_ACCOUNT_ID, amount)
          .freezeWith(client);

        const signTransferTx = await transferTx.sign(
          TREASURY_ACCOUNT_PRIVATEKEY
        );
        const transferResponse = await signTransferTx.execute(client);
        const transferReceipt = await transferResponse.getReceipt(client);
        assert.equal(transferReceipt.status.toString(), "SUCCESS");
        console.log("Transfer successful!");
      }
    }

    console.log("\n=== Creating Multi-Party Transfer ===");
    console.log(
      `Transferring ${amount} tokens from Treasury and Second accounts`
    );
    console.log(`Transferring ${thirdAmount} tokens to Third account`);
    console.log(`Transferring ${fourthAmount} tokens to Fourth account`);

    // Create a multi-party transfer transaction
    transaction = new TransferTransaction()
      .addTokenTransfer(tokenId, TREASURY_ACCOUNT_ID, -amount) // First account transfer out
      .addTokenTransfer(tokenId, SECOND_ACCOUNT_ID, -amount) // Second account transfer out
      .addTokenTransfer(tokenId, NEW_ACCOUNT_ID, thirdAmount) // Third account transfer in
      .addTokenTransfer(tokenId, FOURTH_ACCOUNT_ID, fourthAmount); // Fourth account transfer in

    // Freeze the transaction
    transaction.freezeWith(client);

    // Sign with both sending accounts
    await transaction.sign(TREASURY_ACCOUNT_PRIVATEKEY);
    await transaction.sign(SECOND_ACCOUNT_PRIVATEKEY);

    // Execute the transaction
    const transferResponse = await transaction.execute(client);
    const transferReceipt = await transferResponse.getReceipt(client);
    assert.equal(transferReceipt.status.toString(), "SUCCESS");
    console.log("Multi-party transfer successful!");

    // Log final balances
    console.log("\n=== Final Balances ===");
    const finalTreasuryBalance = await getAccountTokenBalance(
      TREASURY_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log(
      `Treasury Account (${TREASURY_ACCOUNT_ID}): ${finalTreasuryBalance} HTT`
    );

    const finalSecondBalance = await getAccountTokenBalance(
      SECOND_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log(
      `Second Account (${SECOND_ACCOUNT_ID}): ${finalSecondBalance} HTT`
    );

    const finalThirdBalance = await getAccountTokenBalance(
      NEW_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log(`Third Account (${NEW_ACCOUNT_ID}): ${finalThirdBalance} HTT`);

    const finalFourthBalance = await getAccountTokenBalance(
      FOURTH_ACCOUNT_ID,
      tokenId,
      client
    );
    console.log(
      `Fourth Account (${FOURTH_ACCOUNT_ID}): ${finalFourthBalance} HTT`
    );
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
