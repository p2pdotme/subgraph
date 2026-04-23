# Security Policy

## Supported Versions

| Network      | Status      |
|--------------|-------------|
| Base mainnet | ✅ Supported |
| Base Sepolia | ✅ Supported |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in this subgraph or the underlying smart contract ABIs, please disclose it responsibly by emailing:

**security@p2p.me**

Include as much of the following as possible:

- Type of issue (e.g. incorrect data indexing, exposed sensitive data, incorrect access control mapping)
- The file(s) and line number(s) related to the issue
- Any relevant transaction hashes or block numbers on Base or Base Sepolia
- A description of the potential impact
- Steps to reproduce (if applicable)

You will receive an acknowledgement within **48 hours** and a more detailed response within **5 business days** indicating the next steps.

## Scope

This repository is a read-only data indexing layer (The Graph subgraph). It does not hold funds, control smart contracts, or process user authentication. Security issues of highest relevance include:

- Incorrect event indexing that could expose misleading on-chain data
- Data leakage from subgraph entities (e.g. unintended exposure of user data)
- Dependency vulnerabilities in the build toolchain

Issues in the underlying p2p.me smart contracts should be reported separately through the smart contract team's disclosure channel.

## Preferred Languages

We accept vulnerability reports in **English**.
