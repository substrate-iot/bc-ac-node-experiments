#!/bin/bash
#========================================
# Initial Constants
#========================================
BASE_PATH="/tmp/bc-ac-node"
NODE_NAME="BcAcNode"

#========================================
# Checking either run or not
#========================================
if [ ${RUN_BOOTNODE} = false ]; then 
  echo "Bootnode has not been started in this invoking"
  exit 0
fi

#========================================
# Starting node at the first time
#========================================
node-template \
  --base-path "${BASE_PATH}" \
  --chain "/tmp/experiments/${CUSTOM_SPEC_RAW_FILE}" \
  --port 30333 \
  --node-key "${BOOTNODE_KEY}" \
  --telemetry-url "wss://telemetry.polkadot.io/submit/ 0" \
  --validator \
  --unsafe-ws-external \
  --unsafe-rpc-external \
  --rpc-methods Unsafe \
  --name "${NODE_NAME}" \
  --password "${PASSWORD}" \
  & NODE_PID=$! ;
sleep 3

#========================================
# Stopping the node for modifiyng keys
#========================================
kill "${NODE_PID}"

#========================================
# Finding an unused key and Picking it
#========================================
source "/tmp/experiments/key-picking.sh"

#========================================
# Adding the key to keystore of the node
#========================================
echo -e "======================================="
echo -e "Secret phrases are: ${SECRET_PHRASES}"
echo -e "======================================="
node-template key insert \
  --base-path "${BASE_PATH}" \
  --chain /tmp/experiments/${CUSTOM_SPEC_RAW_FILE} \
  --scheme Sr25519 \
  --suri "${SECRET_PHRASES}" \
  --password "${PASSWORD}" \
  --key-type aura

node-template key insert \
  --base-path "${BASE_PATH}" \
  --chain /tmp/experiments/${CUSTOM_SPEC_RAW_FILE} \
  --scheme Ed25519 \
  --suri "${SECRET_PHRASES}" \
  --password "${PASSWORD}" \
  --key-type gran

#========================================
# Starting the node permanently
#========================================
echo -e "======================================="
echo -e "Starting the node permanently"
echo -e "======================================="
node-template \
  --base-path "${BASE_PATH}" \
  --chain "/tmp/experiments/${CUSTOM_SPEC_RAW_FILE}" \
  --port 30333 \
  --node-key "${BOOTNODE_KEY}" \
  --telemetry-url "wss://telemetry.polkadot.io/submit/ 0" \
  --validator \
  --unsafe-ws-external \
  --unsafe-rpc-external \
  --rpc-methods Unsafe \
  --name "${NODE_NAME}" \
  --password "${PASSWORD}";

