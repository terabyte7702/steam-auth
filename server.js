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
    returnURL: 'http://localhost:3000/auth/steam/return',
    realm: 'http://localhost:3000/',
    apiKey: '17EA696C4E9C2C11E16BDED1FFC2AC71'
}, function(identifier, profile, done) {
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
app.get('/logout', (req, res) => {
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

            if (games && games.length > 0) {
                let gamesInfo = `Hello, ${req.user.displayName}! Here are the games you played in the last 2 weeks:<br><ul>`;
                games.forEach(game => {
                    gamesInfo += `<li>${game.name}: ${game.playtime_2weeks} minutes</li>`;
                });
                gamesInfo += '</ul>';
                res.send(gamesInfo);
            } else {
                res.send(`Hello, ${req.user.displayName}! You haven't played any games in the last 2 weeks.`);
            }
        } catch (error) {
            res.send(`Error fetching data: ${error}`);
        }
    } else {
        res.send('Not logged in. <a href="/auth/steam">Log in with Steam</a>');
    }
});

// Запуск сервера
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
