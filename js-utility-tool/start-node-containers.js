const fs = require('fs')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const sleep = util.promisify(setTimeout)
const dotenv = require('dotenv')
dotenv.config()

let progressCount = 0

const errorHandle = (e) => {
  console.log("Error happen!")
  console.error(e)
  process.exit(1)
}

const secretPhrases =
  fs.readFileSync(
    path.join(process.env.CWD, process.env.SECRET_PHRASES_FILE),
    { encoding: 'utf-8' }
  ).split('\n')

const startBootnode = async () => {
  let cmd

  progressCount++

  console.log('------------------------------------------------------------')
  console.log(`${progressCount}. Starting bootnode`)
  console.log('------------------------------------------------------------')
  console.log(`${progressCount}.1 Starting node at the first time for initialization`)
  cmd = [
    'docker run -i -d --rm --name bc_ac_bootnode',
    '-p 30333:30333 -p 9944:9944 -p 9933:9933',
    '--add-host=host.docker.internal:host-gateway',
    `--volume ${process.env.CWD}:/tmp/experiments`,
    'noux/bc-ac-node:1.0.0',
    '--base-path /tmp/node',
    `--chain /tmp/experiments/${process.env.CUSTOM_SPEC_RAW_FILE}`,
    `--node-key "${process.env.BOOTNODE_KEY}"`,
    '--port 30333',
    '--telemetry-url "wss://telemetry.polkadot.io/submit/ 0"',
    '--validator',
    '--unsafe-ws-external',
    '--unsafe-rpc-external',
    '--rpc-methods Unsafe',
    '--name BC_AC_BOOTNODE',
    `--password "${process.env.PASSWORD}"`
  ].join(' ')

  console.log('Command:', cmd)

  try {
    const { stdout, stderr } = await exec(cmd, { cwd: process.env.CWD })
    console.log("stdout:", stdout)
  } catch (e) {
    errorHandle(e)
  }

  await sleep(2000)

  console.log(`${progressCount}.2 Modifying keystore of the node`)
  cmd = [
    'docker exec bc_ac_bootnode',
    'node-template key insert',
    '--base-path /tmp/node',
    `--chain /tmp/experiments/${process.env.CUSTOM_SPEC_RAW_FILE}`,
    '--scheme Sr25519',
    `--suri "${secretPhrases[0]}"`,
    `--password "${process.env.PASSWORD}"`,
    '--key-type aura;',
    'docker exec bc_ac_bootnode',
    'node-template key insert',
    '--base-path /tmp/node',
    `--chain /tmp/experiments/${process.env.CUSTOM_SPEC_RAW_FILE}`,
    '--scheme Ed25519',
    `--suri "${secretPhrases[0]}"`,
    `--password "${process.env.PASSWORD}"`,
    '--key-type gran;',
  ].join(' ')

  console.log('Command:', cmd)

  try {
    const { stdout, stderr } = await exec(cmd, { cwd: process.env.CWD })
    console.log("stdout:", stdout)
  } catch (e) {
    errorHandle(e)
  }

  console.log(`${progressCount}.3 Restarting container to apply the added keys`)
  cmd = 'docker container restart bc_ac_bootnode'

  console.log('Command:', cmd)

  try {
    const { stdout, stderr } = await exec(cmd, { cwd: process.env.CWD })
    console.log("stdout:", stdout)
  } catch (e) {
    errorHandle(e)
  }
}

const startValidatorContainer = async (secretPhrasesIndex) => {
  let cmd

  progressCount++

  console.log('------------------------------------------------------------')
  console.log(`${progressCount}. Starting validator ${secretPhrasesIndex}`)
  console.log('------------------------------------------------------------')
  console.log(`${progressCount}.1 Starting node at the first time for initialization`)
  cmd = [
    `docker run -i -d --rm --name bc_ac_validator_${secretPhrasesIndex}`,
    `--volume ${process.env.CWD}:/tmp/experiments`,
    'noux/bc-ac-node:1.0.0',
    '--base-path /tmp/node',
    `--chain /tmp/experiments/${process.env.CUSTOM_SPEC_RAW_FILE}`,
    '--port 30333',
    '--validator',
    '--unsafe-ws-external',
    '--unsafe-rpc-external',
    '--rpc-methods Unsafe',
    `--name BC_AC_VALIDATOR_${secretPhrasesIndex}`,
    `--password "${process.env.PASSWORD}"`,
    `--bootnodes "/ip4/${process.env.BOOTNODE_IP_V4}/tcp/30333/p2p/${process.env.BOOTNODE_ID}"`
  ].join(' ')

  console.log('Command:', cmd)

  try {
    const { stdout, stderr } = await exec(cmd, { cwd: process.env.CWD })
    console.log("stdout:", stdout)
  } catch (e) {
    errorHandle(e)
  }

  await sleep(2000)

  console.log(`${progressCount}.2 Modifying keystore of the node`)
  cmd = [
    `docker exec bc_ac_validator_${secretPhrasesIndex}`,
    'node-template key insert',
    '--base-path /tmp/node',
    `--chain /tmp/experiments/${process.env.CUSTOM_SPEC_RAW_FILE}`,
    '--scheme Sr25519',
    `--suri "${secretPhrases[secretPhrasesIndex]}"`,
    `--password "${process.env.PASSWORD}"`,
    '--key-type aura;',
    `docker exec bc_ac_validator_${secretPhrasesIndex}`,
    'node-template key insert',
    '--base-path /tmp/node',
    `--chain /tmp/experiments/${process.env.CUSTOM_SPEC_RAW_FILE}`,
    '--scheme Ed25519',
    `--suri "${secretPhrases[secretPhrasesIndex]}"`,
    `--password "${process.env.PASSWORD}"`,
    '--key-type gran;',
  ].join(' ')

  console.log('Command:', cmd)
  try {
    const { stdout, stderr } = await exec(cmd, { cwd: process.env.CWD })
    console.log("stdout:", stdout)
  } catch (e) {
    errorHandle(e)
  }

  console.log(`${progressCount}.3 Restarting container to apply the added keys`)
  cmd = `docker container restart bc_ac_validator_${secretPhrasesIndex}`

  console.log('Command:', cmd)

  try {
    const { stdout, stderr } = await exec(cmd, { cwd: process.env.CWD })
    console.log("stdout:", stdout)
  } catch (e) {
    errorHandle(e)
  }
}

const startNodeContainers = async () => {
  // 1. Starting a bootnode
  if (process.env.RUN_BOOTNODE === 'true') {
    await startBootnode()
  }

  // 2. Starting other validators
  for (let i = 0; i < +process.env.VALIDATOR_NUMBER; ++i) {
    const secretPhrasesIndex = +process.env.VALIDATOR_SECRET_PHRASES_START + i;
    if (secretPhrasesIndex >= +process.env.VALIDATOR_SECRET_PHRASES_END) {
      throw "Reached the end of the secret phrases"
    }
    await startValidatorContainer(secretPhrasesIndex)
    await sleep(2000)
  }
}

startNodeContainers()
