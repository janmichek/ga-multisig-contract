const { use, assert, expect } = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { utils, wallets } = require('@aeternity/aeproject');
const { Crypto } = require('@aeternity/aepp-sdk');

use(chaiAsPromised);

describe('SimpleGAMultiSig', () => {
  let aeSdk;
  let source;
  let gaContract;
  let gaKeyPair;

  const coSigner1 = wallets[1];
  const coSigner2 = wallets[2];
  const coSigner3 = wallets[3];

  before(async () => {
    aeSdk = await utils.getClient();

    // create a new keypair to allow reoccuring tests
    gaKeyPair = Crypto.generateKeyPair();
    // fund the account for the fresh generated keypair
    await aeSdk.spend(10e18, gaKeyPair.publicKey, { onAccount: wallets[0] });

    // get content of contract
    source = utils.getContractContent('./contracts/SimpleGAMultiSig.aes');

    // attach the Generalized Account
    await aeSdk.createGeneralizeAccount('authorize', source, [2, [coSigner1.publicKey, coSigner2.publicKey, coSigner3.publicKey]], { onAccount: gaKeyPair });
    const isGa = await aeSdk.isGA(gaKeyPair.publicKey);
    assert.equal(isGa, true);

    // get gaContract instance
    const { contractId: contractAddress } = await aeSdk.getAccount(gaKeyPair.publicKey);
    gaContract = await aeSdk.getContractInstance({ source, contractAddress });
    
    const signers = await gaContract.methods.get_signers();
    assert.equal(signers.decodedResult.length, 4);

    const consensusInfoResult = await gaContract.methods.get_consensus_info();
    const consensusInfo = consensusInfoResult.decodedResult;
    assert.equal(consensusInfo.confirmations_required, 2n);
    assert.isUndefined(consensusInfo.ga_tx_hash);

    // create a snapshot of the blockchain state
    await utils.createSnapshot(aeSdk);
  });

  // after each test roll back to initial state
  afterEach(async () => {
    await utils.rollbackSnapshot(aeSdk);
  });

  it('Fail on make GA on already GA account', async () => {
    expect(
      aeSdk.createGeneralizeAccount(
        'authorize',
        source,
        [2, [coSigner1.publicKey, coSigner2.publicKey, coSigner3.publicKey]],
        { onAccount: gaKeyPair }
      )
    ).to.be.rejectedWith(`Account ${gaKeyPair.publicKey} is already GA`);
  })
});