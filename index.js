const express = require('express');
const app = express();
const cors = require('cors');
const loginRouter = require('./routes/login')
const registerRouter = require('./routes/register')
const logoutRouter = require('./routes/logout')
require('dotenv').config()
const {v4: uuid} = require('uuid')
const logger = require('morgan');
const passport = require("passport");
const LocalStrategy = require('passport-local');
const crypto = require('crypto');
const knex = require('knex')(require('./knexfile'))
const session = require("express-session");
const KnexSessionStore = require("connect-session-knex")(session)
const PORT = process.env.PORT || 5000;

app.use(express.static('./public'))


app.use(cors());
app.use(express.json());
const store = new KnexSessionStore({knex});


passport.use(new LocalStrategy({usernameField: "email", passwordField: "password"}, async function verify(email, password, cb){
    try{
        const users = await knex("user")
            .where("email", "=", email);
        if(!users || users.length === 0){
            return cb(null, false, {message: "Incorrect username or password."});
        }
        let user = users[0]
        crypto.pbkdf2(password, user.salt, 31000, 32, "sha256", function(error, hashedPassword){
            if(error) return cb(error);
            if(!crypto.timingSafeEqual(user.hashed_password, hashedPassword)){
                return cb(null, false, {message: "Incorrect username or password."})
            }
            return cb(null, user);
        })
    }catch(error){
        return cb(error)
    }
    
}))


passport.serializeUser(function(user, cb) {
    console.log(user);
    process.nextTick(function() {
      return cb(null, { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, country_id: user.country_id });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    console.log(user)
    process.nextTick(function() {
      return cb(null, user);
    });
  });

app.use(session({
    secret: "keyboard cat",
    cookie: {maxAge: 3600000, secure:false},
    store
}))
app.use(passport.session())

app.use('/api/login', loginRouter);
app.use('/api/logout', logoutRouter)
app.use('/api/register', registerRouter);
app.get("/api/test", (req, res, next) => {
   res.send(req.user);
})

app.listen(PORT, ()=>{
    console.log(`Listening to port ${PORT}`)
})