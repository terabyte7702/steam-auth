const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const axios = require('axios');

const app = express();

// Настройка сессий
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

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

// Функция для получения средней стоимости предмета
async function getItemPriceInKZT(itemName) {
    try {
        const response = await axios.get(`https://steamcommunity.com/market/priceoverview/?appid=730&currency=37&market_hash_name=${encodeURIComponent(itemName)}`);
        if (response.data && response.data.median_price) {
            return response.data.median_price;
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Error fetching price for item ${itemName}:`, error);
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
                            marketableItems.push({ name: itemName, icon: itemIcon, price: itemPrice });
                        } else {
                            nonMarketableItems.push({ name: itemName, icon: itemIcon });
                        }
                    }
                }

                if (marketableItems.length > 0) {
                    html += `<p>Вот твой инвентарь CS:GO:</p><ul>`;
                    marketableItems.forEach(item => {
                        html += `<li><img src="${item.icon}" alt="${item.name}" style="width: 50px; height: 50px;"> ${item.name} - ${item.price ? item.price + ' KZT' : 'Цена не найдена'}</li>`;
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

            res.send(html);
        } catch (error) {
            res.send(`Error fetching data: ${error}`);
        }
    } else {
        res.send('Залогинься in. <a href="/auth/steam">Log in with Steam</a>');
    }
});

// Запуск сервера
app.listen(3000, () => {
    console.log('Server is running on https://steam-auth.vercel.app/');
});
