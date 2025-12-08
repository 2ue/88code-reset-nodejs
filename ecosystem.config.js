module.exports = {
    apps: [{
        name: '88code-reset',
        script: 'src/index.js',
        cwd: __dirname,
        env: {
            NODE_ENV: 'production'
        },
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        error_file: 'logs/pm2-error.log',
        out_file: 'logs/pm2-out.log',
        merge_logs: true
    }]
};
