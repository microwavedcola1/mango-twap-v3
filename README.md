mango-v3 twap, inspired by [jup-twap](https://github.com/gopartyparrot/jup-twap)

places post only orders at midprice i.e. best (bid+ask)/2

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
MANGO_ACCOUNT_PK= mango account public key
GROUP= devnet.2 (for testing) or mainnet.1
RPC_URL= devnet or mainnet RPC URL
PRIVATE_KEY_BASE58= base58 encoded private key for wallet (can be exported from phantom), can also be the delegate's private key
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

```
# cancelling all existing orders for a market
yarn ts-node src/index.ts cancel --market BTC/USDC
```
