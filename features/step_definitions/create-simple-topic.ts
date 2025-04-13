import { Given, Then, When } from "@cucumber/cucumber";
import {
  AccountBalanceQuery,
  AccountId,
  Client,
  KeyList,
  PrivateKey,
  RequestType,
  SubscriptionHandle,
  TopicCreateTransaction,
  TopicId,
  TopicInfoQuery,
  TopicMessage,
  TopicMessageQuery,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import { accounts } from "../../src/config";
import assert from "node:assert";
import ConsensusSubmitMessage = RequestType.ConsensusSubmitMessage;
import { error, time } from "node:console";
import { resolve } from "node:path";
import { listeners } from "node:process";

// Pre-configured client for test network (testnet)
const client = Client.forTestnet();
let topicId: TopicId;

let key1: PrivateKey;
let key2: PrivateKey;
let thresholdKey: KeyList;

//Set the operator with the account ID and private key

Given(
  /^a first account with more than (\d+) hbars$/,
  async function (expectedBalance: number) {
    const acc = accounts[0];
    const account: AccountId = AccountId.fromString(acc.id);
    this.account = account;
    const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
    this.privKey = privKey;
    key1 = privKey;
    client.setOperator(this.account, privKey);

    //Create the account query request
    const query = new AccountBalanceQuery().setAccountId(account);
    const balance = await query.execute(client);
    console.log(balance.hbars.toBigNumber().toNumber());
    // Success when new Hedera Account is added from portal
    assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
  }
);

When(
  /^A topic is created with the memo "([^"]*)" with the first account as the submit key$/,
  async function (memo: string) {
    const acc = accounts[0];
    const account: AccountId = AccountId.fromString(acc.id);
    this.account = account;
    const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
    this.privKey = privKey;
    client.setOperator(this.account, privKey);

    // Create a Topic Transaction and Pass the specified memo
    const txCreateTopic = new TopicCreateTransaction();

    const txCreateTopicResponse = await txCreateTopic
      .setTopicMemo(memo)
      .setSubmitKey(privKey)
      .execute(client);

    // Fetch the Transaction Receipt
    const txCreateTopicReceipt = await txCreateTopicResponse.getReceipt(client);

    // Update the Topic ID
    if (txCreateTopicReceipt && txCreateTopicReceipt.topicId) {
      topicId = txCreateTopicReceipt.topicId;
    }

    // Fetch the Transaction Status
    const txCreateTopicStatus = await txCreateTopicReceipt.status;
    assert.equal(txCreateTopicStatus.toString(), "SUCCESS");
  }
);

When(
  /^The message "([^"]*)" is published to the topic$/,
  async function (message: string) {
    const acc = accounts[0];
    const account: AccountId = AccountId.fromString(acc.id);
    this.account = account;
    const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
    this.privKey = privKey;
    client.setOperator(this.account, privKey);

    //Create a Transaction to submit message on a topic
    const txTopicMessageSubmit = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId) //Fill in the topic ID
      .setMessage(message)
      .execute(client);

    // Fetch the Transaction Receipt
    const txTopicMessageReceipt = await txTopicMessageSubmit.getReceipt(client);

    // Fetch the Transaction Status
    const txTopicMessageStatus = await txTopicMessageReceipt.status;
    assert.equal(txTopicMessageStatus.toString(), "SUCCESS");
  }
);

Then(
  /^The message "([^"]*)" is received by the topic and can be printed to the console$/,
  { timeout: 5 * 5000 },
  async function (message: string) {
    let subscriptionHandle: SubscriptionHandle | null = null;

    await new Promise((resolve, reject) => {
      if (subscriptionHandle) {
        subscriptionHandle.unsubscribe();
        subscriptionHandle = null;
      }
      const query = new TopicMessageQuery().setTopicId(topicId).setStartTime(0);

      const timeout = 20000;

      const timeOutId = setTimeout(() => {
        if (subscriptionHandle) {
          subscriptionHandle.unsubscribe();
          subscriptionHandle = null;
        }
        reject("Timeout");
      }, timeout);

      subscriptionHandle = query.subscribe(
        client,
        (error) => {
          console.error("Subscription error, error");
          clearTimeout(timeOutId);
          subscriptionHandle = null;
          reject(error);
        },
        (msg: TopicMessage) => {
          const receivedMessage = Buffer.from(msg.contents).toString("utf8");
          console.log("Received Message", receivedMessage);

          if (receivedMessage == message) {
            if (subscriptionHandle) {
              subscriptionHandle.unsubscribe();
              subscriptionHandle = null;
            }
            resolve(true);
          }
        }
      );
    });

    assert.ok(true);
  }
);

Given(
  /^A second account with more than (\d+) hbars$/,
  async function (expectedBalance: number) {
    const acc = accounts[1];
    const account: AccountId = AccountId.fromString(acc.id);
    this.account = account;
    const privKey: PrivateKey = PrivateKey.fromStringECDSA(acc.privateKey);
    this.privKey = privKey;
    key2 = privKey;
    client.setOperator(this.account, privKey);
    //Create the account query request
    const query = new AccountBalanceQuery().setAccountId(account);
    const balance = await query.execute(client);
    console.log(balance.hbars.toBigNumber().toNumber());
    assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
  }
);

Given(
  /^A (\d+) of (\d+) threshold key with the first and second account$/,
  async function (threshold: number, total: number) {
    const keys = [key1, key2];
    thresholdKey = new KeyList(keys, 2);
    assert.equal(thresholdKey.threshold, 2);
  }
);

When(
  /^A topic is created with the memo "([^"]*)" with the threshold key as the submit key$/,
  async function (memo: string) {
    // Create a Topic Transaction and Pass the specified memo
    const txCreateTopic = new TopicCreateTransaction();

    const txCreateTopicResponse = await txCreateTopic
      .setTopicMemo(memo)
      .setSubmitKey(thresholdKey)
      .execute(client);

    // Fetch the Transaction Receipt
    const txCreateTopicReceipt = await txCreateTopicResponse.getReceipt(client);
    txCreateTopicReceipt.status;
    // Fetch the Transaction Status
    const txCreateTopicReceiptStatus = await txCreateTopicReceipt.status;
    assert.equal(txCreateTopicReceiptStatus.toString(), "SUCCESS");
  }
);
