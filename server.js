const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');

const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    community: community,
    language: 'en'
});

const logOnOptions = {
    accountName: 'terabyte070410',
    password: 'ratatata7'
};

client.logOn(logOnOptions);

client.on('loggedOn', () => {
    console.log('Logged into Steam');
    client.setPersona(SteamUser.EPersonaState.Online);
});

client.on('webSession', (sessionID, cookies) => {
    manager.setCookies(cookies, (err) => {
        if (err) {
            console.log(err);
            process.exit(1); // Fatal error since we couldn't get API key
        }

        console.log('Got API key: ' + manager.apiKey);
    });

    community.setCookies(cookies);
});

function sendTradeOffer(partnerSteamID, items) {
    const offer = manager.createOffer(partnerSteamID);

    items.forEach(item => {
        offer.addMyItem({
            appid: 730,
            contextid: 2,
            assetid: item.assetid
        });
    });

    offer.setMessage('Here are your items!');
    offer.send((err, status) => {
        if (err) {
            console.log(`Error sending trade offer: ${err}`);
        } else {
            console.log(`Trade offer sent with status: ${status}`);
        }
    });
}

module.exports = { sendTradeOffer };
