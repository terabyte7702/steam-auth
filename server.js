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
            const inventoryResponse = await axios.get(`https://steamcommunity.com/inventory/${steamID}/730/2?l=english&count=5000`);
            const inventory = inventoryResponse.data.assets;

            if (inventory && inventory.length > 0) {
                html += `<p>Вот твой инвентарь CS:GO:</p><ul>`;
                inventory.forEach(item => {
                    html += `<li>Item ID: ${item.assetid}</li>`;
                });
                html += '</ul>';
            } else {
                html += `<p>У тебя нет предметов в инвентаре CS:GO.</p>`;
            }

            res.send(html);
        } catch (error) {
            res.send(`Error fetching data: ${error}`);
        }
    } else {
        res.send('Not logged in. <a href="/auth/steam">Log in with Steam</a>');
    }
});

// Запуск сервера
app.listen(3000, () => {
    console.log('Server is running on https://steam-auth.vercel.app/');
});
