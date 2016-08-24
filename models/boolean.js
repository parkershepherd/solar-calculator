// jshint esnext: true
module.exports = message => {
	return {
		type: 'boolean',
		message: message,
		name: message,
		required: false,
	};
};