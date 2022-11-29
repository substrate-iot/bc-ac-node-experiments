const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const crypto = require("crypto")
const Base58 = require('base-58')
const randomWords = require('random-words')
const { faker } = require('@faker-js/faker')
const { Resolver } = require('did-resolver')
const { getResolver } = require('@donhuanvn96/substrate-did-resolver')
const { ApiPromise, WsProvider } = require('@polkadot/api')
const { ContractPromise } = require('@polkadot/api-contract')
const dotenv = require('dotenv')

dotenv.config()

const READ_ADDR = '0x'.padEnd(66, '0')
const BLOCKCHAIN_ENDPOINT = process.env.BLOCKCHAIN_ENDPOINT
const OBJECT_DID = process.env.OBJECT_DID
const AUTH_PRIVATE_KEY_FILE = process.env.OBJECT_AUTH_PRIVATE_KEY_FILE
const AUTH_PRIVATE_KEY_PASSPHRASE = process.env.OBJECT_AUTH_PRIVATE_KEY_PASSPHRASE

const gAuthenticatingSessions = []
const gAuthenticatedSessions = []
const gContractMetadateRegistry = [
  {
    address: process.env.POLICY_1_ADDRESS,
    file: process.env.POLICY_1_METADATA_FILE
  }
]

var gBlockchainApi = null
var gDidResolver = null

//==========================================================================
// Section: INITIALIZATION
//==========================================================================
const init = async () => {
  // Initialize a connection dedicated for DID Resolver
  const providerConfig = { wsUrl: BLOCKCHAIN_ENDPOINT }
  const substrateDidResolver = await getResolver(providerConfig)
  gDidResolver = new Resolver(substrateDidResolver)

  // Initialize a connection for blockchain interaction
  const wsProvider = new WsProvider(BLOCKCHAIN_ENDPOINT)
  gBlockchainApi = await ApiPromise.create({ provider: wsProvider })
}
// Call instantly after declaration
init()

//==========================================================================
// Section: HELPER FUNCTIONS
//==========================================================================
const onChainAccessValidation = async (subjectDid, policyAddress) => {
  // This case uses AccountId as DID of an entity.
  const shortSubjectDid = convertDidToAccountId(subjectDid)
  const shortObjectDid = convertDidToAccountId(OBJECT_DID)

  try {
    // Verify either the specified policy is associated with this OBJECT DID
    const queriedPolicy = await gBlockchainApi
      .query
      .palletAbac
      .policyOf(shortObjectDid, policyAddress)
    if (queriedPolicy.toHuman() === null) return []

    // Execute policy evaluation (indeed, that is a smart contract reading)
    const metadata = gContractMetadateRegistry.find(r => r.address === policyAddress)
    if (!metadata) return []

    const policyContract = new ContractPromise(
      gBlockchainApi,
      fs.readFileSync(metadata.file, { encoding: 'utf-8' }),
      policyAddress
    )

    const result = await policyContract.query.checkAccess(
      READ_ADDR,
      { gasLimit: -1, value: 0 },
      shortSubjectDid,
      shortObjectDid,
      [{ name: "CurrentHour", value: new Date().getHours().toString() }]
    )

    if (!!result && !!result.output) {
      return result.output.map(decision => decision.toString())
    }
  } catch (e) {
    console.error("Fail to validate a access request on blockchain")
  }
  return []
}

const convertDidToAccountId = (did) => {
  const arr = did.split(':')
  return arr[arr.length - 1]
}

const resolveDID = async (did) => {
  const result = await gDidResolver.resolve(did)
  return result.didDocument
}

const getSpecialAuthKeyFromDDO = (ddo) => {
  if (!ddo.verificationMethod) return ''
  const vmRSA = ddo.verificationMethod.find(vm => vm.type === 'RSAVerificationKey*')
  if (vmRSA === undefined) {
    return ''
  } else {
    return vmRSA.publicKeyBase58
  }
}

const generateEncryptedAuthChallange = (key) => {
  const challangePlainText = randomWords()
  // console.log(challangePlainText)

  let publicKey = crypto.createPublicKey({
    key: Base58.decode(key),
    type: 'spki',
    format: 'der'
  })
  const encryptedChallange = crypto.publicEncrypt(publicKey, Buffer.from(challangePlainText, 'utf-8'))
  return { encryptedChallange: encryptedChallange.toString('hex'), challange: challangePlainText }
}

const decryptAuthResponse = (response, privateKeyFile, passphrase) => {
  const privateKey = fs.readFileSync(privateKeyFile, { encoding: 'utf-8' })

  const responseData = crypto.privateDecrypt({
    key: privateKey,
    passphrase
  }, Buffer.from(response, 'hex'))
  return responseData.toString('utf-8')
}

const encryptSecrectKey = (pubKey, secKey) => {
  let publicKey = crypto.createPublicKey({
    key: Base58.decode(pubKey),
    type: 'spki',
    format: 'der'
  })
  return crypto.publicEncrypt(publicKey, Buffer.from(secKey, 'utf-8')).toString('hex')
}

const checkAuthenticatingSessions = (did) => {
  const session = gAuthenticatingSessions.find(s => s.requesterDID === did)
  return ((session !== undefined) && (Date.now() - session.timestamp < 3 * 60 * 1000))
}

const checkAuthRespValidity = (did, encryptedResponse) => {
  if (!checkAuthenticatingSessions(did)) return false

  const res = decryptAuthResponse(encryptedResponse, AUTH_PRIVATE_KEY_FILE, AUTH_PRIVATE_KEY_PASSPHRASE)
  const session = gAuthenticatingSessions.find(s => s.requesterDID === did)

  return (res === session.challange)
}

const checkAuthenticationStatus = (did, secretKey) => {
  const session = gAuthenticatedSessions.find(s => s.clientDID === did)
  if (!session) return false
  if (session.secretKey !== secretKey) return false
  return true
}

//==========================================================================
// Section: IoT Resources
//==========================================================================
const readValueSensor1 = () => {
  const sensorValue = faker.random.numeric()
  console.log(`Sensor 1 has a value of '${sensorValue}' at ${new Date().toISOString()}`)
  return sensorValue
}

const readValueSensor2 = () => {
  const sensorValue = faker.random.numeric()
  console.log(`Sensor 2 has a value of '${sensorValue}' at ${new Date().toISOString()}`)
  return sensorValue
}

//==========================================================================
// Section: Server REST API (Off-chain AC Service)
//==========================================================================
const app = express()

// app.use(bodyParser.urlencoded()) // x-www-form-urlencoded
app.use(bodyParser.json()) // application/json

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  next()
})

app.post('/auth-request', async (req, res, next) => {
  const requesterDDO = await resolveDID(req.body.did)

  const rsaAuthKey = getSpecialAuthKeyFromDDO(requesterDDO)

  if (rsaAuthKey !== '') {
    const { encryptedChallange, challange } = generateEncryptedAuthChallange(rsaAuthKey)
    if (checkAuthenticatingSessions(req.body.did)) {
      return res.status(400).json({
        error: `Existing an authentication session with DID: ${req.body.did}`
      })
    }
    gAuthenticatingSessions.push({
      requesterDID: req.body.did,
      requesterPublicKey: rsaAuthKey,
      challange,
      encryptedChallange,
      timestamp: Date.now()
    })
    res.status(200).json({ encryptedChallange })
  } else {
    res.status(404).json({
      error: 'Not found any authentication key'
    })
  }

})

app.post('/auth-response', (req, res, next) => {
  const validResponse = checkAuthRespValidity(req.body.did, req.body.authResponse)
  if (validResponse) {
    const session = gAuthenticatingSessions.find(s => s.requesterDID === req.body.did)
    // Cleaning authenticating session
    gAuthenticatingSessions.filter(s => s.requesterDID !== req.body.did)

    const randomSecretkey = Base58.encode(crypto.randomBytes(32))

    gAuthenticatedSessions.push({
      clientDID: session.requesterDID,
      clientPublicKey: session.requesterPublicKey,
      secretKey: randomSecretkey,
      timestamp: Date.now()
    })

    res.status(200).json({
      encryptedSecretKey: encryptSecrectKey(session.requesterPublicKey, randomSecretkey)
    })
  } else {
    res.status(400).json({
      error: 'Invalid Auth Response'
    })
  }
})

app.post('/read-sensor-1', async (req, res, next) => {
  // Checking authentication status
  if (!checkAuthenticationStatus(req.body.did, req.body.secretKey)) {
    return res.status(401).json({
      error: "DID Not Authenticated"
    })
  }

  // Authorization
  const decisions = await onChainAccessValidation(req.body.did, req.body.policyAddress)
  console.log("decisions:", decisions)
  if (decisions.find(d => d === 'allow access to resource 1')) {
    return res.status(200).json({
      sensorData: readValueSensor1()
    })
  } else {
    return res.status(401).json({
      error: "Unauthorized access"
    })
  }
})

app.post('/read-sensor-2', async (req, res, next) => {
  // Checking authentication status
  if (!checkAuthenticationStatus(req.body.did, req.body.secretKey)) {
    return res.status(401).json({
      error: "DID Not Authenticated"
    })
  }

  // Authorization
  const decisions = await onChainAccessValidation(req.body.did, req.body.policyAddress)
  if (decisions.find(d => d === 'allow access to resource 2')) {
    return res.status(200).json({
      sensorData: readValueSensor2()
    })
  } else {
    return res.status(401).json({
      error: "Unauthorized access"
    })
  }
})

app.listen(process.env.OBJECT_LOCALHOST_PORT, () => {
  console.log('Server is running on port:', process.env.OBJECT_LOCALHOST_PORT)
})
