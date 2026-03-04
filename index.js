const express = require('express');
const app = express();
const cors = require('cors');
const loginRouter = require('./routes/login')
const registerRouter = require('./routes/register')
const logoutRouter = require('./routes/logout')
const countriesRouter = require('./routes/countries')
const productsRouter = require('./routes/products')
const messageRouter = require('./routes/message')
require('dotenv').config()
const knex = require('knex')(require('./knexfile'))
const session = require("express-session");
const jwt = require('jsonwebtoken')
const KnexSessionStore = require("connect-session-knex")(session)
const PORT = process.env.PORT || 5000;
const http = require('http');
const server = http.createServer(app);
const {Server} = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.static('./public'))
const corsOptions= {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    "optionsSuccessStatus": 204
}

app.use(cors(corsOptions));
app.use(express.json());
const store = new KnexSessionStore({knex});

io.on("connection", (client)=>{
    client.on("data", async function(user){
        try{
        client.data.user = user;
        const userRooms = await knex("message_master").where(function(){
            this.where("message_master.user_one", "=", user.user_id )
            .orWhere("message_master.user_two", "=", user.user_id  )
        })
        userRooms.forEach(room => {
            client.join(room.room_id)
        })
    }catch(error){
        console.log("Failed to put client in room");
    }
    })
})


app.use(session({
    secret: process.env.SESSION_SECRET,
    cookie: {maxAge: 3600000,
        sameSite: 'none', //process.env.NODE_ENV === "production" ? 'none' : 'lax',
         secure: true //process.env.NODE_ENV === "production"
        },
    store
}))

app.use('/api/login', loginRouter);
app.use('/api/logout', logoutRouter)
app.use('/api/register', registerRouter);
app.use('/api/countries', countriesRouter);
app.use('/api/products', productsRouter);

app.use('/api/message', function(req, res, next){
    try{
        const authHeader = req.headers.authorization;
        if(!authHeader){return next();}

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Invalid token format" });
        }

        const token = req.headers.authorization.slice("Bearer ".length);
        const payload = jwt.verify(token, process.env.SESSION_SECRET);
        (async ()=>{
            const userData = await knex("user").join("country", "user.country_id", "=", "country.id")
                        .select("user.id as user_id", "user.email as email", "user.first_name as first_name", "user.last_name as last_name", "user.country_id as country_id", "country.name as country_name")
                        .where("user.id", "=", payload.user_id);
            req.user = userData[0];
            req.io = io;
            next();
        })();
    }catch(error){
        res.status(404).send(error.message)
    }
},messageRouter);



server.listen(PORT, ()=>{
    console.log(`Listening to port ${PORT}`)
})