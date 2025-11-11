// Environment-based configuration for deployment
const config = {
    development: {
        port: 3000,
        host: 'localhost',
        maxUsers: 50
    },
    production: {
        port: process.env.PORT || 3000,
        host: '0.0.0.0',
        maxUsers: 500,
        rateLimiting: true
    }
};

const environment = process.env.NODE_ENV || 'development';
module.exports = config[environment];