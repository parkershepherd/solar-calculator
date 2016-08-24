// jshint esnext: true
module.exports = (message, defaultValue) => {
	return {
		type: 'number',
		message: message,
		name: message,
		required: false,
		default: defaultValue,
	};
};