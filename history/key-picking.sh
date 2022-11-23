#!/bin/bash
SP_STATUS=/tmp/status/secretPhraseStatus.txt
PICK_LOG=/tmp/status/pickedKeys.log

RANDOM_SLEEP=$(($RANDOM%(${SECRET_PHRASES_END}-${SECRET_PHRASES_START}+1)+1)).$(($RANDOM%100))
echo -e "${RANDOM_SLEEP}" >> "/tmp/status/randomSleeps.txt"
sleep ${RANDOM_SLEEP}

if [ ! -f ${SP_STATUS} ]; then
  echo -e "${SECRET_PHRASES_START}\ntrue" > ${SP_STATUS}
fi

while [ $(sed "2!d" ${SP_STATUS}) = false ]; do # available indicator
  echo "Sleeping a second before re-checking secretPhraseStatus.txt"
  sleep 0.$(($RANDOM%1000+1))
done

sed -i "2s/true/false/" ${SP_STATUS} # indicating unavaiable

PICKED_KEY_INDEX=$(sed "1!d" ${SP_STATUS}) # picking current index

NEXT_KEY_INDEX=$((${PICKED_KEY_INDEX}+1))

if [ ${PICKED_KEY_INDEX} -gt ${SECRET_PHRASES_END} ]; then
  echo "Reached the end of the index of keys"
  exit 1
fi

SECRET_PHRASES=$(sed "${PICKED_KEY_INDEX}!d" /tmp/experiments/${SECRET_PHRASES_FILE})

echo -e "${HOSTNAME} ${SECRET_PHRASES}" >> "${PICK_LOG}"

sed -i "1s/${PICKED_KEY_INDEX}/${NEXT_KEY_INDEX}/" ${SP_STATUS} # saving the next index

sed -i "2s/false/true/" ${SP_STATUS} # indicating available
