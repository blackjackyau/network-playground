const express = require('express');
const cors = require('cors');

module.exports = () => {

    const app = express();
    const router = express.Router();
	
	// sets port 8080 to default or unless otherwise specified in the environment
	app.set('port', process.env.PORT || 8888);

    const corsOptions = {
        origin: (origin, callback) => {
            callback(null, true);
        },
        credentials: true,
        maxAge: 3600,
    };

    app.use(cors(corsOptions));
    app.use(express.json())

    app.use((request, response, next) => {
        const requestStart = Date.now();

        let errorMessage = null;
        let body = [];
        request.on("data", chunk => {
            body.push(chunk);
        });
        request.on("end", () => {
            body = Buffer.concat(body).toString();
        });
        request.on("error", error => {
            errorMessage = error.message;
        });

        response.on("finish", () => {

            const { rawHeaders, httpVersion, method, socket, url } = request;
            const { remoteAddress, remoteFamily, _peername } = socket;
            const { statusCode, statusMessage } = response;
            const headers = response.getHeaders();

            console.log({
                timestamp: Date.now(),
                processingTime: Date.now() - requestStart,
                rawHeaders,
                body,
                errorMessage,
                httpVersion,
                method,
                remoteAddress,
                remoteFamily,
                remotePort: _peername.port,
                url,
                response: {
                    statusCode,
                    statusMessage,
                    headers
                }
            }
            );
        });

        next();
    });

    app.use('/api', router);

    router.get('/user', (req, res) => {
        const timeout = req.query.timeout ? req.query.timeout * 1000 : Math.random() * 10000;
        setTimeout(() => {
            res.status(200).json({
                "name": "lalaking",
                "age": 10,
                "lang": req.headers["accept-language"],
                "correlation": req.query.correlation,
                "timeout": timeout,
                "server-identifier": app.get('port')
            })
        }, timeout);

    });

    app.listen(app.get('port'), () => {
        console.log(`Backend server is running at port:${app.get('port')}`);
    });

}