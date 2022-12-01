const fs = require('fs')
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')
const { mnemonicGenerate } = require('@polkadot/util-crypto')
const { ContractPromise } = require('@polkadot/api-contract')

var wsProvider = null
var api = null
var keyring = null

const init = async () => {
  // Construct
  wsProvider = new WsProvider('ws://localhost:9944')
  api = await ApiPromise.create({ provider: wsProvider })

  // Create a keyring instance
  keyring = new Keyring({ type: 'sr25519' })
}


const testSetAttributes = async (transactionNumber, attributeLength) => {
  console.log("================================================")
  console.log("Test setAttributes started!")
  console.log("================================================")
  console.log("Number of transactions:", transactionNumber)
  console.log("Number of attributes in a transaction:", attributeLength)

  // Generate different attributes
  const attrs = Array.from(Array(transactionNumber), (_, k1) => {
    return Array.from(Array(attributeLength), (_, k2) => {
      return {
        name: `AttributeKey_${k1}_${k2}`,
        value: `AttributeValue_${k1}_${k2}`
      }
    })
  })
  // console.log(attrs)

  const alice = keyring.addFromUri('//Alice', { name: 'Alice default' })

  let nonce = await api.rpc.system.accountNextIndex(alice.address)

  const nsTimeStart = process.hrtime.bigint()

  for (let i = 0; i < transactionNumber; ++i) {
    await api.tx.palletAbac
      .setAttributes(alice.address, attrs[i])
      .signAndSend(alice, { nonce })
    nonce = nonce.addn(1)
    process.stdout.write("Number of submitted transactions: " + (i + 1) + "\r")
  }
  process.stdout.write('\n')

  const msTimeElapsed = Number((process.hrtime.bigint() - nsTimeStart) / 1000000n)

  console.log('Time elapsed:', msTimeElapsed, 'ms')
}

const testClearAttributes = async (transactionNumber, attributeLength) => {
  console.log("================================================")
  console.log("Test clearAttributes started!")
  console.log("================================================")
  console.log("Number of transactions:", transactionNumber)
  console.log("Number of attributes in a transaction:", attributeLength)

  const alice = keyring.addFromUri('//Alice', { name: 'Alice default' })

  // Generate different attributes
  const attrs = Array.from(Array(transactionNumber), (_, k1) => {
    return Array.from(Array(attributeLength), (_, k2) => {
      return {
        name: `AttributeKey_${k1}_${k2}`,
        value: `AttributeValue_${k1}_${k2}`
      }
    })
  })

  const initAttributes = async () => {
    console.log("Initializing attributes for clearing.")
    const txs = attrs.map(a => api.tx.palletAbac.setAttributes(alice.address, a))
    const promise = new Promise(async (resolve, reject) => {
      const unsub = await api.tx.utility
        .batch(txs)
        .signAndSend(alice, result => {
          if (result.status.isInBlock) {
            unsub()
            resolve(result.status.asInBlock)
          }
        })
    })
    await Promise.all([promise])
    console.log("Initialized attributes for clearing.")
  }
  await initAttributes()

  const nsTimeStart = process.hrtime.bigint()

  let nonce = await api.rpc.system.accountNextIndex(alice.address)
  for (let i = 0; i < transactionNumber; ++i) {
    await api.tx.palletAbac
      .clearAttributes(alice.address, attrs[i].map(a => a.name))
      .signAndSend(alice, { nonce })
    nonce = nonce.addn(1)
    process.stdout.write("Number of submitted transactions: " + (i + 1) + "\r")
  }
  process.stdout.write('\n')

  const msTimeElapsed = Number((process.hrtime.bigint() - nsTimeStart) / 1000000n)

  console.log('Time elapsed:', msTimeElapsed, 'ms')
}

const testEndorseAttributes = async (transactionNumber, attributeLength) => {
  console.log("================================================")
  console.log("Test endorseAttributes started!")
  console.log("================================================")
  console.log("Number of transactions:", transactionNumber)
  console.log("Number of attributes in a transaction:", attributeLength)

  const alice = keyring.addFromUri('//Alice', { name: 'Alice default' })
  const bob = keyring.addFromUri('//Bob', { name: 'Bob default' })

  // Generate different attributes
  const attrs = Array.from(Array(transactionNumber), (_, k1) => {
    return Array.from(Array(attributeLength), (_, k2) => {
      return {
        name: `AttributeKey_${k1}_${k2}`,
        value: `AttributeValue_${k1}_${k2}`
      }
    })
  })

  const initAttributes = async () => {
    console.log("Initializing attributes for endorsement.")
    const txs = attrs.map(a => api.tx.palletAbac.setAttributes(alice.address, a))
    const promise = new Promise(async (resolve, reject) => {
      const unsub = await api.tx.utility
        .batch(txs)
        .signAndSend(alice, result => {
          if (result.status.isInBlock) {
            unsub()
            resolve(result.status.asInBlock)
          }
        })
    })
    await Promise.all([promise])
    console.log("Initialized attributes for endorsement.")
  }
  await initAttributes()

  const nsTimeStart = process.hrtime.bigint()

  let nonce = await api.rpc.system.accountNextIndex(bob.address)
  for (let i = 0; i < transactionNumber; ++i) {
    await api.tx.palletAbac
      .endorseAttributes(bob.address, alice.address, attrs[i].map(a => a.name), null)
      .signAndSend(bob, { nonce })
    nonce = nonce.addn(1)
    process.stdout.write("Number of submitted transactions: " + (i + 1) + "\r")
  }
  process.stdout.write('\n')

  const msTimeElapsed = Number((process.hrtime.bigint() - nsTimeStart) / 1000000n)

  console.log('Time elapsed:', msTimeElapsed, 'ms')
}

const testUnendorseAttributes = async (transactionNumber, attributeLength) => {
  console.log("================================================")
  console.log("Test unendorseAttributes started!")
  console.log("================================================")
  console.log("Number of transactions:", transactionNumber)
  console.log("Number of attributes in a transaction:", attributeLength)

  const alice = keyring.addFromUri('//Alice', { name: 'Alice default' })
  const bob = keyring.addFromUri('//Bob', { name: 'Bob default' })

  // Generate different attributes
  const attrs = Array.from(Array(transactionNumber), (_, k1) => {
    return Array.from(Array(attributeLength), (_, k2) => {
      return {
        name: `AttributeKey_${k1}_${k2}`,
        value: `AttributeValue_${k1}_${k2}`
      }
    })
  })

  const initAttributes = async () => {
    console.log("Initializing attributes for unendorsement.")
    const txs = attrs.map(a => api.tx.palletAbac.setAttributes(alice.address, a))
    const promise = new Promise(async (resolve, reject) => {
      const unsub = await api.tx.utility
        .batch(txs)
        .signAndSend(alice, result => {
          if (result.status.isInBlock) {
            unsub()
            resolve(result.status.asInBlock)
          }
        })
    })
    await Promise.all([promise])
    console.log("Initialized attributes for unendorsement.")
  }
  await initAttributes()

  const initEndorsements = async () => {
    console.log("Initializing endorsements.")
    const txs = attrs.map(a => api.tx.palletAbac.endorseAttributes(bob.address, alice.address, a, null))
    const promise = new Promise(async (resolve, reject) => {
      const unsub = await api.tx.utility
        .batch(txs)
        .signAndSend(bob, result => {
          if (result.status.isInBlock) {
            unsub()
            resolve(result.status.asInBlock)
          }
        })
    })
    await Promise.all([promise])
    console.log("Initialized endorsements.")
  }
  await initEndorsements()

  const nsTimeStart = process.hrtime.bigint()

  let nonce = await api.rpc.system.accountNextIndex(bob.address)

  for (let i = 0; i < transactionNumber; ++i) {
    await api.tx.palletAbac
      .unendorseAttributes(bob.address, alice.address, attrs[i].map(a => a.name))
      .signAndSend(bob, { nonce })
    nonce = nonce.addn(1)
    process.stdout.write("Number of submitted transactions: " + (i + 1) + "\r")
  }
  process.stdout.write('\n')

  const msTimeElapsed = Number((process.hrtime.bigint() - nsTimeStart) / 1000000n)

  console.log('Time elapsed:', msTimeElapsed, 'ms')
}

const testAttachPolicy = async (transactionNumber) => {
  console.log("================================================")
  console.log("Test testAttachPolicy started!")
  console.log("================================================")
  console.log("Number of transactions:", transactionNumber)
  console.log("Note: must turn off validation of contract address in Pallet ABAC source code in advance.")

  // Generate random policy addresses
  let policyAddresses
  if (fs.existsSync('10kPolicyAddresses.json')) {
    raw = fs.readFileSync('10kPolicyAddresses.json', { encoding: 'utf-8' })
    allAddresses = JSON.parse(raw)
    policyAddresses = allAddresses.slice(0, transactionNumber)
  } else {
    policyAddresses = Array.from(Array(transactionNumber), (_, i) => {
      console.log(i)
      const mnemonic = mnemonicGenerate()
      return keyring.createFromUri(mnemonic, { name: 'sr25519' }).address
    })
  }

  const alice = keyring.addFromUri('//Alice', { name: 'Alice default' })

  let nonce = await api.rpc.system.accountNextIndex(alice.address)

  const nsTimeStart = process.hrtime.bigint()

  for (let i = 0; i < transactionNumber; ++i) {
    await api.tx.palletAbac
      .attachPolicy(alice.address, alice.address, policyAddresses[i], `P${i}`)
      .signAndSend(alice, { nonce })
    nonce = nonce.addn(1)
    process.stdout.write("Number of submitted transactions: " + (i + 1) + "\r")
  }
  process.stdout.write('\n')

  const msTimeElapsed = Number((process.hrtime.bigint() - nsTimeStart) / 1000000n)

  console.log('Time elapsed:', msTimeElapsed, 'ms')
}

const testDetachPolicy = async (transactionNumber) => {
  console.log("================================================")
  console.log("Test testAttachPolicy started!")
  console.log("================================================")
  console.log("Number of transactions:", transactionNumber)
  console.log("Note: must turn off validation of contract address in Pallet ABAC source code in advance.")

  // Generate random policy addresses
  let policyAddresses
  if (fs.existsSync('10kPolicyAddresses.json')) {
    raw = fs.readFileSync('10kPolicyAddresses.json', { encoding: 'utf-8' })
    allAddresses = JSON.parse(raw)
    policyAddresses = allAddresses.slice(0, transactionNumber)
  } else {
    policyAddresses = Array.from(Array(transactionNumber), (_, i) => {
      console.log(i)
      const mnemonic = mnemonicGenerate()
      return keyring.createFromUri(mnemonic, { name: 'sr25519' }).address
    })
  }

  const alice = keyring.addFromUri('//Alice', { name: 'Alice default' })

  const initAttachedPolicies = async () => {
    console.log("Initializing attached polices for detaching.")
    const txs = policyAddresses.map((a, k) => api.tx.palletAbac.attachPolicy(alice.address, alice.address, a, `P${k}`))
    const promise = new Promise(async (resolve, reject) => {
      const unsub = await api.tx.utility
        .batch(txs)
        .signAndSend(alice, result => {
          if (result.status.isInBlock) {
            unsub()
            resolve(result.status.asInBlock)
          }
        })
    })
    await Promise.all([promise])
    console.log("Initialized attached polices for detaching.")
  }
  await initAttachedPolicies()

  const nsTimeStart = process.hrtime.bigint()

  let nonce = await api.rpc.system.accountNextIndex(alice.address)
  for (let i = 0; i < transactionNumber; ++i) {
    await api.tx.palletAbac
      .detachPolicy(alice.address, alice.address, policyAddresses[i])
      .signAndSend(alice, { nonce })
    nonce = nonce.addn(1)
    process.stdout.write("Number of submitted transactions: " + (i + 1) + "\r")
  }
  process.stdout.write('\n')

  const msTimeElapsed = Number((process.hrtime.bigint() - nsTimeStart) / 1000000n)

  console.log('Time elapsed:', msTimeElapsed, 'ms')
}

const testOnChainPolicyValidation = async (requestNumber, configFile) => {
  console.log("================================================")
  console.log("Test testOnChainPolicyValidation started!")
  console.log("================================================")
  console.log("Number of requests:", requestNumber)
  console.log("Config file:", configFile)

  const config = JSON.parse(fs.readFileSync(configFile, { encoding: "utf-8" }))
  console.log("Config file content:", config)

  const metadata = JSON.parse(fs.readFileSync(config.contractMetadataFile, { encoding: "utf-8" }))
  const policyContract = new ContractPromise(api, metadata, config.policyAddress)

  let nsTimeStart

  if (config.checkAccessIsTransaction) {
    const alice = keyring.addFromUri('//Alice', { name: 'Alice default' })

    let nonce = await api.rpc.system.accountNextIndex(alice.address)

    nsTimeStart = process.hrtime.bigint()

    for (let i = 0; i < requestNumber; ++i) {
      const result = await policyContract.tx.checkAccess(
        { gasLimit: -1, value: 0 },
        config.shortSubjectDid,
        config.shortObjectDid,
        config.envAttrs
      ).signAndSend(alice, { nonce })
      nonce = nonce.addn(1)

      process.stdout.write("Number of submitted transactions: " + (i + 1) + "\r")
    }
    process.stdout.write('\n')
  } else {
    const READ_ADDR = '0x'.padEnd(66, '0')

    nsTimeStart = process.hrtime.bigint()

    for (let i = 0; i < requestNumber; ++i) {
      const result = await policyContract.query.checkAccess(
        READ_ADDR,
        { gasLimit: -1, value: 0 },
        config.shortSubjectDid,
        config.shortObjectDid,
        config.envAttrs
      )
      // result.output && console.log("Decisions:", result.output.map(o => o.toHuman()))

      process.stdout.write("Number of submitted transactions: " + (i + 1) + "\r")
    }
    process.stdout.write('\n')
  }

  const msTimeElapsed = Number((process.hrtime.bigint() - nsTimeStart) / 1000000n)

  console.log('Time elapsed:', msTimeElapsed, 'ms')
}

const main = async () => {
  if (process.argv.length < 3) {
    return process.exit(1)
  }

  await init()

  const testCase = process.argv[2].trim()
  const transactionNumber = parseInt(process.argv[3].trim())

  switch (testCase) {
    case 'testSetAttributes':
      await testSetAttributes(transactionNumber, process.argv[4].trim())
      break
    case 'testClearAttributes':
      await testClearAttributes(transactionNumber, process.argv[4].trim())
      break
    case 'testEndorseAttributes':
      await testEndorseAttributes(transactionNumber, process.argv[4].trim())
      break
    case 'testUnendorseAttributes':
      await testUnendorseAttributes(transactionNumber, process.argv[4].trim())
      break
    case 'testAttachPolicy':
      await testAttachPolicy(transactionNumber)
      break
    case 'testDetachPolicy':
      await testDetachPolicy(transactionNumber)
      break
    case 'testOnChainPolicyValidation':
      await testOnChainPolicyValidation(transactionNumber, process.argv[4].trim())
      break
    default:
      console.log("Wrong command!")
      break
  }

  await api.disconnect()
}

main()
