#!/usr/bin/env bash
# Creates the Always Free Ampere VM for the LSMD website, retrying every minute
# while Oracle reports "Out of capacity". Run it in OCI Cloud Shell (already
# signed in, nothing to install), passing your SSH public key:
#
#   curl -fsSL https://raw.githubusercontent.com/blade1walker/lsmd/main/deploy/oracle/create-vm.sh | bash -s -- "ssh-ed25519 AAAA... you"
#
# It sets up the network once (VCN, internet gateway, public subnet, ports
# 22/80/443 open), then keeps asking for the VM until it gets one and prints
# its public IP. Safe to run again — it reuses what already exists.
# SHAPE / OCPUS / MEM / COMPARTMENT can be overridden from the environment
# (SHAPE=VM.Standard.E2.1.Micro is the always-available 1 GB AMD fallback).
set -uo pipefail

PUBKEY="${1:-}"
NAME=lsmd-web
SHAPE="${SHAPE:-VM.Standard.A1.Flex}"
OCPUS="${OCPUS:-2}"
MEM="${MEM:-12}"
COMP="${COMPARTMENT:-${OCI_TENANCY:-}}"

if [ -z "$PUBKEY" ] || [ -z "$COMP" ]; then
  echo 'usage: create-vm.sh "<ssh public key>"   (run in OCI Cloud Shell, or set COMPARTMENT)'
  exit 1
fi

say() { printf '\n\033[1;31m==>\033[0m %s\n' "$*"; }
# The CLI prints "null" (or nothing) when a query matches nothing.
val() { local v; v=$(oci "$@" --raw-output 2>/dev/null); [ "$v" = null ] && v=; printf '%s' "$v"; }

say "Network"
VCN=$(val network vcn list -c "$COMP" --display-name lsmd-vcn --query 'data[0].id')
if [ -z "$VCN" ]; then
  VCN=$(val network vcn create -c "$COMP" --display-name lsmd-vcn --cidr-blocks '["10.0.0.0/16"]' \
        --dns-label lsmd --wait-for-state AVAILABLE --query data.id)
fi
[ -n "$VCN" ] || { echo "Could not create the VCN"; exit 1; }

IGW=$(val network internet-gateway list -c "$COMP" --vcn-id "$VCN" --query 'data[0].id')
if [ -z "$IGW" ]; then
  IGW=$(val network internet-gateway create -c "$COMP" --vcn-id "$VCN" --display-name lsmd-igw \
        --is-enabled true --wait-for-state AVAILABLE --query data.id)
fi

RT=$(val network vcn get --vcn-id "$VCN" --query 'data."default-route-table-id"')
oci network route-table update --rt-id "$RT" --force >/dev/null \
  --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW\"}]"

port() { printf '{"protocol":"6","source":"0.0.0.0/0","tcpOptions":{"destinationPortRange":{"min":%s,"max":%s}}}' "$1" "$1"; }
SL=$(val network vcn get --vcn-id "$VCN" --query 'data."default-security-list-id"')
oci network security-list update --security-list-id "$SL" --force >/dev/null \
  --ingress-security-rules "[$(port 22),$(port 80),$(port 443),{\"protocol\":\"1\",\"source\":\"0.0.0.0/0\",\"icmpOptions\":{\"type\":3,\"code\":4}}]"

SUBNET=$(val network subnet list -c "$COMP" --vcn-id "$VCN" --display-name lsmd-subnet --query 'data[0].id')
if [ -z "$SUBNET" ]; then
  SUBNET=$(val network subnet create -c "$COMP" --vcn-id "$VCN" --display-name lsmd-subnet \
           --cidr-block 10.0.0.0/24 --dns-label web --wait-for-state AVAILABLE --query data.id)
fi
[ -n "$SUBNET" ] || { echo "Could not create the subnet"; exit 1; }
echo "VCN, gateway, subnet and ports 22/80/443 ready"

AD=$(val iam availability-domain list -c "$COMP" --query 'data[0].name')
IMAGE=$(val compute image list -c "$COMP" --operating-system "Canonical Ubuntu" --operating-system-version 24.04 \
        --shape "$SHAPE" --sort-by TIMECREATED --sort-order DESC --query 'data[0].id')
[ -n "$IMAGE" ] || { echo "No Ubuntu 24.04 image found for $SHAPE"; exit 1; }

KEYFILE=$(mktemp)
printf '%s\n' "$PUBKEY" > "$KEYFILE"

ID=$(val compute instance list -c "$COMP" --display-name "$NAME" --query "data[?\"lifecycle-state\"!='TERMINATED'] | [0].id")
if [ -n "$ID" ]; then
  say "$NAME already exists"
else
  # Only Flex shapes take a size; fixed shapes like E2.1.Micro reject one.
  CONFIG=()
  if [[ $SHAPE == *Flex ]]; then
    CONFIG=(--shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEM}")
    say "Requesting $SHAPE ($OCPUS OCPU / $MEM GB) in $AD — retrying every minute until Oracle has room"
  else
    say "Requesting $SHAPE in $AD — retrying every minute until Oracle has room"
  fi
  n=0
  while :; do
    n=$((n + 1))
    out=$(oci compute instance launch -c "$COMP" --availability-domain "$AD" --display-name "$NAME" \
          --shape "$SHAPE" "${CONFIG[@]}" \
          --image-id "$IMAGE" --subnet-id "$SUBNET" --assign-public-ip true \
          --ssh-authorized-keys-file "$KEYFILE" --query data.id --raw-output 2>&1)
    if [[ $out == ocid1.instance* ]]; then ID=$out; break; fi
    if grep -qi 'capacity' <<<"$out"; then
      echo "$(date -u '+%F %T') UTC  attempt $n: out of capacity, retrying in 60s"
      sleep 60
    elif grep -qi 'TooManyRequests' <<<"$out"; then
      echo "$(date -u '+%F %T') UTC  attempt $n: rate limited, retrying in 3 min"
      sleep 180
    else
      echo "$out"
      echo "Stopped: Oracle returned an error other than out of capacity (shown above)."
      exit 1
    fi
  done
fi
rm -f "$KEYFILE"

say "Waiting for $NAME to start"
oci compute instance get --instance-id "$ID" --wait-for-state RUNNING >/dev/null
IP=$(val compute instance list-vnics --instance-id "$ID" --query 'data[0]."public-ip"')
say "VM ready — public IP: $IP"
echo "  SSH in:  ssh ubuntu@$IP"
echo "  Then follow deploy/oracle/README.md step 2 (domain) and step 3 (setup.sh)."
