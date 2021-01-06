/**
 * @brief NodeJS Discord Bot that is port of Telegram Bible Quizzle bot
 * 
 * Uses discord.js 
 */
require('dotenv').config();

// Setup
const Discord = require('discord.js');
const bot = new Discord.Client();

// Get token from secret file
const TOKEN = process.env.TOKEN;

bot.login(TOKEN);
