const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
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
    twoFactorCode: SteamTotp.getAuthCode(config.sharedSecret)
});

client.on('loggedOn', () => {
    console.log('Logged into Steam');
    client.setPersona(SteamUser.Steam.EPersonaState.Online);
});

client.on('webSession', (sessionID, cookies) => {
    manager.setCookies(cookies);
    community.setCookies(cookies);
    community.startConfirmationChecker(30000, config.identitySecret); // Подтверждение трейдов каждые 30 секунд
});

function sendTradeOffer(steamID, items) {
    const offer = manager.createOffer(steamID);

    // Добавление выбранных предметов в трейд оффер
    items.forEach(item => {
        offer.addMyItem({
            assetid: item.assetid,
            appid: 730,
            contextid: 2
        });
    });

    offer.setMessage('Here are your selected items!');
    offer.send((err, status) => {
        if (err) {
            console.log(`Error sending trade offer: ${err.message}`);
            return;
        }
        console.log(`Trade offer sent! Status: ${status}`);
    });
}

// Экспорт функции для использования в основном сервере
module.exports = { sendTradeOffer };
