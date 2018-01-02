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

var job = new CronJob('00 */4 8-24 * * *', async() => {

    calculateProfits()

}, () => {
    
},
false
);

pusher.note(channelTagObject, 'Arbitrage', "ayylmao channel msg", function(error, response) {
    if(error) {
        console.log(error)
    }
});

//job.start()
//console.log('Started Cronjob!')

async function calculateProfits() {
    try {
        var msg = ''
        let profitThreshold = 22.50

        // improvement to DRY: for .. enabledPair { calculate }

        await getCalculations('LTCEUR')
        calculate()
        if(calc.profit > profitThreshold) msg += constructMessage(calc) + '\n'

        /*
        await getCalculations('ETHEUR')
        calculate()
        if(calc.profit > profitThreshold) msg += constructMessage(calc) + '\n'

        await getCalculations('BTCEUR')
        calculate()
        if(calc.profit > profitThreshold) msg += constructMessage(calc) + '\n'
        */
        let timestamp = '[' + Date.now() + '] ';
        if(!isEmpty(msg)) {
            msg = msg.trim()
            sendPush(msg)
            console.log(timestamp + 'Message sent: ' + msg)
        } else {
            console.log(timestamp + 'No currency arbitrage would have given a profit of at least 25€')
        }

    } catch(err) {
        console.error(err)
    }
}

function sendPush(message) {
    pusher.note(channelTagObject, 'Arbitrage', message, function(error, response) {
        if(error) {
            console.log(error)
        }
    });
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

function getCalculations (tradePair) {
    return new Promise(resolve => {
        const corsPrefix = 'https://proxy-arbitrage.chagemann.de/'

        https.get(corsPrefix + 'markets/gdax/' + tradePair + '/price', (res1) => {
            let body1 = [];
            let body2 = [];
            res1.on('data', (chunk1) => {
                body1.push(chunk1)        
            }).on('end', () => {
                body1 = Buffer.concat(body1).toString();

                calc.priceHigh = JSON.parse(body1).result.price

                https.get(corsPrefix + 'markets/kraken/' + tradePair + '/price', (res2) => {
                    res2.on('data', (chunk2) => {
                        body2.push(chunk2)        
                    }).on('end', () => {
                        body2 = Buffer.concat(body2).toString();

                        calc.priceLow = JSON.parse(body2).result.price
                        calc.tradePair = tradePair
                        resolve(null)
                    });
                })
            }).on('error', (e) => { 
                console.error(e);
            });

        }).on('error', (e) => { 
            console.error(e);
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