// jshint ignore: start
"use strict";

let prompt = require('prompt');
let colors = require('colors');
module.exports = (message, name, model, defaultValue) =>
	new Promise((resolve, reject) => {
		prompt.start();
		console.log(message.cyan);
		prompt.get(model(name, defaultValue), (err, results) => {
			if (err) reject(err);
			resolve(results[name]);
		});
	});