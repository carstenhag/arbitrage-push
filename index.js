let https = require('https');
var CronJob = require('cron').CronJob;
let PushBullet = require('pushbullet');
let pusher = new PushBullet(''); // API key of the account

let channelTagObject = {channel_tag: 'arbitrage'} // exchange for own tag, or simply use device ID as string (not inside an object)

var calc = {
    priceHigh: null,
    priceLow: null,
    profit: null,
    profitPercentage: null,
    withdrawFeeCrypto: 0.001,
    withdrawFeeFiat: 0.15,
    tradeVolumeFiat: 500,
    exchangeFeePercentage: 0.26,
    tradePair: null
}

var job = new CronJob('00 */5 8-24 * * *', async() => {

    calculateProfits()

}, () => {
    
},
false
);

calculateProfits()
job.start()
console.log('Started Cronjob!')

async function calculateProfits() {
    try {
        var msg = ''
        let profitThreshold = 22.50

        // improvement to DRY: for .. enabledPair { calculate }

        var error = await getPrices('LTCEUR')
        if(error) {
            console.log(getDateString() + JSON.stringify(error))
            return
        }
        calculate()
        if(calc.profit > profitThreshold) msg += constructMessage(calc) + '\n'

        /*
        await getPrices('ETHEUR')
        calculate()
        if(calc.profit > profitThreshold) msg += constructMessage(calc) + '\n'

        await getPrices('BTCEUR')
        calculate()
        if(calc.profit > profitThreshold) msg += constructMessage(calc) + '\n'
        */

        if(!isEmpty(msg)) {
            msg = msg.trim()
            sendPush(msg)
            console.log(getDateString() + 'Message sent: ' + msg)
        } else {
            console.log(getDateString() + 'No currency arbitrage would have given a profit of at least ' + formatEur(profitThreshold))
        }

    } catch(err) {
        console.error(err)
    }
}

function sendPush(message) {
    pusher.note(channelTagObject, 'Arbitrage', message, function(error, response) {
        if(error) {
            console.log(getDateString() + JSON.stringify(error))
        }
    });
}

function getDateString () {
    let d = new Date();
    return datestring = ("0" + d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" +
                     d.getFullYear() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ' ';
}

function constructMessage (calc) {
    return 'Gewinn ' + calc.tradePair + ': ' +  formatEur(calc.profit) + ' — ' + formatPercentage(calc.profitPercentage)
}

function calculate () {

    var amountCrypto = calc.tradeVolumeFiat / calc.priceLow
    amountCrypto = amountCrypto * (100 - calc.exchangeFeePercentage) / 100
    amountCrypto = amountCrypto - calc.withdrawFeeCrypto

    let fiatAmount = amountCrypto * calc.priceHigh
    calc.profit = fiatAmount - calc.tradeVolumeFiat - calc.withdrawFeeFiat
    calc.profitPercentage = calc.profit / calc.tradeVolumeFiat * 100
}

function getPrices (tradePair) {
    return new Promise(resolve => {
        const corsPrefix = 'https://proxy-arbitrage.chagemann.de/'

        https.get(corsPrefix + 'markets/gdax/' + tradePair + '/price', (res1) => {
            let body1 = [];
            let body2 = [];
            res1.on('data', (chunk1) => {
                body1.push(chunk1)        
            }).on('end', () => {

                body1 = Buffer.concat(body1).toString();
                try {
                    calc.priceHigh = JSON.parse(body1).result.price
                } catch (e) {
                    resolve(e)
                }

                https.get(corsPrefix + 'markets/kraken/' + tradePair + '/price', (res2) => {
                    res2.on('data', (chunk2) => {
                        body2.push(chunk2)        
                    }).on('end', () => {

                        body2 = Buffer.concat(body2).toString();
                        try {
                            calc.priceLow = JSON.parse(body2).result.price
                        } catch (e) {
                            resolve(e)
                        }
                        calc.tradePair = tradePair
                        resolve(null)
                    });
                })
            }).on('error', (e) => {
                resolve(e)
            });

        }).on('error', (e) => {
            resolve(e)
        });

    })
}

function formatEur (number) {
    return number.toFixed(2) + '€'
}

function formatPercentage (number) {
return number.toFixed(2) + '%'
}

function isEmpty(str) {
    return (!str || 0 === str.length);
}