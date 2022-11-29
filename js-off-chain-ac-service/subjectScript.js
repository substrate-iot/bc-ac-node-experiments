const fs = require('fs')
const crypto = require('node:crypto')
const axios = require('axios')
const Base58 = require('base-58')
const dotenv = require('dotenv')

dotenv.config()

const AUTH_PUBLIC_KEY_OBJECT = process.env.OBJECT_AUTH_PUBLIC_KEY_FILE // it's actually public on blockchain
const AUTH_PRIVATE_KEY_FILE = process.env.SUBJECT_AUTH_PRIVATE_KEY_FILE
const AUTH_PRIVATE_KEY_PASSPHRASE = process.env.SUBJECT_AUTH_PRIVATE_KEY_PASSPHRASE
const SUBJECT_DID = process.env.SUBJECT_DID
const OBJECT_ENDPOINT = `http://localhost:${process.env.OBJECT_LOCALHOST_PORT}`
const POLICY_ADDRESS = process.env.POLICY_1_ADDRESS

const main = async () => {
  let progressCount = 0
  console.log('======================================================')
  console.log(`${++progressCount}. Making DID authentication request.`)
  let res
  try {
    res = await axios.post(`${OBJECT_ENDPOINT}/auth-request`, {
      did: SUBJECT_DID
    })
    console.log('Response Status Code:', res.status)
    console.log('Response Data:', res.data)
    console.log("This stage completed successfully, an authentication challange received.")
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }

  console.log('======================================================')
  console.log(`${++progressCount}. Decrypting the received encrypted challange.`)
  const encryptedChallange = res.data.encryptedChallange
  const privateKey = fs.readFileSync(AUTH_PRIVATE_KEY_FILE, { encoding: 'utf-8' })
  let challange
  try {
    challange = crypto.privateDecrypt({
      key: privateKey,
      passphrase: AUTH_PRIVATE_KEY_PASSPHRASE
    }, Buffer.from(encryptedChallange, 'hex')).toString('utf-8')
  } catch (e) {
    console.error("Fail to decrypt the encrypted challange:", e.message)
    process.exit(1)
  }
  console.log("This stage completed successfully, the challange is:", challange)

  console.log('======================================================')
  console.log(`${++progressCount}. Making an auth response corresponding to the challange.`)
  let authResponse
  try {
    const keyRawString = fs.readFileSync(AUTH_PUBLIC_KEY_OBJECT, { encoding: 'utf-8' }).trim()
    const objPublicKey = crypto.createPublicKey({
      key: Base58.decode(keyRawString),
      type: 'spki',
      format: 'der'
    })
    console.log("objPublicKey:", objPublicKey)
    authResponse = crypto.publicEncrypt(objPublicKey, Buffer.from(challange, 'utf-8')).toString('hex')
  } catch (e) {
    console.error("Fail to make an auth response:", e.message)
    process.exit(1)
  }

  console.log("This stage completed successfully, the auth response is:\n", authResponse)

  console.log('======================================================')
  console.log(`${++progressCount}. Submitting the auth response to the object.`)
  try {
    res = await axios.post(`${OBJECT_ENDPOINT}/auth-response`, {
      did: SUBJECT_DID,
      authResponse: authResponse
    })
    console.log('Response Status Code:', res.status)
    console.log('Response Data:', res.data)
    console.log("This stage completed successfully, the auth response was submitted and verified correctly.")
  } catch (e) {
    console.error("Fail to submit the auth reponse to the object:", e.message)
    process.exit(1)
  }

  console.log('======================================================')
  console.log(`${++progressCount}. Decrypting the encrypted secret key.`)
  const encryptedSecretKey = res.data.encryptedSecretKey
  let secretKey
  try {
    secretKey = crypto.privateDecrypt({
      key: privateKey,
      passphrase: "nhuando"
    }, Buffer.from(encryptedSecretKey, 'hex')).toString('utf-8')
  } catch (e) {
    console.error("Fail to decrypt the encrypted secret key:", e.message)
    process.exit(1)
  }
  console.log("This stage completed successfully, the secret key is:", secretKey)

  console.log('======================================================')
  console.log(`${++progressCount}. Testing IoT resource access`)
  try {
    res = await axios.post(`${OBJECT_ENDPOINT}/read-sensor-1`, {
      did: SUBJECT_DID,
      secretKey: secretKey,
      policyAddress: POLICY_ADDRESS
    })
    console.log('Response Status Code:', res.status)
    console.log('Response Data:', res.data)
    console.log("This stage completed successfully.")
  } catch(e) {
    console.error("Error happend when access IoT resoure:", e.message)
    process.exit(1)
  }
}

main()
