const util = require('util')
const exec = util.promisify(require('child_process').exec)
const { writeFile } = require("fs/promises")
const path = require('path')

const args = require('yargs/yargs')(process.argv.slice(2))
  .option('cwd', {
    type: 'string',
    describe: 'Current working dirrectory that contains node binary and is output of chain spec file.'
  })
  .option('name', {
    alias: 'n',
    type: 'string',
    describe: 'A custom name for the chain specification that will be generated.',
  })
  .option('count', {
    alias: 'c',
    type: 'number',
    describe: 'The count of identities will be generated in chain specification.',
  })
  .option('password', {
    alias: 'p',
    type: 'string',
    describe: 'Passsword for key generation',
  })
  .demandOption(['cwd', 'name', 'count', 'password'], 'Please provide these arguments to work with this tool')
  .help()
  .argv

const CWD = args.cwd

const errorHandle = (e) => {
  console.log("Error happen!")
  console.error(e)
  process.exit(1)
}

const generateRandomKeys = async (count, password, sureDifferent) => {
  try {
    // 1. Generating SR25519 keys and making sure them different
    let execPromises = Array.from(Array(count), () => {
      const command = [
        './node-template',
        'key',
        'generate',
        '--scheme',
        'Sr25519',
        '--password',
        password,
        '--output-type',
        'json'
      ].join(' ')
      console.log('Command:', command)
      return exec(command, { cwd: CWD })
    })

    let execResults = await Promise.all(execPromises)
    const sr25519Keys = execResults.map(result => JSON.parse(result.stdout))

    if (sureDifferent) {
      let hasDuplicated = false
      for (let targetKey of sr25519Keys) {
        const countOfTargetKey = sr25519Keys
          .filter((k) => k.secretPhrase === targetKey.secretPhrase)
          .length
        if (countOfTargetKey > 1) {
          hasDuplicated = true
          throw "Fail to generate differently keys at all"
        }
      }
    }

    // 2. Generating ED25519 keys based on secret phrases in SR25519 generating results
    execPromises = sr25519Keys.map((key) => {
      const command = [
        './node-template',
        'key',
        'inspect',
        '--output-type',
        'json',
        '--password',
        password,
        '--scheme',
        'Ed25519',
        `"${key.secretPhrase}"`
      ].join(' ')
      console.log('Command:', command)
      return exec(command, { cwd: CWD })
    })

    execResults = await Promise.all(execPromises)
    const ed25519Keys = execResults.map(result => JSON.parse(result.stdout))

    const result = sr25519Keys.map((k, i) => {
      return {
        SR25519: k,
        ED25519: ed25519Keys[i]
      }
    })

    return result

  } catch (e) {
    errorHandle(e)
  }
}

const generateChainSpec = async (name, count, password) => {
  console.log("Generating chain specification is started.")

  try {
    // 1. Generating the default chain specification
    let customSpec
    {
      const command = [
        './node-template',
        'build-spec',
        '--disable-default-bootnode',
        '--chain',
        'local'
      ].join(' ')
      console.log('Command:', command)
      const { stdout, stderr } = await exec(command, { cwd: CWD })

      customSpec = JSON.parse(stdout)
    }

    // 2. Generating random keys
    const keys = await generateRandomKeys(count, password, true)

    // 3. Updating chain spec with keys
    customSpec.name = `${name} Local Testnet`
    customSpec.genesis.runtime.aura.authorities = keys.map(k => k.SR25519.ss58Address)
    customSpec.genesis.runtime.grandpa.authorities = keys.map(k => [k.ED25519.ss58Address, 1])

    // 4. Writing  custom spec & keys to files.
    await writeFile(path.join(CWD, `customSpec_${name}.json`), JSON.stringify(customSpec, null, 4))
    await writeFile(path.join(CWD, `secretPhrases_${name}.txt`), keys.map(k => k.SR25519.secretPhrase).join('\n'))

    // 5. Exporting to raw custom spec.
    const command = [
      './node-template',
      'build-spec',
      `--chain=${path.join(CWD, `customSpec_${name}.json`)}`,
      '--raw',
      '--disable-default-bootnode',
      '>',
      path.join(CWD, `customSpecRaw_${name}.json`)
    ].join(' ')
    console.log('Command:', command)
    await exec(command, { cwd: CWD })

  } catch (e) {
    errorHandle(e) // should contain code (exit code) and signal (that caused the termination).
  }

  console.log("Generating chain specification is completed.")
}

generateChainSpec(args.name, args.count, args.password)
