"use strict";

let colors = require('colors');
let ask = require('./ask');
let numberList = require('./models/number-list');
let number = require('./models/number');
let boolean = require('./models/boolean');
let async = require('asyncawait/async');
let await = require('asyncawait/await');
let _ = require('lodash');

let defaults = {
	size:             7,
	price:            22000,
	warranty:         25,
	longevity:        80,
	currentRate:      10.71,
	rateGrowth:       3.5,
	averageBill:      150,
	panelProduction:  2105,
	generatorCost:    4000,
	investmentReturn: 4,
};

let getInputs = async (() => {
	console.log('');
	console.log('=== Solar installation cost calcuator ==='.cyan);
	console.log('You will need to know how much sunlight your area gets per year. Try going to https://www.wunderground.com/calculators/solar.html, put in your zip code, select a solar panel with similar efficiency to yours and a number of panels that results in 1 kW total (I used Kyocera KD205GX-LP [15% efficiency] and 5 panels). This should calculate the kWh you will get for a 1 kW system.'.grey);
	console.log('');

	// Solar system
	console.log('Solar system:'.cyan);
	let size = await (ask(` 1/12 `.grey + 'What is the solar installation size? (kW)', 'System size', number, defaults.size));
	let price = await (ask(` 2/12 `.grey + 'What is the price of the system AFTER incentives, but INCLUDING financing costs if any? ($)', 'Total price', number, defaults.price));
	let warranty = await (ask(` 3/12 `.grey + 'How many years are your panels warrantied for? (years)', 'Warranty length', number, defaults.warranty));
	let duration = await (ask(` 4/12 `.grey + 'What period of time are you interested in looking at? (years)', 'Duration', number, warranty+5));
	let longevity = await (ask(` 5/12 `.grey + 'How efficient will the panels be at the end of the warranty? (%)', 'Panel longevity', number, defaults.longevity));
	let panelProduction = await (ask(` 6/12 `.grey + 'How many kWh per 1 kW of your brand solar panel does your area get per year? (kWh) (2105 for a 15% efficient panel in Salt Lake City, see above instructions)', 'Amount of sun', number, defaults.panelProduction));
	console.log('');


	// Electricity bill
	console.log('Electricity bill:'
		.cyan);
	let currentRate = await (ask(` 7/12 `.grey + 'What is your current average electricity rate? ($/kWh)', 'Current rate', number, defaults.currentRate));
	let rateGrowth = await (ask(` 8/12 `.grey + 'How much do you expect your electric rate to increase per year? (%) (Historically 2-7%)', 'Electric rate growth', number, defaults.rateGrowth));
	let averageBill = await (ask(` 9/12 `.grey + 'What is your AVERAGE electricity bill now? ($)', 'Average bill', number, defaults.averageBill));
	console.log('');

	// Other
	console.log('Other:'.cyan);
	let generatorCost = await (ask(`10/12 `.grey + 'How much would you spend on a generator if you DIDNT install solar ($)?', 'Generator cost', number, defaults.generatorCost));
	let investmentReturn = await(ask(`11/12 `.grey + 'What rate of return could you make on another investment per year? (stock/bonds/savings) (%)', 'Investment return', number, defaults.investmentReturn));
	let homeValueChange = await (ask(`12/12 `.grey + 'How much do you expect the value of your home to change by installing solar? ($)', 'Home value change', number, price*.5));
	return {size, price, warranty, duration, longevity, currentRate, rateGrowth, averageBill, panelProduction, homeValueChange, generatorCost, investmentReturn, homeValueChange};
});


let padString = (message, wantedLength) => {
	let str = message + '';
	if (str.length < wantedLength) {
		let difference = wantedLength-str.length;
		for (let i=0; i<difference; i++) {
			str += ' ';
		}
	}
	return str;
};

let numberWithCommas = x => {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
};

let currency = (number, defaultColor) => {
	let positive = number >= 0;
	let val = numberWithCommas(Math.abs(number).toFixed(2));
	if (positive) {
		return `$${val}`[defaultColor || 'green'];
	} else {
		return `($${val})`[defaultColor || 'red'];
	}
};

let getAverageRates = answers => {
	let yearlyStartingRates = [answers.currentRate];
	let ratePerYear = answers.rateGrowth / 100;
	let rate = answers.currentRate
	for (let i=0; i<answers.duration; i++) {
		let nextRate = rate * (1 + ratePerYear);
		yearlyStartingRates.push(nextRate);
		rate = nextRate;
	}

	let yearlyAverageRates = [];
	for (let i=0; i<yearlyStartingRates.length; i++) {
		if (i===yearlyStartingRates.length-1) {
			break;
		}
		yearlyAverageRates.push((yearlyStartingRates[i] + yearlyStartingRates[i+1])/2);
	}
	return yearlyAverageRates;
};

let getYearlySolarProduction = answers => {
	let yearlyStartingRates = [answers.size * answers.panelProduction];
	let ratePerYear = Math.pow(answers.longevity/100, 1/answers.warranty) - 1;
	let rate = answers.size * answers.panelProduction;
	for (let i=0; i<answers.duration; i++) {
		let nextRate = rate * (1 + ratePerYear);
		yearlyStartingRates.push(nextRate);
		rate = nextRate;
	}

	let yearlyAverageRates = [];
	for (let i=0; i<yearlyStartingRates.length; i++) {
		if (i===yearlyStartingRates.length-1) {
			break;
		}
		yearlyAverageRates.push((yearlyStartingRates[i] + yearlyStartingRates[i+1])/2);
	}
	return yearlyAverageRates;
};

let getStats = answers => {
	let yearlyEnergyUse = answers.averageBill * 12 / (answers.currentRate / 100);
	let solarEnergyProduction = getYearlySolarProduction(answers);
	let relativePrice = answers.price - answers.generatorCost - answers.homeValueChange;
	let cumulativeSavings = 0;
	let cumulativeSavingsWithInterest = 0;
	let payoffYear = null;

	let yearlyAverageRates = getAverageRates(answers);
	let yearlyStats = [];
	for (let i=0; i<answers.duration; i++) {
		let withoutCost = yearlyEnergyUse * (yearlyAverageRates[i] / 100);
		let withCost = (yearlyEnergyUse - solarEnergyProduction[i]) * (yearlyAverageRates[i] / 100);

		cumulativeSavings += (withoutCost - withCost);
		cumulativeSavingsWithInterest += (withoutCost - withCost);
		cumulativeSavingsWithInterest = cumulativeSavingsWithInterest * (1 + answers.investmentReturn / 100);

		if (cumulativeSavingsWithInterest >= relativePrice) {
			payoffYear = payoffYear || i+1;
		}

		yearlyStats.push({
			electricityRate: yearlyAverageRates[i],
			endYearCumulativeSavings: cumulativeSavings,
			endYearCumulativeSavingsWithInterest: cumulativeSavingsWithInterest,
			withoutCostMonthly: withoutCost / 12,
			withCostMonthly: withCost / 12,
			savingsMonthly: (withoutCost - withCost) / 12,
			panelEfficiency: solarEnergyProduction[i] / solarEnergyProduction[0],
		});
	}

	return {
		yearlyEnergyUse: yearlyEnergyUse,
		yearlyStats: yearlyStats,
		firstYear: yearlyStats[0],
		lastYear: yearlyStats[yearlyStats.length-1],
		totals: {
			relativePrice: relativePrice,
			payoffYear: payoffYear,
			withoutCost: _(yearlyStats).map('withoutCostMonthly').map(cost => cost * 12).reduce((l, r) => l + r),
			withCost: _(yearlyStats).map('withCostMonthly').map(cost => cost * 12).reduce((l, r) => l + r),
			savings: _(yearlyStats).map('savingsMonthly').map(cost => cost * 12).reduce((l, r) => l + r),
			savingsWithInterest: cumulativeSavingsWithInterest,
		}
	};
}


let printResults = answers => {
	let stats = getStats(answers);

	console.log('');
	console.log('');
	console.log('=== Results ==='.cyan);
	console.log('');



	// Disclaimer
	console.log('This calculator does not account for (among other things):'.cyan);
	console.log(' → Non-linear fluctuations in electricity price'.grey);
	console.log(' → Non-linear fluctuations in investment potential'.grey);
	console.log(' → Fluctuations in climate year to year'.grey);
	console.log(' → Purchasing a generator in a future year'.grey);
	console.log(' → Maintentance fees outside of warranty'.grey);
	console.log(' → Electricity rates being different during day/night and summer/winter'.grey);
	console.log(' → Electric companies who do not have buyback'.grey);
	console.log(' → House value influence changing over time'.grey);
	console.log('');



	// Set up variables
	console.log('Calculated based on:'.cyan);
	console.log(` → `.grey + `A ${currency(answers.price, 'white')}, ${answers.size} kW system with a ${answers.warranty} year warranty`);
	console.log(` → `.grey + `Panels that produce ${answers.panelProduction*answers.size} kWh/yr and will be ${answers.longevity}% efficient at ${answers.warranty} years`);
	console.log(` → `.grey + `Your monthly electric bill is ${currency(answers.averageBill, 'white')} at ${answers.currentRate} ¢/kWh, and you expect it to increase by ${answers.rateGrowth}% per year`);
	if (answers.generatorCost > 0) {
		console.log(` → `.grey + `You were planning on buying a backup generator for ${currency(answers.generatorCost, 'white')} if you didn't install solar`);
	} else {
		console.log(` → `.grey + `You were NOT planning on buying a backup generator`);
	}
	console.log(` → `.grey + `You expect your home's value to increase by ${currency(answers.homeValueChange, 'white')} and you think you can make ${answers.investmentReturn}% interest on your own`);
	console.log('');



	// First year
	console.log('First Year:'.cyan);
	console.log(` → `.grey + `Monthly bill without solar: ` + currency(stats.firstYear.withoutCostMonthly, 'white') + ` (${stats.firstYear.electricityRate.toFixed(2)} ¢/kWh)`.grey);
	console.log(` → `.grey + `Monthly bill with solar: ` + currency(stats.firstYear.withCostMonthly, 'white') + ` (`.grey + currency(stats.firstYear.savingsMonthly, 'grey') + ` savings)`.grey);
	console.log('');



	// Last year
	console.log(`Year ${answers.duration}:`.cyan);
	console.log(` → `.grey + `Monthly bill without solar: ` + currency(stats.lastYear.withoutCostMonthly, 'white') + ` (${answers.rateGrowth}% increase per year)`.grey);
	console.log(` → `.grey + `Monthly bill with solar: ` + currency(stats.lastYear.withCostMonthly, 'white') + ` (`.grey + currency(stats.lastYear.savingsMonthly, 'grey') + ` savings)`.grey);
	console.log(` → `.grey + `Solar panel efficiency: ${(stats.lastYear.panelEfficiency*100).toFixed(1)}%`);
	console.log('');



	// Yearly summaries
	console.log(`Summary by year ${answers.duration}:`.cyan)
	if (answers.generatorCost > 0) {
		console.log(` → `.grey + `Price difference between solar and generator: ` + currency(stats.totals.relativePrice, 'white'));
	} else {
		console.log(` → `.grey + `Price of solar system: ` + currency(answers.price, 'white'));
	}
	console.log(` → `.grey + `Total electricity savings: `.green + currency(stats.totals.savings) + ` (${(stats.yearlyEnergyUse/12).toFixed(0)} kWh/mo usage)`.grey);
	if (stats.totals.payoffYear === null) {
		console.log(` → `.grey + `System does not break even durring the time period`.red);
	} else {
		console.log(` → `.grey + `System breaks even in year ${stats.totals.payoffYear}`.green);
		console.log(` → `.grey + `Investing your savings at ${answers.investmentReturn}%, you end up with ${currency(stats.totals.savingsWithInterest)}`.green + ` (`.grey + currency(stats.totals.savingsWithInterest - stats.totals.savings, 'grey') + ` in interest)`.grey);
		console.log(` → `.grey + `Your home value increased by ${currency(answers.homeValueChange)}`.green + ` (according to you)`.grey);
		console.log(` → `.grey + `As a whole, the system nets you `.green + currency(stats.totals.savingsWithInterest - answers.price + answers.generatorCost + answers.homeValueChange) + ` vs not installing solar`.green);
	}
	console.log('');



	// Yearly table
	console.log('Yearly Table:'.cyan);
	console.log('   ' + padString('Year',7).cyan + padString('Rate/kWh', 10).cyan + padString('Bill/mo', 12).cyan + padString('With solar', 13).cyan + padString('Savings/mo', 14).cyan + padString('Savings/yr', 14).cyan + padString('Invest Potential', 18).cyan + padString('Solar return', 15).cyan);
	for (let i=0; i<answers.duration; i++) {
		let totalReturnWithInterest = stats.yearlyStats[i].endYearCumulativeSavingsWithInterest-stats.totals.relativePrice;
		console.log(
			`   ` +
			padString(`${i+1}`,7).grey +
			padString(currency(stats.yearlyStats[i].electricityRate, 'grey'), 20) + 
			padString(currency(stats.yearlyStats[i].withoutCostMonthly, 'grey'), 22) + 
			padString(currency(stats.yearlyStats[i].withCostMonthly, 'grey'), 23) + 
			padString(currency(stats.yearlyStats[i].savingsMonthly, 'grey'), 24) +
			padString(currency(stats.yearlyStats[i].savingsMonthly*12, 'grey'), 24) +
			padString(currency((answers.price-answers.generatorCost)*Math.pow(Math.E, answers.investmentReturn/100*(i+1)), 'cyan'), 28) +
			currency(totalReturnWithInterest) +
			`${i+1===stats.totals.payoffYear ? ' (break even)'.cyan : ''}` +
			`${i+1===answers.warranty ? ' (warranty ends)'.yellow : ''}`
		);
	}
};

getInputs().then(printResults);
