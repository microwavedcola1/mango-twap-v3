mango-v3 twap, inspired by [jup-twap](https://github.com/gopartyparrot/jup-twap)

## Development
```
node --version
v16.13.1

nodemon src/index.ts twap --market BTC-PERP --side buy \
 --amount 0.01 --interval 10s --priceThreshold 50000
```

## Example
copy .env.example into .env, fill with desired properties, and then run as below

```
MANGO_ACCOUNT= mango account public key
GROUP= devnet.2 (for testing) or mainnet.1
RPC_URL= devnet or mainnet RPC URL
WALLET_PK= base58 encoded private key for wallet (can be exported from phantom)
```

```
# spot
yarn ts-node src/index.ts twap  --market MNGO/USDC --side buy \
 --amount 1 --interval 10s --priceThreshold 0.20
```
```
# perp
yarn ts-node src/index.ts twap  --market MNGO-PERP --side buy \
 --amount 1 --interval 10s --priceThreshold 0.20
  ```

## Todo
* it would be great if we could use the delegate feature to have someone implement twap as a standalone service as well as other trading strategies (like trailing stop)