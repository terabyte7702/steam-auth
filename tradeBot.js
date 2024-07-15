const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamTotp = require('steam-totp');
const config = require('./config.json'); // Конфигурационный файл с данными бота

const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    community: community,
    language: 'en'
});

// Вход в аккаунт бота
client.logOn({
    accountName: config.accountName,
    password: config.password,
    twoFactorCode: SteamTotp.generateAuthCode(config.sharedSecret)
});

client.on('loggedOn', () => {
    console.log('Bot logged in');
    client.setPersona(SteamUser.Steam.EPersonaState.Online);
    client.gamesPlayed(730);
});

client.on('webSession', (sessionID, cookies) => {
    manager.setCookies(cookies);
    community.setCookies(cookies);
});

function sendTradeOffer(partnerSteamID, items) {
    const offer = manager.createOffer(partnerSteamID);

    items.forEach(item => {
        offer.addTheirItem({ appid: 730, contextid: 2, assetid: item.assetid });
    });

    offer.send((err, status) => {
        if (err) {
            console.log(`Error sending trade offer: ${err.message}`);
            return;
        }

        console.log(`Trade offer sent, status: ${status}`);
        if (status === 'pending') {
            community.acceptConfirmationForObject(config.identitySecret, offer.id, (err) => {
                if (err) {
                    console.log(`Error confirming trade offer: ${err.message}`);
                } else {
                    console.log('Trade offer confirmed');
                }
            });
        }
    });
}

module.exports = { sendTradeOffer };
