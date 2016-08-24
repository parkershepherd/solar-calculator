// jshint esnext: true
module.exports = message => {
	return {
		type: 'array',
		message: message,
		name: message,
		required: true,
	};
};