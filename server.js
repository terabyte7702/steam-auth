const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const axios = require('axios');
const bodyParser = require('body-parser');
const { sendTradeOffer } = require('./tradeBot'); // Импорт функции из tradeBot.js

const app = express();

// Настройка сессий
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());

// Настройка стратегии Steam
passport.use(new SteamStrategy({
    returnURL: 'https://steam-auth.vercel.app/auth/steam/return',
    realm: 'https://steam-auth.vercel.app/',
    apiKey: '17EA696C4E9C2C11E16BDED1FFC2AC71'
}, function(identifier, profile, done) {
    profile.id = identifier.split('/').pop();  // Extract Steam ID
    return done(null, profile);
}));

// Сериализация и десериализация пользователя
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});

// Маршрут для аутентификации через Steam
app.get('/auth/steam', passport.authenticate('steam'));

// Маршрут для обработки ответа от Steam
app.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/');
});

// Маршрут для выхода
app.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// Функция для получения цены предмета в тенге
async function getItemPriceInKZT(itemName) {
    try {
        const response = await axios.get(`https://steamcommunity.com/market/priceoverview/?appid=730&currency=37&market_hash_name=${encodeURIComponent(itemName)}`);
        return response.data.median_price || response.data.lowest_price || null;
    } catch (error) {
        console.error(`Error fetching price for ${itemName}: ${error}`);
        return null;
    }
}

// Маршрут для отображения главной страницы и данных пользователя
app.get('/', async (req, res) => {
    if (req.isAuthenticated()) {
        const steamID = req.user.id;
        const apiKey = '17EA696C4E9C2C11E16BDED1FFC2AC71';

        try {
            // Запрос данных о недавно сыгранных играх
            const response = await axios.get(`http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${steamID}&format=json`);
            const games = response.data.response.games;

            let html = `<p>Салам, ${req.user.displayName}!</p>`;

            if (games && games.length > 0) {
                html += `Вот в эти игры ты задротил последние 2 недели, сходи траву потрогай чтоли:<br><ul>`;
                games.forEach(game => {
                    html += `<li>${game.name}: ${game.playtime_2weeks} minutes</li>`;
                });
                html += '</ul>';
            } else {
                html += `Ебать, ты 2 недели не прикасался к играм, ебанутый.`;
            }

            // Добавить кнопку выхода
            html += `
                <form action="/logout" method="post">
                    <button type="submit">Log out</button>
                </form>
            `;

            // Запрос данных инвентаря пользователя
            const inventoryResponse = await axios.get(`https://steamcommunity.com/inventory/${steamID}/730/2?l=russian&count=5000`);
            const inventory = inventoryResponse.data.assets;
            const descriptions = inventoryResponse.data.descriptions;

            const marketableItems = [];
            const nonMarketableItems = [];

            if (inventory && inventory.length > 0 && descriptions) {
                for (const item of inventory) {
                    const description = descriptions.find(desc => desc.classid === item.classid && desc.instanceid === item.instanceid);
                    if (description) {
                        const itemName = description.market_hash_name;
                        const itemIcon = `https://steamcommunity-a.akamaihd.net/economy/image/${description.icon_url}`;
                        const itemPrice = await getItemPriceInKZT(itemName);

                        if (description.marketable === 1) {
                            marketableItems.push({ name: itemName, icon: itemIcon, price: itemPrice, assetid: item.assetid });
                        } else {
                            nonMarketableItems.push({ name: itemName, icon: itemIcon });
                        }
                    }
                }

                if (marketableItems.length > 0) {
                    html += `<p>Вот твой инвентарь CS:GO:</p><ul>`;
                    marketableItems.forEach(item => {
                        html += `<li>
                                    <img src="${item.icon}" alt="${item.name}" style="width: 50px; height: 50px;">
                                    ${item.name} - ${item.price ? item.price + ' KZT' : 'Цена не найдена'}
                                    <button onclick="selectItem('${item.assetid}', '${item.name}')">Выбрать</button>
                                 </li>`;
                    });
                    html += '</ul>';
                } else {
                    html += `<p>У тебя нет предметов в инвентаре CS:GO.</p>`;
                }

                if (nonMarketableItems.length > 0) {
                    html += `<p>Предметы которые нельзя продать:</p><ul>`;
                    nonMarketableItems.forEach(item => {
                        html += `<li><img src="${item.icon}" alt="${item.name}" style="width: 50px; height: 50px;"> ${item.name}</li>`;
                    });
                    html += '</ul>';
                }
            } else {
                html += `<p>У тебя нет предметов в инвентаре CS:GO.</p>`;
            }

            // Добавляем скрипт для обработки выбора предметов
            html += `
                <script>
                    let selectedItems = [];

                    function selectItem(assetid, name) {
                        if (!selectedItems.some(item => item.assetid === assetid)) {
                            selectedItems.push({ assetid: assetid, name: name });
                            alert(name + ' добавлен в список для трейда.');
                        }
                    }

                    function sendTrade() {
                        fetch('/sendTrade', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ items: selectedItems })
                        })
                        .then(response => response.json())
                        .then(data => {
                            alert(data.message);
                            selectedItems = []; // Очистить список после отправки
                        })
                        .catch(error => {
                            console.error('Error:', error);
                        });
                    }
                </script>
                <button onclick="sendTrade()">Отправить трейд оффер</button>
            `;

            res.send(html);
        } catch (error) {
            res.send(`Error fetching data: ${error}`);
        }
    } else {
        res.send('Not logged in. <a href="/auth/steam">Log in with Steam</a>');
    }
});

// Маршрут для отправки трейд оффера
app.post('/sendTrade', async (req, res) => {
    if (req.isAuthenticated()) {
        const steamID = req.user.id;
        const items = req.body.items;

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No items selected' });
        }

        try {
            // Отправляем трейд оффер
            sendTradeOffer(steamID, items);
            res.json({ message: 'Trade offer sent!' });
        } catch (error) {
            res.status(500).json({ message: `Error sending trade offer: ${error.message}` });
        }
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

// Запуск сервера
app.listen(3000, () => {
    console.log('Server is running on https://steam-auth.vercel.app/');
});
